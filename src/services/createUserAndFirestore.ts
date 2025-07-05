import { getFunctions, httpsCallable } from 'firebase/functions';

// Always use the correct region for callable functions
const functions = getFunctions(undefined, 'us-central1');

export async function createUserAndFirestore(phone: string, name: string, apartments: string[]): Promise<string> {
  // Use only the Firebase callable function API, no custom endpoint
  const createUser = httpsCallable(functions, 'createUserAndFirestore');
  try {
    const result = await createUser({ phone, name, apartments });
    // result.data.uid contains the new user's UID
    return (result.data as { uid: string }).uid;
  } catch (error) {
    // Log the error for debugging
    console.error('Cloud Function error:', error);
    throw error;
  }
}
