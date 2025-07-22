import { db } from './firebase';
import { collection, addDoc, deleteDoc, getDocs, doc } from 'firebase/firestore';

export type Category = {
  id: string;
  value: string;
  label: string;
  type: 'income' | 'expense';
};

export async function getCategories(apartmentId: string): Promise<Category[]> {
  if (!apartmentId) return [];
  const snap = await getDocs(collection(db, 'apartments', apartmentId, 'categories'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
}

export async function addCategory(apartmentId: string, category: Omit<Category, 'id'>) {
  if (!apartmentId) return;
  await addDoc(collection(db, 'apartments', apartmentId, 'categories'), category);
}

export async function deleteCategory(apartmentId: string, categoryId: string) {
  if (!apartmentId || !categoryId) return;
  await deleteDoc(doc(db, 'apartments', apartmentId, 'categories', categoryId));
}
