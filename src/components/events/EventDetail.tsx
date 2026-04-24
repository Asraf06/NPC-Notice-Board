'use client';
import { useState, useEffect } from 'react';
import { ArrowLeft, Pencil, Trash2, Users, CalendarClock, MapPin, Clock, Eye, EyeOff, CheckCircle2, Loader2, AlertTriangle, Download } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, deleteDoc, collection, onSnapshot, setDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import type { EventData, EnrollmentData } from './types';

import { deleteUploadedFiles } from '@/lib/uploadService';

interface Props {
    event: EventData;
    onBack: () => void;
    onEdit: () => void;
}

export default function EventDetail({ event, onBack, onEdit }: Props) {
    const { userProfile } = useAuth();
    const { showToast, showAlert } = useUI();
    const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
    const [loadingEnroll, setLoadingEnroll] = useState(false);
    const [customData, setCustomData] = useState<Record<string, string>>({});
    const [showEnrollForm, setShowEnrollForm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isAdmin = userProfile?.role === 'admin';
    const isCR = userProfile?.isCR === true;
    const isOwner = event.createdByUid === userProfile?.uid;
    const canManage = isAdmin || isOwner;
    const hasCustomFields = event.customFields && event.customFields.length > 0;
    const isPast = event.deadline && new Date(event.deadline.split('/').reverse().join('-')) < new Date();

    // Listen to enrollments
    useEffect(() => {
        if (!event.id) return;
        const unsub = onSnapshot(collection(db, 'events', event.id, 'enrollments'), (snap) => {
            const list: EnrollmentData[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as EnrollmentData));
            setEnrollments(list);
        });
        return () => unsub();
    }, [event.id]);

    const isEnrolled = enrollments.some(e => e.uid === userProfile?.uid);

    const handleEnroll = async () => {
        if (!userProfile || !event.id) return;
        if (hasCustomFields) {
            const missing = event.customFields.filter(f => f.required && !customData[f.id]?.trim());
            if (missing.length > 0) {
                showAlert('Missing Info', `Please fill: ${missing.map(f => f.label).join(', ')}`, 'error');
                return;
            }
        }
        setLoadingEnroll(true);
        try {
            await setDoc(doc(db, 'events', event.id, 'enrollments', userProfile.uid), {
                eventId: event.id,
                uid: userProfile.uid,
                name: userProfile.name,
                roll: userProfile.roll,
                dept: userProfile.dept,
                sem: userProfile.sem,
                section: userProfile.section,
                customData: customData,
                enrolledAt: serverTimestamp(),
            });
            await updateDoc(doc(db, 'events', event.id), { enrollmentCount: increment(1) });
            showToast('Enrolled successfully!');
            setShowEnrollForm(false);
        } catch (err: any) {
            showAlert('Error', err.message || 'Failed to enroll.', 'error');
        } finally { setLoadingEnroll(false); }
    };

    const handleUnenroll = async () => {
        if (!userProfile || !event.id) return;
        setLoadingEnroll(true);
        try {
            await deleteDoc(doc(db, 'events', event.id, 'enrollments', userProfile.uid));
            await updateDoc(doc(db, 'events', event.id), { enrollmentCount: increment(-1) });
            showToast('Unenrolled.');
        } catch (err: any) {
            showAlert('Error', err.message || 'Failed to unenroll.', 'error');
        } finally { setLoadingEnroll(false); }
    };

    const handleDelete = async () => {
        if (!event.id) return;
        setDeleting(true);
        try {
            // Delete associated images
            if (event.images && event.images.length > 0) {
                await deleteUploadedFiles(event.images);
            }
            // Delete all enrollments first
            for (const e of enrollments) {
                await deleteDoc(doc(db, 'events', event.id, 'enrollments', e.id!));
            }
            await deleteDoc(doc(db, 'events', event.id));
            showToast('Event deleted.');
            onBack();
        } catch (err: any) {
            showAlert('Error', err.message || 'Failed to delete.', 'error');
            setDeleting(false);
        }
    };

    const handleToggleActive = async () => {
        if (!event.id) return;
        try {
            await updateDoc(doc(db, 'events', event.id), { isActive: !event.isActive });
            showToast(event.isActive ? 'Event hidden from students.' : 'Event visible to students.');
        } catch (err: any) {
            showAlert('Error', err.message, 'error');
        }
    };

    const targetLabel = [
        event.targetDept === 'all' ? 'All Departments' : event.targetDept,
        event.targetSem === 'all' ? 'All Semesters' : event.targetSem,
        event.targetSection === 'all' ? 'All Sections' : event.targetSection,
    ].join(' · ');

    return (
        <div className="w-full h-full min-h-0 overflow-y-auto custom-scrollbar min-w-0">
            <div className="locomotive-content-wrapper max-w-[900px] mx-auto px-4 py-8">
                <button onClick={onBack} className="flex items-center gap-2 mb-6 text-xs font-black uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity">
                    <ArrowLeft className="w-4 h-4" /> Back to Events
                </button>

                {/* Event Header */}
                <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-zinc-900 mb-6 overflow-hidden">
                    {event.images && event.images.length > 0 && (
                        <div className="w-full h-48 md:h-64 border-b border-black/10 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 relative">
                            <img src={event.images[0].url} alt="Event Cover" className="w-full h-full object-cover" />
                        </div>
                    )}
                    <div className={`px-5 py-3 border-b border-black/10 dark:border-zinc-700 flex items-center justify-between ${event.isActive ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1">
                            {event.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            {event.isActive ? 'Active' : 'Hidden'} · By {event.createdBy}
                        </span>
                        <span className="text-[10px] font-mono opacity-40">{targetLabel}</span>
                    </div>
                    <div className="p-5 md:p-6">
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-3">{event.title}</h1>
                        {event.description && <p className="text-sm opacity-70 whitespace-pre-wrap mb-4">{event.description}</p>}
                        
                        {event.images && event.images.length > 1 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                                {event.images.slice(1).map((img, i) => (
                                    <div key={i} className="aspect-video bg-gray-100 dark:bg-zinc-800 border border-black/10 dark:border-zinc-700">
                                        <img src={img.url} className="w-full h-full object-cover" alt={`Event Image ${i+2}`} />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-3 text-xs font-mono">
                            {event.date && <span className="bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 border border-gray-200 dark:border-zinc-700 flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {event.date}</span>}
                            {event.time && <span className="bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 border border-gray-200 dark:border-zinc-700 flex items-center gap-1"><Clock className="w-3 h-3" /> {event.time}</span>}
                            {event.location && <span className="bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 border border-gray-200 dark:border-zinc-700 flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>}
                            {event.deadline && <span className={`px-3 py-1.5 border flex items-center gap-1 ${isPast ? 'bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400' : 'bg-yellow-100 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700'}`}><AlertTriangle className="w-3 h-3" /> Deadline: {event.deadline}</span>}
                        </div>
                    </div>
                </div>

                {/* Admin/CR Actions */}
                {canManage && (
                    <div className="flex flex-wrap gap-3 mb-6">
                        <button onClick={onEdit} className="flex items-center gap-2 px-5 py-2.5 border-2 border-black dark:border-white font-black uppercase text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] active:translate-y-0.5 active:shadow-none">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={handleToggleActive} className="flex items-center gap-2 px-5 py-2.5 border-2 border-black dark:border-white font-black uppercase text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] active:translate-y-0.5 active:shadow-none">
                            {event.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {event.isActive ? 'Hide' : 'Show'}
                        </button>
                        <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 px-5 py-2.5 border-2 border-red-500 text-red-500 font-black uppercase text-xs hover:bg-red-500 hover:text-white transition-all shadow-[3px_3px_0px_0px_rgba(239,68,68,0.4)] active:translate-y-0.5 active:shadow-none disabled:opacity-50">
                            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
                        </button>
                    </div>
                )}

                {/* Enrollment Section */}
                {!canManage && (
                    <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-zinc-900 mb-6 overflow-hidden">
                        <div className="px-4 py-2 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-zinc-700">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Enrollment</span>
                        </div>
                        <div className="p-5">
                            {isPast ? (
                                <p className="text-sm font-bold text-red-500 uppercase">Enrollment deadline has passed.</p>
                            ) : isEnrolled ? (
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black uppercase text-sm"><CheckCircle2 className="w-5 h-5" /> You are enrolled!</span>
                                    <button onClick={handleUnenroll} disabled={loadingEnroll} className="text-xs font-bold uppercase text-red-500 hover:underline disabled:opacity-50">
                                        {loadingEnroll ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unenroll'}
                                    </button>
                                </div>
                            ) : hasCustomFields && !showEnrollForm ? (
                                <button onClick={() => setShowEnrollForm(true)} className="w-full py-3 bg-purple-600 text-white font-black uppercase text-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
                                    Enroll Now
                                </button>
                            ) : hasCustomFields && showEnrollForm ? (
                                <div className="space-y-3">
                                    <p className="text-xs font-bold uppercase opacity-50 mb-2">Please fill in the required info:</p>
                                    {event.customFields.map(field => (
                                        <div key={field.id}>
                                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">{field.label} {field.required && '*'}</label>
                                            <input type={field.type} value={customData[field.id] || ''} onChange={e => setCustomData(prev => ({ ...prev, [field.id]: e.target.value }))} className="edit-input w-full" placeholder={field.label} />
                                        </div>
                                    ))}
                                    <button onClick={handleEnroll} disabled={loadingEnroll} className="w-full py-3 bg-purple-600 text-white font-black uppercase text-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                                        {loadingEnroll ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Enrollment'}
                                    </button>
                                </div>
                            ) : (
                                <button onClick={handleEnroll} disabled={loadingEnroll} className="w-full py-3 bg-purple-600 text-white font-black uppercase text-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                                    {loadingEnroll ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enroll Now'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Enrolled Students (visible to admin/cr/owner) */}
                {canManage && (
                    <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                        <div className="px-4 py-2 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-zinc-700 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40 flex items-center gap-1">
                                <Users className="w-3 h-3" /> Enrolled Students ({enrollments.length})
                            </span>
                        </div>
                        {enrollments.length === 0 ? (
                            <div className="p-8 text-center text-xs opacity-30 font-bold uppercase tracking-widest">No enrollments yet</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-zinc-800 border-b border-black/10 dark:border-zinc-700">
                                            <th className="px-4 py-2.5 text-left font-black uppercase tracking-wider">#</th>
                                            <th className="px-4 py-2.5 text-left font-black uppercase tracking-wider">Name</th>
                                            <th className="px-4 py-2.5 text-left font-black uppercase tracking-wider">Roll</th>
                                            <th className="px-4 py-2.5 text-left font-black uppercase tracking-wider">Dept/Sem</th>
                                            {event.customFields?.map(f => (
                                                <th key={f.id} className="px-4 py-2.5 text-left font-black uppercase tracking-wider">{f.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {enrollments.map((en, i) => (
                                            <tr key={en.id} className="border-b border-black/5 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-4 py-2.5 font-mono opacity-40">{i + 1}</td>
                                                <td className="px-4 py-2.5 font-bold uppercase">{en.name}</td>
                                                <td className="px-4 py-2.5 font-mono">{en.roll}</td>
                                                <td className="px-4 py-2.5 font-mono opacity-60">{en.dept}/{en.sem}</td>
                                                {event.customFields?.map(f => (
                                                    <td key={f.id} className="px-4 py-2.5 font-mono">{en.customData?.[f.id] || '—'}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                <div className="h-20 lg:hidden" />
            </div>
        </div>
    );
}
