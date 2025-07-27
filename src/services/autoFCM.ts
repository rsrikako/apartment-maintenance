import { getMessaging, getToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db, app } from './firebase';

export async function autoEnableFCM(userId: string) {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }
    const messaging = getMessaging(app);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    console.log('vapidKey', vapidKey);
    const swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js') || await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (token) {
      // Check if token already exists
      const userDocSnap = await getDoc(doc(db, 'users', userId));
      let tokens: string[] = [];
      if (userDocSnap.exists()) {
        tokens = userDocSnap.data()?.fcmTokens || [];
      }
      if (!tokens.includes(token)) {
        await updateDoc(doc(db, 'users', userId), {
          fcmTokens: arrayUnion(token),
          notificationsEnabled: true,
        });
      } else {
        await updateDoc(doc(db, 'users', userId), {
          notificationsEnabled: true,
        });
      }
    }
  } catch (err) {
    console.error('Auto FCM error', err);
    console.error('Auto FCM error', err);
  }
}
