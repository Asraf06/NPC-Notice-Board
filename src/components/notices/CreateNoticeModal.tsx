'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, CloudUpload, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { apiUrl } from '@/lib/apiBase';
import CustomSelect from '@/components/CustomSelect';

interface CreateNoticeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

import { secureUploadFile } from '@/lib/uploadService';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';


export default function CreateNoticeModal({ isOpen, onClose }: CreateNoticeModalProps) {
    const { userProfile } = useAuth();
    const { showAlert, showToast } = useUI();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [category, setCategory] = useState('general');
    const [subject, setSubject] = useState('');
    const [layout, setLayout] = useState('text');
    const [categories, setCategories] = useState<{ name: string; value: string }[]>([]);
    const [subjects, setSubjects] = useState<{ label: string; value: string }[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [progressPct, setProgressPct] = useState(0);
    const [showProgress, setShowProgress] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    useSmoothScroll(scrollRef);

    // Load categories & subjects when modal opens
    useEffect(() => {
        if (!isOpen || !userProfile) return;

        // Load categories
        getDocs(query(collection(db, 'notice_categories'), orderBy('name'))).then(snap => {
            const cats: { name: string; value: string }[] = [];
            const seen = new Set<string>();
            snap.forEach(d => {
                const c = d.data();
                const val = c.value || c.name;
                if (!seen.has(val)) {
                    seen.add(val);
                    cats.push({ name: c.name, value: val });
                }
            });
            if (cats.length === 0) cats.push({ name: 'General', value: 'general' });
            setCategories(cats);
            setCategory(cats[0]?.value || 'general');
        });

        // Load subjects filtered by dept/sem
        getDocs(collection(db, 'notice_subjects')).then(snap => {
            const subs: { label: string; value: string }[] = [];
            snap.forEach(d => {
                const s = d.data();
                if ((s.dept === 'all' || s.dept === userProfile.dept) &&
                    (s.sem === 'all' || s.sem === userProfile.sem)) {
                    subs.push({ label: `${s.name} [${s.code}]`, value: `${s.name} (${s.code})` });
                }
            });
            setSubjects(subs);
        });
    }, [isOpen, userProfile]);

    if (!isOpen || typeof document === 'undefined') return null;

    const resetForm = () => {
        setTitle(''); setBody(''); setCategory('general'); setSubject(''); setLayout('text');
        setSelectedFiles(null); setIsSubmitting(false); setShowProgress(false);
        setUploadProgress(''); setProgressPct(0);
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleClose = () => { resetForm(); onClose(); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;
        setIsSubmitting(true);

        try {
            // Upload files if any
            let attachments: { type: string; url: string; thumb: string | null; name: string; service: string; fileId: string | null }[] = [];
            if (selectedFiles && selectedFiles.length > 0) {
                setShowProgress(true);
                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    setUploadProgress(`Uploading ${i + 1}/${selectedFiles.length}: ${file.name}...`);
                    setProgressPct(Math.round(((i) / selectedFiles.length) * 100));

                    const uploaded = await secureUploadFile(file);
                    if (uploaded) attachments.push(uploaded);
                }
                setProgressPct(100);
            }

            const roleSuffix = userProfile.role === 'admin' ? '(Admin)' : '(CR)';
            const authorName = `${userProfile.name} ${roleSuffix}`;
            const docRef = await addDoc(collection(db, 'notices'), {
                title: title.trim(),
                body: body.trim(),
                targetDept: userProfile.dept,
                targetSem: userProfile.sem,
                targetSection: userProfile.section,
                type: category,
                category,
                subject,
                layout,
                attachments,
                timestamp: serverTimestamp(),
                author: authorName,
                authorUid: userProfile.uid,
                views: 0,
            });

            // Fire-and-forget: send FCM push notifications
            fetch(apiUrl('/api/notifications/notice'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    noticeId: docRef.id,
                    title: title.trim(),
                    body: body.trim(),
                    author: authorName,
                    authorUid: userProfile.uid,
                    category,
                    targetDept: userProfile.dept,
                    targetSem: userProfile.sem,
                    targetSection: userProfile.section,
                }),
            }).catch(err => console.warn('[Notification] Failed to send push:', err));

            showToast('Notice posted successfully!');
            handleClose();
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to post notice.', 'error');
        } finally {
            setIsSubmitting(false);
            setShowProgress(false);
        }
    };

    const fileCount = selectedFiles ? selectedFiles.length : 0;

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
            <div ref={scrollRef} className="bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-lg max-h-[90vh] overflow-y-auto relative shadow-[8px_8px_0px_0px_rgba(147,51,234,0.5)]" onClick={e => e.stopPropagation()}>
                <div className="locomotive-content-wrapper">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b-2 border-black dark:border-white">
                        <h2 className="text-xl font-bold uppercase tracking-widest">Create CR Notice</h2>
                        <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1 opacity-70">Title</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Notice title..."
                                className="w-full p-3 border-2 border-black dark:border-white bg-transparent font-mono outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1 opacity-70">Message</label>
                            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} required placeholder="Notice content..."
                                className="w-full p-3 border-2 border-black dark:border-white bg-transparent font-mono outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
                        </div>

                        {/* Dropdowns Row */}
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

                        {/* File Upload */}
                        <div>
                            <label onClick={() => fileRef.current?.click()}
                                className="block w-full p-4 border-2 border-dashed border-gray-400 dark:border-gray-600 text-center cursor-pointer hover:border-purple-500 transition-colors group">
                                <CloudUpload className="w-8 h-8 mx-auto opacity-50 mb-2 group-hover:text-purple-500 group-hover:opacity-100 transition-all" />
                                <p className="font-bold uppercase text-sm">Click to Upload Images/Videos</p>
                                <p className="text-xs opacity-50 mt-1">{fileCount > 0 ? `${fileCount} file(s) selected` : 'No files selected'}</p>
                            </label>
                            <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
                                onChange={e => setSelectedFiles(e.target.files)} />
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

                        {/* Submit */}
                        <button type="submit" disabled={isSubmitting}
                            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Posting...</> : <><Send className="w-4 h-4" /> Post to Class</>}
                        </button>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}
