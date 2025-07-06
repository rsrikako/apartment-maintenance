import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { useApartment } from '../context/ApartmentContext';
import { useAuth } from '../context/AuthContext';


const CATEGORIES = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'salary', label: 'Salary' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'misc', label: 'Miscellaneous' },
  { value: 'income', label: 'Income' },
];

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

const Financials: React.FC = () => {
  const { selectedApartment } = useApartment();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: '',
    date: '',
    file: null as File | null,
  });
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [audit, setAudit] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    const { start, end } = getMonthRange();
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  });
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check admin
  useEffect(() => {
    if (!selectedApartment || !user) return;
    // Fetch apartment doc to check admin
    import('firebase/firestore').then(({ doc, getDoc }) => {
      getDoc(doc(db, 'apartments', selectedApartment)).then(snap => {
        const data = snap.data();
        setIsAdmin(!!(data && data.admins && data.admins.includes(user.uid)));
      });
    });
  }, [selectedApartment, user]);

  // Fetch audit trail for date range
  useEffect(() => {
    if (!selectedApartment) return;
    setLoadingAudit(true);
    (async () => {
      const { Timestamp } = await import('firebase/firestore');
      const fromTS = Timestamp.fromDate(new Date(dateRange.from));
      const toTS = Timestamp.fromDate(new Date(dateRange.to + 'T23:59:59.999Z'));
      // Opening balance: balance before first txn in range
      let opening = 0;
      // Get all txns before from date
      const q2 = query(
        collection(db, 'apartments', selectedApartment, 'expenses'),
        where('date', '<', fromTS)
      );
      const snap2 = await getDocs(q2);
      opening = snap2.docs.reduce((sum, d) => {
        const t = d.data();
        return sum + Number(t.amount) * (t.category === 'income' ? 1 : -1);
      }, 0);
        setOpeningBalance(opening);
      const q = query(
        collection(db, 'apartments', selectedApartment, 'expenses'),
        where('date', '>=', fromTS),
        where('date', '<=', toTS),
        orderBy('date', 'asc')
      );
      const snap = await getDocs(q);
      const txns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Compute running balance
      let balance = opening;
      const auditTrail = txns.map(txn => {
        const amt = Number(txn.amount) * (txn.category === 'income' ? 1 : -1);
        balance += amt;
        return { ...txn, balance };
      });
      setAudit(auditTrail);
      setClosingBalance(balance);

    })().finally(() => setLoadingAudit(false));
  }, [selectedApartment, dateRange]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedApartment) return setError('No apartment selected');
    if (!isAdmin) return setError('Only admins can add expenses/income');
    if (!form.title.trim() || !form.amount || !form.category || !form.date) {
      return setError('All fields are required');
    }
    setSubmitting(true);
    try {
      let receiptUrl = '';
      if (form.file) {
        const storage = getStorage();
        const fileRef = storageRef(storage, `apartments/${selectedApartment}/receipts/${Date.now()}_${form.file.name}`);
        await uploadBytes(fileRef, form.file);
        receiptUrl = await getDownloadURL(fileRef);
      }
      await addDoc(collection(db, 'apartments', selectedApartment, 'expenses'), {
        title: form.title,
        amount: Number(form.amount),
        category: form.category,
        date: new Date(form.date),
        createdBy: user.uid,
        receiptUrl,
        createdAt: Timestamp.now(),
      });
      setSuccess('Transaction added!');
      setForm({ title: '', amount: '', category: '', date: '', file: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Refresh audit
      setDateRange(r => ({ ...r }));
    } catch (e: any) {
      setError(e.message || 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Financials</h1>
      {/* Add Transaction Form (admin only) */}
      {isAdmin && (
        <div className="mb-8">
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-400 text-white px-6 py-3 rounded-full shadow-lg font-semibold text-base hover:from-blue-600 hover:to-blue-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Transaction
          </button>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl relative animate-fadeInUp">
                <button
                  className="absolute top-3 right-3 text-gray-400 hover:text-blue-600 text-2xl font-bold focus:outline-none"
                  onClick={() => { setShowModal(false); setError(''); setSuccess(''); }}
                  aria-label="Close"
                >
                  &times;
                </button>
                <h2 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Expense / Income
                </h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Title</label>
                      <input type="text" className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-300" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Amount</label>
                      <input type="number" className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-300" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required min="0" step="0.01" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Category</label>
                      <select className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-300" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required>
                        <option value="">Select</option>
                        {CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date</label>
                      <input type="date" className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-300" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Receipt (optional)</label>
                      <div className="relative flex items-center">
                        <label htmlFor="file-upload" className="cursor-pointer bg-gradient-to-r from-blue-500 to-blue-400 text-white px-4 py-2 rounded-full shadow font-semibold hover:from-blue-600 hover:to-blue-500 transition-all duration-200 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
                          {form.file ? form.file.name : 'Choose File'}
                        </label>
                        <input
                          id="file-upload"
                          type="file"
                          className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer"
                          ref={fileInputRef}
                          onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))}
                          accept="image/*,application/pdf"
                          style={form.file ? { pointerEvents: 'none' } : {}}
                        />
                        {form.file && (
                          <button
                            type="button"
                            className="ml-3 text-red-500 hover:text-red-700 text-xs font-semibold"
                            onClick={e => {
                              e.preventDefault();
                              setForm(f => ({ ...f, file: null }));
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            tabIndex={0}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 items-center mt-2">
                    <button type="submit" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2 rounded-full font-semibold shadow hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-60" disabled={submitting}>{submitting ? 'Saving...' : 'Add Transaction'}</button>
                    {error && <span className="text-red-500 text-sm">{error}</span>}
                    {success && <span className="text-green-600 text-sm">{success}</span>}
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Trail and Balance */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">From</label>
          <input type="date" className="w-full border rounded px-3 py-2" value={dateRange.from} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))} />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">To</label>
          <input type="date" className="w-full border rounded px-3 py-2" value={dateRange.to} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))} />
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
          <div className="font-semibold text-lg">Audit Trail</div>
          <div className="flex gap-6 mt-2 md:mt-0">
            <span className="text-sm text-gray-600">Opening Balance: <span className="font-bold">₹{openingBalance.toFixed(2)}</span></span>
            <span className="text-sm text-gray-600">Closing Balance: <span className="font-bold">₹{closingBalance.toFixed(2)}</span></span>
          </div>
        </div>
        {loadingAudit ? (
          <div>Loading...</div>
        ) : audit.length === 0 ? (
          <div className="text-gray-500">No transactions found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-left">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(txn => (
                  <tr key={txn.id} className="border-b last:border-b-0 hover:bg-blue-50">
                    <td className="px-3 py-2">{txn.date && txn.date.toDate ? txn.date.toDate().toLocaleDateString() : new Date(txn.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{txn.title}</td>
                    <td className="px-3 py-2">{CATEGORIES.find(c => c.value === txn.category)?.label || txn.category}</td>
                    <td className="px-3 py-2 text-right">{txn.category === 'income' ? '+' : '-'}₹{Number(txn.amount).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">₹{txn.balance.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {txn.receiptUrl ? (
                        <a href={txn.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Financials;
