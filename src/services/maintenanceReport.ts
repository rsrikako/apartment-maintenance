import { db } from './firebase';
import { collection, getDoc, getDocs, doc } from 'firebase/firestore';

export interface MaintenanceReport {
  paid: string[];
  unpaid: string[];
  totalFlats: number;
  amount: number;
  month: string;
}

export async function getMaintenanceReport(apartmentId: string, month: string): Promise<MaintenanceReport> {
  if (!apartmentId || !month) return { paid: [], unpaid: [], totalFlats: 0, amount: 0, month };
  // Get all flats
  const flatsSnap = await getDocs(collection(db, 'apartments', apartmentId, 'flats'));
  // Use Flat type to help TypeScript understand flatNumber exists
  interface Flat { id: string; flatNumber?: string }
  const allFlats: Flat[] = flatsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Get maintenancePayments doc for the month
  const maintDoc = await getDoc(doc(db, 'apartments', apartmentId, 'maintenancePayments', month));
  const flatsPaid: string[] = maintDoc.exists() && Array.isArray(maintDoc.data()?.flatsPaid) ? maintDoc.data()?.flatsPaid : [];
  const amount = maintDoc.exists() && maintDoc.data()?.amount ? maintDoc.data()?.amount : 0;
  // Paid/unpaid by flat number
  const paid = allFlats.filter(f => flatsPaid.includes(f.id)).map(f => f.flatNumber || f.id);
  const unpaid = allFlats.filter(f => !flatsPaid.includes(f.id)).map(f => f.flatNumber || f.id);
  return {
    paid,
    unpaid,
    totalFlats: allFlats.length,
    amount,
    month,
  };
}
