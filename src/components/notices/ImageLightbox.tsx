'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '@/context/UIContext';

interface Attachment {
    url: string;
    type: string;
    thumb?: string;
}

interface ImageLightboxProps {
    attachments: Attachment[];
    initialIndex: number;
    onClose: () => void;
}

export default function ImageLightbox({ attachments, initialIndex, onClose }: ImageLightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [direction, setDirection] = useState(0);
    const { showAlert } = useUI();

    const navigate = useCallback((dir: number) => {
        setDirection(dir);
        setCurrentIndex(prev => {
            let newIndex = prev + dir;
            if (newIndex < 0) newIndex = attachments.length - 1;
            if (newIndex >= attachments.length) newIndex = 0;
            return newIndex;
        });
    }, [attachments.length]);

    const downloadImage = useCallback(async () => {
        const imgUrl = attachments[currentIndex]?.url;
        if (!imgUrl) return;

        try {
            const response = await fetch(imgUrl, { mode: 'cors' });
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `notice_image_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showAlert('Downloaded', 'Item saved successfully!', 'success');
        } catch {
            window.open(imgUrl, '_blank');
            showAlert('Notice', 'Opening item in new tab. Right-click or share to save.', 'info');
        }
    }, [attachments, currentIndex, showAlert]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') navigate(-1);
            if (e.key === 'ArrowRight') navigate(1);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [navigate, onClose]);

    if (!attachments.length) return null;
    if (typeof document === 'undefined') return null;

    const currentImg = attachments[currentIndex];
    const isVideo = currentImg.type === 'video' || currentImg.type.startsWith('video/');

    // Framer Motion variants for the slide transition
    const slideVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 300 : -300,
            opacity: 0,
            scale: 0.9,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
            transition: {
                x: { type: 'spring' as const, stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
            },
        },
        exit: (dir: number) => ({
            x: dir > 0 ? -300 : 300,
            opacity: 0,
            scale: 0.9,
            transition: {
                x: { type: 'spring' as const, stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.15 },
            },
        }),
    };

    return createPortal(
        <motion.div
            className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex items-center justify-center p-0 m-0"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
            {/* Close Button */}
            <motion.button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                title="Close"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 20 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                <X className="w-6 h-6 text-white" />
            </motion.button>

            {/* Counter */}
            {attachments.length > 1 && (
                <motion.div
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-black/60 rounded-full text-white text-sm font-mono"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 250, damping: 20 }}
                >
                    {currentIndex + 1} / {attachments.length}
                </motion.div>
            )}

            {/* Navigation Buttons */}
            {attachments.length > 1 && (
                <>
                    <motion.button
                        onClick={(e) => { e.stopPropagation(); navigate(-1); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        title="Previous"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 250, damping: 20 }}
                        whileHover={{ scale: 1.15, backgroundColor: 'rgba(255,255,255,0.25)' }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <ChevronLeft className="w-8 h-8 text-white" />
                    </motion.button>
                    <motion.button
                        onClick={(e) => { e.stopPropagation(); navigate(1); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        title="Next"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 250, damping: 20 }}
                        whileHover={{ scale: 1.15, backgroundColor: 'rgba(255,255,255,0.25)' }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <ChevronRight className="w-8 h-8 text-white" />
                    </motion.button>
                </>
            )}

            {/* Main Content Area */}
            <div
                className="w-full h-full flex flex-col items-center justify-center p-4 pt-16 pb-32 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                    <motion.div
                        key={currentIndex}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="flex items-center justify-center w-full h-full"
                    >
                        {isVideo ? (
                            <LightboxVideoPlayer src={currentImg.url} />
                        ) : (
                            <img
                                src={currentImg.url}
                                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                                alt="Preview"
                                draggable={false}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom Bar: Thumbnails + Actions */}
            <motion.div
                className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 250, damping: 25 }}
            >
                {/* Thumbnails */}
                {attachments.length > 1 && (
                    <div className="flex justify-center gap-2 mb-4 overflow-x-auto pt-3 pb-2 px-4 no-scrollbar">
                        {attachments.map((item, idx) => {
                            const isActive = idx === currentIndex;
                            const isItemVideo = item.type === 'video' || item.type?.startsWith('video/');

                            return (
                                <motion.div
                                    key={idx}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDirection(idx > currentIndex ? 1 : -1);
                                        setCurrentIndex(idx);
                                    }}
                                    className={`w-12 h-12 rounded-md overflow-hidden cursor-pointer shrink-0 relative ${isItemVideo ? 'bg-black' : ''}`}
                                    animate={{
                                        scale: isActive ? 1.15 : 1,
                                        opacity: isActive ? 1 : 0.6,
                                    }}
                                    whileHover={{ scale: isActive ? 1.15 : 1.05, opacity: 1 }}
                                    whileTap={{ scale: 0.95 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                    style={{
                                        boxShadow: isActive ? '0 0 0 2px white, 0 0 0 4px rgba(0,0,0,0.5)' : 'none',
                                    }}
                                >
                                    {isItemVideo ? (
                                        <>
                                            <video src={item.url} className="w-full h-full object-cover pointer-events-none" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Play className="w-4 h-4 text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <img src={item.thumb || item.url} className="w-full h-full object-cover pointer-events-none" alt="" />
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-center gap-3">
                    <motion.button
                        onClick={(e) => { e.stopPropagation(); downloadImage(); }}
                        className="px-5 py-2.5 bg-white text-black font-bold uppercase text-xs rounded-full hover:bg-gray-200 transition-colors flex items-center gap-2"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Download className="w-4 h-4" /> Save
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    );
}

// ============================================
// CUSTOM VIDEO PLAYER FOR LIGHTBOX
// ============================================
function LightboxVideoPlayer({ src }: { src: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [buffered, setBuffered] = useState(0);

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onTimeUpdate = () => { setCurrentTime(video.currentTime); setDuration(video.duration); };
        const onProgress = () => {
            if (video.buffered.length > 0) {
                setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
            }
        };
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => setIsPlaying(false);

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('progress', onProgress);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);

        // Auto-play
        video.play().catch(() => { });

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('progress', onProgress);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onEnded);
        };
    }, [src]);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        v.paused ? v.play() : v.pause();
    };

    const seek = (e: React.MouseEvent<HTMLDivElement>) => {
        const v = videoRef.current;
        if (!v || !v.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setIsMuted(v.muted);
        setVolume(v.muted ? 0 : (v.volume || 1));
    };

    const handleVolumeChange = (val: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.volume = val; v.muted = val === 0;
        setVolume(val); setIsMuted(val === 0);
    };

    const cycleSpeed = () => {
        const v = videoRef.current;
        if (!v) return;
        const speeds = [1, 1.25, 1.5, 2, 0.5];
        const next = (speeds.indexOf(v.playbackRate) + 1) % speeds.length;
        v.playbackRate = speeds[next];
        setSpeed(speeds[next]);
    };

    const downloadVideo = async () => {
        try {
            const res = await fetch(src);
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `notice_video_${Date.now()}.mp4`;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); document.body.removeChild(a);
        } catch { window.open(src, '_blank'); }
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className={`custom-video-container group/video w-full max-w-4xl rounded-lg overflow-hidden shadow-2xl ${isPlaying ? 'playing' : ''}`}>
            <video
                ref={videoRef}
                src={src}
                preload="auto"
                playsInline
                className="w-full max-h-[70vh] object-contain bg-black cursor-pointer"
                onClick={togglePlay}
            />

            {/* Big center play overlay */}
            <div className="video-overlay" onClick={togglePlay}>
                <div className="big-play-btn">
                    {isPlaying ? (
                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    ) : (
                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21" /></svg>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="video-controls" onClick={e => e.stopPropagation()} style={{ opacity: 1, transform: 'translateY(0)' }}>
                <div className="video-progress-container" onClick={seek}>
                    <div className="video-buffered" style={{ width: `${buffered}%` }} />
                    <div className="video-progress-bar" style={{ width: `${progress}%` }} />
                </div>
                <div className="controls-row">
                    <div className="controls-left">
                        <button className="video-btn" onClick={togglePlay}>
                            {isPlaying ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21" /></svg>
                            )}
                        </button>
                        <div className="volume-container">
                            <button className="video-btn" onClick={toggleMute}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    {isMuted ? (
                                        <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
                                    ) : (
                                        <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></>
                                    )}
                                </svg>
                            </button>
                            <input type="range" className="volume-slider" min="0" max="1" step="0.1" value={volume} onChange={e => handleVolumeChange(parseFloat(e.target.value))} />
                        </div>
                        <span className="video-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    </div>
                    <div className="controls-right">
                        <button className="speed-btn" onClick={cycleSpeed}>{speed}x</button>
                        <button className="video-btn" onClick={downloadVideo}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
