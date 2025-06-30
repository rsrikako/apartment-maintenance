import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export interface UserDoc {
  phone: string;
  role: 'admin' | 'owner' | 'tenant';
}

export async function getUserRoleByPhone(phone: string): Promise<UserDoc | null> {
  console.log('[FIRESTORE] Looking up user with phone:', phone);
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phone', '==', phone));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const doc = snap.docs[0].data() as UserDoc;
      console.log('[FIRESTORE] User found:', doc);
      return doc;
    }
    console.log('[FIRESTORE] No user found for phone:', phone);
    return null;
  } catch (err) {
    console.error('[FIRESTORE] Error fetching user:', err);
    return null;
  }
}
