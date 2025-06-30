const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Callable function to check if a user exists by phone number
exports.checkUserByPhone = functions.https.onCall(async (data, context) => {
  const phone = data.phone;
  if (!phone) {
    throw new functions.https.HttpsError('invalid-argument', 'Phone number is required');
  }
  const usersRef = admin.firestore().collection('users');
  const snapshot = await usersRef.where('phone', '==', phone).limit(1).get();
  if (snapshot.empty) {
    return { exists: false };
  } else {
    return { exists: true, userId: snapshot.docs[0].id };
  }
});
