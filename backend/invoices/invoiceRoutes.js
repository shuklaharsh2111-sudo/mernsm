
import express from 'express';
import mongoose from 'mongoose';
import Invoice, { InvoiceCounter } from './Invoice.js';
import { protect } from '../auth.js';

const router = express.Router();

router.use(protect(['admin', 'operation_manager', 'sme']));

const roundAmount = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const DAY_MS = 24 * 60 * 60 * 1000;

// whole days between two dates (time of day ignored)
const daysBetween = (from, to) => {
    const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
    const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    return Math.round((b - a) / DAY_MS);
};

// simple interest: principal x rate x (days / 365)  or  (days / 30) for a monthly rate
const calcLateInterest = (principal, ratePercent, ratePeriod, days) => {
    const basis = ratePeriod === 'month' ? 30 : 365;
    return roundAmount(principal * (ratePercent / 100) * (days / basis));
};

const fmtInr = (n) => Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
});
const fmtDate = (d) => d.toISOString().slice(0, 10).split('-').reverse().join('/');

// CREATE INVOICE
router.post('/', async (req, res) => {
    try {
        const {
            invoiceType, billTo, primaryPerson, contact, billGstin,
            companyPan, shipTo, shipGstin, sameGstin, issueDate,
            terms, dueDate, notes, items
        } = req.body;

        if (!['PFI', 'TAX'].includes(invoiceType)) {
            return res.status(400).json({ message: 'Invalid invoice type' });
        }

        if (!billTo?.trim()) {
            return res.status(400).json({ message: 'Bill To is required' });
        }

        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json({ message: 'At least one invoice item is required' });
        }

        const cleanItems = [];

        for (const item of items) {
            const amount = Number(item.amount);

            if (!item.item?.trim() || !Number.isFinite(amount) || amount < 0) {
                return res.status(400).json({ message: 'Invalid invoice item or amount' });
            }

            cleanItems.push({
                item: item.item.trim(),
                description: item.description || '',
                amount: roundAmount(amount)
            });
        }

        const subtotal = roundAmount(
            cleanItems.reduce((sum, item) => sum + item.amount, 0)
        );

        const gstRate = invoiceType === 'TAX' ? 18 : 0;
        const gstAmount = roundAmount(subtotal * gstRate / 100);
        const totalAmount = roundAmount(subtotal + gstAmount);

        const counterKey = `${req.user.role}:${req.user.id}:${invoiceType}`;

        const counter = await InvoiceCounter.findOneAndUpdate(
            { key: counterKey },
            { $inc: { sequence: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        const prefix = invoiceType === 'PFI' ? 'PFI' : 'TI';
        const invoiceNumber = `${prefix}-${String(counter.sequence).padStart(4, '0')}`;

        const invoice = await Invoice.create({
            invoiceNumber,
            invoiceType,
            billTo: billTo.trim(),
            primaryPerson,
            contact,
            billGstin,
            companyPan,
            shipTo,
            shipGstin: sameGstin ? billGstin : shipGstin,
            sameGstin: Boolean(sameGstin),
            issueDate: issueDate || new Date(),
            terms,
            dueDate: dueDate || null,
            notes,
            items: cleanItems,
            subtotal,
            gstRate,
            gstAmount,
            totalAmount,
            createdBy: req.user.id,
            createdByRole: req.user.role
        });

        return res.status(201).json({
            message: 'Invoice created successfully',
            invoice
        });
    } catch (error) {
        console.error('Create Invoice Error:', error);
        return res.status(500).json({ message: 'Failed to create invoice' });
    }
});

// CREATE LATE INTEREST INVOICE (against an existing PFI / Tax invoice)
router.post('/late-interest', async (req, res) => {
    try {
        const { refInvoiceId, ratePercent, ratePeriod, principal, toDate, addGst, notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(refInvoiceId)) {
            return res.status(400).json({ message: 'Select the invoice the interest is charged on' });
        }

        const ref = await Invoice.findOne({
            _id: refInvoiceId,
            createdBy: req.user.id,
            createdByRole: req.user.role,
            invoiceType: { $in: ['PFI', 'TAX'] }
        });

        if (!ref) {
            return res.status(404).json({ message: 'Original invoice not found' });
        }

        if (!ref.dueDate) {
            return res.status(400).json({ message: `${ref.invoiceNumber} has no due date, so interest cannot be calculated` });
        }

        const rate = Number(ratePercent);
        const period = ratePeriod === 'month' ? 'month' : 'year';

        if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
            return res.status(400).json({ message: 'Interest rate must be between 0 and 100' });
        }

        const base = principal === undefined || principal === '' || principal === null
            ? ref.totalAmount
            : Number(principal);

        if (!Number.isFinite(base) || base <= 0 || base > ref.totalAmount) {
            return res.status(400).json({
                message: `Amount overdue must be more than 0 and at most ${fmtInr(ref.totalAmount)}`
            });
        }

        const from = new Date(ref.dueDate);
        const to = toDate ? new Date(toDate) : new Date();

        if (Number.isNaN(to.getTime())) {
            return res.status(400).json({ message: 'Invalid interest-till date' });
        }

        const days = daysBetween(from, to);

        if (days <= 0) {
            return res.status(400).json({
                message: `${ref.invoiceNumber} is not overdue on ${fmtDate(to)}`
            });
        }

        const interest = calcLateInterest(base, rate, period, days);

        if (interest <= 0) {
            return res.status(400).json({ message: 'Calculated interest is zero' });
        }

        const gstRate = addGst ? 18 : 0;
        const gstAmount = roundAmount(interest * gstRate / 100);
        const totalAmount = roundAmount(interest + gstAmount);

        const counter = await InvoiceCounter.findOneAndUpdate(
            { key: `${req.user.role}:${req.user.id}:INT` },
            { $inc: { sequence: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        const invoice = await Invoice.create({
            invoiceNumber: `LI-${String(counter.sequence).padStart(4, '0')}`,
            invoiceType: 'INT',
            billTo: ref.billTo,
            primaryPerson: ref.primaryPerson,
            contact: ref.contact,
            billGstin: ref.billGstin,
            companyPan: ref.companyPan,
            shipTo: ref.shipTo,
            shipGstin: ref.shipGstin,
            sameGstin: ref.sameGstin,
            issueDate: new Date(),
            terms: 'Due on Receipt',
            dueDate: null,
            notes: notes || '',
            items: [{
                item: 'Late payment interest',
                description: `On ${ref.invoiceNumber}: Rs ${fmtInr(base)} @ ${rate}% per ${period} for ${days} days (${fmtDate(from)} to ${fmtDate(to)})`,
                amount: interest
            }],
            lateInterest: {
                refInvoiceId: ref._id,
                refInvoiceNumber: ref.invoiceNumber,
                principal: base,
                ratePercent: rate,
                ratePeriod: period,
                fromDate: from,
                toDate: to,
                days,
                interestAmount: interest
            },
            subtotal: interest,
            gstRate,
            gstAmount,
            totalAmount,
            createdBy: req.user.id,
            createdByRole: req.user.role
        });

        return res.status(201).json({
            message: 'Late interest invoice created successfully',
            invoice
        });
    } catch (error) {
        console.error('Create Late Interest Error:', error);
        return res.status(500).json({ message: 'Failed to create late interest invoice' });
    }
});

// GET ALL LOGGED-IN USER INVOICES
router.get('/', async (req, res) => {
    try {
        const invoices = await Invoice.find({
            createdBy: req.user.id,
            createdByRole: req.user.role
        }).sort({ createdAt: -1 });

        return res.json({ invoices });
    } catch (error) {
        console.error('Fetch Invoices Error:', error);
        return res.status(500).json({ message: 'Failed to fetch invoices' });
    }
});

// GET SINGLE INVOICE
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid invoice ID' });
        }

        const invoice = await Invoice.findOne({
            _id: req.params.id,
            createdBy: req.user.id,
            createdByRole: req.user.role
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        return res.json({ invoice });
    } catch (error) {
        console.error('Fetch Invoice Error:', error);
        return res.status(500).json({ message: 'Failed to fetch invoice' });
    }
});

// DELETE INVOICE
router.delete('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid invoice ID' });
        }

        const invoice = await Invoice.findOneAndDelete({
            _id: req.params.id,
            createdBy: req.user.id,
            createdByRole: req.user.role
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        return res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
        console.error('Delete Invoice Error:', error);
        return res.status(500).json({ message: 'Failed to delete invoice' });
    }
});

export default router;
