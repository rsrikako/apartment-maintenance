// functions/index.js

const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}

// Main callable function – v2 style
exports.createUserAndFirestore = onCall(async (request) => {
  const auth = request.auth;
  console.log('request.auth →', auth);
  console.log('request.data →', request.data);

  if (!auth || !auth.uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Authentication required.'
    );
  }

  const { phone, name, apartments } = request.data;
  if (
    !phone ||
    !name ||
    !apartments ||
    !Array.isArray(apartments) ||
    apartments.length === 0
  ) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Fields phone, name, and a non-empty array of apartments are required.'
    );
  }

  // Check if the caller is an admin of any listed apartment
  let isAdmin = false;
  for (const apartmentId of apartments) {
    const aptDoc = await admin
      .firestore()
      .collection('apartments')
      .doc(apartmentId)
      .get();
    const apt = aptDoc.data();
    console.log(
      'Apartment',
      apartmentId,
      '→ admins:',
      apt?.admins,
      '– caller:',
      auth.uid
    );
    if (apt?.admins?.includes(auth.uid)) {
      isAdmin = true;
      break;
    }
  }
  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only apartment admins can create users.'
    );
  }

  // Create new auth user
  const userRecord = await admin.auth().createUser({
    phoneNumber: phone,
    displayName: name,
  });

  // Write Firestore user entry
  await admin
    .firestore()
    .collection('users')
    .doc(userRecord.uid)
    .set({ phone, name, apartments });

  return { uid: userRecord.uid };
});
