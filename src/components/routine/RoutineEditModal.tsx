'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import RoutinePromptModal from './RoutinePromptModal';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import { useRef } from 'react';

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

interface RoutineEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: RoutineData | null;
    onSaved: () => void;
}

export default function RoutineEditModal({ isOpen, onClose, initialData, onSaved }: RoutineEditModalProps) {
    const { userProfile } = useAuth();
    const { showAlert, showToast } = useUI();
    const [localData, setLocalData] = useState<RoutineData>({
        days: initialData?.days || ['SUN', 'MON', 'TUE', 'WED', 'THU'],
        slots: initialData?.slots || ["09:00 - 10:00", "10:00 - 11:00", "11:20 - 12:20", "12:20 - 01:20", "01:20 - 02:20", "02:20 - 03:20"],
        schedule: initialData?.schedule || {}
    });

    const [activeDayIdx, setActiveDayIdx] = useState(0);
    const [saving, setSaving] = useState(false);
    const [prompt, setPrompt] = useState<{ isOpen: boolean; title: string; defaultValue: string; callback: (val: string) => void } | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    useSmoothScroll(scrollRef);

    useEffect(() => {
        if (isOpen && initialData) {
            setLocalData({
                days: initialData.days || [],
                slots: initialData.slots || [],
                schedule: JSON.parse(JSON.stringify(initialData.schedule || {})) // deep copy
            });
        }
    }, [isOpen, initialData]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleSyncState = useCallback((day: string, time: string, value: string) => {
        setLocalData(prev => {
            const next = { ...prev };
            if (!next.schedule[day]) next.schedule[day] = [];

            // Remove existing slot for this time
            next.schedule[day] = next.schedule[day].filter(s => s.time !== time);

            if (value.trim()) {
                const parts = value.split('|').map(s => s.trim());
                next.schedule[day].push({
                    time,
                    subject: parts[0] || 'Unassigned',
                    room: parts[1] || 'TBA',
                    teacher: parts[2] || 'Staff'
                });
            }

            return next;
        });
    }, []);

    const addDay = () => {
        setPrompt({
            isOpen: true,
            title: 'Add New Day',
            defaultValue: 'FRI',
            callback: (val) => {
                const day = val.trim().toUpperCase();
                if (day && !localData.days.includes(day)) {
                    setLocalData(prev => ({
                        ...prev,
                        days: [...prev.days, day],
                        schedule: { ...prev.schedule, [day]: [] }
                    }));
                }
                setPrompt(null);
            }
        });
    };

    const removeDay = (day: string) => {
        setLocalData(prev => {
            const next = { ...prev };
            next.days = next.days.filter(d => d !== day);
            delete next.schedule[day];
            return next;
        });
    };

    const addSlot = () => {
        setPrompt({
            isOpen: true,
            title: 'Add New Time Slot',
            defaultValue: '03:30 - 04:30',
            callback: (val) => {
                const slot = val.trim();
                if (slot && !localData.slots.includes(slot)) {
                    setLocalData(prev => ({
                        ...prev,
                        slots: [...prev.slots, slot]
                    }));
                }
                setPrompt(null);
            }
        });
    };

    const removeSlot = (slot: string) => {
        setLocalData(prev => {
            const next = { ...prev };
            next.slots = next.slots.filter(s => s !== slot);
            // Also clean up schedule entries for this slot across all days
            Object.keys(next.schedule).forEach(day => {
                next.schedule[day] = next.schedule[day].filter(s => s.time !== slot);
            });
            return next;
        });
    };

    const updateSlotTime = (oldSlot: string) => {
        setPrompt({
            isOpen: true,
            title: 'Update Time Slot',
            defaultValue: oldSlot,
            callback: (newSlot) => {
                const slot = newSlot.trim();
                if (slot && slot !== oldSlot) {
                    setLocalData(prev => {
                        const next = { ...prev };
                        next.slots = next.slots.map(s => s === oldSlot ? slot : s);
                        // Update existing schedule entries
                        Object.keys(next.schedule).forEach(day => {
                            next.schedule[day] = next.schedule[day].map(s =>
                                s.time === oldSlot ? { ...s, time: slot } : s
                            );
                        });
                        return next;
                    });
                }
                setPrompt(null);
            }
        });
    };

    const saveRoutine = async () => {
        if (!userProfile) return;
        setSaving(true);
        try {
            const docId = `${userProfile.section}_${userProfile.dept}_${userProfile.sem}`
                .replace(/\s+/g, '_')
                .toLowerCase();

            await setDoc(doc(db, 'routines', docId), {
                dept: userProfile.dept,
                sem: userProfile.sem,
                days: localData.days,
                slots: localData.slots,
                schedule: localData.schedule,
                updatedBy: userProfile.name,
                updatedByUid: userProfile.uid,
                lastUpdated: serverTimestamp()
            });

            onSaved();
            onClose();
        } catch (err) {
            console.error("Failed to save routine:", err);
            showAlert("Error", "Error saving routine. Check connection.", "error");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const currentDay = localData.days[activeDayIdx] || localData.days[0];

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-0 lg:p-8"
            onClick={handleBackdropClick}
        >
            <div
                className="bg-white dark:bg-black w-full max-w-6xl h-full lg:h-auto lg:max-h-[90vh] border-x-4 lg:border-4 border-black dark:border-white shadow-[20px_20px_0px_0px_rgba(255,255,255,0.1)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b-4 border-black dark:border-white flex justify-between items-center bg-purple-600 text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <CalendarIcon className="w-8 h-8" />
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Edit Routine</h2>
                            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{userProfile?.dept} — {userProfile?.sem} SEM</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/20 rounded-full transition-colors">
                        <X className="w-8 h-8" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
                    <div className="locomotive-content-wrapper">

                        {/* Toolbar */}
                        <div className="flex flex-wrap gap-4 mb-8">
                            <button onClick={addDay} className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-zinc-800 text-white border-2 border-black dark:border-white font-black uppercase text-xs hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(147,51,234,1)] transition-all">
                                <Plus className="w-4 h-4" /> Add Day
                            </button>
                            <button onClick={addSlot} className="flex items-center gap-2 px-6 py-3 border-2 border-black dark:border-white font-black uppercase text-xs hover:bg-gray-100 dark:hover:bg-zinc-900 transition-all">
                                <Plus className="w-4 h-4" /> Add Slot
                            </button>
                        </div>

                        {/* Editor Layout (Desktop: Table, Mobile: Stack) */}
                        <div className="hidden lg:block">
                            <div className="overflow-x-auto border-2 border-black dark:border-white mb-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)]">
                                <table className="w-full border-collapse text-xs">
                                    <thead className="bg-black text-white dark:bg-white dark:text-black">
                                        <tr>
                                            <th className="p-6 border-r border-zinc-800 w-48 text-left uppercase tracking-tighter font-black text-lg italic">Slot \ Day</th>
                                            {localData.days.map(day => (
                                                <th key={day} className="p-4 border-r border-zinc-700">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="font-black text-sm">{day}</span>
                                                        <button onClick={() => removeDay(day)} className="text-[8px] bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 uppercase font-mono">Del</button>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {localData.slots.map(time => (
                                            <tr key={time} className="border-b-2 border-black dark:border-zinc-800 group">
                                                <td className="p-4 border-r-2 border-black dark:border-zinc-800 font-mono font-black text-xs relative bg-gray-50 dark:bg-zinc-950">
                                                    <div className="cursor-pointer hover:text-purple-600 flex items-center gap-2.5 transition-colors" onClick={() => updateSlotTime(time)}>
                                                        <Clock className="w-4 h-4 opacity-30" />
                                                        {time}
                                                    </div>
                                                    <button onClick={() => removeSlot(time)} className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-lg transition-opacity hover:scale-110 active:scale-90">×</button>
                                                </td>
                                                {localData.days.map(day => {
                                                    const existing = localData.schedule[day]?.find(s => s.time === time);
                                                    const val = existing ? `${existing.subject} | ${existing.room || ''} | ${existing.teacher || ''}` : '';
                                                    return (
                                                        <td key={`${day}-${time}`} className="p-0 border-r-2 border-black dark:border-zinc-800">
                                                            <input
                                                                type="text"
                                                                defaultValue={val}
                                                                onBlur={(e) => handleSyncState(day, time, e.target.value)}
                                                                placeholder="SUB | RM | TCH"
                                                                className="w-full p-5 bg-transparent text-[11px] font-bold outline-none focus:bg-purple-600/10 focus:placeholder-transparent placeholder:opacity-20 transition-all font-mono"
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Editor View */}
                        <div className="lg:hidden space-y-6">
                            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar border-b-2 border-dashed border-gray-200 dark:border-white/10">
                                {localData.days.map((day, idx) => (
                                    <div key={day} className="flex flex-col items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => setActiveDayIdx(idx)}
                                            className={`px-8 py-3 border-2 border-black dark:border-white font-black uppercase text-xs transition-all ${idx === activeDayIdx ? 'bg-black text-white dark:bg-white dark:text-black' : 'opacity-40'}`}
                                        >
                                            {day}
                                        </button>
                                        <button onClick={() => removeDay(day)} className="text-[9px] text-red-500 font-black uppercase mt-1">Remove</button>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4">
                                {localData.slots.map(time => {
                                    const existing = localData.schedule[currentDay]?.find(s => s.time === time);
                                    const val = existing ? `${existing.subject} | ${existing.room || ''} | ${existing.teacher || ''}` : '';
                                    return (
                                        <div key={time} className="p-6 border-2 border-black dark:border-white bg-white dark:bg-zinc-950 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative">
                                            <div className="flex justify-between items-start mb-6">
                                                <button onClick={() => updateSlotTime(time)} className="flex flex-col text-left group">
                                                    <span className="text-[8px] uppercase font-black opacity-30 tracking-widest mb-1">Time Slot</span>
                                                    <span className="font-mono font-black text-sm flex items-center gap-2 group-hover:text-purple-600">
                                                        <Clock className="w-3.5 h-3.5" /> {time}
                                                    </span>
                                                </button>
                                                <button onClick={() => removeSlot(time)} className="text-red-500 p-2"><Trash2 className="w-5 h-5" /></button>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[8px] uppercase font-black opacity-40 tracking-widest">Details (Sub | rm | tch)</span>
                                                    <span className="text-[8px] font-mono opacity-20">{currentDay}</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    defaultValue={val}
                                                    onBlur={(e) => handleSyncState(currentDay, time, e.target.value)}
                                                    className="w-full p-4 border-2 border-black/10 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 font-bold text-xs outline-none focus:border-purple-600 focus:bg-white dark:focus:bg-black transition-all"
                                                    placeholder="e.g., Math | 102 | Dr. Sam"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 lg:p-10 border-t-4 border-black dark:border-white bg-gray-50 dark:bg-zinc-900 flex flex-col md:flex-row gap-6 shrink-0">
                    <div className="flex-1">
                        <p className="text-xs font-black uppercase tracking-tight opacity-40 mb-1">Editor Legend</p>
                        <p className="text-[10px] font-mono leading-tight opacity-60">Use the pipe character (<span className="text-purple-600 font-black">|</span>) to separate entries:<br /><span className="text-black dark:text-white font-bold uppercase tracking-widest">Subject | Room | Teacher</span></p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            disabled={saving}
                            onClick={onClose}
                            className="px-10 py-4 border-4 border-black dark:border-white font-black uppercase text-sm hover:bg-gray-200 dark:hover:bg-zinc-800 transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={saving}
                            onClick={saveRoutine}
                            className="px-12 py-4 bg-purple-600 text-white border-4 border-black dark:border-white font-black uppercase text-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {saving ? 'Syncing...' : (
                                <><Save className="w-5 h-5" /> Save Changes</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {prompt && (
                <RoutinePromptModal
                    isOpen={prompt.isOpen}
                    title={prompt.title}
                    defaultValue={prompt.defaultValue}
                    onClose={() => setPrompt(null)}
                    onConfirm={prompt.callback}
                />
            )}
        </div>,
        document.body
    );
}
