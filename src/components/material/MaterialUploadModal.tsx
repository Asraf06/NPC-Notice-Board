'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, FileUp, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { secureUploadWithProgress } from '@/lib/uploadService';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import CustomSelect from '@/components/CustomSelect';

interface MaterialUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploaded: () => void;
    tabNames?: Record<string, string>;
}

export default function MaterialUploadModal({ isOpen, onClose, onUploaded, tabNames }: MaterialUploadModalProps) {
    const { userProfile } = useAuth();
    const { showAlert, showToast } = useUI();
    const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
    const [materialType, setMaterialType] = useState('Syllabus');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [showProgress, setShowProgress] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    useSmoothScroll(scrollRef);

    if (!isOpen) return null;
    if (typeof document === 'undefined') return null;

    const resetForm = () => {
        setUploadMode('file');
        setMaterialType('Syllabus');
        setSubject('');
        setDescription('');
        setLinkUrl('');
        setSelectedFiles([]);
        setIsSubmitting(false);
        setUploadProgress(0);
        setShowProgress(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    // Upload via secure server-side proxy (keys never reach browser)
    const uploadFile = async (file: File) => {
        try {
            return await secureUploadWithProgress(file, (pct) => setUploadProgress(pct));
        } catch (error) {
            console.error('Upload error:', error);
            return null;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;

        // Validation
        if (!subject.trim()) {
            showAlert('Required', 'Please enter a subject title.', 'warning');
            return;
        }

        if (uploadMode === 'file') {
            if (selectedFiles.length === 0) {
                showAlert('Required', 'Select at least one document!', 'warning');
                return;
            }
            // Check sizes for each file (10MB Limit)
            for (const file of selectedFiles) {
                const fileSizeMB = file.size / (1024 * 1024);
                if (fileSizeMB > 9.5) {
                    showAlert('File Too Large', `File ${file.name} is too large! Free upload limit is 10MB per file. Please use the "Paste Link" tab for larger files.`, 'error');
                    return;
                }
            }
        } else {
            if (!linkUrl.trim()) {
                showAlert('Required', 'Paste a valid link!', 'warning');
                return;
            }
        }

        setIsSubmitting(true);

        try {
            // Handle file upload
            const uploadedFiles: { url: string; service: string | null; fileId: string | null }[] = [];

            if (uploadMode === 'file' && selectedFiles.length > 0) {
                setShowProgress(true);
                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    // Progress for multiple files
                    setUploadProgress((i / selectedFiles.length) * 100);

                    const uploadResult = await uploadFile(file);
                    if (!uploadResult || !uploadResult.url) {
                        throw new Error(`Upload returned no URL for ${file.name}`);
                    }

                    uploadedFiles.push({
                        url: uploadResult.url,
                        service: uploadResult.service || null,
                        fileId: uploadResult.fileId || null,
                    });
                }
                setUploadProgress(100);

                await addDoc(collection(db, 'materials'), {
                    type: materialType,
                    subject: subject.trim(),
                    description: description.trim(),
                    url: uploadedFiles[0].url,
                    dept: userProfile.dept,
                    sem: userProfile.sem,
                    section: userProfile.section,
                    author: userProfile.name,
                    authorUid: userProfile.uid,
                    timestamp: serverTimestamp(),
                    // File deletion metadata
                    service: uploadedFiles[0].service,
                    fileId: uploadedFiles[0].fileId,
                    attachments: uploadedFiles,
                });
            } else if (uploadMode === 'link' && linkUrl.trim()) {
                await addDoc(collection(db, 'materials'), {
                    type: materialType,
                    subject: subject.trim(),
                    description: description.trim(),
                    url: linkUrl.trim(),
                    dept: userProfile.dept,
                    sem: userProfile.sem,
                    section: userProfile.section,
                    author: userProfile.name,
                    authorUid: userProfile.uid,
                    timestamp: serverTimestamp(),
                    // Link has no file deletion metadata
                    service: null,
                    fileId: null,
                });
            }

            showToast('Resource(s) published successfully!');
            handleClose();
            onUploaded();
        } catch (error) {
            console.error('Material upload failed:', error);
            showAlert('Error', 'Could not publish resource. Try again.', 'error');
        } finally {
            setIsSubmitting(false);
            setShowProgress(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleClose}
        >
            <div
                ref={scrollRef}
                className="bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-md p-6 relative shadow-[12px_12px_0px_0px_rgba(0,0,0,0.3)] max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="locomotive-content-wrapper">
                    {/* Close Button */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <h2 className="text-xl font-bold uppercase mb-6 tracking-widest">Upload Resource</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Resource Category */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase mb-1 opacity-60 tracking-wider">
                                Resource Category
                            </label>
                            <CustomSelect
                                value={materialType}
                                onChange={setMaterialType}
                                options={[
                                    { value: 'Syllabus', label: tabNames?.syllabus || 'Official Syllabus' },
                                    { value: 'Note', label: tabNames?.notes || 'Lecture Notes' },
                                    { value: 'Question', label: tabNames?.questions || 'Question Papers' }
                                ]}
                                placeholder="Select Type"
                                className="w-full p-3 border-2 border-black dark:border-white bg-white dark:bg-black font-mono text-sm outline-none"
                            />
                        </div>

                        {/* Subject Title */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase mb-1 opacity-60 tracking-wider">
                                Subject Title
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                required
                                placeholder="e.g. Theory of Computation"
                                className="w-full p-3 border-2 border-black dark:border-white bg-transparent font-mono text-sm outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase mb-1 opacity-60 tracking-wider">
                                Brief Description
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g. Unit 3 Handwritten Notes"
                                className="w-full p-3 border-2 border-black dark:border-white bg-transparent font-mono text-sm outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* Upload Method Toggle */}
                        <div>
                            <div className="flex gap-2 mb-4">
                                <button
                                    type="button"
                                    onClick={() => setUploadMode('file')}
                                    className={`flex-1 py-2 text-xs font-bold uppercase border-2 border-black dark:border-white transition-all ${uploadMode === 'file'
                                        ? 'bg-black text-white dark:bg-white dark:text-black'
                                        : 'bg-transparent opacity-50'
                                        }`}
                                >
                                    Upload File
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUploadMode('link')}
                                    className={`flex-1 py-2 text-xs font-bold uppercase border-2 border-black dark:border-white transition-all ${uploadMode === 'link'
                                        ? 'bg-black text-white dark:bg-white dark:text-black'
                                        : 'bg-transparent opacity-50'
                                        }`}
                                >
                                    Paste Link
                                </button>
                            </div>

                            {/* File Input Mode */}
                            {uploadMode === 'file' && (
                                <div>
                                    <label
                                        onClick={() => fileInputRef.current?.click()}
                                        className="block w-full p-6 border-2 border-dashed border-gray-400 dark:border-zinc-700 text-center cursor-pointer hover:border-purple-500 transition-colors group"
                                    >
                                        <FileUp className="w-8 h-8 mx-auto opacity-30 mb-2 group-hover:text-purple-500 group-hover:opacity-100 transition-all" />
                                        <p className="text-xs font-bold uppercase tracking-widest">
                                            Choose File (PDF/Image)
                                        </p>
                                        <p className="text-[10px] opacity-50 mt-1 font-mono">
                                            {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'Max size: 10MB per file'}
                                        </p>
                                    </label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="application/pdf,image/*"
                                        multiple
                                        onChange={(e) => {
                                            if (e.target.files) {
                                                setSelectedFiles(Array.from(e.target.files));
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {/* Link Input Mode */}
                            {uploadMode === 'link' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase mb-1 opacity-60 tracking-wider">
                                        Drive / Docs Link
                                    </label>
                                    <input
                                        type="url"
                                        value={linkUrl}
                                        onChange={(e) => setLinkUrl(e.target.value)}
                                        placeholder="https://drive.google.com/..."
                                        className="w-full p-3 border-2 border-black dark:border-white bg-transparent font-mono text-sm outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <p className="text-[9px] opacity-50 mt-1 font-mono">
                                        * Make sure the link is set to &quot;Anyone with the link can view&quot;
                                    </p>
                                </div>
                            )}

                            {/* Progress Bar */}
                            {showProgress && (
                                <div className="mt-3">
                                    <p className="text-[10px] font-mono mb-1 text-purple-600 dark:text-purple-400 font-bold uppercase">
                                        Uploading Resource... {uploadProgress}%
                                    </p>
                                    <div className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)] transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-purple-600 text-white font-bold uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                'Publish Resource'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}
