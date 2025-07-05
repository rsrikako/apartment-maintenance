// Migrate Firestore users from phone-number doc IDs to Auth UID doc IDs
// Usage: node scripts/migrateUsersToUid.cjs

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('../serviceAccountKey.json');

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();
const auth = getAuth();

async function migrateUsers() {
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    // Find the Auth user by phone number
    try {
      const userRecord = await auth.getUserByPhoneNumber(data.phone);
      const uid = userRecord.uid;
      // Write to new doc with UID as ID
      await db.collection('users').doc(uid).set(data);
      // Delete old doc
      await doc.ref.delete();
      console.log(`Migrated user ${data.phone} to UID ${uid}`);
    } catch (err) {
      console.error(`Could not migrate user with phone ${data.phone}:`, err.message);
    }
  }
  console.log('Migration complete!');
}

migrateUsers().catch(console.error);
