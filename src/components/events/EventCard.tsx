'use client';
import { CalendarClock, Users, MapPin, Eye, EyeOff, Clock } from 'lucide-react';
import type { EventData } from './types';

export default function EventCard({ event, onClick }: { event: EventData; onClick: () => void }) {
    const isPast = event.deadline && new Date(event.deadline.split('/').reverse().join('-')) < new Date();
    const targetLabel = [
        event.targetDept === 'all' ? 'All Depts' : event.targetDept,
        event.targetSem === 'all' ? 'All Sems' : event.targetSem,
        event.targetSection === 'all' ? 'All Sections' : event.targetSection,
    ].join(' · ');

    return (
        <button onClick={onClick} className="w-full text-left border-2 border-black dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] hover:translate-y-[-1px] transition-all">
            {/* Header bar */}
            <div className={`flex items-center justify-between px-4 py-2 border-b border-black/10 dark:border-zinc-800 ${event.isActive ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60">
                    {event.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {event.isActive ? 'Active' : 'Hidden'}
                    {isPast && <span className="text-red-500 ml-2">· Deadline passed</span>}
                </div>
                <span className="text-[10px] font-mono opacity-40">{targetLabel}</span>
            </div>
            {/* Body */}
            <div className="flex flex-col md:flex-row gap-4 p-4 md:p-5">
                {event.images && event.images.length > 0 && (
                    <div className="shrink-0 w-full md:w-32 aspect-video md:aspect-square bg-gray-100 dark:bg-zinc-800 border border-black/10 dark:border-zinc-700">
                        <img src={event.images[0].url} className="w-full h-full object-cover" alt="Event Thumbnail" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-lg md:text-xl uppercase tracking-tight mb-2">{event.title}</h3>
                <p className="text-sm opacity-60 line-clamp-2 mb-3">{event.description}</p>
                <div className="flex flex-wrap gap-3 text-xs font-mono opacity-60">
                    {event.date && (
                        <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 border border-gray-200 dark:border-zinc-700 flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" /> {event.date}
                        </span>
                    )}
                    {event.time && (
                        <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 border border-gray-200 dark:border-zinc-700 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {event.time}
                        </span>
                    )}
                    {event.location && (
                        <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 border border-gray-200 dark:border-zinc-700 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {event.location}
                        </span>
                    )}
                    <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 border border-purple-300 dark:border-purple-700 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {event.enrollmentCount || 0} enrolled
                    </span>
                </div>
                </div>
            </div>
        </button>
    );
}
