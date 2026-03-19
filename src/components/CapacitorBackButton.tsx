'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useRouter } from 'next/navigation';

/**
 * Handles Android hardware back button in Capacitor.
 * Instead of closing the app, it navigates back through the app's history.
 * Only closes the app if there's no more history (i.e., on the first page).
 */
export default function CapacitorBackButton() {
    const router = useRouter();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const handler = App.addListener('backButton', ({ canGoBack }) => {
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
    }, [router]);

    return null;
}
