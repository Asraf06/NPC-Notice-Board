'use client';

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { WifiOff } from 'lucide-react';
import { isOfflineCacheEnabled } from '@/lib/offlineCache';

/**
 * Shows a small non-intrusive banner when the app is offline on native.
 * Only visible on Capacitor APK with offline cache enabled.
 */
export default function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        if (!Capacitor.isNativePlatform() || !isOfflineCacheEnabled()) return;

        const update = () => setIsOffline(!navigator.onLine);

        // Initial check
        update();

        window.addEventListener('online', update);
        window.addEventListener('offline', update);

        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="bg-amber-500 text-black text-center py-1 px-4 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 z-[200]">
            <WifiOff className="w-3 h-3" />
            <span>Offline Mode — Showing Cached Data</span>
        </div>
    );
}
