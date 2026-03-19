'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { db } from '@/lib/firebase';
import { apiUrl } from '@/lib/apiBase';
import { 
    doc, updateDoc, arrayUnion, arrayRemove, collection, query, 
    orderBy, onSnapshot, limit, Timestamp, addDoc, writeBatch, 
    getDocs, deleteDoc, getDoc 
} from 'firebase/firestore';
import { requestNotificationPermission, onForegroundMessage } from '@/lib/fcm';
import { useRouter } from 'next/navigation';

export interface NotificationItem {
    id: string;
    noticeId?: string; // Optional for friend requests
    type?: 'notice' | 'friend_request';
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
    deleteNotification: (id: string) => Promise<void>;
    smartCleanup: () => Promise<number>;
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
        // On native Capacitor apps, notifications are handled natively
        // The web Notification API is not relevant
        if (Capacitor.isNativePlatform()) {
            setPermissionStatus('granted');
            return;
        }
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

            // Check if a DIFFERENT user previously used this token on this device
            // This prevents cross-user push notifications when switching accounts
            try {
                const prevOwnerUid = localStorage.getItem('fcm_token_owner');
                
                if (prevOwnerUid && prevOwnerUid !== user.uid) {
                    // Remove the token from the previous user's fcmTokens array
                    console.log(`[Notifications] Transferring FCM token from ${prevOwnerUid} to ${user.uid}`);
                    try {
                        await updateDoc(doc(db, 'students', prevOwnerUid), {
                            fcmTokens: arrayRemove(token),
                        });
                    } catch (removeErr) {
                        // Previous user doc might not exist anymore, that's fine
                        console.warn('[Notifications] Could not remove token from previous user:', removeErr);
                    }
                }

                // Store token for current user
                await updateDoc(doc(db, 'students', user.uid), {
                    fcmTokens: arrayUnion(token),
                });

                // Remember who owns this token on this device
                localStorage.setItem('fcm_token_owner', user.uid);

                // Server-side cleanup: ensure this token isn't on any OTHER user
                // (handles edge cases where localStorage was cleared or multiple switches happened)
                fetch(apiUrl('/api/notifications/cleanup-token'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, ownerUid: user.uid }),
                }).catch(err => console.warn('[Notifications] Token cleanup failed:', err));
                
                setTokenStored(true);
                if (!prevOwnerUid || prevOwnerUid === user.uid) {
                    showToast('Notifications enabled! 🔔');
                } else {
                    showToast('Notifications switched to your account! 🔔');
                }
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
        // On native Capacitor apps, skip web notification permission flow
        if (Capacitor.isNativePlatform()) {
            setPermissionStatus('granted');
            setTokenStored(true);
            return;
        }
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
            } else if (data.type === 'friend_request') {
                showToast(`🤝 ${title}: ${body.substring(0, 60)}`);
            }
        });

        return unsubscribe;
    }, [user, showToast]);

    // Listen for service worker notification clicks (for foreground routing)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.url) {
                const urlStr = event.data.url;
                router.push(urlStr);

                // Dispatch custom events if the user is already on the page
                try {
                    const parsedUrl = new URL(urlStr, window.location.origin);
                    if (parsedUrl.searchParams.has('noticeId')) {
                        window.dispatchEvent(new CustomEvent('open-notice', { 
                            detail: { noticeId: parsedUrl.searchParams.get('noticeId') } 
                        }));
                    } else if (parsedUrl.searchParams.has('chatWith')) {
                        window.dispatchEvent(new CustomEvent('open-chat', { 
                            detail: { chatWith: parsedUrl.searchParams.get('chatWith') } 
                        }));
                    }
                } catch (err) {
                    console.warn('[Notifications] Failed to parse deep link URL', err);
                }
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

    // Mark a specific notification as viewed (by noticeId or specific notif ID)
    const markAsViewed = useCallback(async (noticeIdOrId: string) => {
        if (!user) return;

        // Try to find by noticeId first (traditional behavior)
        let matching = notifications.filter(n => n.noticeId === noticeIdOrId && !n.viewed);
        
        // If not found, try to find by the specific notification document ID
        if (matching.length === 0) {
            matching = notifications.filter(n => n.id === noticeIdOrId && !n.viewed);
        }

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

    // Delete a single notification
    const deleteNotification = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, 'students', user.uid, 'notifications', id));
        } catch (err) {
            console.error('[Notifications] Failed to delete:', err);
        }
    }, [user]);

    // Smart cleanup (remove notifications whose notice is deleted)
    const smartCleanup = useCallback(async () => {
        if (!user || notifications.length === 0) return 0;

        const withNoticeId = notifications.filter(n => n.noticeId);
        if (withNoticeId.length === 0) return 0;

        const noticeIds = Array.from(new Set(withNoticeId.map(n => n.noticeId))) as string[];
        
        // This checks if the source notice still exists
        const statuses = await Promise.all(
            noticeIds.map(async (id) => {
                const snap = await getDoc(doc(db, 'notices', id));
                return { id, exists: snap.exists() };
            })
        );

        const deletedNoticeIds = statuses.filter(s => !s.exists).map(s => s.id);
        if (deletedNoticeIds.length === 0) return 0;

        const batch = writeBatch(db);
        let count = 0;
        notifications.forEach(n => {
            if (n.noticeId && deletedNoticeIds.includes(n.noticeId)) {
                batch.delete(doc(db, 'students', user.uid, 'notifications', n.id));
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
        }
        return count;
    }, [user, notifications]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            permissionStatus,
            requestPermission,
            markAsViewed,
            markAllAsViewed,
            deleteNotification,
            smartCleanup,
            isNotifPanelOpen,
            setNotifPanelOpen,
        }}>
            {children}
        </NotificationContext.Provider>
    );
}
