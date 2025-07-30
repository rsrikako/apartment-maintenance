import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, app } from './firebase';

// Call this after login, pass userId
export async function setupFCM(userId: string) {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const messaging = getMessaging(app);
    // Use your VAPID key from Firebase Console
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js') || await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (token) {
      await updateDoc(doc(db, 'users', userId), {
        fcmTokens: arrayUnion(token)
      });
    }
    // Optionally, handle foreground messages
    onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      // You can show a toast or notification here
      // e.g., toast(payload.notification?.title || 'New notification');
      // Or use Notification API
      if (payload.notification) {
        new Notification(payload.notification.title || '', {
          body: payload.notification.body,
          icon: '/icon-512x512.png',
        });
      }
    });
  } catch (err) {
    console.error('FCM setup error', err);
    console.error('FCM setup error', err);
  }
}
