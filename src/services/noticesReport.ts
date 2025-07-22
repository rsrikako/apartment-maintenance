import { db } from './firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

export interface Notice {
  id: string;
  title: string;
  details: string;
  createdAt: any;
  updatedAt?: any;
  createdBy: string;
}

export async function getNoticesReport(apartmentId: string): Promise<Notice[]> {
  if (!apartmentId) return [];
  const noticesRef = collection(db, 'apartments', apartmentId, 'notices');
  const q = query(noticesRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice));
}
