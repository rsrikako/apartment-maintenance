import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

export interface UserDoc {
  phone: string;
  role: 'admin' | 'owner' | 'tenant';
}

export async function getUserRoleByPhone(phone: string): Promise<UserDoc | null> {
  console.log('[CLOUD FUNCTION] Looking up user with phone:', phone);
  try {
    const checkUserByPhone = httpsCallable(functions, 'checkUserByPhone');
    const result = await checkUserByPhone({ phone });
    if (result.data && (result.data as any).exists) {
      return { phone, role: 'tenant' } as UserDoc;
    }
    return null;
  } catch (err) {
    console.error('[CLOUD FUNCTION] Error fetching user:', err);
    return null;
  }
}
