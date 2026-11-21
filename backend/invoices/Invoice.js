
import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
    item: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    amount: { type: Number, required: true, min: 0 }
}, { _id: true });

// Only filled for invoiceType 'INT' (late payment interest invoice)
const lateInterestSchema = new mongoose.Schema({
    refInvoiceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    refInvoiceNumber: { type: String, default: '', trim: true },
    principal: { type: Number, min: 0, default: 0 },
    ratePercent: { type: Number, min: 0, default: 0 },
    ratePeriod: { type: String, enum: ['year', 'month'], default: 'year' },
    fromDate: { type: Date, default: null },
    toDate: { type: Date, default: null },
    days: { type: Number, min: 0, default: 0 },
    interestAmount: { type: Number, min: 0, default: 0 }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true },
    invoiceType: { type: String, enum: ['PFI', 'TAX', 'INT'], required: true },
    billTo: { type: String, required: true, trim: true },
    primaryPerson: { type: String, default: '', trim: true },
    contact: { type: String, default: '', trim: true },
    billGstin: { type: String, default: '', trim: true },
    companyPan: { type: String, default: '', trim: true },
    shipTo: { type: String, default: '', trim: true },
    shipGstin: { type: String, default: '', trim: true },
    sameGstin: { type: Boolean, default: false },
    issueDate: { type: Date, default: Date.now },
    terms: { type: String, default: '' },
    dueDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    items: { type: [invoiceItemSchema], required: true },
    lateInterest: { type: lateInterestSchema, default: undefined },
    subtotal: { type: Number, required: true },
    gstRate: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdByRole: { type: String, enum: ['admin', 'operation_manager', 'sme'], required: true }
}, { timestamps: true });

invoiceSchema.index(
    { createdBy: 1, createdByRole: 1, invoiceNumber: 1 },
    { unique: true }
);

const counterSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    sequence: { type: Number, default: 0 }
});

export const InvoiceCounter = mongoose.models.InvoiceCounter ||
    mongoose.model('InvoiceCounter', counterSchema);

const Invoice = mongoose.models.Invoice ||
    mongoose.model('Invoice', invoiceSchema);

export default Invoice;
