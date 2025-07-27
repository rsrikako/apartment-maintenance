const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
if (process.env.FUNCTIONS_EMULATOR) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  admin.initializeApp(); // Production: Firebase provides credentials automatically
}

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

exports.sendApartmentPushNotification = onCall(async (request) => {
  try {
    console.log('started sending push notification');
    const { apartmentId, userIds, title, message, clickUrl } = request.data;
    if (!title || !message || (!apartmentId && !userIds)) {
      throw new Error('Missing required fields');
    }
    console.log('started sending push notification1', apartmentId);
    // Get user IDs: either from userIds or all users in apartment
    let targetUserIds = userIds;
    if (!targetUserIds && apartmentId) {
      // Query users with this apartmentId
      const usersSnap = await admin.firestore().collection('users')
        .where('apartments', 'array-contains', apartmentId).get();
      targetUserIds = usersSnap.docs.map(doc => doc.id);
    }
    console.log('started sending push notification2', targetUserIds);

    let tokensToSend = [];
    let userTokenMap = {}; // For token cleanup
    // Fetch FCM tokens for each user, only if notificationsEnabled == true
    for (const uid of targetUserIds) {
      const userDoc = await admin.firestore().collection('users').doc(uid).get();
      const userData = userDoc.data();
      if (userData?.notificationsEnabled) {
        const fcmTokens = userData.fcmTokens || [];
        tokensToSend.push(...fcmTokens);
        userTokenMap[uid] = fcmTokens;
      }
    }
    console.log('started sending push notification3', tokensToSend);
    if (tokensToSend.length === 0) {
      return { result: 'No tokens to send' };
    }

    console.log('Sending notifications to', tokensToSend.length, 'tokens');

    const tokensToRemove = [];

    // Send each notification individually (send() does not support array of tokens)
    for (const token of tokensToSend) {
      try {
        const response = await admin.messaging().send({
          token,
          notification: {
            title,
            body: message
          },
          data: {
            clickUrl: clickUrl || ''
          }
        });

        console.log(`Notification sent to token: ${token} ->`, response);
      } catch (err) {
        console.warn(`Failed to send to token: ${token}`, err.code, err.message);
        // Only remove if it's an unregistered/invalid token
        if (
          err.code === 'messaging/invalid-argument' ||
          err.code === 'messaging/registration-token-not-registered'
        ) {
          tokensToRemove.push(token);
        }
      }
    }

    // Cleanup invalid tokens
    for (const uid of targetUserIds) {
      const tokens = userTokenMap[uid];
      const invalidTokens = tokens?.filter(t => tokensToRemove.includes(t)) || [];
      if (invalidTokens.length > 0) {
        await admin.firestore().collection('users').doc(uid).update({
          fcmTokens: FieldValue.arrayRemove(...invalidTokens)
        });
      }
    }

    return { result: `Notifications sent. Invalid tokens removed: ${tokensToRemove.length}` };
  } catch (err) {
    console.error('Error sending notifications:', err);
    throw new functions.https.HttpsError('internal', 'Failed to send push notifications');
  }
});
