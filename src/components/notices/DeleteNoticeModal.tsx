'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { useUI } from '@/context/UIContext';
import { deleteUploadedFiles } from '@/lib/uploadService';

interface DeleteNoticeModalProps {
    noticeId: string;
    onClose: () => void;
    onDeleted: (id: string) => void;
}

export default function DeleteNoticeModal({ noticeId, onClose, onDeleted }: DeleteNoticeModalProps) {
    const { showAlert } = useUI();
    const [deleting, setDeleting] = useState(false);

    const confirmDelete = async () => {
        setDeleting(true);
        try {
            // 1️⃣ Fetch notice data to get file info
            const noticeRef = doc(db, 'notices', noticeId);
            const noticeSnap = await getDoc(noticeRef);

            if (noticeSnap.exists()) {
                const data = noticeSnap.data();
                const attachments = data.attachments || [];

                // 2️⃣ Delete files from cloud storage
                if (attachments.length > 0) {
                    const filesToDelete = attachments
                        .filter((att: { service?: string; fileId?: string }) => att.service && att.fileId)
                        .map((att: { service: string; fileId: string }) => ({
                            service: att.service,
                            fileId: att.fileId,
                        }));

                    if (filesToDelete.length > 0) {
                        await deleteUploadedFiles(filesToDelete);
                    }
                }
            }

            // 3️⃣ Delete the Firestore document
            await deleteDoc(noticeRef);
            onDeleted(noticeId);
            onClose();
            showAlert('Deleted', 'Notice and attached files have been removed.', 'success');
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to delete notice.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[170] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-black border-2 border-red-500 w-full max-w-sm p-6 text-center shadow-[8px_8px_0px_0px_rgba(239,68,68,0.5)]">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold uppercase mb-2">Delete Notice?</h3>
                <p className="text-sm opacity-70 mb-6">
                    This action cannot be undone. The notice and its attached files will be permanently removed.
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border-2 border-black dark:border-white font-bold uppercase hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={confirmDelete}
                        disabled={deleting}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}
