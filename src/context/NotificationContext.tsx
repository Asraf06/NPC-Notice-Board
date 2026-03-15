'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, orderBy, onSnapshot, limit, Timestamp, addDoc, writeBatch, getDocs } from 'firebase/firestore';
import { requestNotificationPermission, onForegroundMessage } from '@/lib/fcm';
import { useRouter } from 'next/navigation';

export interface NotificationItem {
    id: string;
    noticeId: string;
    title: string;
    body: string;
    author: string;
    category: string;
    timestamp: Timestamp | { seconds: number };
    viewed: boolean;
}

interface NotificationContextType {
    notifications: NotificationItem[];
    unreadCount: number;
    permissionStatus: NotificationPermission | 'unsupported';
    requestPermission: () => Promise<void>;
    markAsViewed: (noticeId: string) => Promise<void>;
    markAllAsViewed: () => Promise<void>;
    isNotifPanelOpen: boolean;
    setNotifPanelOpen: (open: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
    return ctx;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user, userProfile } = useAuth();
    const { showToast } = useUI();
    const router = useRouter();

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
    const [isNotifPanelOpen, setNotifPanelOpen] = useState(false);
    const [tokenStored, setTokenStored] = useState(false);

    // Check initial permission status
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!('Notification' in window)) {
            setPermissionStatus('unsupported');
            return;
        }
        setPermissionStatus(Notification.permission);
    }, []);

    // Request permission and store FCM token
    const requestPermission = useCallback(async () => {
        if (!user) return;

        const token = await requestNotificationPermission();
        if (token) {
            setPermissionStatus('granted');

            // Store token in Firestore (add to array, supports multiple devices)
            try {
                await updateDoc(doc(db, 'students', user.uid), {
                    fcmTokens: arrayUnion(token),
                });
                setTokenStored(true);
                showToast('Notifications enabled! 🔔');
            } catch (err) {
                console.error('[Notifications] Failed to store FCM token:', err);
            }
        } else {
            setPermissionStatus(Notification.permission);
        }
    }, [user, showToast]);

    // Auto-request permission after login (if not already granted)
    useEffect(() => {
        if (!user || !userProfile || tokenStored) return;
        if (typeof window === 'undefined' || !('Notification' in window)) return;

        // Only auto-request if permission hasn't been decided yet
        if (Notification.permission === 'default') {
            // Delay a bit so the user sees the app first
            const timer = setTimeout(() => {
                requestPermission();
            }, 3000);
            return () => clearTimeout(timer);
        } else if (Notification.permission === 'granted') {
            // Permission already granted, just ensure token is stored
            requestPermission();
        }
    }, [user, userProfile, tokenStored, requestPermission]);

    // Listen to foreground messages
    useEffect(() => {
        if (!user) return;

        const unsubscribe = onForegroundMessage((payload) => {
            const { title, body, data } = payload;

            // Show in-app toast
            if (data.type === 'notice') {
                showToast(`📢 ${title}: ${body.substring(0, 60)}...`);
            } else if (data.type === 'chat') {
                showToast(`💬 ${title}: ${body.substring(0, 60)}`);
            }
        });

        return unsubscribe;
    }, [user, showToast]);

    // Listen for service worker notification clicks (for foreground routing)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.url) {
                router.push(event.data.url);
            }
        };

        navigator.serviceWorker?.addEventListener('message', handler);
        return () => navigator.serviceWorker?.removeEventListener('message', handler);
    }, [router]);

    // Listen to notification history from Firestore (notices only)
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'students', user.uid, 'notifications'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const items: NotificationItem[] = [];
            snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as NotificationItem);
            });
            setNotifications(items);
        }, (error) => {
            console.warn('[Notifications] Could not read notifications:', error.message);
        });

        return () => unsub();
    }, [user]);

    // Unread count
    const unreadCount = notifications.filter(n => !n.viewed).length;

    // Mark a specific notice notification as viewed
    const markAsViewed = useCallback(async (noticeId: string) => {
        if (!user) return;

        // Find all notification items for this notice and mark them viewed
        const matching = notifications.filter(n => n.noticeId === noticeId && !n.viewed);
        if (matching.length === 0) return;

        const batch = writeBatch(db);
        matching.forEach(n => {
            batch.update(doc(db, 'students', user.uid, 'notifications', n.id), {
                viewed: true,
            });
        });

        try {
            await batch.commit();
        } catch (err) {
            console.error('[Notifications] Failed to mark as viewed:', err);
        }
    }, [user, notifications]);

    // Mark all as viewed
    const markAllAsViewed = useCallback(async () => {
        if (!user) return;

        const unread = notifications.filter(n => !n.viewed);
        if (unread.length === 0) return;

        const batch = writeBatch(db);
        unread.forEach(n => {
            batch.update(doc(db, 'students', user.uid, 'notifications', n.id), {
                viewed: true,
            });
        });

        try {
            await batch.commit();
        } catch (err) {
            console.error('[Notifications] Failed to mark all as viewed:', err);
        }
    }, [user, notifications]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            permissionStatus,
            requestPermission,
            markAsViewed,
            markAllAsViewed,
            isNotifPanelOpen,
            setNotifPanelOpen,
        }}>
            {children}
        </NotificationContext.Provider>
    );
}
