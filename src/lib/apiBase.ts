import { Capacitor } from '@capacitor/core';

/**
 * Returns the correct API base URL.
 * - On the website (Vercel): returns '' (relative path, e.g. /api/...)
 * - On the native Capacitor app: returns the full deployed website URL
 *   so the app calls the live server's API routes.
 */
export function getApiBase(): string {
    if (Capacitor.isNativePlatform()) {
        // Point to your live Vercel deployment
        return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://npcnoticeboard.vercel.app';
    }
    return ''; // relative paths work on the web
}

/**
 * Helper to build a full API URL from a relative path.
 * Usage: apiUrl('/api/notifications/chat')
 */
export function apiUrl(path: string): string {
    return `${getApiBase()}${path}`;
}
