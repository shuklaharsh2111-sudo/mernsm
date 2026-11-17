import Pdf from './pdf';
import { useEffect, useState } from 'react';
import {
  FileText, Receipt, Plus, Trash2, ChevronDown,
  X, Save, ArrowLeft, Building2, CalendarDays,
  FilePlus2, Eye, Percent, CalendarClock
} from 'lucide-react';
import api from '../api';
import '../styles/invoice.css';
const emptyItem = () => ({
  id: crypto.randomUUID(),
  item: '',
  description: '',
  amount: ''
});

const getToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const initialForm = {
  billTo: '',
  primaryPerson: '',
  contact: '',
  billGstin: '',
  companyPan: '',
  shipTo: '',
  shipGstin: '',
  sameGstin: false,
  issueDate: getToday(),
  terms: 'Due on Receipt',
  dueDate: '',
  notes: '',
  items: [emptyItem()]
};

const formatAmount = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);

const normalizeInvoice = (invoice) => ({
  ...invoice,
  id: invoice._id,
  number: invoice.invoiceNumber,
  type: invoice.invoiceType,
  total: invoice.totalAmount,
  issueDate: invoice.issueDate
    ? String(invoice.issueDate).slice(0, 10)
    : '-',
  dueDate: invoice.dueDate
    ? String(invoice.dueDate).slice(0, 10)
    : '-'
});

const initialLateForm = () => ({
  refId: '',
  ratePercent: '18',
  ratePeriod: 'year',
  principal: '',
  toDate: getToday(),
  addGst: false,
  notes: ''
});

// whole days from `from` to `to` (both YYYY-MM-DD strings)
const daysBetween = (from, to) => {
  if (!from || !to || from === '-' || to === '-') return 0;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
};

// same formula as the backend: simple interest, 365-day year or 30-day month
const calcInterest = (principal, ratePercent, ratePeriod, days) => {
  const basis = ratePeriod === 'month' ? 30 : 365;
  const value = principal * (Number(ratePercent) / 100) * (days / basis);
  return Number.isFinite(value) && value > 0
    ? Math.round((value + Number.EPSILON) * 100) / 100
    : 0;
};

