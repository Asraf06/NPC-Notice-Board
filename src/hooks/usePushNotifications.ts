import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../context/AuthContext';

import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export function usePushNotifications(userProfile: UserProfile | null, router: AppRouterInstance | null) {
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        if (!Capacitor.isNativePlatform() || !userProfile) return;

        const initializePush = async () => {
            try {
                // Request push permissions
                let permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive === 'prompt') {
                    permStatus = await PushNotifications.requestPermissions();
                }

                if (permStatus.receive !== 'granted') {
                    console.warn("Push notification permission not granted");
                    return;
                }

                // Delete any existing default channels to prevent conflicts if we changed them before
                try {
                    const existingChannels = await PushNotifications.listChannels();
                    for (const channel of existingChannels.channels) {
                        try {
                            await PushNotifications.deleteChannel({ id: channel.id });
                        } catch { /* ignore */ }
                    }
                } catch { /* ignore */ }

                // Define Custom Channels
                // They MUST have importance 4/5 for heads-up popups!
                await PushNotifications.createChannel({
                    id: 'notice_default',
                    name: 'Notice Alerts - Default',
                    description: 'Notifications for new notices with default sound',
                    importance: 5,
                    visibility: 1,
                    vibration: true,
                    sound: 'notification_sound.mp3'
                });

                await PushNotifications.createChannel({
                    id: 'notice_alternate',
                    name: 'Notice Alerts - Alternate',
                    description: 'Notifications for new notices with alternate sound',
                    importance: 5,
                    visibility: 1,
                    vibration: true,
                    sound: 'notification_sound_2.mp3'
                });

                await PushNotifications.createChannel({
                    id: 'message_default',
                    name: 'Message Alerts - Default',
                    description: 'Chat messages with default sound',
                    importance: 5,
                    visibility: 1,
                    vibration: true,
                    sound: 'message_sound.mp3'
                });

                await PushNotifications.createChannel({
                    id: 'message_alternate',
                    name: 'Message Alerts - Alternate',
                    description: 'Chat messages with alternate sound',
                    importance: 5,
                    visibility: 1,
                    vibration: true,
                    sound: 'message_sound_2.mp3'
                });

                await PushNotifications.createChannel({
                    id: 'system_default',
                    name: 'System Default',
                    description: 'General system notifications using phone default sound',
                    importance: 5,
                    visibility: 1,
                    vibration: true
                });

                // Add registration listeners
                await PushNotifications.addListener('registration', async (fcmToken) => {
                    console.log('FCM Token received: ', fcmToken.value);
                    setToken(fcmToken.value);

                    // Save token and initialize default settings if missing
                    const updateData: any = {
                        deviceType: 'android',
                    };

                    // Only set default sounds if the user hasn't explicitly set them
                    if (!userProfile.noticeSound) {
                        updateData.noticeSound = 'notice_default';
                    }
                    if (!userProfile.messageSound) {
                        updateData.messageSound = 'message_default';
                    }

                    try {
                        const { arrayUnion } = await import('firebase/firestore');
                        updateData.fcmTokens = arrayUnion(fcmToken.value);
                        await setDoc(doc(db, 'students', userProfile.uid), updateData, { merge: true });
                    } catch (e) {
                        console.error("Token update error: ", e);
                    }
                });

                await PushNotifications.addListener('registrationError', (error) => {
                    console.error('Push Registration Error: ', error);
                });

                await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    console.log('Push received: ', notification);
                });

                await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                    console.log('Push action performed: ', notification);
                    const data = notification.notification.data;
                    if (router && data) {
                        try {
                            if (data.type === 'notice' && data.noticeId) {
                                router.push(`/notices?noticeId=${data.noticeId}`);
                                // Dispatch custom event so the UI updates if already on the page
                                window.dispatchEvent(new CustomEvent('open-notice', { detail: { noticeId: data.noticeId } }));
                            } else if (data.type === 'chat' && data.chatWith) {
                                router.push(`/social/recent?chatWith=${data.chatWith}`);
                                window.dispatchEvent(new CustomEvent('open-chat', { detail: { chatWith: data.chatWith } }));
                            } else if (data.type === 'friend_request') {
                                router.push('/social/friends?view=requests');
                            }
                        } catch (err) {
                            console.error('Routing err:', err);
                        }
                    }
                });

                // Finally register with Apple/Google to receive token
                await PushNotifications.register();
            } catch (error) {
                console.error("Error setting up push notifications:", error);
            }
        };

        initializePush();

        return () => {
            PushNotifications.removeAllListeners();
        };
    }, [userProfile]);

    return { token };
}
