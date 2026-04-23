'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, CalendarOff, MapPin, User, Pencil, RefreshCw } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { isOfflineCacheEnabled, cacheRoutine, getCachedRoutine, isOnline } from '@/lib/offlineCache';

import RoutineEditModal from './RoutineEditModal';

interface RoutineSlot {
    time: string;
    subject: string;
    room?: string;
    teacher?: string;
}

interface RoutineData {
    days: string[];
    slots: string[];
    schedule: Record<string, RoutineSlot[]>;
}

const checkIsRunning = (day: string, timeSlot: string, now: Date | null) => {
    if (!now) return false;
    
    const daysMap: Record<number, string> = { 0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT' };
    if (day !== daysMap[now.getDay()]) return false;

    const parts = timeSlot.split(' - ');
    if (parts.length !== 2) return false;
    
    const parseTime = (timeStr: string) => {
        const [hStr, mStr] = timeStr.split(':');
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        // If hour is 01-07, add 12 to make it PM (13-19)
        if (h >= 1 && h <= 7) h += 12;
        return h * 60 + m;
    };

    const startMins = parseTime(parts[0].trim());
    const endMins = parseTime(parts[1].trim());
    const nowMins = now.getHours() * 60 + now.getMinutes();

    return nowMins >= startMins && nowMins < endMins;
};

export default function RoutineView() {
    const { userProfile } = useAuth();
    const [routineData, setRoutineData] = useState<RoutineData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeDay, setActiveDay] = useState<string>('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    const feedRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setCurrentTime(new Date());
        const interval = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!userProfile) return;

        const docId = `${userProfile.section}_${userProfile.dept}_${userProfile.sem}`
            .replace(/\s+/g, '_')
            .toLowerCase();

        // If offline and cache is enabled, load from cache immediately
        if (!isOnline() && isOfflineCacheEnabled()) {
            const cached = getCachedRoutine(docId);
            if (cached) {
                const data = cached as RoutineData;
                if (!data.days) data.days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                if (!data.slots) data.slots = ["09:00 - 09:45", "09:45 - 10:30", "10:30 - 11:15", "11:15 - 12:00", "12:00 - 12:45", "12:45 - 01:30", "01:30 - 02:15"];
                setRoutineData(data);
                const daysMap: Record<number, string> = { 0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT' };
                const today = new Date().getDay();
                const todayName = daysMap[today];
                if (data.days.includes(todayName)) setActiveDay(todayName);
                else setActiveDay(data.days[0]);
                setLoading(false);
            }
        }

        const unsub = onSnapshot(doc(db, 'routines', docId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as RoutineData;
                // Defaults if missing
                if (!data.days) data.days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                if (!data.slots) data.slots = ["09:00 - 09:45", "09:45 - 10:30", "10:30 - 11:15", "11:15 - 12:00", "12:00 - 12:45", "12:45 - 01:30", "01:30 - 02:15"];

                setRoutineData(data);
                if (data.days.length > 0) {
                    const daysMap: Record<number, string> = { 0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT' };
                    const today = new Date().getDay();
                    const todayName = daysMap[today];

                    if (data.days.includes(todayName)) {
                        setActiveDay(todayName);
                    } else if (!activeDay || !data.days.includes(activeDay)) {
                        setActiveDay(data.days[0]);
                    }
                }

                // Save to offline cache if enabled
                if (isOfflineCacheEnabled() && isOnline()) {
                    cacheRoutine(data, docId);
                }
            } else {
                // Prevent wiping out offline cache if Firebase emits empty offline snapshot
                if (!isOnline() && snap.metadata.fromCache) {
                    console.log('[RoutineView] Ignored empty offline snapshot to protect local cache.');
                    return;
                }
                setRoutineData(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("Routine fetch failed:", err);
            // On error (likely offline), try cache
            if (isOfflineCacheEnabled()) {
                const cached = getCachedRoutine(docId);
                if (cached) {
                    setRoutineData(cached as RoutineData);
                }
            }
            setLoading(false);
        });

        return () => unsub();
    }, [userProfile]);

    const isCR = userProfile?.isCR === true;

    return (
        <div ref={feedRef} className="w-full h-full min-h-0 overflow-y-auto custom-scrollbar min-w-0">
            {loading ? (
                <div className="locomotive-content-wrapper flex flex-col items-center justify-center py-20 animate-pulse h-full w-full">
                    <RefreshCw className="w-12 h-12 mb-4 opacity-20 animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest opacity-30">Syncing Schedule...</p>
                </div>
            ) : !routineData ? (
                <div className="locomotive-content-wrapper max-w-4xl mx-auto px-4 py-12">
                    <div className="border-4 border-dashed border-black dark:border-white/20 p-12 text-center bg-gray-50 dark:bg-zinc-900/50 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)]">
                        <CalendarOff className="w-20 h-20 mx-auto mb-6 opacity-10" />
                        <h3 className="text-2xl font-black uppercase mb-2 tracking-tighter">No Active Routine</h3>
                        <p className="text-sm opacity-50 uppercase tracking-widest mb-8">
                            Your Class Representative has not initialized the routine for {userProfile?.dept} - {userProfile?.sem} SEM.
                        </p>
                        {isCR && (
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="px-10 py-4 bg-purple-600 text-white font-black uppercase text-sm border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all"
                            >
                                Initialize Routine
                            </button>
                        )}
                    </div>
                    {isEditModalOpen && (
                        <RoutineEditModal
                            isOpen={isEditModalOpen}
                            onClose={() => setIsEditModalOpen(false)}
                            initialData={null}
                            onSaved={() => { }}
                        />
                    )}
                </div>
            ) : (
                <div className="locomotive-content-wrapper max-w-[1400px] mx-auto px-4 py-8 relative">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
                        <div>
                            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-2">
                                Class Routine
                            </h1>
                            <p className="text-xs font-mono font-bold opacity-50 uppercase tracking-widest bg-gray-100 dark:bg-zinc-800 px-3 py-1 inline-block">
                                {userProfile?.dept} — {userProfile?.sem} SEMESTER
                            </p>
                        </div>

                        {isCR && (
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="flex items-center gap-2 px-6 py-3 border-2 border-black dark:border-white font-black uppercase text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] active:translate-y-0.5 active:shadow-none"
                            >
                                <Pencil className="w-4 h-4" /> Edit Routine
                            </button>
                        )}
                    </div>

                    {/* Desktop Grid View — Days as rows, Times as columns */}
                    <div className="hidden lg:block overflow-x-auto pb-10 custom-scrollbar" data-lenis-prevent>
                        <div
                            className="routine-grid-container"
                            style={{ '--slot-count': routineData.slots.length } as any}
                        >
                            {/* Header Row — DAY label + time slot headers */}
                            <div className="routine-header-cell">DAY</div>
                            {routineData.slots.map(slot => (
                                <div key={slot} className="routine-time-header">{slot}</div>
                            ))}

                            {/* Each day is a row */}
                            {routineData.days.map(day => (
                                <div key={day} className="contents">
                                    <div className="routine-header-cell flex items-center justify-center !text-sm tracking-widest">
                                        {day}
                                    </div>
                                    {routineData.slots.map(slot => {
                                        const classData = routineData.schedule[day]?.find(s => s.time === slot);
                                        if (classData) {
                                            const isActive = checkIsRunning(day, slot, currentTime);
                                            return (
                                                <div key={`${day}-${slot}`} className={`routine-cell group relative ${isActive ? 'ring-2 ring-inset ring-green-500 bg-green-500/5' : ''}`}>
                                                    {isActive && (
                                                        <div className="absolute top-2 right-2 flex w-2.5 h-2.5" title="Class is Live">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                                        </div>
                                                    )}
                                                    <h4 className="font-black text-[13px] uppercase leading-tight mb-2 text-purple-600 dark:text-purple-400 group-hover:underline decoration-2 underline-offset-2">
                                                        {classData.subject}
                                                    </h4>
                                                    <div className="space-y-1.5 opacity-60">
                                                        <div className="flex items-center gap-1.5">
                                                            <MapPin className="w-3.5 h-3.5 text-red-500" />
                                                            <span className="text-[10px] font-bold uppercase truncate">{classData.room || 'TBA'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <User className="w-3.5 h-3.5 text-blue-500" />
                                                            <span className="text-[10px] font-bold uppercase truncate">{classData.teacher || 'STAFF'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div
                                                key={`${day}-${slot}`}
                                                className="border-2 border-black dark:border-zinc-800 opacity-5 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.1)_10px,rgba(0,0,0,0.1)_20px)]"
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mobile Tabbed View */}
                    <div className="lg:hidden w-full">
                        {/* Tabs */}
                        <div className="w-full max-w-[calc(100vw-32px)] overflow-x-auto pb-6 no-scrollbar snap-x touch-pan-x">
                            <div className="flex gap-2 w-max pr-4">
                                {routineData.days.map(day => (
                                    <button
                                        key={day}
                                        onClick={() => setActiveDay(day)}
                                        className={`px-8 py-3 font-black uppercase text-xs shrink-0 snap-start transition-all border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none
                            ${activeDay === day
                                                ? 'bg-black text-white dark:bg-white dark:text-black translate-y-[-2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                                : 'bg-white dark:bg-black opacity-40 translate-y-0'}`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Day Content */}
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {routineData.schedule[activeDay]?.length > 0 ? (
                                routineData.slots.map(slotTime => {
                                    const slot = routineData.schedule[activeDay]?.find(s => s.time === slotTime);
                                    if (!slot) return null;

                                    return (
                                        <div key={slotTime} className={`relative p-6 border-2 transition-all ${checkIsRunning(activeDay, slotTime, currentTime) ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' : 'border-black dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.05)] hover:border-purple-500'}`}>
                                            {checkIsRunning(activeDay, slotTime, currentTime) && (
                                                <div className="absolute top-4 right-4 flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-green-600 dark:text-green-400">Live</span>
                                                    <span className="flex relative w-2.5 h-2.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-mono font-black text-[10px] uppercase border border-purple-200 dark:border-purple-800">
                                                    {slotTime}
                                                </div>
                                            </div>
                                            <h4 className="font-black text-xl leading-tight uppercase mb-4 tracking-tighter">
                                                {slot.subject}
                                            </h4>
                                            <div className="flex flex-wrap gap-6 pt-6 border-t border-gray-100 dark:border-zinc-800/50">
                                                <div className="flex items-center gap-2 opacity-60">
                                                    <MapPin className="w-5 h-5 text-red-500" />
                                                    <span className="text-xs uppercase font-bold tracking-wider">{slot.room || 'TBA'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-60">
                                                    <User className="w-5 h-5 text-blue-500" />
                                                    <span className="text-xs uppercase font-bold tracking-wider">{slot.teacher || 'FACULTY'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-24 text-center border-2 border-dashed border-black/10 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-zinc-900/20">
                                    <p className="opacity-10 font-black uppercase text-2xl tracking-[0.2em]">
                                        — NO CLASSES —
                                    </p>
                                    <p className="text-[10px] font-bold uppercase opacity-30 mt-4 tracking-widest">Enjoy your holiday!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {isEditModalOpen && (
                        <RoutineEditModal
                            isOpen={isEditModalOpen}
                            onClose={() => setIsEditModalOpen(false)}
                            initialData={routineData}
                            onSaved={() => { }}
                        />
                    )}

                    <div className="h-20 lg:hidden" />
                </div>
            )}
        </div>
    );
}
