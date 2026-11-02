
import express from 'express';
import mongoose from 'mongoose';
import Invoice, { InvoiceCounter } from './Invoice.js';
import { protect } from '../auth.js';

const router = express.Router();

router.use(protect(['admin', 'sme']));

const roundAmount = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

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
