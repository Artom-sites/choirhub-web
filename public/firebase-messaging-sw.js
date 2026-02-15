// Firebase Messaging Service Worker
// This file MUST be in the public folder and named exactly "firebase-messaging-sw.js"

// Try to load Firebase scripts - may fail offline which is OK
try {
    importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

    // Initialize the Firebase app in the service worker
    firebase.initializeApp({
        apiKey: "AIzaSyCPBASol-Zd6dLF3XsRNTUFTMyJMptFJRA",
        authDomain: "choirhub-8bfa2.firebaseapp.com",
        projectId: "choirhub-8bfa2",
        storageBucket: "choirhub-8bfa2.firebasestorage.app",
        messagingSenderId: "536668000416",
        appId: "1:536668000416:web:3a35d3674134409d2eb9c5"
    });

    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message:', payload);

        const notificationTitle = payload.notification?.title || 'ChoirHub';
        const notificationOptions = {
            body: payload.notification?.body || 'Нове повідомлення',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: payload.data?.serviceId || 'default',
            data: {
                url: payload.data?.url || '/',
                serviceId: payload.data?.serviceId
            },
            requireInteraction: true,
            actions: []
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (e) {
    // Offline - Firebase messaging not available
    console.log('[firebase-messaging-sw.js] Firebase scripts failed to load (likely offline):', e.message);
}

// Handle notification click - works even if Firebase failed to load
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification click:', event.notification.tag);

    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    client.postMessage({
                        type: 'NOTIFICATION_CLICK',
                        url: targetUrl
                    });
                    return;
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
