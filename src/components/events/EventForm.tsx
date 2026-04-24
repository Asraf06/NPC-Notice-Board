'use client';
import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Loader2, Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import type { EventData, CustomField } from './types';

interface Props {
    event?: EventData;
    onBack: () => void;
}

export default function EventForm({ event, onBack }: Props) {
    const { userProfile } = useAuth();
    const { showToast, showAlert } = useUI();
    const isEdit = !!event;
    const isAdmin = userProfile?.role === 'admin';

    const [title, setTitle] = useState(event?.title || '');
    const [description, setDescription] = useState(event?.description || '');
    const [date, setDate] = useState(event?.date || '');
    const [time, setTime] = useState(event?.time || '');
    const [location, setLocation] = useState(event?.location || '');
    const [deadline, setDeadline] = useState(event?.deadline || '');
    const [targetDept, setTargetDept] = useState(event?.targetDept || (isAdmin ? 'all' : userProfile?.dept || ''));
    const [targetSem, setTargetSem] = useState(event?.targetSem || (isAdmin ? 'all' : userProfile?.sem || ''));
    const [targetSection, setTargetSection] = useState(event?.targetSection || (isAdmin ? 'all' : userProfile?.section || ''));
    const [isActive, setIsActive] = useState(event?.isActive ?? true);
    const [customFields, setCustomFields] = useState<CustomField[]>(event?.customFields || []);
    const [saving, setSaving] = useState(false);

    // Date helpers
    const toISO = (d: string) => { if (!d) return ''; const p = d.split('/'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d; };
    const fromISO = (d: string) => { if (!d) return ''; const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };

    const addField = () => {
        setCustomFields(prev => [...prev, { id: Date.now().toString(), label: '', type: 'text', required: false }]);
    };
    const removeField = (id: string) => setCustomFields(prev => prev.filter(f => f.id !== id));
    const updateField = (id: string, key: keyof CustomField, val: any) => {
        setCustomFields(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
    };

    const handleSave = async () => {
        if (!title.trim()) { showAlert('Error', 'Event title is required.', 'error'); return; }
        if (!userProfile) return;
        setSaving(true);
        try {
            const docId = event?.id || doc(collection(db, 'events')).id;
            const data: any = {
                title: title.trim(),
                description: description.trim(),
                date, time, location: location.trim(),
                deadline,
                targetDept, targetSem, targetSection,
                isActive,
                customFields: customFields.filter(f => f.label.trim()),
                updatedAt: serverTimestamp(),
            };
            if (!isEdit) {
                data.createdBy = userProfile.name;
                data.createdByUid = userProfile.uid;
                data.createdByRole = isAdmin ? 'admin' : 'cr';
                data.createdAt = serverTimestamp();
                data.enrollmentCount = 0;
            }
            await setDoc(doc(db, 'events', docId), data, { merge: isEdit });
            showToast(isEdit ? 'Event updated!' : 'Event created!');
            onBack();
        } catch (err: any) {
            showAlert('Error', err.message || 'Failed to save event.', 'error');
        } finally { setSaving(false); }
    };

    return (
        <div className="w-full h-full min-h-0 overflow-y-auto custom-scrollbar min-w-0">
            <div className="locomotive-content-wrapper max-w-[800px] mx-auto px-4 py-8">
                <button onClick={onBack} className="flex items-center gap-2 mb-6 text-xs font-black uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity">
                    <ArrowLeft className="w-4 h-4" /> Back to Events
                </button>

                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-8">
                    {isEdit ? 'Edit Event' : 'Create Event'}
                </h1>

                <div className="space-y-6">
                    {/* Title */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Title *</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" className="edit-input w-full" />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this event about?" rows={3} className="edit-input w-full resize-y" />
                    </div>

                    {/* Date, Time, Location */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Date</label>
                            <input type="date" value={toISO(date)} onChange={e => setDate(fromISO(e.target.value))} className="edit-input w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Time</label>
                            <input value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 10:00 AM" className="edit-input w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Location</label>
                            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Room 301" className="edit-input w-full" />
                        </div>
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Enrollment Deadline</label>
                        <input type="date" value={toISO(deadline)} onChange={e => setDeadline(fromISO(e.target.value))} className="edit-input w-full md:w-1/3" />
                    </div>

                    {/* Target Audience */}
                    <div className="border-2 border-black dark:border-zinc-800 overflow-hidden">
                        <div className="px-4 py-2 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-zinc-700">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Target Audience</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Department</label>
                                {isAdmin ? (
                                    <input value={targetDept} onChange={e => setTargetDept(e.target.value)} placeholder="all or dept name" className="edit-input w-full" />
                                ) : (
                                    <input value={targetDept} readOnly className="edit-input w-full opacity-50" />
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Semester</label>
                                {isAdmin ? (
                                    <input value={targetSem} onChange={e => setTargetSem(e.target.value)} placeholder="all or semester" className="edit-input w-full" />
                                ) : (
                                    <input value={targetSem} readOnly className="edit-input w-full opacity-50" />
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Section</label>
                                {isAdmin ? (
                                    <input value={targetSection} onChange={e => setTargetSection(e.target.value)} placeholder="all or section" className="edit-input w-full" />
                                ) : (
                                    <input value={targetSection} readOnly className="edit-input w-full opacity-50" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Visibility */}
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setIsActive(!isActive)}
                            className={`w-12 h-7 rounded-full border-2 border-black dark:border-zinc-600 relative transition-colors ${isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-700'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white border border-black/20 transition-all ${isActive ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                        <span className="text-xs font-black uppercase tracking-wider">{isActive ? 'Visible to students' : 'Hidden from students'}</span>
                    </div>

                    {/* Custom Fields */}
                    <div className="border-2 border-black dark:border-zinc-800 overflow-hidden">
                        <div className="px-4 py-2 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-zinc-700 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Extra Info from Students</span>
                            <button onClick={addField} className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:opacity-70">
                                <Plus className="w-3 h-3" /> Add Field
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            {customFields.length === 0 && (
                                <p className="text-xs opacity-30 text-center py-4 uppercase tracking-widest">No extra fields — students enroll with one click</p>
                            )}
                            {customFields.map(field => (
                                <div key={field.id} className="flex items-center gap-2">
                                    <input value={field.label} onChange={e => updateField(field.id, 'label', e.target.value)}
                                        placeholder="Field name (e.g. Phone Number)" className="edit-input flex-1 min-w-0" />
                                    <select value={field.type} onChange={e => updateField(field.id, 'type', e.target.value)}
                                        className="edit-input w-24 text-xs">
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="email">Email</option>
                                        <option value="tel">Phone</option>
                                    </select>
                                    <label className="flex items-center gap-1 text-[10px] font-bold uppercase shrink-0">
                                        <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, 'required', e.target.checked)} />
                                        Req
                                    </label>
                                    <button onClick={() => removeField(field.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Save */}
                    <div className="flex gap-3 pt-4 border-t-2 border-black dark:border-zinc-800">
                        <button onClick={onBack} disabled={saving}
                            className="flex-1 border-2 border-black dark:border-zinc-700 font-bold uppercase text-xs py-3 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex-[2] bg-black text-white dark:bg-white dark:text-black font-bold uppercase text-xs py-3 flex justify-center items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {isEdit ? 'Update Event' : 'Create Event'}</>}
                        </button>
                    </div>
                </div>
                <div className="h-20 lg:hidden" />
            </div>
        </div>
    );
}
