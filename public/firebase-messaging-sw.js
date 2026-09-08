// Firebase Cloud Messaging Service Worker
// Must be served from the root scope (/firebase-messaging-sw.js)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Config injected at runtime via ?config=base64 query param or falls back to self.__firebaseConfig
const searchParams = new URLSearchParams(self.location.search);
const configParam = searchParams.get('config');

const firebaseConfig = configParam
  ? JSON.parse(atob(configParam))
  : (self.__firebaseConfig ?? {
      apiKey: 'AIzaSyDQZoNHxHoDpLj-iRkOb3X7PYCRrhca1yU',
      authDomain: 'sophionix-4c1f4.firebaseapp.com',
      projectId: 'sophionix-4c1f4',
      storageBucket: 'sophionix-4c1f4.firebasestorage.app',
      messagingSenderId: '213822458978',
      appId: '1:213822458978:web:1f4fef763490c67399d53b',
    });

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  const { title = 'Sophionix', body = '', icon = '/icons/icon-192.png', data = {} } = payload.notification ?? {};

  self.registration.showNotification(title, {
    body,
    icon,
    badge: '/icons/icon-192.png',
    data: { url: data.url ?? '/', ...data },
  });
});

// Notification click → open/focus app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url === url && 'focus' in c);
      return existing ? existing.focus() : clients.openWindow(url);
    })
  );
});
