const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

const users = [
  { phone: '+918341334400', role: 'admin' },
  { phone: '+917207734035', role: 'owner' },
  { phone: '+919866859751', role: 'tenant' },
];

async function seedUsers() {
  const batch = db.batch();
  users.forEach((user) => {
    const ref = db.collection('users').doc(user.phone);
    batch.set(ref, user);
  });
  await batch.commit();
  console.log('Seeded users to Firestore!');
}

seedUsers().catch(console.error);
