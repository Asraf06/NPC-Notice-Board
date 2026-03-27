'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useRouter } from 'next/navigation';
import { useChat } from '@/context/ChatContext';

/**
 * Handles Android hardware back button in Capacitor.
 * Priority:
 * 1. If a mobile chat overlay is open → close it (return to social sidebar)
 * 2. If there's browser history → navigate back
 * 3. Otherwise → minimize the app
 */
export default function CapacitorBackButton() {
    const router = useRouter();
    const { isMobileChatOpen, closeChat } = useChat();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const handler = App.addListener('backButton', ({ canGoBack }) => {
            // If a chat overlay is open on mobile, close it first
            if (isMobileChatOpen) {
                closeChat();
                return;
            }

            if (canGoBack) {
                router.back();
            } else {
                // On the first page, minimize the app instead of closing
                App.minimizeApp();
            }
        });

        return () => {
            handler.then(h => h.remove());
        };
    }, [router, isMobileChatOpen, closeChat]);

    return null;
}
