'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { useUI } from '@/context/UIContext';
import { deleteUploadedFiles } from '@/lib/uploadService';

interface DeleteMaterialModalProps {
    materialId: string;
    onClose: () => void;
    onDeleted: (id: string) => void;
}

export default function DeleteMaterialModal({ materialId, onClose, onDeleted }: DeleteMaterialModalProps) {
    const { showAlert } = useUI();
    const [deleting, setDeleting] = useState(false);

    const confirmDelete = async () => {
        setDeleting(true);
        try {
            // 1️⃣ Fetch material data to get cloud storage file info
            const materialRef = doc(db, 'materials', materialId);
            const materialSnap = await getDoc(materialRef);

            if (materialSnap.exists()) {
                const data = materialSnap.data();

                // 2️⃣ Delete file(s) from cloud storage if metadata exists
                if (data.attachments && data.attachments.length > 0) {
                    const filesToDelete = data.attachments
                        .filter((att: any) => att.service && att.fileId)
                        .map((att: any) => ({ service: att.service, fileId: att.fileId }));
                    if (filesToDelete.length > 0) {
                        await deleteUploadedFiles(filesToDelete);
                    }
                } else if (data.service && data.fileId) {
                    await deleteUploadedFiles([{ service: data.service, fileId: data.fileId }]);
                }
            }

            // 3️⃣ Delete the Firestore document
            await deleteDoc(materialRef);
            onDeleted(materialId);
            onClose();
            showAlert('Deleted', 'Material has been removed.', 'success');
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to delete material.', 'error');
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
                <h3 className="text-xl font-bold uppercase mb-2">Delete Material?</h3>
                <p className="text-sm opacity-70 mb-6">
                    This action cannot be undone. The material document and its attached file will be permanently removed.
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
