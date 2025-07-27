import { getFunctions, httpsCallable } from 'firebase/functions';

interface SendPushNotificationParams {
  apartmentId?: string;
  userIds?: string[];
  title: string;
  message: string;
  clickUrl?: string;
}

export async function sendPushNotification({ apartmentId, userIds, title, message, clickUrl }: SendPushNotificationParams) {
  const functions = getFunctions();
  const sendNotification = httpsCallable(functions, 'sendApartmentPushNotification');
  try {
    const response = await sendNotification({ apartmentId, userIds, title, message, clickUrl });
    console.log('Push notification sent successfully:', response);
  } catch (err) {
    console.error('Failed to send push notification:', err);
  }
}
