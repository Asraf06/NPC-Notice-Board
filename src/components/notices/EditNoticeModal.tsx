'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, CloudUpload, Loader2, Undo2, PlayCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import CustomSelect from '@/components/CustomSelect';
import type { NoticeData } from './NoticeCard';

interface EditNoticeModalProps {
    notice: NoticeData;
    onClose: () => void;
}

import { secureUploadFile, deleteUploadedFiles } from '@/lib/uploadService';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

export default function EditNoticeModal({ notice, onClose }: EditNoticeModalProps) {
    const { userProfile } = useAuth();
    const { showAlert, showToast } = useUI();
    const [title, setTitle] = useState(notice.title);
    const [body, setBody] = useState(notice.body);
    const [category, setCategory] = useState(notice.type || 'general');
    const [subject, setSubject] = useState(notice.subject || '');
    const [layout, setLayout] = useState(notice.layout || 'text');
    const [categories, setCategories] = useState<{ name: string; value: string }[]>([]);
    const [subjects, setSubjects] = useState<{ label: string; value: string }[]>([]);

    // Attachment management
    const [existingAttachments, setExistingAttachments] = useState(notice.attachments || []);
    const [deletedIndexes, setDeletedIndexes] = useState<Set<number>>(new Set());
    const [newFiles, setNewFiles] = useState<FileList | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    useSmoothScroll(modalRef);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [progressPct, setProgressPct] = useState(0);
    const [showProgress, setShowProgress] = useState(false);

    // Load categories & subjects
    useEffect(() => {
        if (!userProfile) return;
        getDocs(query(collection(db, 'notice_categories'), orderBy('name'))).then(snap => {
            const cats: { name: string; value: string }[] = [];
            snap.forEach(d => { const c = d.data(); cats.push({ name: c.name, value: c.value || c.name }); });
            if (cats.length === 0) cats.push({ name: 'General', value: 'general' });
            setCategories(cats);
        });
        getDocs(collection(db, 'notice_subjects')).then(snap => {
            const subs: { label: string; value: string }[] = [];
            snap.forEach(d => {
                const s = d.data();
                if ((s.dept === 'all' || s.dept === userProfile.dept) && (s.sem === 'all' || s.sem === userProfile.sem) && (!s.section || s.section === 'all' || s.section === userProfile.section)) {
                    subs.push({ label: `${s.name} [${s.code}]`, value: `${s.name} (${s.code})` });
                }
            });
            setSubjects(subs);
        });
    }, [userProfile]);

    if (typeof document === 'undefined') return null;

    const toggleDeleteAttachment = (idx: number) => {
        setDeletedIndexes(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx); else next.add(idx);
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;
        setIsSubmitting(true);

        try {
            // Build final attachments: existing minus deleted
            const deletedAttachments = existingAttachments.filter((_: unknown, idx: number) => deletedIndexes.has(idx));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let finalAttachments: any[] = existingAttachments.filter((_: unknown, idx: number) => !deletedIndexes.has(idx));

            // Delete removed attachments from cloud storage
            if (deletedAttachments.length > 0) {
                const filesToDelete = deletedAttachments
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .filter((att: any) => att.service && att.fileId)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((att: any) => ({ service: att.service, fileId: att.fileId }));
                if (filesToDelete.length > 0) {
                    await deleteUploadedFiles(filesToDelete);
                }
            }

            // Upload new files
            if (newFiles && newFiles.length > 0) {
                setShowProgress(true);
                for (let i = 0; i < newFiles.length; i++) {
                    const file = newFiles[i];
                    setUploadProgress(`Uploading ${i + 1}/${newFiles.length}: ${file.name}...`);
                    setProgressPct(Math.round((i / newFiles.length) * 100));
                    const uploaded = await secureUploadFile(file);
                    if (uploaded) finalAttachments.push(uploaded);
                }
                setProgressPct(100);
            }

            await updateDoc(doc(db, 'notices', notice.id), {
                title: title.trim(),
                body: body.trim(),
                type: category,
                category,
                subject,
                layout,
                attachments: finalAttachments,
                updatedAt: serverTimestamp(),
            });

            showToast('Notice updated successfully!');
            onClose();
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to update notice.', 'error');
        } finally {
            setIsSubmitting(false);
            setShowProgress(false);
        }
    };

    const newFileCount = newFiles ? newFiles.length : 0;

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            {/* Modal Body */}
            <div ref={modalRef} className="bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-lg max-h-[90vh] overflow-y-auto relative shadow-[8px_8px_0px_0px_rgba(147,51,234,0.5)]" onClick={e => e.stopPropagation()}>
                <div className="locomotive-content-wrapper">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b-2 border-black dark:border-white">
                        <h2 className="text-xl font-bold uppercase tracking-widest">Edit Notice</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1 opacity-70">Title</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                                className="w-full p-3 border-2 border-black dark:border-white bg-transparent font-mono outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1 opacity-70">Message</label>
                            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} required
                                className="w-full p-3 border-2 border-black dark:border-white bg-transparent font-mono outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
                        </div>

                        {/* Dropdowns */}
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold uppercase mb-1 opacity-70">Category</label>
                                <CustomSelect
                                    value={category}
                                    onChange={setCategory}
                                    options={categories.map(c => ({ value: c.value, label: c.name }))}
                                    placeholder="Category"
                                    className="w-full p-2 border-2 border-black dark:border-white bg-white dark:bg-black font-mono text-xs outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase mb-1 opacity-70">Subject (Optional)</label>
                                <CustomSelect
                                    value={subject}
                                    onChange={setSubject}
                                    options={[{ value: '', label: '-- None --' }, ...subjects.map(s => ({ value: s.value, label: s.label }))]}
                                    placeholder="Subject"
                                    className="w-full p-2 border-2 border-black dark:border-white bg-white dark:bg-black font-mono text-xs outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase mb-1 opacity-70">Layout</label>
                                <CustomSelect
                                    value={layout}
                                    onChange={setLayout}
                                    options={[
                                        { value: 'text', label: 'Text Only' },
                                        { value: 'grid', label: 'Image Grid' },
                                        { value: 'slider', label: 'Image Slider' },
                                        { value: 'video_feed', label: 'Video Feed' }
                                    ]}
                                    placeholder="Layout"
                                    className="w-full p-2 border-2 border-black dark:border-white bg-white dark:bg-black font-mono text-xs outline-none"
                                />
                            </div>
                        </div>

                        {/* Existing Attachments */}
                        {existingAttachments.length > 0 && (
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 opacity-70">Current Attachments</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {existingAttachments.map((att, idx) => {
                                        const isDeleted = deletedIndexes.has(idx);
                                        return (
                                            <div key={idx} className={`relative aspect-square ${isDeleted ? 'opacity-30' : ''} transition-opacity`}>
                                                {att.type === 'video' ? (
                                                    <div className={`w-full h-full bg-black border-2 ${isDeleted ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} flex items-center justify-center`}>
                                                        <PlayCircle className="w-8 h-8 text-white" />
                                                    </div>
                                                ) : (
                                                    <img src={att.thumb || att.url} className={`w-full h-full object-cover border-2 ${isDeleted ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}`} alt="" />
                                                )}
                                                <button type="button" onClick={() => toggleDeleteAttachment(idx)}
                                                    className={`absolute ${isDeleted ? 'inset-0 flex items-center justify-center bg-black/60 text-white text-xs font-bold uppercase' : 'top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white shadow-lg'}`}>
                                                    {isDeleted ? <><Undo2 className="w-4 h-4 mr-1" /> Restore</> : <X className="w-3 h-3" />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Add New Media */}
                        <div>
                            <label className="block text-xs font-bold uppercase mb-2 opacity-70">Add New Media</label>
                            <label onClick={() => fileRef.current?.click()}
                                className="block w-full p-3 border-2 border-dashed border-gray-400 dark:border-gray-600 text-center cursor-pointer hover:border-purple-500 transition-colors group">
                                <CloudUpload className="w-6 h-6 mx-auto opacity-50 mb-1 group-hover:text-purple-500 group-hover:opacity-100 transition-all" />
                                <p className="font-bold uppercase text-xs">Click to Upload</p>
                                <p className="text-[10px] opacity-50 mt-1">{newFileCount > 0 ? `${newFileCount} new file(s) selected` : 'No new files selected'}</p>
                            </label>
                            <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
                                onChange={e => setNewFiles(e.target.files)} />
                        </div>

                        {/* Progress */}
                        {showProgress && (
                            <div>
                                <p className="text-xs font-mono mb-1 text-purple-600 dark:text-purple-400">{uploadProgress}</p>
                                <div className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${progressPct}%` }} />
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 border-2 border-black dark:border-white font-bold uppercase hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={isSubmitting}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : <><Save className="w-4 h-4" /> Update</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}
