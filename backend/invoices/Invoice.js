
import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
    item: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    amount: { type: Number, required: true, min: 0 }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true },
    invoiceType: { type: String, enum: ['PFI', 'TAX'], required: true },
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
    subtotal: { type: Number, required: true },
    gstRate: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdByRole: { type: String, enum: ['admin', 'sme'], required: true }
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
