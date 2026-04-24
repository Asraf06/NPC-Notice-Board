'use client';
import { useState, useEffect } from 'react';
import { CalendarPlus, Loader2, RefreshCw, PartyPopper } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { EventData } from './types';
import EventCard from './EventCard';
import EventForm from './EventForm';
import EventDetail from './EventDetail';

type View = 'list' | 'create' | 'edit' | 'detail';

export default function EventsView() {
    const { userProfile } = useAuth();
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<View>('list');
    const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);

    const isAdmin = userProfile?.role === 'admin';
    const isCR = userProfile?.isCR === true;
    const canCreate = isAdmin || isCR;

    useEffect(() => {
        const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const list: EventData[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as EventData));
            setEvents(list);
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, []);

    // Filter events visible to this user
    const visibleEvents = events.filter(ev => {
        if (isAdmin) return true; // Admin sees all
        if (!ev.isActive && ev.createdByUid !== userProfile?.uid) return false;
        const deptMatch = ev.targetDept === 'all' || ev.targetDept === userProfile?.dept;
        const semMatch = ev.targetSem === 'all' || ev.targetSem === userProfile?.sem;
        const secMatch = ev.targetSection === 'all' || ev.targetSection === userProfile?.section;
        return deptMatch && semMatch && secMatch;
    });

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center py-20 animate-pulse">
                <RefreshCw className="w-12 h-12 mb-4 opacity-20 animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest opacity-30">Loading Events...</p>
            </div>
        );
    }

    if (view === 'create') {
        return <EventForm onBack={() => setView('list')} />;
    }
    if (view === 'edit' && selectedEvent) {
        return <EventForm event={selectedEvent} onBack={() => { setView('list'); setSelectedEvent(null); }} />;
    }
    if (view === 'detail' && selectedEvent) {
        return (
            <EventDetail
                event={selectedEvent}
                onBack={() => { setView('list'); setSelectedEvent(null); }}
                onEdit={() => setView('edit')}
            />
        );
    }

    return (
        <div className="w-full h-full min-h-0 overflow-y-auto custom-scrollbar min-w-0">
            <div className="locomotive-content-wrapper max-w-[1000px] mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none mb-2">Events</h1>
                        <p className="text-xs font-mono font-bold opacity-50 uppercase tracking-widest bg-gray-100 dark:bg-zinc-800 px-3 py-1 inline-block">
                            {userProfile?.dept} — {userProfile?.sem} Semester
                        </p>
                    </div>
                    {canCreate && (
                        <button onClick={() => setView('create')}
                            className="flex items-center gap-2 px-6 py-3 border-2 border-black dark:border-white font-black uppercase text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] active:translate-y-0.5 active:shadow-none">
                            <CalendarPlus className="w-4 h-4" /> Create Event
                        </button>
                    )}
                </div>

                {/* Event List */}
                {visibleEvents.length === 0 ? (
                    <div className="border-4 border-dashed border-black/10 dark:border-white/10 p-12 text-center bg-gray-50 dark:bg-zinc-900/50 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)]">
                        <PartyPopper className="w-16 h-16 mx-auto mb-4 opacity-10" />
                        <h3 className="text-xl font-black uppercase mb-2 tracking-tighter">No Events Yet</h3>
                        <p className="text-sm opacity-50 uppercase tracking-widest">
                            {canCreate ? 'Create the first event for your class!' : 'No events have been created yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {visibleEvents.map(ev => (
                            <EventCard key={ev.id} event={ev}
                                onClick={() => { setSelectedEvent(ev); setView('detail'); }}
                            />
                        ))}
                    </div>
                )}
                <div className="h-20 lg:hidden" />
            </div>
        </div>
    );
}
