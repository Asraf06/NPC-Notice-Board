'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, QrCode, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AttendanceQRModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AttendanceQRModal({ isOpen, onClose }: AttendanceQRModalProps) {
    const { userProfile } = useAuth();
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !userProfile) return;

        const fetchQR = async () => {
            setLoading(true);
            setError(null);
            try {
                const docId = `${userProfile.section}_${userProfile.dept}_${userProfile.sem}`;
                const qrDoc = await getDoc(doc(db, 'attendance_qrs', docId));

                if (qrDoc.exists()) {
                    setQrUrl(qrDoc.data().url);
                } else {
                    setError("No active QR code found for your batch. Admin must generate it first.");
                }
            } catch (err: any) {
                console.error("Error fetching QR:", err);
                setError("Failed to load QR code. Please check your connection.");
            } finally {
                setLoading(false);
            }
        };

        fetchQR();
    }, [isOpen, userProfile]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        className="bg-white dark:bg-black w-full max-w-sm border-4 border-black dark:border-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] dark:shadow-[12px_12px_0px_0px_rgba(255,255,255,1)] relative z-10 flex flex-col"
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        {/* Header */}
                        <div className="p-4 border-b-4 border-black dark:border-white flex justify-between items-center bg-yellow-400 dark:bg-yellow-600 text-black">
                            <h2 className="font-bold text-xl uppercase flex items-center gap-2">
                                <QrCode className="w-6 h-6" /> Class QR Code
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-black/10 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-8 flex flex-col items-center justify-center min-h-[350px]">
                            {loading && (
                                <div className="flex flex-col items-center text-gray-500">
                                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                                    <p className="font-bold uppercase tracking-widest text-sm">Loading QR...</p>
                                </div>
                            )}

                            {!loading && error && (
                                <div className="flex flex-col items-center text-center text-red-600 dark:text-red-400">
                                    <AlertTriangle className="w-16 h-16 mb-4" />
                                    <p className="font-bold uppercase text-sm mb-2">Unavailable</p>
                                    <p className="text-xs opacity-80">{error}</p>
                                </div>
                            )}

                            {!loading && !error && qrUrl && (
                                <div className="flex flex-col items-center w-full">
                                    <div className="bg-white p-4 border-4 border-black inline-block mb-6 relative">
                                        <div className="absolute inset-0 bg-blue-500/10 mix-blend-overlay pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]"></div>
                                        <img src={qrUrl} alt="Attendance QR" className="w-64 h-64 object-contain brightness-110 contrast-125 mx-auto" crossOrigin="anonymous" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-mono text-xs opacity-60 uppercase mb-1">
                                            {userProfile?.section} • {userProfile?.dept} • {userProfile?.sem}
                                        </p>
                                        <p className="text-sm font-bold uppercase tracking-widest bg-black text-white dark:bg-white dark:text-black px-4 py-1 inline-block">
                                            Scan to Verify
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
