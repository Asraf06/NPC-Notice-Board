'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Crown, Pencil, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { NoticeData } from './NoticeCard';
import CollageRenderer from './CollageRenderer';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

interface NoticeModalProps {
    notice: NoticeData | null;
    sourceRect?: DOMRect | null;
    onClose: () => void;
    onShare: () => void;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
    onImageClick?: (index: number, images: { url: string; type: string }[]) => void;
}

export default function NoticeModal({ notice, sourceRect, onClose, onShare, onEdit, onDelete, onImageClick }: NoticeModalProps) {
    const { userProfile, user } = useAuth();
    const [isVisible, setIsVisible] = useState(true);
    const contentRef = useRef<HTMLDivElement>(null);
    useSmoothScroll(contentRef);
    const [finalRect, setFinalRect] = useState<DOMRect | null>(null);

    // Capture final rect on mount for reverse animation
    useEffect(() => {
        if (contentRef.current) {
            setFinalRect(contentRef.current.getBoundingClientRect());
        }
    }, []);

    const handleClose = useCallback(() => {
        setIsVisible(false);
        // Call onClose after a short delay matching exit animation
        // This ensures the UI is unblocked quickly
        setTimeout(() => onClose(), 250);
    }, [onClose]);

    if (!notice) return null;

    const n = notice;
    const isOwner = userProfile && userProfile.isCR && n.authorUid === user?.uid;
    const date = n.timestamp ? new Date(n.timestamp.seconds * 1000).toDateString() : 'N/A';

    // Track view
    if (user) {
        setDoc(doc(db, 'notice_views', `${user.uid}_${n.id}`), {
            userId: user.uid,
            userName: userProfile?.name,
            noticeId: n.id,
            noticeTitle: n.title,
            timestamp: serverTimestamp()
        }, { merge: true }).catch(() => { });
    }

    if (typeof document === 'undefined') return null;

    // ============================
    // SHARED ELEMENT / CONTAINER TRANSFORM ANIMATION
    // ============================
    // If sourceRect is available, animate from the card's position to center.
    // If not available (e.g. direct link), use a simple scale-up animation.

    const hasSourceRect = sourceRect && sourceRect.width > 0;

    // Calculate animation values from card rect to viewport center
    const getInitialTransform = () => {
        if (!hasSourceRect) {
            return {
                opacity: 0,
                scale: 0.85,
                y: 40,
                borderRadius: '0px',
            };
        }

        // The modal content is centered (max-w-2xl ≈ 672px, max-h-90vh)
        // We want to animate FROM the card position TO the center
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        // Approximate final modal size
        const modalW = Math.min(672, viewportW - 32); // max-w-2xl with p-4
        const modalH = Math.min(viewportH * 0.9, viewportH - 32);

        // Final modal center position
        const finalCenterX = viewportW / 2;
        const finalCenterY = viewportH / 2;

        // Source card center position
        const sourceCenterX = sourceRect.left + sourceRect.width / 2;
        const sourceCenterY = sourceRect.top + sourceRect.height / 2;

        // Offset from center
        const offsetX = sourceCenterX - finalCenterX;
        const offsetY = sourceCenterY - finalCenterY;

        // Scale ratio
        const scaleX = sourceRect.width / modalW;
        const scaleY = sourceRect.height / modalH;
        const scale = Math.max(scaleX, scaleY, 0.15); // Never too small

        return {
            opacity: 0.7,
            scale: Math.min(scale, 0.6),
            x: offsetX,
            y: offsetY,
            borderRadius: '0px',
        };
    };

    const initialTransform = getInitialTransform();

    // Spring config for premium feel — fast but with satisfying overshoot
    const springConfig = {
        type: 'spring' as const,
        stiffness: 380,
        damping: 32,
        mass: 0.8,
    };

    // Fast tween for exit — no spring overshoot = no delay
    const exitTween = {
        duration: 0.2,
        ease: [0.2, 0, 0, 1] as [number, number, number, number],
    };

    return createPortal(
        <AnimatePresence mode="wait">
            {isVisible && (
                <motion.div
                    key="notice-modal-overlay"
                    className="fixed inset-0 z-[160] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    onClick={handleClose}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    />

                    {/* Modal Content — Container Transform Animation */}
                    <motion.div
                        ref={contentRef}
                        className="bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-[12px_12px_0px_0px_rgba(255,255,255,0.2)] z-10 will-change-transform"
                        onClick={e => e.stopPropagation()}
                        initial={initialTransform}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            x: 0,
                            y: 0,
                            borderRadius: '0px',
                        }}
                        exit={{
                            ...initialTransform,
                            opacity: 0,
                            transition: exitTween,
                        }}
                        transition={springConfig}
                        style={{ transformOrigin: 'center center' }}
                    >
                        <div className="locomotive-content-wrapper">
                            {/* Content fade-in (staggered after container expands) */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ delay: 0.08, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                            >
                                {/* Close button */}
                                <motion.button
                                    onClick={handleClose}
                                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-900 border border-transparent hover:border-black dark:hover:border-white transition-all z-10"
                                    initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                                    transition={{ delay: 0.15, type: 'spring' as const, stiffness: 300, damping: 20 }}
                                    whileHover={{ scale: 1.15, rotate: 90 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <X className="w-6 h-6" />
                                </motion.button>

                                <div className="p-8 md:p-10">
                                    {/* Type badge + Date */}
                                    <motion.div
                                        className="flex items-center gap-3 mb-6"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.12, duration: 0.3 }}
                                    >
                                        <span className="px-3 py-1 text-xs font-bold uppercase border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black">
                                            {n.type}
                                        </span>
                                        <span className="text-xs font-mono opacity-60 uppercase tracking-widest">
                                            {date}
                                        </span>
                                    </motion.div>

                                    {/* Title */}
                                    <motion.h2
                                        className="text-3xl md:text-5xl font-extrabold mb-8 leading-tight uppercase font-mono tracking-tight break-words"
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.16, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        {n.title}
                                    </motion.h2>

                                    {/* Subject badge */}
                                    {n.subject && (
                                        <motion.div
                                            className="mb-8"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.2, duration: 0.25 }}
                                        >
                                            <span className="border-2 border-gray-900 dark:border-gray-100 px-3 py-1 text-xs font-mono font-bold uppercase inline-block max-w-full break-words whitespace-normal text-left">
                                                {n.subject}
                                            </span>
                                        </motion.div>
                                    )}

                                    {/* Divider — animated line */}
                                    <motion.div
                                        className="w-full h-0.5 bg-black dark:bg-white mb-8"
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ delay: 0.22, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                        style={{ transformOrigin: 'left' }}
                                    />

                                    {/* Body */}
                                    <motion.div
                                        className="prose dark:prose-invert max-w-none text-base md:text-lg font-serif leading-relaxed opacity-90 mb-8 break-words"
                                        dangerouslySetInnerHTML={{ __html: n.body }}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.25, duration: 0.3 }}
                                    />

                                    {/* Attachments */}
                                    {n.attachments && n.attachments.length > 0 && (
                                        <motion.div
                                            className="mb-8"
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.28, duration: 0.3 }}
                                        >
                                            <h4 className="text-xs font-bold uppercase mb-4 opacity-50 tracking-widest">
                                                Attachments
                                            </h4>
                                            <CollageRenderer
                                                attachments={n.attachments}
                                                layout={n.layout || 'grid'}
                                                onImageClick={onImageClick}
                                            />
                                        </motion.div>
                                    )}

                                    {/* Footer: Target audience + Author */}
                                    <motion.div
                                        className="mt-8 pt-6 border-t-2 border-dashed border-gray-300 dark:border-gray-700 flex justify-between items-end"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.32, duration: 0.3 }}
                                    >
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">
                                                Target Audience
                                            </p>
                                            <p className="text-sm font-mono font-bold">
                                                {n.targetSection && n.targetSection !== 'all' ? `${n.targetSection} / ` : ''}{n.targetDept} / {n.targetSem}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">
                                                Issued By
                                            </p>
                                            <p className="text-sm font-mono font-bold">
                                                {n.author || 'Admin'}
                                            </p>
                                        </div>
                                    </motion.div>

                                    {/* Share button */}
                                    <motion.button
                                        onClick={onShare}
                                        className="mt-6 w-full py-3 border-2 border-black dark:border-white font-bold uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center justify-center gap-2"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.35, duration: 0.3 }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Share2 className="w-5 h-5" /> Share with Friends
                                    </motion.button>

                                    {/* CR Owner Actions */}
                                    {isOwner && (
                                        <motion.div
                                            className="mt-4 pt-4 border-t border-dashed border-gray-300 dark:border-gray-700"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.38, duration: 0.25 }}
                                        >
                                            <p className="text-[10px] uppercase font-bold text-purple-500 tracking-widest mb-3 flex items-center gap-1">
                                                <Crown className="w-3 h-3" /> Your Notice - Manage
                                            </p>
                                            <div className="flex gap-2">
                                                <motion.button
                                                    onClick={() => { handleClose(); setTimeout(() => onEdit?.(n.id), 350); }}
                                                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase flex items-center justify-center gap-2 transition-colors"
                                                    whileHover={{ scale: 1.03 }}
                                                    whileTap={{ scale: 0.97 }}
                                                >
                                                    <Pencil className="w-4 h-4" /> Edit
                                                </motion.button>
                                                <motion.button
                                                    onClick={() => { handleClose(); setTimeout(() => onDelete?.(n.id), 350); }}
                                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold uppercase flex items-center justify-center gap-2 transition-colors"
                                                    whileHover={{ scale: 1.03 }}
                                                    whileTap={{ scale: 0.97 }}
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete
                                                </motion.button>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
