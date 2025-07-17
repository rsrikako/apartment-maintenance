import React, { useEffect, useState } from 'react';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { db } from '../services/firebase';
import { useApartment } from '../context/ApartmentContext';
import { useAuth } from '../context/AuthContext';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

function getCurrentMonthYYYYMM() {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

const Stats: React.FC = () => {
  const { selectedApartment } = useApartment();
  const { user } = useAuth();
  const [month, setMonth] = useState<string>(getCurrentMonthYYYYMM());
  const [expensesData, setExpensesData] = useState<any>(null);
  const [maintenanceData, setMaintenanceData] = useState<any>(null);
  const [activitiesData, setActivitiesData] = useState<any>(null);
  const [totalFlats, setTotalFlats] = useState<number | null>(null);
  const [flatsPieData, setFlatsPieData] = useState<any>(null)
  const [activitiesPieData, setActivitiesPieData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedApartment || !month) return;
    setLoading(true);
    (async () => {
      const { collection, query, where, getDocs, Timestamp, doc, getDoc } = await import('firebase/firestore');
      // Fetch total flats from apartment document
      const flatsColRef = collection(db, 'apartments', selectedApartment, 'flats');
      const flatsSnap = await getDocs(flatsColRef);
      const totalFlats = flatsSnap.size; // or flatsSnap.docs.length
      setTotalFlats(totalFlats);

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
      // Aggregate by category
      const categoryTotals: Record<string, number> = {};
      txns.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount);
      });
      setExpensesData({
        labels: Object.keys(categoryTotals),
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
        const occs = occSnap.docs.map(d => d.data());
        if (occs.length === 0) {
          notCompleted += 1;
        } else if (occs.every(o => o.status === 'completed' || o.status === 'skipped')) {
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
  }, [selectedApartment, month]);

  useEffect(() => {
    console.log('maintenanceData:', maintenanceData, 'totalFlats:', totalFlats);
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
        <h2 className="text-2xl font-bold text-blue-700">Stats for {month}</h2>
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