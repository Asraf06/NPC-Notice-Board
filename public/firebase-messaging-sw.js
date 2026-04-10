/* eslint-disable no-undef */
// Firebase Messaging Service Worker for Background Notifications
// This file MUST be in public/ root for FCM to work

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyD3bWPCwpzOPhBBUas2Eh9o3MExGR5Tejo',
    authDomain: 'npc-notice-board.firebaseapp.com',
    projectId: 'npc-notice-board',
    storageBucket: 'npc-notice-board.firebasestorage.app',
    messagingSenderId: '529840057304',
    appId: '1:529840057304:web:1fc9097f3e6e98b3ee60ad',
});

const messaging = firebase.messaging();

// Handle background messages (when the PWA tab is not focused)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const data = payload.data || {};
    const notification = payload.notification || {};

    const title = notification.title || data.title || 'NPC Notice Board';
    const body = notification.body || data.body || 'You have a new notification';
    const icon = '/icons/icon-192.png';
    const badge = '/icons/icon-192.png';

    // Build click URL based on notification type
    let clickUrl = '/notices';
    if (data.type === 'notice' && data.noticeId) {
        clickUrl = `/notices?noticeId=${data.noticeId}`;
    } else if (data.type === 'chat' && data.chatWith) {
        clickUrl = `/social/recent?chatWith=${data.chatWith}`;
    } else if (data.type === 'friend_request') {
        clickUrl = '/social/friends?view=requests';
    }

    // Determine unique tag so every notification is physical and distinct
    const uniqueTag = `notif-${data.noticeId || data.chatWith || ''}-${Date.now()}`;

    // If Firebase is already going to show a default notification because
    // payload.notification is present, DO NOT duplicate it here!
    // The backend now sends the correct icons/badges inside webpush config.
    if (payload.notification) {
        return;
    }

    self.registration.showNotification(title, {
        body,
        icon,
        badge,
        tag: uniqueTag,
        data: { url: clickUrl },
        vibrate: [200, 100, 200],
        requireInteraction: true,
        actions: [
            { action: 'open', title: 'Open' },
        ],
    });
});

// Handle notification click — open the deep-link URL
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If a window is already open, focus it and navigate
            for (const client of clientList) {
                if (client.url.includes(self.location.origin)) {
                    client.focus();
                    client.postMessage({ type: 'NOTIFICATION_CLICK', url });
                    return;
                }
            }
            // Otherwise open a new window
            return clients.openWindow(url);
        })
    );
});
