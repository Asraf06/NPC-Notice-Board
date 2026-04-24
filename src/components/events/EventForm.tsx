'use client';
import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Loader2, Save, ImagePlus, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { secureUploadFile, deleteUploadedFiles } from '@/lib/uploadService';
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
    const [isActive, setIsActive] = useState(event?.isActive ?? true);
    const [customFields, setCustomFields] = useState<CustomField[]>(event?.customFields || []);
    const [saving, setSaving] = useState(false);

    // Image state
    const [images, setImages] = useState<{ url: string; fileId: string | null; service: string }[]>(event?.images || []);
    const [uploading, setUploading] = useState(false);

    // Date helpers: dd/mm/yyyy <-> yyyy-mm-dd
    const toISO = (d: string) => { if (!d) return ''; const p = d.split('/'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d; };
    const fromISO = (d: string) => { if (!d) return ''; const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };

    const addField = () => {
        setCustomFields(prev => [...prev, { id: Date.now().toString(), label: '', type: 'text', required: false }]);
    };
    const removeField = (id: string) => setCustomFields(prev => prev.filter(f => f.id !== id));
    const updateField = (id: string, key: keyof CustomField, val: any) => {
        setCustomFields(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
    };

    // Build folder path: /events/{dept}_{sem}_{section}
    const getFolderPath = () => {
        const dept = userProfile?.dept || 'unknown';
        const sem = userProfile?.sem || 'unknown';
        const section = userProfile?.section || 'unknown';
        return `/events/${dept}_${sem}_${section}`;
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const result = await secureUploadFile(files[i], getFolderPath());
                if (result) {
                    setImages(prev => [...prev, { url: result.url, fileId: result.fileId, service: result.service }]);
                }
            }
        } catch (err: any) {
            showAlert('Upload Error', err.message || 'Failed to upload image.', 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleRemoveImage = async (idx: number) => {
        const img = images[idx];
        if (img.fileId) {
            try {
                await deleteUploadedFiles([{ service: img.service, fileId: img.fileId }]);
            } catch (err) {
                console.error('Failed to delete image from CDN:', err);
            }
        }
        setImages(prev => prev.filter((_, i) => i !== idx));
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
                targetDept: isAdmin ? 'all' : userProfile.dept,
                targetSem: isAdmin ? 'all' : userProfile.sem,
                targetSection: isAdmin ? 'all' : userProfile.section,
                isActive,
                customFields: customFields.filter(f => f.label.trim()),
                images,
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
                            <input type="text" value={date} onChange={e => setDate(e.target.value)} placeholder="dd/mm/yyyy" className="edit-input w-full" />
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
                        <input type="text" value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="dd/mm/yyyy" className="edit-input w-full md:w-1/3" />
                    </div>

                    {/* Images */}
                    <div className="border-2 border-black dark:border-zinc-800 overflow-hidden">
                        <div className="px-4 py-2 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-zinc-700 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Event Images</span>
                            <label className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:opacity-70 cursor-pointer">
                                <ImagePlus className="w-3 h-3" />
                                {uploading ? 'Uploading...' : 'Add Image'}
                                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" disabled={uploading} />
                            </label>
                        </div>
                        <div className="p-4">
                            {images.length === 0 && !uploading && (
                                <p className="text-xs opacity-30 text-center py-4 uppercase tracking-widest">No images added</p>
                            )}
                            {uploading && (
                                <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold uppercase opacity-50">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                                </div>
                            )}
                            {images.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {images.map((img, idx) => (
                                        <div key={idx} className="relative group border-2 border-black/10 dark:border-zinc-700 overflow-hidden aspect-video bg-gray-100 dark:bg-zinc-800">
                                            <img src={img.url} alt={`Event image ${idx + 1}`} className="w-full h-full object-cover" />
                                            <button onClick={() => handleRemoveImage(idx)}
                                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
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
