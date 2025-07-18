importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC77ul8fTI1otPz7rB9HLQ5vfP27BgOqu4", // TODO: Replace with your Firebase config
  projectId: "apartment-maintenance-81c7c",
  messagingSenderId: "396157322515",
  appId: "1:396157322515:web:a6946fc576f6847c5246e6"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon-512x512.png',
  });
});
