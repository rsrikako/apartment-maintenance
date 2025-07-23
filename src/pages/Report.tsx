import React, { useState } from 'react';
import { useApartment } from '../context/ApartmentContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getFinancialReport } from '../services/financialReport';
import { getCategories, Category } from '../services/categoryService';
import { getActivitiesReport } from '../services/activitiesReport';
import { getMaintenanceReport } from '../services/maintenanceReport';
import type { MaintenanceReport } from '../services/maintenanceReport';
import { getNoticesReport } from '../services/noticesReport';
import type { Notice } from '../services/noticesReport';
import type { Activity, Occurrence } from '../services/activitiesReport';

// Placeholder for data fetching hooks/services
// import { useFinancials, useActivities, useMaintenance, useNotices } from '../services/reportData';

const Report: React.FC = () => {
  // Default to previous month (YYYY-MM)
  const getPreviousMonthYYYYMM = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(getPreviousMonthYYYYMM());
  const { selectedApartment } = useApartment();
  const [loading, setLoading] = useState(false);

  // Data state
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [transactions, setTransactions] = useState<{
    id: string;
    title?: string;
    amount: number;
    category: string;
    date: Date | { toDate: () => Date };
    createdBy?: string;
    receiptUrl?: string;
    createdAt?: Date | { toDate: () => Date };
    balance: number;
  }[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceReport | null>(null);
  const [notifications, setNotifications] = useState<Notice[]>([]);
  React.useEffect(() => {
    if (!selectedApartment || !selectedMonth) return;
    setLoading(true);
    Promise.all([
      getFinancialReport(selectedApartment, selectedMonth),
      getActivitiesReport(selectedApartment, selectedMonth),
      getNoticesReport(selectedApartment),
      getMaintenanceReport(selectedApartment, selectedMonth),
      getCategories(selectedApartment),
    ]).then(([fin, acts, notices, maint, cats]) => {
      setOpeningBalance(fin.openingBalance);
      setClosingBalance(fin.closingBalance);
      setTransactions(fin.transactions);
      setActivities(acts);
      setNotifications(notices);
      setMaintenance(maint);
      setCategories(cats);
    }).finally(() => setLoading(false));
  }, [selectedApartment, selectedMonth]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  const generatePDF = () => {
    setLoading(true);
    const doc = new jsPDF();
    doc.setFont('times', 'bold');
    doc.setFontSize(20);
    doc.text('Monthly Apartment Report', 105, 18, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('times', 'normal');
    doc.text(`Month: ${selectedMonth}`, 14, 30);
    doc.text(`Opening Balance: Rs. ${openingBalance}`, 14, 40);
    doc.text(`Closing Balance: Rs. ${closingBalance}`, 14, 50);


    // --- Section Layouts (no cards) ---
    let y = 60;

    // Activities Section
    doc.setFont('times', 'bold');
    doc.setTextColor(33, 76, 135);
    doc.text('Activities', 15, y + 8);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);
    if (activities.length === 0) {
      doc.text('No activities found for this period.', 15, y + 18);
      y += 30;
    } else {
      autoTable(doc, {
        startY: y + 12,
        margin: { left: 15, right: 15 },
        head: [['Activity', 'Frequency', 'Date', 'Status', 'Skip Reason']],
        body: activities.flatMap((a: Activity) =>
          a.occurrences.map((occ: Occurrence) => [
            a.name,
            a.frequency,
            occ.expectedDate?.toDate ? occ.expectedDate.toDate().toLocaleDateString() : '',
            occ.status,
            occ.skipReason || ''
          ])
        ),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [33, 76, 135], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 249, 255] },
        rowPageBreak: 'avoid',
        tableWidth: 180,
      });
      // @ts-expect-error: lastAutoTable is a runtime property added by jspdf-autotable
      y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 12 : y + 45;
    }

    // Maintenance Section
    doc.setFont('times', 'bold');
    doc.setTextColor(16, 108, 56);
    doc.text('Maintenance', 15, y + 8);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);
    if (!maintenance) {
      doc.text('No maintenance data found for this period.', 15, y + 18);
      y += 30;
    } else {
      doc.text(`Total Flats: ${maintenance.totalFlats}`, 15, y + 16);
      doc.text(`Amount per Flat: Rs. ${maintenance.amount}`, 70, y + 16);
      doc.setTextColor(16, 108, 56);
      doc.text(`Paid (${maintenance.paid.length})`, 15, y + 24);
      doc.setTextColor(0, 0, 0);
      maintenance.paid.forEach((flat, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        doc.text(flat, 45 + col * 35, y + 24 + row * 7, { maxWidth: 30 });
      });
      doc.setTextColor(220, 38, 38);
      doc.text(`Unpaid (${maintenance.unpaid.length})`, 15, y + 24 + Math.ceil(maintenance.paid.length / 4) * 7);
      doc.setTextColor(0, 0, 0);
      maintenance.unpaid.forEach((flat, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        doc.text(flat, 45 + col * 35, y + 24 + Math.ceil(maintenance.paid.length / 4) * 7 + row * 7, { maxWidth: 30 });
      });
      y += 24 + (Math.ceil(maintenance.paid.length / 4) + Math.ceil(maintenance.unpaid.length / 4)) * 7 + 12;
    }

    // Notifications Section
    doc.setFont('times', 'bold');
    doc.setTextColor(180, 120, 0);
    doc.text('Notifications', 15, y + 8);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);
    if (notifications.length === 0) {
      doc.text('No notifications found for this period.', 15, y + 18);
      y += 30;
    } else {
      autoTable(doc, {
        startY: y + 12,
        margin: { left: 15, right: 15 },
        head: [['Date', 'Title', 'Details']],
        body: notifications.map(n => [
          n.createdAt && typeof n.createdAt === 'object' && 'toDate' in n.createdAt
            ? n.createdAt.toDate().toLocaleDateString()
            : '',
          n.title,
          n.details
        ]),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [180, 120, 0], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 252, 235] },
        rowPageBreak: 'avoid',
        tableWidth: 180,
      });
      // @ts-expect-error: lastAutoTable is a runtime property added by jspdf-autotable
      y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 12 : y + 45;
    }

    // Transactions Section
    doc.setFont('times', 'bold');
    doc.setTextColor(76, 33, 135);
    doc.text('Transactions', 15, y + 8);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);
    if (transactions.length === 0) {
      doc.text('No transactions found for this period.', 15, y + 18);
    } else {
      autoTable(doc, {
        startY: y + 12,
        margin: { left: 15, right: 15 },
        head: [['Date', 'Category', 'Title/Description', 'Amount', 'Balance']],
        body: transactions.map(t => [
          t.date && typeof t.date === 'object' && 'toDate' in t.date
            ? t.date.toDate().toLocaleDateString()
            : t.date instanceof Date
              ? t.date.toLocaleDateString()
              : '',
          categories.find(c => c.id === t.category)?.label || t.category,
          t.title || '',
          `Rs. ${t.amount}`,
          `Rs. ${t.balance}`
        ]),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [76, 33, 135], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 240, 255] },
        rowPageBreak: 'avoid',
        tableWidth: 180,
      });
    }

    doc.save(`Apartment_Report_${selectedMonth}.pdf`);
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-8 mt-8">
      <h2 className="text-2xl font-bold mb-4">Generate Monthly Report</h2>
      <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
        <input
          type="month"
          value={selectedMonth}
          onChange={handleMonthChange}
          className="border rounded-lg px-4 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={generatePDF}
          disabled={!selectedMonth || loading}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-700 text-white px-6 py-3 rounded-full text-lg font-semibold shadow hover:from-blue-600 hover:to-blue-800 transition disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v4.125A2.625 2.625 0 0116.875 21H7.125A2.625 2.625 0 014.5 18.375V14.25m15 0V8.25m0 6v-6m0 0V5.625A2.625 2.625 0 0016.875 3H7.125A2.625 2.625 0 004.5 5.625V8.25m15 0h-15" />
          </svg>
          Generate PDF
        </button>
      </div>
      <p className="text-gray-500 text-sm">Select a month and generate a professional PDF report including balances, activities, maintenance, notifications, and transactions.</p>
    </div>
  );
};

export default Report;
