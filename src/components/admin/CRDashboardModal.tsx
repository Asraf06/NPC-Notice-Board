'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LayoutDashboard, PlusCircle, Users, Image as ImageIcon, MailWarning, Pin, Loader2, ClipboardCheck, QrCode } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUI } from '@/context/UIContext';
import { useRouter } from 'next/navigation';
import ManageBoardRollsModal from './ManageBoardRollsModal';
import AttendanceQRModal from './AttendanceQRModal';

interface CRDashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenCreateNotice: () => void;
}

export default function CRDashboardModal({ isOpen, onClose, onOpenCreateNotice }: CRDashboardModalProps) {
    const { userProfile, globalSettings } = useAuth();
    const { showAlert } = useUI();
    const router = useRouter();
    const [showRollsModal, setShowRollsModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [togglingGmail, setTogglingGmail] = useState(false);
    // Pinning state - usually stored in localStorage as per index_anigravity.html
    const [pinnedTools, setPinnedTools] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            return JSON.parse(localStorage.getItem('pinnedTools_v1') || '[]');
        }
        return [];
    });

    if (typeof document === 'undefined') return null;

    const togglePin = (toolId: string) => {
        const next = pinnedTools.includes(toolId)
            ? pinnedTools.filter(t => t !== toolId)
            : [...pinnedTools, toolId];
        setPinnedTools(next);
        localStorage.setItem('pinnedTools_v1', JSON.stringify(next));
        window.dispatchEvent(new Event('pinnedToolsChanged'));
    };

    const triggerGroupIconUpload = () => {
        const input = document.getElementById('group-icon-upload-input') as HTMLInputElement;
        if (input) input.click();
    };

    const toggleGmailRestriction = async () => {
        if (togglingGmail) return;
        setTogglingGmail(true);
        try {
            const newValue = !globalSettings.restrictGmail;
            await updateDoc(doc(db, 'settings', 'config'), {
                restrictGmail: newValue,
            });
            showAlert(
                newValue ? 'Restriction Enabled' : 'Restriction Disabled',
                newValue
                    ? 'Only @gmail.com addresses can now register/login.'
                    : 'All email domains are now allowed for registration/login.',
                'success'
            );
        } catch (err) {
            console.error('Failed to toggle Gmail restriction:', err);
            showAlert('Error', 'Failed to update Gmail restriction setting.', 'error');
        } finally {
            setTogglingGmail(false);
        }
    };

    const isGmailRestricted = globalSettings.restrictGmail;

    return createPortal(
        <>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop with fade */}
                        <motion.div
                            className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={onClose}
                        />

                        {/* Modal panel — pops from bottom-right (where the Manage Website button is) */}
                        <motion.div
                            className="fixed inset-0 z-[151] flex items-center justify-center p-4 pointer-events-none"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-sm p-6 relative shadow-[12px_12px_0px_0px_rgba(255,255,255,0.2)] pointer-events-auto"
                                style={{ transformOrigin: 'bottom right' }}
                                initial={{ scale: 0.3, opacity: 0, y: 80, x: 40 }}
                                animate={{ scale: 1, opacity: 1, y: 0, x: 0 }}
                                exit={{ scale: 0.3, opacity: 0, y: 80, x: 40 }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 500,
                                    damping: 30,
                                }}
                                onClick={e => e.stopPropagation()}
                            >
                                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors">
                                    <X className="w-6 h-6" />
                                </button>

                                <h2 className="text-xl font-bold uppercase mb-6 border-b-2 border-black dark:border-white pb-2 flex items-center gap-2">
                                    <LayoutDashboard className="w-6 h-6" /> CR Dashboard
                                </h2>

                                <div className="space-y-3">
                                    {/* Post New Notice */}
                                    <div className="relative w-full group">
                                        <button
                                            onClick={() => { onClose(); onOpenCreateNotice(); }}
                                            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.02] pr-12"
                                        >
                                            <PlusCircle className="w-5 h-5" /> Post New Notice
                                        </button>
                                        <button
                                            onClick={() => togglePin('post_notice')}
                                            className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 rounded-full transition-colors ${pinnedTools.includes('post_notice') ? 'text-yellow-400' : 'text-white'}`}
                                            title="Pin to Main Screen"
                                        >
                                            <Pin className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Manage Attendance */}
                                    <div className="relative w-full group">
                                        <button
                                            onClick={() => { onClose(); router.push('/attendance-manager'); }}
                                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.02] pr-12"
                                        >
                                            <ClipboardCheck className="w-5 h-5" /> Manage Attendance
                                        </button>
                                        <button
                                            onClick={() => togglePin('manage_attendance')}
                                            className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 rounded-full transition-colors ${pinnedTools.includes('manage_attendance') ? 'text-yellow-400' : 'text-white'}`}
                                            title="Pin to Main Screen"
                                        >
                                            <Pin className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Show Attendance QR */}
                                    <div className="relative w-full group">
                                        <button
                                            onClick={() => setShowQRModal(true)}
                                            className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-black font-bold uppercase flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.02] border-2 border-black pr-12"
                                        >
                                            <QrCode className="w-5 h-5" /> Show Attendance QR
                                        </button>
                                        <button
                                            onClick={() => togglePin('show_qr')}
                                            className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-black/10 rounded-full transition-colors ${pinnedTools.includes('show_qr') ? 'text-black' : 'text-black/50'}`}
                                            title="Pin to Main Screen"
                                        >
                                            <Pin className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Manage Board Rolls */}
                                    <div className="relative w-full group">
                                        <button
                                            onClick={() => setShowRollsModal(true)}
                                            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black hover:opacity-80 font-bold uppercase flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.02] pr-12 border-2 border-black dark:border-white"
                                        >
                                            <Users className="w-5 h-5" /> Manage Board Rolls
                                        </button>
                                        <button
                                            onClick={() => togglePin('manage_rolls')}
                                            className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 dark:hover:bg-black/20 rounded-full transition-colors ${pinnedTools.includes('manage_rolls') ? 'text-yellow-400' : 'text-zinc-400 dark:text-zinc-600'}`}
                                            title="Pin to Main Screen"
                                        >
                                            <Pin className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Manage Group Icon */}
                                    <div className="relative w-full group">
                                        <button
                                            onClick={triggerGroupIconUpload}
                                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.02] pr-12"
                                        >
                                            <ImageIcon className="w-5 h-5" /> Manage Group Icon
                                        </button>
                                        <button
                                            onClick={() => togglePin('manage_icon')}
                                            className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 rounded-full transition-colors ${pinnedTools.includes('manage_icon') ? 'text-yellow-400' : 'text-white'}`}
                                            title="Pin to Main Screen"
                                        >
                                            <Pin className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* ADMIN ONLY: Gmail Restriction Toggle */}
                                    {userProfile?.role === 'admin' && (
                                        <div className="border-t-2 border-dashed border-gray-300 dark:border-zinc-800 pt-4 mt-2">
                                            <button
                                                onClick={toggleGmailRestriction}
                                                disabled={togglingGmail}
                                                className="w-full py-4 bg-zinc-100 dark:bg-zinc-900 border-2 border-black dark:border-white text-black dark:text-white font-bold uppercase flex items-center justify-between px-6 shadow-md transition-all hover:opacity-90 disabled:opacity-60"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {togglingGmail ? (
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                    ) : (
                                                        <MailWarning className="w-5 h-5" />
                                                    )}
                                                    <span className="text-xs">Only @gmail.com</span>
                                                </div>
                                                <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${isGmailRestricted ? 'bg-purple-600' : 'bg-gray-400'}`}>
                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 ${isGmailRestricted ? 'translate-x-[22px]' : 'translate-x-[4px]'}`}></div>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Sub-modals */}
            <ManageBoardRollsModal isOpen={showRollsModal} onClose={() => setShowRollsModal(false)} />
            <AttendanceQRModal isOpen={showQRModal} onClose={() => setShowQRModal(false)} />
        </>,
        document.body
    );
}