const Invoice = () => {
  const [activeTab, setActiveTab] = useState('PFI');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [invoiceType, setInvoiceType] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [lateForm, setLateForm] = useState(initialLateForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const subtotal = Number(form.items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  ).toFixed(2));

  const gstRate = invoiceType === 'TAX' ? 18 : 0;
  const gstAmount = Number((subtotal * gstRate / 100).toFixed(2));
  const total = Number((subtotal + gstAmount).toFixed(2));

  // ---- late interest calculator (live preview, backend recalculates on save) ----
  const sourceInvoices = invoices.filter(
    inv => (inv.type === 'PFI' || inv.type === 'TAX') && inv.dueDate !== '-'
  );
  const refInvoice = sourceInvoices.find(inv => inv.id === lateForm.refId) || null;
  const lateBase = lateForm.principal !== ''
    ? Number(lateForm.principal)
    : (refInvoice ? Number(refInvoice.total) : 0);
  const lateDays = refInvoice ? daysBetween(refInvoice.dueDate, lateForm.toDate) : 0;
  const lateInterest = refInvoice
    ? calcInterest(lateBase, lateForm.ratePercent, lateForm.ratePeriod, lateDays)
    : 0;
  const lateGst = lateForm.addGst ? Number((lateInterest * 0.18).toFixed(2)) : 0;
  const lateTotal = Number((lateInterest + lateGst).toFixed(2));

  const fetchInvoices = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/invoices');
      const records = response.data?.invoices || [];
      setInvoices(records.map(normalizeInvoice));
    } catch (err) {
      console.error('Fetch invoices error:', err);
      setError(
        err.response?.data?.message ||
        'Unable to load invoices. Please login again or check backend.'
      );
    } finally {
      setLoading(false);
    }
  };
  const handleViewInvoice = async (id) => {
    if (viewingId) return;

    setViewingId(id);
    setError('');

    try {
      const response = await api.get(`/invoices/${id}`);
      const invoice = response.data?.invoice || response.data;

      if (!invoice || !invoice._id) {
        throw new Error('Invoice details not found.');
      }

      setSelectedInvoice(invoice);
    } catch (err) {
      console.error('View invoice error:', err);

      const message =
        err.response?.data?.message ||
        err.message ||
        'Unable to fetch invoice details.';

      setError(message);
      alert(message);
    } finally {
      setViewingId(null);
    }
  };
  useEffect(() => {
    fetchInvoices();
  }, []);

  const updateField = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'billGstin' && prev.sameGstin
        ? { shipGstin: value }
        : {})
    }));
  };

  const updateItem = (id, field, value) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, emptyItem()]
    }));
  };

  const removeItem = (id) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.length > 1
        ? prev.items.filter(item => item.id !== id)
        : prev.items
    }));
  };

  const openForm = (type) => {
    setInvoiceType(type);
    setForm({
      ...initialForm,
      issueDate: getToday(),
      items: [emptyItem()]
    });
    setShowDropdown(false);
    setError('');
  };

  const saveInvoice = async (e) => {
    e.preventDefault();

    if (saving) return;

    if (!form.billTo.trim()) {
      alert('Please enter Bill To company name.');
      return;
    }

    const validItems = form.items.filter(
      item => item.item.trim() && Number(item.amount) >= 0
    );

    if (!validItems.length) {
      alert('Please add at least one valid invoice item.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        invoiceType,
        ...form,
        items: validItems.map(item => ({
          item: item.item.trim(),
          description: item.description || '',
          amount: Number(item.amount) || 0
        }))
      };

      const response = await api.post('/invoices', payload);

      if (!response.data?.invoice) {
        throw new Error('Invoice was not returned by the server.');
      }

      const savedInvoice = normalizeInvoice(response.data.invoice);

      setInvoices(prev => [
        savedInvoice,
        ...prev.filter(item => item.id !== savedInvoice.id)
      ]);

      setActiveTab(invoiceType);
      setInvoiceType('');
      setForm({
        ...initialForm,
        issueDate: getToday(),
        items: [emptyItem()]
      });

      alert(
        response.data.message ||
        `Invoice ${savedInvoice.number} saved successfully!`
      );
    } catch (err) {
      console.error('Save invoice error:', err);

      const message =
        err.response?.data?.message ||
        err.message ||
        'Unable to save invoice.';

      setError(message);
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const openLateForm = (refId = '') => {
    setInvoiceType('INT');
    setLateForm({ ...initialLateForm(), refId });
    setShowDropdown(false);
    setError('');
  };

  const updateLate = (field, value) => {
    setLateForm(prev => ({
      ...prev,
      [field]: value,
      // a different invoice means a different amount: go back to its full total
      ...(field === 'refId' ? { principal: '' } : {})
    }));
  };

  const saveLateInterest = async (e) => {
    e.preventDefault();

    if (saving) return;

    if (!refInvoice) {
      alert('Please select the invoice the interest is charged on.');
      return;
    }

    if (lateDays <= 0) {
      alert(`${refInvoice.number} is not overdue on the selected date.`);
      return;
    }

    if (!(lateBase > 0) || lateBase > Number(refInvoice.total)) {
      alert(`Amount overdue must be more than 0 and at most ${formatAmount(refInvoice.total)}.`);
      return;
    }

    if (!(Number(lateForm.ratePercent) > 0)) {
      alert('Please enter the interest rate.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await api.post('/invoices/late-interest', {
        refInvoiceId: refInvoice.id,
        ratePercent: Number(lateForm.ratePercent),
        ratePeriod: lateForm.ratePeriod,
        principal: lateBase,
        toDate: lateForm.toDate,
        addGst: lateForm.addGst,
        notes: lateForm.notes
      });

      if (!response.data?.invoice) {
        throw new Error('Invoice was not returned by the server.');
      }

      const saved = normalizeInvoice(response.data.invoice);

      setInvoices(prev => [saved, ...prev.filter(item => item.id !== saved.id)]);
      setActiveTab('INT');
      setInvoiceType('');
      setLateForm(initialLateForm());

      alert(response.data.message || `Invoice ${saved.number} saved successfully!`);
    } catch (err) {
      console.error('Save late interest error:', err);

      const message =
        err.response?.data?.message ||
        err.message ||
        'Unable to save late interest invoice.';

      setError(message);
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const today = getToday();

  const filteredInvoices = invoices.filter(
    invoice => invoice.type === activeTab
  );
if (selectedInvoice) {
    return (
        <Pdf
            invoice={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
        />
    );
}
  return (
    <div className="invoice-page">
      <div className="invoice-header">
        <div>
          <h1>Invoice Management</h1>
          <p>Manage your proforma, tax and late interest invoices.</p>
        </div>

        <div className="invoice-add-wrapper">
          <button
            type="button"
            className="invoice-add-btn"
            onClick={() => setShowDropdown(prev => !prev)}
          >
            <Plus size={19} />
            Add Invoice
            <ChevronDown size={17} />
          </button>

          {showDropdown && (
            <div className="invoice-dropdown">
              <button type="button" onClick={() => openForm('PFI')}>
                <FileText size={17} />
                Proforma Invoice
              </button>
              <button type="button" onClick={() => openForm('TAX')}>
                <Receipt size={17} />
                Tax Invoice
              </button>
              <button type="button" onClick={() => openLateForm()}>
                <Percent size={17} />
                Late Interest
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="invoice-tabs">
        <button
          type="button"
          className={activeTab === 'PFI' ? 'active' : ''}
          onClick={() => {
            setActiveTab('PFI');
            setInvoiceType('');
          }}
        >
          <FileText size={18} />
          Proforma Invoice (PFI)
          <span>{invoices.filter(i => i.type === 'PFI').length}</span>
        </button>

        <button
          type="button"
          className={activeTab === 'TAX' ? 'active' : ''}
          onClick={() => {
            setActiveTab('TAX');
            setInvoiceType('');
          }}
        >
          <Receipt size={18} />
          Tax Invoice
          <span>{invoices.filter(i => i.type === 'TAX').length}</span>
        </button>

        <button
          type="button"
          className={activeTab === 'INT' ? 'active' : ''}
          onClick={() => {
            setActiveTab('INT');
            setInvoiceType('');
          }}
        >
          <Percent size={18} />
          Late Interest
          <span>{invoices.filter(i => i.type === 'INT').length}</span>
        </button>
      </div>

      {error && (
        <div className="invoice-error">
          {error}
        </div>
      )}

      {invoiceType === 'INT' ? (
        <form className="invoice-form" onSubmit={saveLateInterest}>
          <div className="invoice-form-header">
            <div>
              <button
                type="button"
                className="invoice-back-btn"
                onClick={() => setInvoiceType('')}
              >
                <ArrowLeft size={17} /> Back to Invoices
              </button>

              <h2>Late Interest Invoice</h2>

              <p>Charge interest on an invoice that was paid late or is still unpaid.</p>
            </div>

            <span className="invoice-type-badge int">LATE INTEREST</span>
          </div>

          <section className="invoice-section">
            <h3><FileText size={19} /> Original Invoice</h3>

            <div className="invoice-grid">
              <div className="invoice-field full-width">
                <label>Invoice *</label>
                <select
                  value={lateForm.refId}
                  onChange={e => updateLate('refId', e.target.value)}
                  required
                >
                  <option value="">Select an invoice</option>
                  {sourceInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.number} · {inv.billTo} · due {inv.dueDate} · {formatAmount(inv.total)}
                    </option>
                  ))}
                </select>
                {sourceInvoices.length === 0 && (
                  <small className="invoice-hint">
                    No invoice with a due date yet. Interest runs from an invoice's due date.
                  </small>
                )}
              </div>

              {refInvoice && (
                <>
                  <div className="invoice-field">
                    <label>Bill To</label>
                    <input value={refInvoice.billTo} disabled />
                  </div>

                  <div className="invoice-field">
                    <label>Due Date</label>
                    <input value={refInvoice.dueDate} disabled />
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="invoice-section">
            <h3><Percent size={19} /> Interest Details</h3>

            <div className="invoice-grid">
              <div className="invoice-field">
                <label>Interest Rate (%) *</label>
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={lateForm.ratePercent}
                  onChange={e => updateLate('ratePercent', e.target.value)}
                  required
                />
              </div>

              <div className="invoice-field">
                <label>Rate Charged</label>
                <select
                  value={lateForm.ratePeriod}
                  onChange={e => updateLate('ratePeriod', e.target.value)}
                >
                  <option value="year">Per year</option>
                  <option value="month">Per month</option>
                </select>
              </div>

              <div className="invoice-field">
                <label>Amount Overdue (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={refInvoice ? String(refInvoice.total) : 'Select an invoice'}
                  value={lateForm.principal}
                  onChange={e => updateLate('principal', e.target.value)}
                  disabled={!refInvoice}
                />
                <small className="invoice-hint">
                  Leave empty for the full invoice amount. Enter less if part was paid.
                </small>
              </div>

              <div className="invoice-field">
                <label>Interest Till *</label>
                <input
                  type="date"
                  value={lateForm.toDate}
                  onChange={e => updateLate('toDate', e.target.value)}
                  required
                />
                <small className="invoice-hint">
                  The date the payment was made, or today if still unpaid.
                </small>
              </div>

              <div className="invoice-field full-width">
                <label className="invoice-checkbox">
                  <input
                    type="checkbox"
                    checked={lateForm.addGst}
                    onChange={e => updateLate('addGst', e.target.checked)}
                  />
                  Add GST (18%) on the interest
                </label>
              </div>

              <div className="invoice-field full-width">
                <label>Notes</label>
                <textarea
                  rows={3}
                  value={lateForm.notes}
                  onChange={e => updateLate('notes', e.target.value)}
                  placeholder="Add any additional notes..."
                />
              </div>
            </div>
          </section>

          <section className="invoice-section">
            <h3><CalendarClock size={19} /> Interest Calculation</h3>

            {!refInvoice ? (
              <p className="invoice-hint">Select an invoice to see the interest.</p>
            ) : lateDays <= 0 ? (
              <p className="invoice-warning">
                {refInvoice.number} was due on {refInvoice.dueDate}, so it is not overdue on{' '}
                {lateForm.toDate || 'the selected date'}. Choose a later "Interest Till" date.
              </p>
            ) : (
              <>
                <p className="invoice-hint">
                  {formatAmount(lateBase)} × {Number(lateForm.ratePercent) || 0}% per{' '}
                  {lateForm.ratePeriod} × {lateDays} days ÷{' '}
                  {lateForm.ratePeriod === 'month' ? '30' : '365'}
                </p>

                <div className="invoice-total-breakdown">
                  <div>
                    <span>Days overdue</span>
                    <strong>{lateDays}</strong>
                  </div>

                  <div>
                    <span>Interest</span>
                    <strong>{formatAmount(lateInterest)}</strong>
                  </div>

                  {lateForm.addGst && (
                    <div>
                      <span>GST (18%)</span>
                      <strong>{formatAmount(lateGst)}</strong>
                    </div>
                  )}

                  <div className="invoice-grand-total">
                    <span>Total Amount</span>
                    <strong>{formatAmount(lateTotal)}</strong>
                  </div>
                </div>
              </>
            )}
          </section>

          <div className="invoice-form-actions">
            <button
              type="button"
              className="invoice-cancel-btn"
              onClick={() => setInvoiceType('')}
              disabled={saving}
            >
              <X size={17} /> Cancel
            </button>

            <button
              type="submit"
              className="invoice-save-btn"
              disabled={saving || !refInvoice || lateDays <= 0 || lateInterest <= 0}
            >
              <Save size={18} />
              {saving ? 'Saving Invoice...' : 'Save Invoice'}
            </button>
          </div>
        </form>
      ) : invoiceType ? (
        <form className="invoice-form" onSubmit={saveInvoice}>
          <div className="invoice-form-header">
            <div>
              <button
                type="button"
                className="invoice-back-btn"
                onClick={() => setInvoiceType('')}
              >
                <ArrowLeft size={17} /> Back to Invoices
              </button>

              <h2>
                {invoiceType === 'PFI'
                  ? 'Proforma Invoice'
                  : 'Tax Invoice'}
              </h2>

              <p>Enter the invoice details below.</p>
            </div>

            <span className={`invoice-type-badge ${invoiceType.toLowerCase()}`}>
              {invoiceType === 'PFI' ? 'PFI' : 'TAX INVOICE'}
            </span>
          </div>

          <section className="invoice-section">
            <h3><Building2 size={19} /> Billing Information</h3>

            <div className="invoice-grid">
              <div className="invoice-field">
                <label>Bill To (Company Name) *</label>
                <input
                  value={form.billTo}
                  onChange={e => updateField('billTo', e.target.value)}
                  placeholder="Enter company name"
                  required
                />
              </div>

              <div className="invoice-field">
                <label>Primary Person</label>
                <input
                  value={form.primaryPerson}
                  onChange={e => updateField('primaryPerson', e.target.value)}
                  placeholder="Enter contact person"
                />
              </div>

              <div className="invoice-field">
                <label>Contact Number</label>
                <input
                  value={form.contact}
                  onChange={e => updateField('contact', e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="invoice-field">
                <label>Bill To GSTIN</label>
                <input
                  value={form.billGstin}
                  onChange={e => updateField('billGstin', e.target.value.toUpperCase())}
                  placeholder="Enter GSTIN"
                  maxLength={15}
                />
              </div>

              <div className="invoice-field">
                <label>Company PAN</label>
                <input
                  value={form.companyPan}
                  onChange={e => updateField('companyPan', e.target.value.toUpperCase())}
                  placeholder="Enter company PAN"
                  maxLength={10}
                />
              </div>
            </div>
          </section>

          <section className="invoice-section">
            <h3><Building2 size={19} /> Shipping Information</h3>

            <div className="invoice-grid">
              <div className="invoice-field full-width">
                <label>Ship To (Address / Company Name)</label>
                <textarea
                  value={form.shipTo}
                  onChange={e => updateField('shipTo', e.target.value)}
                  placeholder="Enter shipping address"
                  rows={3}
                />
              </div>

              <div className="invoice-field">
                <label>Ship To GSTIN</label>
                <input
                  value={form.shipGstin}
                  onChange={e => updateField('shipGstin', e.target.value.toUpperCase())}
                  placeholder="Enter shipping GSTIN"
                  maxLength={15}
                  disabled={form.sameGstin}
                />

                <label className="invoice-checkbox">
                  <input
                    type="checkbox"
                    checked={form.sameGstin}
                    onChange={e => {
                      const checked = e.target.checked;
                      setForm(prev => ({
                        ...prev,
                        sameGstin: checked,
                        shipGstin: checked ? prev.billGstin : ''
                      }));
                    }}
                  />
                  Same as Bill To GSTIN
                </label>
              </div>
            </div>
          </section>

          <section className="invoice-section">
            <h3><CalendarDays size={19} /> Invoice Details</h3>

            <div className="invoice-grid">
              <div className="invoice-field">
                <label>Date of Issue *</label>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={e => updateField('issueDate', e.target.value)}
                  required
                />
              </div>

              <div className="invoice-field">
                <label>Terms</label>
                <select
                  value={form.terms}
                  onChange={e => updateField('terms', e.target.value)}
                >
                  <option>Due on Receipt</option>
                  <option>Net 7 Days</option>
                  <option>Net 15 Days</option>
                  <option>Net 30 Days</option>
                  <option>Net 45 Days</option>
                  <option>Net 60 Days</option>
                </select>
              </div>

              <div className="invoice-field">
                <label>Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => updateField('dueDate', e.target.value)}
                />
              </div>

              <div className="invoice-field full-width">
                <label>Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => updateField('notes', e.target.value)}
                  placeholder="Add any additional notes..."
                />
              </div>
            </div>
          </section>

          <section className="invoice-section">
            <div className="invoice-items-heading">
              <h3><FilePlus2 size={19} /> Items & Pricing</h3>

              <button
                type="button"
                className="invoice-add-item"
                onClick={addItem}
              >
                <Plus size={16} /> Add Item
              </button>
            </div>

            <div className="invoice-items-table">
              <div className="invoice-item-head">
                <span>Item</span>
                <span>Description</span>
                <span>Amount (₹)</span>
                <span></span>
              </div>

              {form.items.map((item, index) => (
                <div className="invoice-item-row" key={item.id}>
                  <input
                    placeholder={`Item ${index + 1}`}
                    value={item.item}
                    onChange={e => updateItem(item.id, 'item', e.target.value)}
                    required={index === 0}
                  />

                  <input
                    placeholder="Enter description"
                    value={item.description}
                    onChange={e => updateItem(item.id, 'description', e.target.value)}
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={item.amount}
                    onChange={e => updateItem(item.id, 'amount', e.target.value)}
                    required
                  />

                  <button
                    type="button"
                    className="invoice-remove-item"
                    onClick={() => removeItem(item.id)}
                    title="Remove item"
                    disabled={form.items.length === 1}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>

            <div className="invoice-total-breakdown">
              <div>
                <span>Subtotal</span>
                <strong>{formatAmount(subtotal)}</strong>
              </div>

              {invoiceType === 'TAX' && (
                <div>
                  <span>GST (18%)</span>
                  <strong>{formatAmount(gstAmount)}</strong>
                </div>
              )}

              <div className="invoice-grand-total">
                <span>Total Amount</span>
                <strong>{formatAmount(total)}</strong>
              </div>
            </div>
          </section>

          <div className="invoice-form-actions">
            <button
              type="button"
              className="invoice-cancel-btn"
              onClick={() => setInvoiceType('')}
              disabled={saving}
            >
              <X size={17} /> Cancel
            </button>

            <button
              type="submit"
              className="invoice-save-btn"
              disabled={saving}
            >
              <Save size={18} />
              {saving ? 'Saving Invoice...' : 'Save Invoice'}
            </button>
          </div>
        </form>
      ) : (
        <div className="invoice-list-section">
          <div className="invoice-list-heading">
            <div>
              <h2>
                {activeTab === 'PFI'
                  ? 'Proforma Invoices'
                  : activeTab === 'TAX'
                    ? 'Tax Invoices'
                    : 'Late Interest Invoices'}
              </h2>
              <p>View and manage your saved invoices.</p>
            </div>

            <span className="invoice-count">
              {filteredInvoices.length} Invoices
            </span>
          </div>

          {loading ? (
            <div className="invoice-empty">
              <h3>Loading Invoices...</h3>
              <p>Please wait while invoices are fetched.</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="invoice-empty">
              <div className="invoice-empty-icon">
                {activeTab === 'PFI'
                  ? <FileText size={32} />
                  : activeTab === 'TAX'
                    ? <Receipt size={32} />
                    : <Percent size={32} />}
              </div>

              <h3>No Invoices Yet</h3>

              <p>
                You haven't created any {activeTab === 'PFI'
                  ? 'proforma'
                  : activeTab === 'TAX'
                    ? 'tax'
                    : 'late interest'} invoices yet.
              </p>

              <button
                type="button"
                className="invoice-add-btn"
                onClick={() => (activeTab === 'INT' ? openLateForm() : openForm(activeTab))}
              >
                <Plus size={18} /> Create Invoice
              </button>
            </div>
          ) : (
            <div className="invoice-table-wrapper">
              <table className="invoice-list-table">
                <thead>
                  <tr>
                    <th>Invoice No.</th>
                    <th>Bill To</th>
                    {activeTab === 'INT' ? (
                      <>
                        <th>Against</th>
                        <th>Days Late</th>
                        <th>Rate</th>
                        <th>Interest</th>
                      </>
                    ) : (
                      <>
                        <th>Issue Date</th>
                        <th>Due Date</th>
                      </>
                    )}
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td><strong>{inv.number}</strong></td>
                      <td>{inv.billTo}</td>
                      {activeTab === 'INT' ? (
                        <>
                          <td>{inv.lateInterest?.refInvoiceNumber || '-'}</td>
                          <td>{inv.lateInterest?.days ?? '-'}</td>
                          <td>
                            {inv.lateInterest
                              ? `${inv.lateInterest.ratePercent}% / ${inv.lateInterest.ratePeriod === 'month' ? 'month' : 'year'}`
                              : '-'}
                          </td>
                          <td>{formatAmount(inv.lateInterest?.interestAmount)}</td>
                        </>
                      ) : (
                        <>
                          <td>{inv.issueDate || '-'}</td>
                          <td>
                            {inv.dueDate || '-'}
                            {inv.dueDate !== '-' && inv.dueDate < today && (
                              <span className="invoice-overdue-tag">Past due</span>
                            )}
                          </td>
                        </>
                      )}
                      <td><strong>{formatAmount(inv.total)}</strong></td>
                      <td>
                        <span className="invoice-saved-tag">
                          Saved
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="invoice-view-btn"
                          onClick={() => handleViewInvoice(inv.id)}
                          disabled={viewingId !== null}
                        >
                          <Eye size={16} />
                          {viewingId === inv.id ? 'Loading...' : 'View'}
                        </button>

                        {activeTab !== 'INT' && inv.dueDate !== '-' && inv.dueDate < today && (
                          <button
                            type="button"
                            className="invoice-view-btn invoice-interest-btn"
                            onClick={() => openLateForm(inv.id)}
                            title="Create a late interest invoice for this invoice"
                          >
                            <Percent size={16} />
                            Late Interest
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Invoice;