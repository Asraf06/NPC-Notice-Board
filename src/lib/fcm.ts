import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import app from './firebase';

let messagingInstance: Messaging | null = null;

/**
 * Get the Firebase Messaging instance (lazy, only in browser + if supported)
 */
async function getMessagingInstance(): Promise<Messaging | null> {
    if (typeof window === 'undefined') return null;
    if (messagingInstance) return messagingInstance;

    const supported = await isSupported();
    if (!supported) {
        console.warn('[FCM] Firebase Messaging is not supported in this browser');
        return null;
    }

    messagingInstance = getMessaging(app);
    return messagingInstance;
}

/**
 * Request notification permission and get FCM token
 * Returns the token string or null if permission denied / not supported
 */
export async function requestNotificationPermission(): Promise<string | null> {
    try {
        if (typeof window === 'undefined') return null;

        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('[FCM] Notifications not supported');
            return null;
        }

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('[FCM] Notification permission denied');
            return null;
        }

        const messaging = await getMessagingInstance();
        if (!messaging) return null;

        // Register service worker for FCM
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.error('[FCM] VAPID key not found in env');
            return null;
        }

        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration,
        });

        console.log('[FCM] Token obtained:', token?.substring(0, 20) + '...');
        return token;
    } catch (error) {
        console.error('[FCM] Error getting token:', error);
        return null;
    }
}

/**
 * Subscribe to foreground messages
 * Returns an unsubscribe function
 */
export function onForegroundMessage(
    callback: (payload: { title: string; body: string; data: Record<string, string> }) => void
): () => void {
    let unsubscribe = () => { };

    getMessagingInstance().then((messaging) => {
        if (!messaging) return;

        unsubscribe = onMessage(messaging, (payload) => {
            console.log('[FCM] Foreground message:', payload);

            const data = payload.data || {};
            const notification = payload.notification || {};

            callback({
                title: notification.title || data.title || 'NPC Notice Board',
                body: notification.body || data.body || 'New notification',
                data: data as Record<string, string>,
            });
        });
    });

    return () => unsubscribe();
}
