// Apartment multi-tenant Firestore seeding script
// Usage: node scripts/seedMultiApartment.cjs

const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function seed() {
  // Example users
  const users = [
    { uid: 'user1', phone: '+911111111111', name: 'Alice', apartments: [], defaultApartment: null },
    { uid: 'user2', phone: '+922222222222', name: 'Bob', apartments: [], defaultApartment: null },
    { uid: 'user3', phone: '+933333333333', name: 'Charlie', apartments: [], defaultApartment: null },
  ];

  // Example apartments
  const apartments = [
    { id: 'apt1', name: 'Sunshine Residency', address: '123 Main St', admins: ['user1'], flats: [] },
    { id: 'apt2', name: 'Green Meadows', address: '456 Park Ave', admins: ['user2'], flats: [] },
  ];

  // Example flats
  const flats = [
    { id: 'A101', number: 'A101', owners: ['user1'], tenants: ['user3'] },
    { id: 'B202', number: 'B202', owners: ['user2'], tenants: [] },
  ];

  // Link users to apartments
  users[0].apartments = ['apt1'];
  users[0].defaultApartment = 'apt1';
  users[1].apartments = ['apt2'];
  users[1].defaultApartment = 'apt2';
  users[2].apartments = ['apt1'];
  users[2].defaultApartment = 'apt1';

  // Add users
  for (const user of users) {
    await db.collection('users').doc(user.uid).set(user);
  }

  // Add apartments and flats
  for (const apt of apartments) {
    const aptRef = db.collection('apartments').doc(apt.id);
    await aptRef.set({ name: apt.name, address: apt.address, admins: apt.admins });
    // Add flats as subcollection
    for (const flat of flats.filter(f => apt.admins.includes(f.owners[0]))) {
      await aptRef.collection('flats').doc(flat.id).set(flat);
    }
  }

  console.log('Multi-apartment seed complete!');
}

seed();
