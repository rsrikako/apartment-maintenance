import React, { useEffect, useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { db } from '../services/firebase';
import { useApartment } from '../context/ApartmentContext';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

function getCurrentMonthYYYYMM() {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

interface ChartData {
  labels: string[];
  datasets: { label?: string; data: number[]; backgroundColor: string[] }[];
}

const Stats: React.FC = () => {
  const { selectedApartment } = useApartment();
  const [month, setMonth] = useState<string>(getCurrentMonthYYYYMM());
  const [expensesData, setExpensesData] = useState<ChartData | null>(null);
  interface MaintenanceData {
    flatsPaid?: string[];
    amount?: number;
    month?: string;
    updatedAt?: unknown;
  }
  interface ActivitiesData {
    total: number;
  }
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData | null>(null);
  const [activitiesData, setActivitiesData] = useState<ActivitiesData | null>(null);
  const [totalFlats, setTotalFlats] = useState<number | null>(null);
  const [flatsPieData, setFlatsPieData] = useState<ChartData | null>(null);
  const [activitiesPieData, setActivitiesPieData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: string; label: string; type: string }[]>([]);

  useEffect(() => {
    if (!selectedApartment) return;
    // Fetch categories from Firestore
    (async () => {
      const { collection, getDocs } = await import('firebase/firestore');
      const catsSnap = await getDocs(collection(db, 'apartments', selectedApartment, 'categories'));
      setCategories(catsSnap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; label: string; type: string })));
    })();
  }, [selectedApartment]);

  useEffect(() => {
    if (!selectedApartment || !month) return;
    setLoading(true);
    (async () => {
      const { collection, query, where, getDocs, Timestamp } = await import('firebase/firestore');
      // Fetch total flats from apartment document
      const flatsColRef = collection(db, 'apartments', selectedApartment, 'flats');
      const flatsSnap = await getDocs(flatsColRef);
      setTotalFlats(flatsSnap.size);

      // Fetch expenses for the month
      const start = new Date(`${month}-01T00:00:00`);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      const fromTS = Timestamp.fromDate(start);
      const toTS = Timestamp.fromDate(end);
      // Expenses
      const q = query(
        collection(db, 'apartments', selectedApartment, 'expenses'),
        where('date', '>=', fromTS),
        where('date', '<=', toTS)
      );
      const snap = await getDocs(q);
      const txns = snap.docs.map(d => d.data());
      // Aggregate by category id
      const categoryTotals: Record<string, number> = {};
      txns.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount);
      });
      // Map category ids to labels for chart
      const labels = Object.keys(categoryTotals).map(catId => {
        const cat = categories.find(c => c.id === catId);
        return cat ? cat.label : catId;
      });
      setExpensesData({
        labels,
        datasets: [{
          label: 'Expenses by Category',
          data: Object.values(categoryTotals),
          backgroundColor: [
            '#60a5fa', '#fbbf24', '#34d399', '#f87171', '#a78bfa', '#f472b6', '#facc15', '#38bdf8'
          ],
        }],
      });
      // Maintenance payments
      const maintSnap = await getDocs(collection(db, 'apartments', selectedApartment, 'maintenancePayments'));
      const maintForMonth = maintSnap.docs.find(d => d.id === month);
      setMaintenanceData(maintForMonth ? maintForMonth.data() : null);
      // Activities
      const actsSnap = await getDocs(collection(db, 'apartments', selectedApartment, 'activities'));
      const acts = actsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActivitiesData({
        total: acts.length,
      });

      // Activities completion pie chart
      let completed = 0;
      let notCompleted = 0;
      for (const act of acts) {
        const occRef = collection(db, 'apartments', selectedApartment, 'activities', act.id, 'occurrences');
        const occQuery = query(
          occRef,
          where('expectedDate', '>=', fromTS),
          where('expectedDate', '<=', toTS)
        );
        const occSnap = await getDocs(occQuery);
        const occs = occSnap.docs.map(d => d.data() as { status?: string });
        if (occs.length === 0) {
          notCompleted += 1;
        } else if (occs.every((o) => o.status === 'completed' || o.status === 'skipped')) {
          completed += 1;
        } else {
          notCompleted += 1;
        }
      }
      setActivitiesPieData({
        labels: ['Completed', 'Not Completed'],
        datasets: [{
          data: [completed, notCompleted],
          backgroundColor: ['#34d399', '#f87171'],
        }],
      });

      setLoading(false);
    })();
  }, [selectedApartment, month, categories]);

  useEffect(() => {
    if (maintenanceData && totalFlats !== null) {
      const paid = maintenanceData.flatsPaid?.length || 0;
      const unpaid = Math.max(totalFlats - paid, 0);
      setFlatsPieData({
        labels: ['Paid', 'Unpaid'],
        datasets: [{
          data: [paid, unpaid],
          backgroundColor: ['#34d399', '#f87171'],
        }],
      });
    } else {
      setFlatsPieData(null);
    }
  }, [maintenanceData, totalFlats]);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading stats...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <label className="flex items-center gap-2">
          <span className="font-medium">Select Month:</span>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border rounded px-2 py-1"
            max={getCurrentMonthYYYYMM()}
          />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Expenses by Category</h3>
          {expensesData ? <Bar data={expensesData} /> : <div>No data</div>}
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Flats Paid vs Total Flats</h3>
          {flatsPieData ? (
            <Pie data={flatsPieData} />
          ) : <div>No data</div>}
          {maintenanceData && totalFlats !== null && (
            <div className="mt-2 text-sm text-gray-600">
              Paid: {maintenanceData.flatsPaid?.length || 0} / {totalFlats}
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:col-span-2">
          <h3 className="font-semibold mb-2">Activities Completion Status</h3>
          {activitiesPieData ? (
            <Pie data={activitiesPieData} />
          ) : <div>No data</div>}
          {activitiesData ? (
            <div className="text-lg mt-2">Total Activities: {activitiesData.total}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Stats;
