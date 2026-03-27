'use client';

// ============================================
// OFFLINE CACHE MANAGER
// Stores Firestore data in localStorage so the
// APK can serve cached content when offline.
// ============================================

const CACHE_PREFIX = 'npc_offline_';
const CACHE_ENABLED_KEY = 'npc_offline_enabled';

// Cache keys
const KEYS = {
    notices: `${CACHE_PREFIX}notices`,
    categories: `${CACHE_PREFIX}categories`,
    routine: `${CACHE_PREFIX}routine`,
    lastSync: `${CACHE_PREFIX}last_sync`,
} as const;

// ============================================
// Enable / Disable
// ============================================

export function isOfflineCacheEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(CACHE_ENABLED_KEY) === 'true';
}

export function setOfflineCacheEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CACHE_ENABLED_KEY, enabled ? 'true' : 'false');

    // If disabling, clear all cached data
    if (!enabled) {
        clearOfflineCache();
    }
}

// ============================================
// Save data to cache
// ============================================

export function cacheNotices(notices: any[]): void {
    if (!isOfflineCacheEnabled()) return;
    try {
        localStorage.setItem(KEYS.notices, JSON.stringify(notices));
        updateLastSync();
    } catch (e) {
        console.warn('[OfflineCache] Failed to cache notices:', e);
    }
}

export function cacheCategories(categories: any[]): void {
    if (!isOfflineCacheEnabled()) return;
    try {
        localStorage.setItem(KEYS.categories, JSON.stringify(categories));
    } catch (e) {
        console.warn('[OfflineCache] Failed to cache categories:', e);
    }
}

export function cacheRoutine(routineData: any, docId: string): void {
    if (!isOfflineCacheEnabled()) return;
    try {
        const payload = { docId, data: routineData };
        localStorage.setItem(KEYS.routine, JSON.stringify(payload));
        updateLastSync();
    } catch (e) {
        console.warn('[OfflineCache] Failed to cache routine:', e);
    }
}

// ============================================
// Load data from cache
// ============================================

export function getCachedNotices(): any[] | null {
    try {
        const raw = localStorage.getItem(KEYS.notices);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function getCachedCategories(): any[] | null {
    try {
        const raw = localStorage.getItem(KEYS.categories);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function getCachedRoutine(docId: string): any | null {
    try {
        const raw = localStorage.getItem(KEYS.routine);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Only return if it matches the current user's routine doc
        if (parsed.docId === docId) return parsed.data;
        return null;
    } catch {
        return null;
    }
}

// ============================================
// Cache size & management
// ============================================

export function getOfflineCacheSize(): { bytes: number; formatted: string } {
    if (typeof window === 'undefined') return { bytes: 0, formatted: '0 B' };

    let totalBytes = 0;
    const keys = Object.values(KEYS);

    for (const key of keys) {
        const val = localStorage.getItem(key);
        if (val) {
            // Each character in localStorage is 2 bytes (UTF-16)
            totalBytes += val.length * 2;
        }
    }

    // Also count the enabled flag
    const enabledVal = localStorage.getItem(CACHE_ENABLED_KEY);
    if (enabledVal) totalBytes += enabledVal.length * 2;

    return { bytes: totalBytes, formatted: formatBytes(totalBytes) };
}

export function clearOfflineCache(): void {
    if (typeof window === 'undefined') return;
    const keys = Object.values(KEYS);
    for (const key of keys) {
        localStorage.removeItem(key);
    }
}

export function getLastSyncTime(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(KEYS.lastSync);
}

// ============================================
// Online/Offline detection
// ============================================

export function isOnline(): boolean {
    if (typeof window === 'undefined') return true;
    return navigator.onLine;
}

// ============================================
// Helpers
// ============================================

function updateLastSync(): void {
    localStorage.setItem(KEYS.lastSync, new Date().toISOString());
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}
