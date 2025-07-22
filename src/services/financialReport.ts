import { db } from './firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';

export const CATEGORIES = [
  { value: "maintenance", label: "Maintenance", type: "income" },
  { value: "salary", label: "Salary", type: "expense" },
  { value: "utilities", label: "Utilities", type: "expense" },
  { value: "misc", label: "Miscellaneous", type: "expense" },
  { value: "income", label: "Income", type: "income" },
];

export function getMonthRange(date = new Date()) {
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

export async function getFinancialReport(apartmentId: string, month: string) {
  if (!apartmentId || !month) return { openingBalance: 0, closingBalance: 0, transactions: [] };
  const [year, m] = month.split('-');
  const from = new Date(Number(year), Number(m) - 1, 1);
  const to = new Date(Number(year), Number(m), 0, 23, 59, 59, 999);
  const fromTS = Timestamp.fromDate(from);
  const toTS = Timestamp.fromDate(to);
  // Opening balance: balance before first txn in range
  let opening = 0;
  // Get all txns before from date
  const q2 = query(
    collection(db, "apartments", apartmentId, "expenses"),
    where("date", "<", fromTS)
  );
  const snap2 = await getDocs(q2);
  const isIncomeCategory = (cat: string) => CATEGORIES.filter(c => c.type === 'income').some(c => c.value === cat);
  opening = snap2.docs.reduce((sum, d) => {
    const t = d.data();
    return sum + Number(t.amount) * (isIncomeCategory(t.category) ? 1 : -1);
  }, 0);
  // Get txns in range
  const q = query(
    collection(db, "apartments", apartmentId, "expenses"),
    where("date", ">=", fromTS),
    where("date", "<=", toTS),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  const txns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Compute running balance
  let balance = opening;
  const transactions = txns.map((txn: any) => {
    const amt = Number(txn.amount) * (isIncomeCategory(txn.category) ? 1 : -1);
    balance += amt;
    return { ...txn, balance };
  });
  return {
    openingBalance: opening,
    closingBalance: balance,
    transactions,
  };
}
