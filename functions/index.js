const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();

exports.checkUserByPhone = onCall(async (request) => {
  console.log('request.auth:', request.auth);
  const phone = request.data.phone;
  if (!phone) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Phone number is required.'
    );
  }
  const snapshot = await admin
    .firestore()
    .collection('users')
    .where('phone', '==', phone)
    .limit(1)
    .get();

  return snapshot.empty
    ? { exists: false }
    : { exists: true, userId: snapshot.docs[0].id };
});

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

  let userRecord;
  try {
    // Try to get the user by phone number
    userRecord = await admin.auth().getUserByPhoneNumber(phone);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      // User does not exist, so create a new one
      userRecord = await admin.auth().createUser({
        phoneNumber: phone,
        displayName: name,
      });
    } else {
      // Some other error occurred
      throw error;
    }
  }

  // Write Firestore user entry (merge if exists, create if not)
  await admin
    .firestore()
    .collection('users')
    .doc(userRecord.uid)
    .set({ phone, name, apartments }, { merge: true });

  return { uid: userRecord.uid };
});
