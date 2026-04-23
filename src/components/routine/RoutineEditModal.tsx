'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Trash2, Clock, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
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

interface Subject {
    id: string;
    name: string;
    code: string;
    dept: string;
    sem: string;
}

const CustomSubjectSelect = ({ value, onChange, subjects, placeholder }: { value: string, onChange: (v: string) => void, subjects: Subject[], placeholder: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const toggleOpen = () => {
        if (buttonRef.current) {
            setRect(buttonRef.current.getBoundingClientRect());
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleScroll = (e: Event) => {
            if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
                return;
            }
            setIsOpen(false);
        };
        const handleResize = () => setIsOpen(false);
        if (isOpen) {
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);
        }
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [isOpen]);

    const selectedSubjectText = value || placeholder;

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleOpen}
                className="w-full text-left bg-gray-50/50 dark:bg-black/20 text-[11px] lg:text-xs font-black outline-none border-b-2 border-black/10 dark:border-white/10 focus:border-purple-600 transition-all uppercase px-2 py-2 truncate hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between group"
            >
                <span className={`truncate ${!value && 'opacity-40 font-bold'}`}>{selectedSubjectText}</span>
                <ChevronDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>

            {isOpen && rect && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[9999]"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                    }}
                >
                    <div 
                        ref={dropdownRef}
                        className="fixed z-[10000] bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.05)] max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 custom-scrollbar"
                        style={{
                            top: `${Math.min(rect.bottom, window.innerHeight - 250)}px`,
                            left: `${Math.max(10, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 220) - 10))}px`,
                            width: `${Math.max(rect.width, 220)}px`,
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button 
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className="w-full text-left px-4 py-3 text-[10px] lg:text-xs font-bold hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors uppercase border-b border-gray-100 dark:border-zinc-800 opacity-60"
                        >
                            -- CLEAR LIST --
                        </button>
                        {subjects.map((s: Subject) => {
                            const optionValue = `${s.name} (${s.code})`;
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => { onChange(optionValue); setIsOpen(false); }}
                                    className={`w-full text-left px-4 py-3 text-[10px] lg:text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors uppercase border-b border-gray-100 dark:border-zinc-800/50 last:border-0 ${optionValue === value ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 font-black border-l-4 border-l-purple-600' : 'font-bold'}`}
                                >
                                    {s.name} <div className="opacity-50 text-[9px] mt-0.5 font-mono">{s.code}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

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
        slots: initialData?.slots || ["09:00 - 09:45", "09:45 - 10:30", "10:30 - 11:15", "11:15 - 12:00", "12:00 - 12:45", "12:45 - 01:30", "01:30 - 02:15"],
        schedule: initialData?.schedule || {}
    });

    const [activeDayIdx, setActiveDayIdx] = useState(0);
    const [saving, setSaving] = useState(false);
    const [prompt, setPrompt] = useState<{ isOpen: boolean; title: string; defaultValue: string; callback: (val: string) => void } | null>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);

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

    useEffect(() => {
        if (!isOpen || !userProfile?.dept || !userProfile?.sem) return;

        const fetchSubjects = async () => {
            try {
                const q = query(
                    collection(db, 'notice_subjects'),
                    where('dept', 'in', [userProfile.dept, 'all', 'All', 'ALL'])
                );
                
                const snap = await getDocs(q);
                const data: Subject[] = [];
                snap.forEach(doc => {
                    data.push({ id: doc.id, ...doc.data() } as Subject);
                });
                
                // Filter by semester
                const filtered = data.filter(s => {
                    const subjectSem = s.sem?.toLowerCase() || '';
                    return s.sem === userProfile.sem || subjectSem === 'all' || subjectSem === 'all semester';
                });
                
                // Sort by name
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                setSubjects(filtered);
            } catch (err) {
                console.error("Failed to fetch subjects", err);
            }
        };

        fetchSubjects();
    }, [isOpen, userProfile]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleUpdateCell = useCallback((day: string, time: string, field: 'subject' | 'room' | 'teacher', value: string) => {
        setLocalData(prev => {
            const next = { ...prev };
            if (!next.schedule[day]) next.schedule[day] = [];

            const existingIdx = next.schedule[day].findIndex(s => s.time === time);
            
            if (existingIdx >= 0) {
                const updatedSlot = { ...next.schedule[day][existingIdx], [field]: value };
                if (!updatedSlot.subject && !updatedSlot.room && !updatedSlot.teacher) {
                    next.schedule[day] = next.schedule[day].filter(s => s.time !== time);
                } else {
                    next.schedule[day][existingIdx] = updatedSlot;
                }
            } else {
                if (value.trim()) {
                    next.schedule[day].push({
                        time,
                        subject: field === 'subject' ? value : '',
                        room: field === 'room' ? value : '',
                        teacher: field === 'teacher' ? value : ''
                    });
                }
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

        if (localData.days.length === 0) {
            showAlert("Validation Error", "Please add at least one day.", "error");
            return;
        }

        if (localData.slots.length === 0) {
            showAlert("Validation Error", "Please add at least one time slot.", "error");
            return;
        }

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
                className="bg-white dark:bg-black w-full max-w-[95vw] 2xl:max-w-[90vw] h-full lg:h-auto lg:max-h-[95vh] border-x-4 lg:border-4 border-black dark:border-white shadow-[20px_20px_0px_0px_rgba(255,255,255,0.1)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 lg:p-5 border-b-4 border-black dark:border-white flex justify-between items-center bg-purple-600 text-white shrink-0">
                    <div className="flex items-center gap-3 lg:gap-4">
                        <CalendarIcon className="w-6 h-6 lg:w-8 lg:h-8 hidden sm:block" />
                        <div>
                            <h2 className="text-xl lg:text-2xl font-black uppercase tracking-tighter">Edit Routine</h2>
                            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest leading-none mt-1">{userProfile?.dept} — {userProfile?.sem} SEM</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 lg:gap-4">
                        <button onClick={addDay} className="flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1.5 lg:py-2 bg-black text-white font-black uppercase text-[10px] lg:text-xs border border-white/20 hover:scale-105 active:scale-95 transition-all">
                            <Plus className="w-3 h-3 lg:w-4 lg:h-4" /> <span className="hidden sm:inline">Add Day</span><span className="sm:hidden">Day</span>
                        </button>
                        <button onClick={addSlot} className="flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1.5 lg:py-2 bg-white text-purple-600 font-black uppercase text-[10px] lg:text-xs hover:scale-105 active:scale-95 transition-all shadow-sm">
                            <Plus className="w-3 h-3 lg:w-4 lg:h-4" /> <span className="hidden sm:inline">Add Slot</span><span className="sm:hidden">Slot</span>
                        </button>
                        <button onClick={onClose} className="p-1 lg:p-2 hover:bg-black/20 rounded-full transition-colors sm:ml-2">
                            <X className="w-6 h-6 lg:w-8 lg:h-8" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="locomotive-content-wrapper">

                        {/* Editor Layout (Desktop: Table, Mobile: Stack) */}
                        <div className="hidden lg:block">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead className="bg-black text-white dark:bg-white dark:text-black">
                                        <tr>
                                            <th className="p-4 border-r border-zinc-800 w-32 text-left uppercase tracking-tighter font-black text-sm italic">Day \ Slot</th>
                                            {localData.slots.map(time => (
                                                <th key={time} className="p-3 border-r border-zinc-700 min-w-[200px] group">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="cursor-pointer hover:text-purple-400 flex items-center gap-2 transition-colors font-mono font-black text-xs" onClick={() => updateSlotTime(time)}>
                                                            <Clock className="w-4 h-4 opacity-50" />
                                                            {time}
                                                        </div>
                                                        <button onClick={() => removeSlot(time)} className="text-[10px] bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 uppercase font-mono opacity-0 group-hover:opacity-100 transition-opacity">Del</button>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {localData.days.map(day => (
                                            <tr key={day} className="border-b-2 border-black dark:border-zinc-800">
                                                <td className="p-4 border-r-2 border-black dark:border-zinc-800 font-black text-sm relative bg-gray-50 dark:bg-zinc-950 group">
                                                    <div className="flex items-center justify-between">
                                                        <span>{day}</span>
                                                        <button onClick={() => removeDay(day)} className="text-[10px] bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 uppercase font-mono opacity-0 group-hover:opacity-100 transition-opacity">Del</button>
                                                    </div>
                                                </td>
                                                {localData.slots.map(time => {
                                                    const existing = localData.schedule[day]?.find(s => s.time === time);
                                                    return (
                                                        <td key={`${day}-${time}`} className="p-3 border-r-2 border-black dark:border-zinc-800 align-top group/cell hover:bg-purple-600/5 transition-colors">
                                                            <div className="flex flex-col gap-2 w-full h-full">
                                                                <CustomSubjectSelect
                                                                    value={existing?.subject || ''}
                                                                    onChange={(val) => handleUpdateCell(day, time, 'subject', val)}
                                                                    subjects={subjects}
                                                                    placeholder="Subject"
                                                                />
                                                                <div className="flex gap-3">
                                                                    <div className="w-1/2 flex items-center border-b-2 border-black/10 dark:border-white/10 focus-within:border-purple-600 transition-all">
                                                                        <span className="text-[8px] uppercase font-bold opacity-30 px-1 hidden xl:block">RM</span>
                                                                        <input
                                                                            type="text"
                                                                            defaultValue={existing?.room || ''}
                                                                            onBlur={(e) => handleUpdateCell(day, time, 'room', e.target.value)}
                                                                            placeholder="Room"
                                                                            className="w-full bg-transparent text-xs font-bold outline-none uppercase px-1 py-1"
                                                                        />
                                                                    </div>
                                                                    <div className="w-1/2 flex items-center border-b-2 border-black/10 dark:border-white/10 focus-within:border-purple-600 transition-all">
                                                                        <span className="text-[8px] uppercase font-bold opacity-30 px-1 hidden xl:block">TCH</span>
                                                                        <input
                                                                            type="text"
                                                                            defaultValue={existing?.teacher || ''}
                                                                            onBlur={(e) => handleUpdateCell(day, time, 'teacher', e.target.value)}
                                                                            placeholder="Teacher"
                                                                            className="w-full bg-transparent text-xs font-bold outline-none uppercase px-1 py-1"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
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
                        <div className="lg:hidden space-y-6 p-4">
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
                                    return (
                                        <div key={time} className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
                                            <div className="flex justify-between items-start mb-4">
                                                <button onClick={() => updateSlotTime(time)} className="flex flex-col text-left group">
                                                    <span className="text-[8px] uppercase font-black opacity-30 tracking-widest mb-1">Time Slot</span>
                                                    <span className="font-mono font-black text-sm flex items-center gap-2 group-hover:text-purple-600 transition-colors">
                                                        <Clock className="w-3.5 h-3.5" /> {time}
                                                    </span>
                                                </button>
                                                <button onClick={() => removeSlot(time)} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                            <div className="space-y-3 border-t-2 border-dashed border-gray-100 dark:border-white/5 pt-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="col-span-2">
                                                        <label className="text-[8px] uppercase font-bold opacity-50 block mb-1">Subject</label>
                                                        <CustomSubjectSelect
                                                            value={existing?.subject || ''}
                                                            onChange={(val) => handleUpdateCell(currentDay, time, 'subject', val)}
                                                            subjects={subjects}
                                                            placeholder="Select Subject..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] uppercase font-bold opacity-50 block mb-1">Room</label>
                                                        <input
                                                            type="text"
                                                            defaultValue={existing?.room || ''}
                                                            onBlur={(e) => handleUpdateCell(currentDay, time, 'room', e.target.value)}
                                                            className="w-full p-2.5 border-2 border-black/10 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 font-bold text-[11px] outline-none focus:border-purple-600 focus:bg-white dark:focus:bg-black transition-all uppercase"
                                                            placeholder="e.g. 101"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] uppercase font-bold opacity-50 block mb-1">Teacher</label>
                                                        <input
                                                            type="text"
                                                            defaultValue={existing?.teacher || ''}
                                                            onBlur={(e) => handleUpdateCell(currentDay, time, 'teacher', e.target.value)}
                                                            className="w-full p-2.5 border-2 border-black/10 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 font-bold text-[11px] outline-none focus:border-purple-600 focus:bg-white dark:focus:bg-black transition-all uppercase"
                                                            placeholder="e.g. ABC"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 lg:p-4 border-t-4 border-black dark:border-white bg-gray-50 dark:bg-zinc-900 flex justify-end gap-3 shrink-0">
                    <button
                        disabled={saving}
                        onClick={onClose}
                        className="px-6 py-2.5 border-[3px] border-black dark:border-white font-black uppercase text-xs hover:bg-gray-200 dark:hover:bg-zinc-800 transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={saving}
                        onClick={saveRoutine}
                        className="px-8 py-2.5 bg-purple-600 text-white border-[3px] border-black dark:border-white font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : (
                            <><Save className="w-4 h-4" /> Save</>
                        )}
                    </button>
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
