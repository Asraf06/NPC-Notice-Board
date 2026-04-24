'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText, CalendarClock, Pencil, Plus, Trash2, Loader2, BookOpen, RefreshCw, ChevronDown, Search, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';

interface ExamEntry {
    subject: string;
    date: string;
    time: string;
    room?: string;
}

interface SyllabusEntry {
    subject: string;
    topics: string;
    chapters?: string;
}

interface ExamInfoData {
    routine: ExamEntry[];
    syllabus: SyllabusEntry[];
    updatedAt?: any;
    updatedBy?: string;
}

export default function ExamInfoView() {
    const { userProfile } = useAuth();
    const { showAlert, showToast } = useUI();

    const [activeTab, setActiveTab] = useState<'routine' | 'syllabus'>('routine');
    const [data, setData] = useState<ExamInfoData | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [subjects, setSubjects] = useState<{ id: string; name: string; sem: string }[]>([]);

    // Edit states
    const [editRoutine, setEditRoutine] = useState<ExamEntry[]>([]);
    const [editSyllabus, setEditSyllabus] = useState<SyllabusEntry[]>([]);

    const isCR = userProfile?.isCR === true || userProfile?.role === 'admin';

    const docId = userProfile
        ? `${userProfile.section}_${userProfile.dept}_${userProfile.sem}`.replace(/\s+/g, '_').toLowerCase()
        : '';

    useEffect(() => {
        if (!docId) return;

        const unsub = onSnapshot(doc(db, 'examInfo', docId), (snap) => {
            if (snap.exists()) {
                const d = snap.data() as ExamInfoData;
                setData({
                    routine: d.routine || [],
                    syllabus: d.syllabus || [],
                    updatedAt: d.updatedAt,
                    updatedBy: d.updatedBy,
                });
            } else {
                setData(null);
            }
            setLoading(false);
        }, () => setLoading(false));

        return () => unsub();
    }, [docId]);

    // Fetch subjects filtered by dept AND semester
    useEffect(() => {
        if (!userProfile?.dept || !userProfile?.sem) return;

        const q = query(
            collection(db, 'notice_subjects'),
            where('dept', 'in', [userProfile.dept, 'all', 'All', 'ALL'])
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const raw: any[] = [];
            snapshot.forEach(d => {
                raw.push({ id: d.id, ...d.data() });
            });
            // Filter by semester: match user's semester OR universal semesters
            const userSem = userProfile.sem.toLowerCase();
            const filtered = raw.filter(s => {
                const subSem = (s.sem || '').toLowerCase();
                return subSem === userSem || subSem === 'all' || subSem === 'all semester';
            });
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            setSubjects(filtered);
        }, (err) => console.error("Failed to fetch subjects", err));

        return () => unsub();
    }, [userProfile]);

    const startEditing = () => {
        setEditRoutine(data?.routine?.length ? JSON.parse(JSON.stringify(data.routine)) : [{ subject: '', date: '', time: '', room: '' }]);
        setEditSyllabus(data?.syllabus?.length ? JSON.parse(JSON.stringify(data.syllabus)) : [{ subject: '', topics: '', chapters: '' }]);
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
    };

    const handleSave = async () => {
        if (!docId) return;
        setSaving(true);
        try {
            // Filter out empty entries
            const cleanRoutine = editRoutine.filter(e => e.subject.trim());
            const cleanSyllabus = editSyllabus.filter(e => e.subject.trim());

            await setDoc(doc(db, 'examInfo', docId), {
                routine: cleanRoutine,
                syllabus: cleanSyllabus,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile?.name || 'CR',
            }, { merge: true });

            showToast('Exam info saved!');
            setEditing(false);
        } catch (err: any) {
            console.error('Save error:', err);
            showAlert('Save Failed', err.message || 'Could not save exam info.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Routine edit helpers
    const addRoutineEntry = () => setEditRoutine(prev => [...prev, { subject: '', date: '', time: '', room: '' }]);
    const removeRoutineEntry = (i: number) => setEditRoutine(prev => prev.filter((_, idx) => idx !== i));
    const updateRoutineEntry = (i: number, field: keyof ExamEntry, value: string) => {
        setEditRoutine(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
    };

    // Syllabus edit helpers
    const addSyllabusEntry = () => setEditSyllabus(prev => [...prev, { subject: '', topics: '', chapters: '' }]);
    const removeSyllabusEntry = (i: number) => setEditSyllabus(prev => prev.filter((_, idx) => idx !== i));
    const updateSyllabusEntry = (i: number, field: keyof SyllabusEntry, value: string) => {
        setEditSyllabus(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
    };

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center py-20 animate-pulse">
                <RefreshCw className="w-12 h-12 mb-4 opacity-20 animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest opacity-30">Loading Exam Info...</p>
            </div>
        );
    }

    const hasRoutine = (data?.routine?.length ?? 0) > 0;
    const hasSyllabus = (data?.syllabus?.length ?? 0) > 0;
    const hasAnyData = hasRoutine || hasSyllabus;

    return (
        <div className="w-full h-full min-h-0 overflow-y-auto custom-scrollbar min-w-0">
            <div className="locomotive-content-wrapper max-w-[1000px] mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none mb-2">
                            Exam Info
                        </h1>
                        <p className="text-xs font-mono font-bold opacity-50 uppercase tracking-widest bg-gray-100 dark:bg-zinc-800 px-3 py-1 inline-block">
                            {userProfile?.dept} — {userProfile?.sem} SEMESTER
                        </p>
                    </div>

                    {isCR && !editing && (
                        <button
                            onClick={startEditing}
                            className="flex items-center gap-2 px-6 py-3 border-2 border-black dark:border-white font-black uppercase text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] active:translate-y-0.5 active:shadow-none"
                        >
                            <Pencil className="w-4 h-4" /> {hasAnyData ? 'Edit' : 'Add Info'}
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-8">
                    <button
                        onClick={() => setActiveTab('routine')}
                        className={`flex items-center gap-2 px-6 py-3 font-black uppercase text-xs border-2 border-black dark:border-white transition-all ${activeTab === 'routine'
                            ? 'bg-black text-white dark:bg-white dark:text-black shadow-none translate-y-[2px]'
                            : 'bg-white dark:bg-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                            }`}
                    >
                        <CalendarClock className="w-4 h-4" /> Mid Routine
                    </button>
                    <button
                        onClick={() => setActiveTab('syllabus')}
                        className={`flex items-center gap-2 px-6 py-3 font-black uppercase text-xs border-2 border-black dark:border-white transition-all ${activeTab === 'syllabus'
                            ? 'bg-black text-white dark:bg-white dark:text-black shadow-none translate-y-[2px]'
                            : 'bg-white dark:bg-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                            }`}
                    >
                        <BookOpen className="w-4 h-4" /> Syllabus
                    </button>
                </div>

                {/* Editing Mode */}
                {editing ? (
                    <div className="space-y-6">
                        {activeTab === 'routine' ? (
                            <EditRoutineSection entries={editRoutine} onAdd={addRoutineEntry} onRemove={removeRoutineEntry} onUpdate={updateRoutineEntry} subjects={subjects} />
                        ) : (
                            <EditSyllabusSection entries={editSyllabus} onAdd={addSyllabusEntry} onRemove={removeSyllabusEntry} onUpdate={updateSyllabusEntry} subjects={subjects} />
                        )}

                        {/* Save / Cancel */}
                        <div className="flex gap-3 pt-4 border-t-2 border-black dark:border-zinc-800">
                            <button
                                onClick={cancelEditing}
                                disabled={saving}
                                className="flex-1 border-2 border-black dark:border-zinc-700 font-bold uppercase text-xs py-3 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-[2] bg-black text-white dark:bg-white dark:text-black font-bold uppercase text-xs py-3 flex justify-center items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* View Mode */
                    <>
                        {activeTab === 'routine' ? (
                            hasRoutine ? <ViewRoutine entries={data!.routine} /> : <EmptyState label="Mid Exam Routine" isCR={isCR} onAdd={startEditing} />
                        ) : (
                            hasSyllabus ? <ViewSyllabus entries={data!.syllabus} /> : <EmptyState label="Syllabus" isCR={isCR} onAdd={startEditing} />
                        )}

                        {data?.updatedBy && (
                            <p className="text-[10px] font-mono opacity-30 uppercase mt-8 text-center tracking-widest">
                                Last updated by {data.updatedBy}
                            </p>
                        )}
                    </>
                )}

                <div className="h-20 lg:hidden" />
            </div>
        </div>
    );
}

/* ─── Sub-components ─── */

function EmptyState({ label, isCR, onAdd }: { label: string; isCR: boolean; onAdd: () => void }) {
    return (
        <div className="border-4 border-dashed border-black/10 dark:border-white/10 p-12 text-center bg-gray-50 dark:bg-zinc-900/50 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)]">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <h3 className="text-xl font-black uppercase mb-2 tracking-tighter">No {label} Yet</h3>
            <p className="text-sm opacity-50 uppercase tracking-widest mb-6">
                {isCR ? `Click below to add ${label.toLowerCase()} for your class.` : 'Your CR has not added this yet.'}
            </p>
            {isCR && (
                <button onClick={onAdd} className="px-8 py-3 bg-purple-600 text-white font-black uppercase text-sm border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
                    Add {label}
                </button>
            )}
        </div>
    );
}

function ViewRoutine({ entries }: { entries: ExamEntry[] }) {
    return (
        <div className="space-y-3">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[2fr_1.2fr_1fr_1fr] gap-0 border-2 border-black dark:border-zinc-800 bg-black text-white dark:bg-white dark:text-black">
                <div className="px-4 py-3 font-black uppercase text-xs tracking-wider">Subject</div>
                <div className="px-4 py-3 font-black uppercase text-xs tracking-wider border-l border-white/20 dark:border-black/20">Date</div>
                <div className="px-4 py-3 font-black uppercase text-xs tracking-wider border-l border-white/20 dark:border-black/20">Time</div>
                <div className="px-4 py-3 font-black uppercase text-xs tracking-wider border-l border-white/20 dark:border-black/20">Room</div>
            </div>

            {entries.map((entry, i) => (
                <div key={i} className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] transition-shadow">
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-[2fr_1.2fr_1fr_1fr]">
                        <div className="px-4 py-4 font-bold text-sm uppercase">{entry.subject}</div>
                        <div className="px-4 py-4 font-mono text-sm border-l border-gray-100 dark:border-zinc-800">{entry.date}</div>
                        <div className="px-4 py-4 font-mono text-sm border-l border-gray-100 dark:border-zinc-800">{entry.time}</div>
                        <div className="px-4 py-4 font-mono text-sm border-l border-gray-100 dark:border-zinc-800 opacity-60">{entry.room || '—'}</div>
                    </div>
                    {/* Mobile card */}
                    <div className="md:hidden p-4 space-y-2">
                        <h4 className="font-black text-base uppercase tracking-tight">{entry.subject}</h4>
                        <div className="flex flex-wrap gap-3 text-xs font-mono opacity-70">
                            <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 border border-gray-200 dark:border-zinc-700">📅 {entry.date}</span>
                            <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 border border-gray-200 dark:border-zinc-700">⏰ {entry.time}</span>
                            {entry.room && <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 border border-gray-200 dark:border-zinc-700">🏫 {entry.room}</span>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function ViewSyllabus({ entries }: { entries: SyllabusEntry[] }) {
    return (
        <div className="space-y-4">
            {entries.map((entry, i) => (
                <div key={i} className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 p-1.5 shrink-0">
                            <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h4 className="font-black text-base uppercase tracking-tight">{entry.subject}</h4>
                            {entry.chapters && <p className="text-[10px] font-mono opacity-50 uppercase mt-0.5">Chapters: {entry.chapters}</p>}
                        </div>
                    </div>
                    <div className="pl-10">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap opacity-80">{entry.topics}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ─── Edit Sub-components ─── */

function SubjectInput({ value, onChange, subjects }: { value: string, onChange: (val: string) => void, subjects: { id: string; name: string }[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isManual, setIsManual] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Auto-focus search when opened
    useEffect(() => {
        if (isOpen && searchRef.current) {
            searchRef.current.focus();
        }
    }, [isOpen]);

    const isCustom = value.trim() !== '' && !subjects.some(s => s.name === value);

    // If value was set manually before, keep manual mode
    useEffect(() => {
        if (isCustom && value.trim()) setIsManual(true);
    }, []);

    const filteredSubjects = subjects.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (name: string) => {
        onChange(name);
        setIsManual(false);
        setIsOpen(false);
        setSearch('');
    };

    const handleManualMode = () => {
        setIsManual(true);
        setIsOpen(false);
        setSearch('');
        onChange('');
    };

    // Manual type mode
    if (isManual) {
        return (
            <div className="flex w-full gap-2">
                <input
                    className="edit-input flex-1 min-w-0"
                    placeholder="Type subject name..."
                    value={value.trim()}
                    onChange={(e) => onChange(e.target.value)}
                    autoFocus
                />
                <button
                    type="button"
                    onClick={() => {
                        setIsManual(false);
                        onChange('');
                    }}
                    className="edit-input px-3 flex items-center text-xs font-bold uppercase hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors shrink-0"
                    title="Switch to dropdown"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="edit-input w-full flex items-center justify-between gap-2 text-left cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition-colors"
            >
                <span className={value ? '' : 'opacity-35 uppercase text-xs tracking-wider'}>
                    {value || 'Select Subject...'}
                </span>
                <ChevronDown className={`w-4 h-4 shrink-0 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)] max-h-[260px] flex flex-col">
                    {/* Search */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-black/10 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 shrink-0">
                        <Search className="w-3.5 h-3.5 opacity-40 shrink-0" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search subjects..."
                            className="w-full bg-transparent outline-none text-xs font-bold uppercase tracking-wider placeholder:opacity-30 placeholder:normal-case"
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')} className="opacity-40 hover:opacity-100">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {filteredSubjects.length > 0 ? (
                            filteredSubjects.map(sub => (
                                <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => handleSelect(sub.name)}
                                    className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors border-b border-black/5 dark:border-zinc-800 last:border-b-0 ${
                                        value === sub.name
                                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                                            : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    {sub.name}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-xs opacity-40 font-bold uppercase tracking-widest">
                                No subjects found
                            </div>
                        )}
                    </div>

                    {/* Manual Type Option */}
                    <button
                        type="button"
                        onClick={handleManualMode}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-t-2 border-black/10 dark:border-zinc-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors shrink-0 flex items-center gap-2"
                    >
                        <Pencil className="w-3 h-3" /> Type Manually...
                    </button>
                </div>
            )}
        </div>
    );
}

// Date helpers: store as dd/mm/yyyy, convert for native input
function toISODate(ddmmyyyy: string): string {
    if (!ddmmyyyy) return '';
    const parts = ddmmyyyy.split('/');
    if (parts.length !== 3) return ddmmyyyy; // fallback if already ISO or invalid
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
function fromISODate(iso: string): string {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function EditRoutineSection({ entries, onAdd, onRemove, onUpdate, subjects }: {
    entries: ExamEntry[];
    onAdd: () => void;
    onRemove: (i: number) => void;
    onUpdate: (i: number, field: keyof ExamEntry, value: string) => void;
    subjects: { id: string; name: string; sem: string }[];
}) {
    return (
        <div className="space-y-4">
            <h3 className="font-black uppercase text-sm tracking-wider flex items-center gap-2">
                <CalendarClock className="w-4 h-4" /> Edit Mid Exam Routine
            </h3>
            {entries.map((entry, i) => (
                <div key={i} className="border-2 border-black dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 overflow-hidden">
                    {/* Card Header with delete */}
                    <div className="flex items-center justify-between px-4 py-2 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-zinc-700">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Subject {i + 1}</span>
                        <button onClick={() => onRemove(i)} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors rounded" title="Remove">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Card Body */}
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <SubjectInput value={entry.subject} onChange={(val) => onUpdate(i, 'subject', val)} subjects={subjects} />
                            <input
                                type="date"
                                value={toISODate(entry.date)}
                                onChange={e => onUpdate(i, 'date', fromISODate(e.target.value))}
                                className="edit-input"
                            />
                            <input value={entry.time} onChange={e => onUpdate(i, 'time', e.target.value)} placeholder="Time (e.g. 10:00 AM)" className="edit-input" />
                            <input value={entry.room || ''} onChange={e => onUpdate(i, 'room', e.target.value)} placeholder="Room (optional)" className="edit-input" />
                        </div>
                    </div>
                </div>
            ))}
            <button onClick={onAdd} className="w-full border-2 border-dashed border-black/20 dark:border-white/20 py-3 font-bold uppercase text-xs flex items-center justify-center gap-2 hover:border-black dark:hover:border-white transition-colors">
                <Plus className="w-4 h-4" /> Add Subject
            </button>
        </div>
    );
}

function EditSyllabusSection({ entries, onAdd, onRemove, onUpdate, subjects }: {
    entries: SyllabusEntry[];
    onAdd: () => void;
    onRemove: (i: number) => void;
    onUpdate: (i: number, field: keyof SyllabusEntry, value: string) => void;
    subjects: { id: string; name: string; sem: string }[];
}) {
    return (
        <div className="space-y-4">
            <h3 className="font-black uppercase text-sm tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Edit Syllabus
            </h3>
            {entries.map((entry, i) => (
                <div key={i} className="border-2 border-black dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 overflow-hidden">
                    {/* Card Header with delete */}
                    <div className="flex items-center justify-between px-4 py-2 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-zinc-700">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Subject {i + 1}</span>
                        <button onClick={() => onRemove(i)} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors rounded" title="Remove">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Card Body */}
                    <div className="p-4">
                        <div className="space-y-3">
                            <SubjectInput value={entry.subject} onChange={(val) => onUpdate(i, 'subject', val)} subjects={subjects} />
                            <input value={entry.chapters || ''} onChange={e => onUpdate(i, 'chapters', e.target.value)} placeholder="Chapters (e.g. 1-5)" className="edit-input w-full" />
                            <textarea value={entry.topics} onChange={e => onUpdate(i, 'topics', e.target.value)} placeholder="Topics covered..." rows={3} className="edit-input w-full resize-y" />
                        </div>
                    </div>
                </div>
            ))}
            <button onClick={onAdd} className="w-full border-2 border-dashed border-black/20 dark:border-white/20 py-3 font-bold uppercase text-xs flex items-center justify-center gap-2 hover:border-black dark:hover:border-white transition-colors">
                <Plus className="w-4 h-4" /> Add Subject
            </button>
        </div>
    );
}
