import React from 'react';
import { X, Printer } from 'lucide-react';
import '../styles/pdf.css';

const company = {
  name: 'Unstoppable Solutions LLP',
  address: '5th floor, Building-B, 50, Off New Link Rd,\nOpposite Citi Mall, Veera Desai Industrial Estate,\nAndheri West, Mumbai, Maharashtra - 400053',
  udyam: 'UDYAM-MH-18-0344293 (Micro)',
  gstin: '27AAIFU1702D1ZJ',
  pan: 'AAIF1702D',
  email: 'acs@getunstoppable.co.in'
};

const bank = {
  holder: 'Unstoppable Solutions LLP',
  name: 'ICICI Bank',
  account: '101605002937',
  branch: 'Borivali S.V. Road Branch, Mumbai',
  ifsc: 'ICIC0001016'
};

const formatAmount = (amount) =>
  Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB');
};

const Pdf = ({ invoice, onClose }) => {
  if (!invoice) return null;

  const isTaxInvoice = invoice.invoiceType === 'TAX';
  const invoiceTitle = isTaxInvoice ? 'Tax Invoice' : 'Proforma Invoice';
  const invoiceNumber = invoice.invoiceNumber || invoice.number || '-';
  const subtotal = Number(invoice.subtotal || 0);
  const gstAmount = Number(invoice.gstAmount || 0);
  const total = Number(invoice.totalAmount ?? invoice.total ?? subtotal + gstAmount);

  const addressText = (value) => {
    if (!value) return '-';
    if (typeof value === 'object') {
      return Object.values(value).filter(Boolean).join('\n');
    }
    return value;
  };

  return (
    <div className="pdf-view-overlay">
      <div className="pdf-view-toolbar">
        <button onClick={onClose} className="pdf-toolbar-btn">
          <X size={18} /> Close
        </button>
        <button onClick={() => window.print()} className="pdf-toolbar-btn print-btn">
          <Printer size={18} /> Print / Save PDF
        </button>
      </div>

      <div className="pdf-document" id="invoice-print-document">
        <div className="pdf-company-header">
          <img src="/assets/images/logo.png" alt="Unstoppable Solutions Logo" className="pdf-company-logo" />

          <div className="pdf-company-info">
            <h2>{company.name}</h2>
            <p>{company.address}</p>
            <p><strong>UDYAM Reg No.:</strong> {company.udyam}</p>
            <p><strong>GSTIN:</strong> {company.gstin}</p>
            <p><strong>PAN:</strong> {company.pan}</p>
            <p><strong>Email:</strong> {company.email}</p>
          </div>
        </div>

        <div className="pdf-invoice-heading">
          <h1>{invoiceTitle}</h1>
          <h3>{invoiceNumber}</h3>
        </div>

        <div className="pdf-address-grid">
          <div className="pdf-address-box">
            <h3>Bill To</h3>
            <h4>{invoice.billTo || '-'}</h4>
            <p>{addressText(invoice.billToAddress)}</p>
            <p><strong>Primary Person:</strong> {invoice.primaryPerson || '-'}</p>
            <p><strong>Contact:</strong> {invoice.contact || '-'}</p>
            <p><strong>GSTIN:</strong> {invoice.billGstin || '-'}</p>
            <p><strong>PAN:</strong> {invoice.companyPan || '-'}</p>
          </div>

          <div className="pdf-address-box">
            <h3>Ship To</h3>
            <h4>{invoice.shipTo || invoice.billTo || '-'}</h4>
            <p>{addressText(invoice.shipToAddress || invoice.billToAddress)}</p>
            <p><strong>GSTIN:</strong> {invoice.sameGstin ? invoice.billGstin : invoice.shipGstin || '-'}</p>
            <p><strong>PAN:</strong> {invoice.companyPan || '-'}</p>
          </div>
        </div>

        <table className="pdf-date-table">
          <thead>
            <tr>
              <th>Date of Issue</th>
              <th>Terms</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{formatDate(invoice.issueDate)}</td>
              <td>{invoice.terms || 'Due On Receipt'}</td>
              <td>{formatDate(invoice.dueDate)}</td>
            </tr>
          </tbody>
        </table>

        <table className="pdf-items-table">
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Services</th>
              <th>Description</th>
              <th>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, index) => (
              <tr key={item._id || index}>
                <td>{index + 1}</td>
                <td>{item.description || item.service || '-'}</td>
                <td>{item.details || item.category || '-'}</td>
                <td className="pdf-amount">{formatAmount(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pdf-total-section">
          <div className="pdf-total-row">
            <span>Subtotal</span>
            <strong>₹{formatAmount(subtotal)}</strong>
          </div>

          {isTaxInvoice && (
            <div className="pdf-total-row">
              <span>GST ({invoice.gstRate || 18}%)</span>
              <strong>₹{formatAmount(gstAmount)}</strong>
            </div>
          )}

          <div className="pdf-total-row">
            <span>Total</span>
            <strong>₹{formatAmount(total)}</strong>
          </div>

          <div className="pdf-total-row pdf-balance">
            <span>Balance Due</span>
            <strong>₹{formatAmount(total)}</strong>
          </div>
        </div>

        <div className="pdf-words">
          <strong>Total in words:</strong> {invoice.totalInWords || '-'}
        </div>

        <div className="pdf-bank-details">
          <h3>Bank Details</h3>
          <p><strong>Account Holder Name:</strong> {bank.holder}</p>
          <p><strong>Bank Name:</strong> {bank.name}</p>
          <p><strong>Account Number:</strong> {bank.account}</p>
          <p><strong>Branch:</strong> {bank.branch}</p>
          <p><strong>IFSC Code:</strong> {bank.ifsc}</p>
        </div>

        <div className="pdf-thankyou">
          Thank you for doing business with us!
        </div>

        <div className="pdf-signature-section">
          <div className="pdf-signature-images">
            <img src="https://creativemanager.site.je/assets/images/comp-stamp.png" alt="Company Stamp" />
            <img src="https://creativemanager.site.je/assets/images/authorized-signature.png" alt="Authorized Signature" />
          </div>
          <strong>Authorized Signature</strong>
          <p><strong>Mithilesh Kasare</strong></p>
          <p>Operations Manager</p>
        </div>

        <div className="pdf-disclaimer">
          <h4>IMPORTANT NOTICE & DISCLAIMER</h4>
          <p>
            Unstoppable Solutions LLP is registered as a Micro Enterprise under the
            Micro, Small and Medium Enterprises Development (MSMED) Act, 2006
            (Udyam Registration No.: UDYAM-MH-18-0344293). In accordance with
            Sections 15 and 16 of the MSMED Act, 2006, delayed payments beyond
            the applicable statutory timeline shall attract compound interest
            with monthly rests at three times the bank rate notified by the
            Reserve Bank of India, wherever applicable. This document is a
            {isTaxInvoice ? ' Tax Invoice' : ' Proforma Invoice (PI)'} and the
            applicable document shall be issued in accordance with applicable GST laws.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pdf;