'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export interface Holiday {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    type: 'gov' | 'college' | 'exam' | 'emergency';
    timestamp?: any;
}

const CACHE_KEY = 'npc_offline_holidays';

// Simple localStorage helpers (self-contained, no dependency on offlineCache)
function getCachedHolidays(): Holiday[] | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function setCachedHolidays(data: Holiday[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[HolidayCache] Failed to cache:', e);
    }
}

// Helper to hash string ID to number for Capacitor Notifications
function hashStringToNumber(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

export function useHolidays() {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load initial offline cache
        const cached = getCachedHolidays();
        if (cached && cached.length > 0) {
            setHolidays(cached);
            setLoading(false);
        }

        // Listen to live data
        const q = query(collection(db, 'holidays'), orderBy('startDate', 'asc'));
        const unsubscribe = onSnapshot(q, async (snap) => {
            const freshHolidays = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Holiday));
            setHolidays(freshHolidays);
            setLoading(false);
            setCachedHolidays(freshHolidays);
            
            // Re-schedule notifications based on fresh data
            await scheduleHolidayNotifications(freshHolidays);
        }, (err) => {
            console.error("Error fetching holidays:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Request notification permissions on mount (native only)
    useEffect(() => {
        const initPerms = async () => {
            if (typeof window === 'undefined') return;
            try {
                const capMod = '@capaci' + 'tor/core';
                const notifMod = '@capaci' + 'tor/local-notifications';
                const { Capacitor } = await (Function('m', 'return import(m)')(capMod));
                const { LocalNotifications } = await (Function('m', 'return import(m)')(notifMod));
                if (Capacitor.isNativePlatform()) {
                    LocalNotifications.requestPermissions();
                }
            } catch (e) { /* not on native, ignore */ }
        };
        initPerms();
    }, []);

    return { holidays, loading };
}

export async function scheduleHolidayNotifications(holidays: Holiday[]) {
    if (typeof window === 'undefined') return;
    try {
        const { Capacitor } = await import('@capacitor/core');
        const { LocalNotifications } = await import('@capacitor/local-notifications');
    
        if (!Capacitor.isNativePlatform()) return;

        const { display } = await LocalNotifications.checkPermissions();
        if (display !== 'granted') return;

        // Android 8+ requires a Notification Channel to be explicitly created
        try {
            await LocalNotifications.createChannel({
                id: 'npc_holidays',
                name: 'Holiday Alerts',
                description: 'Notifications for upcoming holidays and breaks',
                importance: 5, // High importance
                visibility: 1  // Public visibility
            });
        } catch (e) {
            console.log("Channel creation skipped or failed:", e);
        }

        // Clear existing scheduled holiday notifications to avoid duplicates
        const pending = await LocalNotifications.getPending();
        const holidayPendingList = pending.notifications.filter((n: any) => n.extra?.isHoliday);
        if (holidayPendingList.length > 0) {
            await LocalNotifications.cancel({ notifications: holidayPendingList });
        }

        const now = new Date();
        const notificationsToSchedule: any[] = [];

        // Check user preferences for notifications
        // Default: notify 1 day before at 8:00 AM
        const prefStr = localStorage.getItem('holiday_notification_pref');
        const prefs = prefStr ? JSON.parse(prefStr) : { enabled: true, offsetDays: 1, hour: 8, minute: 0 };

        if (!prefs.enabled) return;

        for (const holiday of holidays) {
            if (!holiday.startDate) continue;
            
            const startDateParts = holiday.startDate.split('-');
            const holidayDate = new Date(
                Number(startDateParts[0]), 
                Number(startDateParts[1]) - 1, 
                Number(startDateParts[2]),
                prefs.hour, prefs.minute, 0
            );

            // Calculate alert date based on preference offset
            const alertDate = new Date(holidayDate);
            alertDate.setDate(alertDate.getDate() - prefs.offsetDays);

            // If the alert date is in the future, schedule it
            if (alertDate > now) {
                let typeText = "Holiday";
                if (holiday.type === 'college') typeText = "College Holiday";
                if (holiday.type === 'exam') typeText = "Exam Break";
                if (holiday.type === 'emergency') typeText = "Emergency Update";

                notificationsToSchedule.push({
                    id: hashStringToNumber(holiday.id),
                    title: `Upcoming ${typeText}: ${holiday.name}`,
                    body: prefs.offsetDays === 0 ? `Today is ${holiday.name}. Enjoy your time!` : `${holiday.name} starts tomorrow!`,
                    extra: { isHoliday: true, holidayId: holiday.id },
                    schedule: { at: alertDate },
                    sound: 'default',
                    channelId: 'npc_holidays'
                });
            }
        }

        if (notificationsToSchedule.length > 0) {
            await LocalNotifications.schedule({ notifications: notificationsToSchedule });
            console.log(`Scheduled ${notificationsToSchedule.length} holiday notifications.`);
        }
    } catch (error) {
        console.error("Failed to schedule holiday notifications", error);
    }
}
