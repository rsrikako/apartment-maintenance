import React, { useState, useEffect, useRef } from "react";
import { db } from "../services/firebase";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { useApartment } from "../context/ApartmentContext";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = [
  { value: "maintenance", label: "Maintenance", type: "income" },
  { value: "salary", label: "Salary", type: "expense" },
  { value: "utilities", label: "Utilities", type: "expense" },
  { value: "misc", label: "Miscellaneous", type: "expense" },
  { value: "income", label: "Income", type: "income" },
];

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  return { start, end };
}

interface Flat {
  id: string;
  flatNumber: string;
}

interface AuditTxn {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: any;
  createdBy?: string;
  receiptUrl?: string;
  createdAt?: any;
  balance: number;
}

const Financials: React.FC = () => {
  const { selectedApartment } = useApartment();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [form, setForm] = useState<{
    title: string;
    amount: string;
    category: string;
    date: string;
    file: File | null;
  }>({
    title: "",
    amount: "",
    category: "",
    date: "",
    file: null,
  });
  const [showModal, setShowModal] = useState(false);
  // Maintenance modal state
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [selectedFlats, setSelectedFlats] = useState<string[]>([]);
  const [maintMonth, setMaintMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [maintAmount, setMaintAmount] = useState('');
  const [maintLoading, setMaintLoading] = useState(false);
  const [maintError, setMaintError] = useState('');
  const [maintSuccess, setMaintSuccess] = useState('');

  // Fetch flats for maintenance modal
  // Track flats that have already paid for the selected month
  const [flatsPaid, setFlatsPaid] = useState<string[]>([]);
  const [maintRefresh, setMaintRefresh] = useState(0);

  useEffect(() => {
    if (!selectedApartment || !showMaintModal) return;
    setMaintLoading(true);
    (async () => {
      // Fetch all flats
      const flatsSnap = await getDocs(collection(db, 'apartments', selectedApartment, 'flats'));
      setFlats(flatsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Flat)));
      // Fetch flatsPaid for the selected month
      const maintDoc = await getDoc(doc(db, 'apartments', selectedApartment, 'maintenancePayments', maintMonth));
      const paid = maintDoc.exists() && Array.isArray(maintDoc.data()?.flatsPaid) ? maintDoc.data()?.flatsPaid : [];
      setFlatsPaid(paid);
      setMaintLoading(false);
    })();
  }, [selectedApartment, showMaintModal, maintMonth, maintRefresh]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [audit, setAudit] = useState<AuditTxn[]>([]);
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
    (async () => {
      const aptSnap = await getDoc(doc(db, "apartments", selectedApartment));
      const data = aptSnap.data();
      setIsAdmin(!!(data && data.admins && data.admins.includes(user.uid)));
    })();
  }, [selectedApartment, user]);

  // Fetch audit trail for date range
  useEffect(() => {
    if (!selectedApartment) return;
    setLoadingAudit(true);
    (async () => {
      const fromTS = Timestamp.fromDate(new Date(dateRange.from));
      const toTS = Timestamp.fromDate(
        new Date(dateRange.to + "T23:59:59.999Z")
      );
      // Opening balance: balance before first txn in range
      let opening = 0;
      // Get all txns before from date
      const q2 = query(
        collection(db, "apartments", selectedApartment, "expenses"),
        where("date", "<", fromTS)
      );
      const snap2 = await getDocs(q2);
      // Helper: treat these as income, all others as expense
      const isIncomeCategory = (cat: string) => CATEGORIES.filter(c => c.type === 'income').some(c => c.value === cat);
      opening = snap2.docs.reduce((sum, d) => {
        const t = d.data();
        return sum + Number(t.amount) * (isIncomeCategory(t.category) ? 1 : -1);
      }, 0);
      setOpeningBalance(opening);
      const q = query(
        collection(db, "apartments", selectedApartment, "expenses"),
        where("date", ">=", fromTS),
        where("date", "<=", toTS),
        orderBy("date", "asc")
      );
      const snap = await getDocs(q);
      const txns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Compute running balance
      let balance = opening;
      const auditTrail: AuditTxn[] = txns.map((txn: any) => {
        const amt = Number(txn.amount) * (isIncomeCategory(txn.category) ? 1 : -1);
        balance += amt;
        return { ...txn, balance } as AuditTxn;
      });
      setAudit(auditTrail);
      setClosingBalance(balance);
    })().finally(() => setLoadingAudit(false));
  }, [selectedApartment, dateRange]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!selectedApartment) return setError("No apartment selected");
    if (!isAdmin) return setError("Only admins can add expenses/income");
    if (!form.title.trim() || !form.amount || !form.category || !form.date) {
      return setError("All fields are required");
    }
    setSubmitting(true);
    try {
      let receiptUrl = "";
      if (form.file) {
        const storage = getStorage();
        const fileRef = storageRef(
          storage,
          `apartments/${selectedApartment}/receipts/${Date.now()}_${
            form.file.name
          }`
        );
        await uploadBytes(fileRef, form.file);
        receiptUrl = await getDownloadURL(fileRef);
      }
      await addDoc(
        collection(db, "apartments", selectedApartment, "expenses"),
        {
          title: form.title,
          amount: Number(form.amount),
          category: form.category,
          date: new Date(form.date),
          createdBy: user?.uid,
          receiptUrl,
          createdAt: Timestamp.now(),
        }
      );
      setSuccess("Transaction added!");
      setForm({ title: "", amount: "", category: "", date: "", file: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Refresh audit
      setDateRange((r) => ({ ...r }));
    } catch (e: any) {
      setError(e.message || "Failed to add transaction");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete transaction
  const [txnToDelete, setTxnToDelete] = useState<AuditTxn | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteTransaction = async (txn: AuditTxn) => {
    if (!selectedApartment) return;
    setDeleting(true);
    try {
      // Delete from expenses
      await deleteDoc(doc(db, 'apartments', selectedApartment, 'expenses', txn.id));
      // If maintenance, update maintenancePayments
      if (txn.category === 'maintenance') {
        // Try to extract month and flat number from title
        // Example: "Maintenance for 2024-06 by Flat #101"
        const match = txn.title.match(/Maintenance for ([\d-]+) by Flat #(\w+)/);
        if (match) {
          const maintMonth = match[1];
          const flatNumber = match[2];
          // Find the flatId for this flatNumber
          const flatsSnap = await getDocs(
            collection(db, 'apartments', selectedApartment, 'flats')
          );
          const flatDoc = flatsSnap.docs.find(f => f.data().flatNumber == flatNumber);
          if (flatDoc) {
            const flatId = flatDoc.id;
            // Remove flatId from flatsPaid
            const maintDocRef = doc(db, 'apartments', selectedApartment, 'maintenancePayments', maintMonth);
            const maintDocSnap = await getDoc(maintDocRef);
            if (maintDocSnap.exists()) {
              const data = maintDocSnap.data();
              const updatedFlatsPaid = (data.flatsPaid || []).filter((id: string) => id !== flatId);
              await updateDoc(maintDocRef, { flatsPaid: updatedFlatsPaid });
            }
          }
        }
      }
      // Refresh audit
      setDateRange(r => ({ ...r }));
      setTxnToDelete(null);
    } catch (e) {
      setError('Failed to delete transaction');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-6">Financials</h1>
      {/* Add Transaction Form (admin only) */}
      {isAdmin && (
        <div className="mb-8 flex gap-4 flex-wrap">
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-400 text-white px-6 py-3 rounded-full shadow-lg font-semibold text-base hover:from-blue-600 hover:to-blue-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Transaction
          </button>
          <button
            onClick={() => {
              setShowMaintModal(true);
              setMaintSuccess('');
              setMaintError('');
            }}
            className="bg-gradient-to-r from-green-500 to-green-400 text-white px-6 py-3 rounded-full shadow-lg font-semibold text-base hover:from-green-600 hover:to-green-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-300 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h4m0 0V7a4 4 0 00-4-4H7a4 4 0 00-4 4v10a4 4 0 004 4h4" /></svg>
            Maintenance
          </button>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl relative animate-fadeInUp">
                <button
                  className="absolute top-3 right-3 text-gray-400 hover:text-blue-600 text-2xl font-bold focus:outline-none"
                  onClick={() => {
                    setShowModal(false);
                    setError("");
                    setSuccess("");
                  }}
                  aria-label="Close"
                >
                  &times;
                </button>
                <h2 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
                  <svg
                    className="w-6 h-6 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Expense / Income
                </h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-300"
                        value={form.title}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, title: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-300"
                        value={form.amount}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, amount: e.target.value }))
                        }
                        required
                        min="0"
                        step="0.01"
                      />
                    </div>
                   <div>
                        <label className="block text-sm font-medium mb-1">Category</label>
                       <select
                        className="w-full border rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none"
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                        required
                        >
                        <option value="">Select</option>
                        {CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value} className="text-base">
                            {c.label}
                            </option>
                        ))}
                        </select>

                        </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-300"
                        value={form.date}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, date: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">
                        Receipt (optional)
                      </label>
                      <div className="relative flex items-center">
                        <label
                          htmlFor="file-upload"
                          className="cursor-pointer bg-gradient-to-r from-blue-500 to-blue-400 text-white px-4 py-2 rounded-full shadow font-semibold hover:from-blue-600 hover:to-blue-500 transition-all duration-200 flex items-center gap-2"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                            />
                          </svg>
                          {form.file ? form.file.name : "Choose File"}
                        </label>
                        <input
                          id="file-upload"
                          type="file"
                          className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer"
                          ref={fileInputRef}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              file: e.target.files?.[0] || null,
                            }))
                          }
                          accept="image/*,application/pdf"
                          style={form.file ? { pointerEvents: "none" } : {}}
                        />
                        {form.file && (
                          <button
                            type="button"
                            className="ml-3 text-red-500 hover:text-red-700 text-xs font-semibold"
                            onClick={(e) => {
                              e.preventDefault();
                              setForm((f) => ({ ...f, file: null }));
                              if (fileInputRef.current)
                                fileInputRef.current.value = "";
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
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2 rounded-full font-semibold shadow hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-60"
                      disabled={submitting}
                    >
                      {submitting ? "Saving..." : "Add Transaction"}
                    </button>
                    {error && (
                      <span className="text-red-500 text-sm">{error}</span>
                    )}
                    {success && (
                      <span className="text-green-600 text-sm">{success}</span>
                    )}
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
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={dateRange.from}
            onChange={(e) =>
              setDateRange((r) => ({ ...r, from: e.target.value }))
            }
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">To</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={dateRange.to}
            onChange={(e) =>
              setDateRange((r) => ({ ...r, to: e.target.value }))
            }
          />
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
          <div className="font-semibold text-lg">Audit Trail</div>
          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <div className="flex-1 border rounded-2xl shadow-sm p-4 bg-white text-center">
              <div className="text-xs text-gray-500 uppercase mb-1">
                Opening Balance
              </div>
              <div className="text-lg font-bold text-blue-600">
                ₹{openingBalance.toFixed(2)}
              </div>
            </div>

            <div className="flex-1 border rounded-2xl shadow-sm p-4 bg-white text-center">
              <div className="text-xs text-gray-500 uppercase mb-1">
                Closing Balance
              </div>
              <div className="text-lg font-bold text-green-600">
                ₹{closingBalance.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        {loadingAudit ? (
          <div>Loading...</div>
        ) : audit.length === 0 ? (
          <div className="text-gray-500">
            No transactions found for this period.
          </div>
        ) : (
          <div className="grid gap-4">
            {audit.map((txn) => (
              <div
                key={txn.id}
                className="border rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-gray-500">
                    {txn.date && txn.date.toDate
                      ? txn.date.toDate().toLocaleDateString()
                      : new Date(txn.date).toLocaleDateString()}
                  </div>
                  <div
                    className={`font-semibold ${
                      CATEGORIES.filter(c => c.type === 'income').some(c => c.value === txn.category)
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {CATEGORIES.filter(c => c.type === 'income').some(c => c.value === txn.category) ? "+" : "-"}₹
                    {Number(txn.amount).toFixed(2)}
                  </div>
                </div>

                <div className="text-lg font-medium mb-1">{txn.title}</div>

                <div className="flex flex-wrap gap-2 text-sm text-gray-600 mb-2">
                  <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                    {CATEGORIES.find((c) => c.value === txn.category)?.label ||
                      txn.category}
                  </span>
                  <span className="text-gray-500">
                    Balance: ₹{txn.balance.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {txn.receiptUrl ? (
                    <a
                      href={txn.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline text-sm"
                    >
                      View Receipt
                    </a>
                  ) : (
                    <span className="text-gray-400 text-sm">No receipt</span>
                  )}
                  {isAdmin && (
                    <button
                      className="ml-auto p-2 bg-red-100 hover:bg-red-200 rounded-full"
                      title="Delete Transaction"
                      onClick={() => setTxnToDelete(txn)}
                    >
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 011-1h4a1 1 0 011 1m-7 0h8" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    {/* Maintenance Modal (always rendered at top level) */}
    {showMaintModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg relative animate-fadeInUp">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-blue-600 text-2xl font-bold focus:outline-none"
            onClick={() => {
              setShowMaintModal(false);
              setSelectedFlats([]);
              setMaintAmount('');
              setMaintSuccess('');
              setMaintError('');
            }}
            aria-label="Close"
          >
            &times;
          </button>
          <h2 className="text-xl font-bold mb-4 text-green-700 flex items-center gap-2">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h4m0 0V7a4 4 0 00-4-4H7a4 4 0 00-4 4v10a4 4 0 004 4h4" /></svg>
            Maintenance Payment
          </h2>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Month</label>
            <input
              type="month"
              className="border rounded px-3 py-2 w-full"
              value={maintMonth}
              onChange={e => setMaintMonth(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Amount (per flat)</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={maintAmount}
              onChange={e => setMaintAmount(e.target.value)}
              min="0"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Select Flats</label>
            {maintLoading ? (
              <div>Loading flats...</div>
            ) : (
              <div className="max-h-48 overflow-y-auto border rounded p-2 bg-gray-50">
                {flats.filter(flat => !flatsPaid.includes(flat.id)).map(flat => (
                  <label key={flat.id} className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={selectedFlats.includes(flat.id)}
                      onChange={e => {
                        setSelectedFlats(prev =>
                          e.target.checked
                            ? [...prev, flat.id]
                            : prev.filter(id => id !== flat.id)
                        );
                      }}
                    />
                    <span className="text-base">Flat #{flat.flatNumber}</span>
                  </label>
                ))}
                {flats.filter(flat => !flatsPaid.includes(flat.id)).length === 0 && <div className="text-gray-400">All flats have paid for this month.</div>}
              </div>
            )}
          </div>
          {maintError && <div className="text-red-500 mb-2">{maintError}</div>}
          {maintSuccess && <div className="text-green-600 mb-2">{maintSuccess}</div>}
          <div className="flex gap-4 mt-4">
            <button
              className="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700"
              disabled={maintLoading}
              onClick={async () => {
                setMaintError('');
                setMaintSuccess('');
                if (!selectedApartment) return setMaintError('No apartment selected');
                if (!maintMonth) return setMaintError('Please select a month');
                if (!maintAmount) return setMaintError('Please enter amount');
                if (selectedFlats.length === 0) return setMaintError('Select at least one flat');
                setMaintLoading(true);
                try {
                  // Add a transaction for each selected flat
                  await Promise.all(selectedFlats.map(flatId => {
                    const flat = flats.find(f => f.id === flatId);
                    return addDoc(collection(db, 'apartments', selectedApartment, 'expenses'), {
                        title: `Maintenance for ${maintMonth} by Flat #${flat ? flat.flatNumber : flatId}`,
                        amount: Number(maintAmount),
                        category: 'maintenance',
                        date: new Date(),
                        createdBy: user?.uid,
                        createdAt: Timestamp.now(),
                    });
                  }));
                  // Store maintenance payment record for the month (append, deduplicate)
                  const allPaid = Array.from(new Set([...flatsPaid, ...selectedFlats]));
                  await setDoc(doc(db, 'apartments', selectedApartment, 'maintenancePayments', maintMonth), {
                    flatsPaid: allPaid,
                    amount: Number(maintAmount),
                    month: maintMonth,
                    updatedAt: Timestamp.now(),
                  }, { merge: true });
                  setMaintSuccess('Maintenance payments recorded!');
                  setSelectedFlats([]);
                  setMaintAmount('');
                  setMaintRefresh(r => r + 1);
                  setDateRange(r => ({ ...r }));
                } catch (e) {
                  setMaintError('Failed to record maintenance payments');
                }
                setMaintLoading(false);
              }}
            >
              Save
            </button>
            <button
              className="bg-gray-300 text-gray-800 px-6 py-2 rounded font-semibold hover:bg-gray-400"
              onClick={() => {
                setShowMaintModal(false);
                setSelectedFlats([]);
                setMaintAmount('');
                setMaintSuccess('');
                setMaintError('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
  {/* Warning Modal for Delete */}
      {txnToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80 flex flex-col items-center">
            <div className="text-lg font-semibold mb-2 text-red-700">
              Delete Transaction?
            </div>
            <div className="text-gray-700 mb-4 text-center">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </div>
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => setTxnToDelete(null)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                disabled={deleting}
              >Cancel</button>
              <button
                onClick={() => handleDeleteTransaction(txnToDelete!)}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                disabled={deleting}
              >{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Financials;
