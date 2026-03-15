'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Attachment {
    url: string;
    type: string;
    thumb?: string;
}

interface CollageRendererProps {
    attachments: Attachment[];
    layout: string;
    onImageClick?: (index: number, imageAttachments: Attachment[]) => void;
    onVideoFullscreen?: (url: string) => void;
}

export default function CollageRenderer({ attachments, layout, onImageClick }: CollageRendererProps) {
    const imageAttachments = attachments.filter(a => a.type !== 'video');

    const handleImageClick = useCallback((imgIndex: number) => {
        if (onImageClick) {
            onImageClick(imgIndex, imageAttachments);
        }
    }, [imageAttachments, onImageClick]);

    // Build the CSS class for the container
    let wrapperClass = 'collage-container';
    if (layout === 'hero') wrapperClass += ' collage-hero';
    else if (layout === 'masonry') wrapperClass += ' collage-masonry';
    else if (layout === 'single') wrapperClass += ' collage-single';
    else wrapperClass += ' collage-grid';

    const renderMedia = (att: Attachment, idx: number) => {
        if (att.type === 'video') {
            return <VideoPlayer key={idx} src={att.url} />;
        } else {
            const imgIndex = imageAttachments.findIndex(a => a.url === att.url);
            return (
                <img
                    key={idx}
                    src={att.url}
                    loading="lazy"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleImageClick(imgIndex);
                    }}
                    className="cursor-pointer w-full h-full object-cover"
                    title="Click to view full image"
                    alt=""
                />
            );
        }
    };

    if (layout === 'hero' && attachments.length > 1) {
        return (
            <div className={wrapperClass}>
                <div className="collage-hero-top">
                    {renderMedia(attachments[0], 0)}
                </div>
                <div className="collage-hero-bottom">
                    {attachments.slice(1).map((att, i) => (
                        <div key={i + 1}>{renderMedia(att, i + 1)}</div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={wrapperClass}>
            {attachments.map((att, idx) => (
                <div key={idx}>{renderMedia(att, idx)}</div>
            ))}
        </div>
    );
}

// ============================================
// VIDEO PLAYER — Matching index_anigravity.html EXACTLY
// 
// HTML behavior:
// 1. Inline = just a thumbnail with play button overlay (NO controls)
// 2. Clicking ALWAYS opens fullscreen popup modal
// 3. Controls only appear in the fullscreen popup
// 4. Fullscreen popup has: close btn, play/pause overlay, bottom controls
// ============================================
function VideoPlayer({ src }: { src: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const handleVideoTap = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        // ALWAYS open fullscreen popup — matching HTML website behavior
        if (videoRef.current) {
            videoRef.current.pause();
        }
        setIsFullscreen(true);
    };

    const closeFullscreen = () => {
        setIsFullscreen(false);
    };

    return (
        <>
            {/* INLINE PLAYER: Just a thumbnail with play button — NO controls */}
            <div className="custom-video-container relative w-full h-full cursor-pointer" onClick={handleVideoTap}>
                <video
                    ref={videoRef}
                    src={src}
                    preload="metadata"
                    playsInline
                    className="w-full h-full object-cover"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVideoTap(); }}
                />
                {/* Play overlay — always visible, just like HTML website */}
                <div
                    className="video-overlay"
                    style={{ opacity: 1, pointerEvents: 'auto' }}
                    onClick={(e) => { e.stopPropagation(); handleVideoTap(); }}
                >
                    <div className="big-play-btn">
                        <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                            <polygon points="5 3 19 12 5 21" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* FULLSCREEN VIDEO POPUP — portaled to body, matching HTML website */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isFullscreen && (
                        <FullscreenVideoModal
                            src={src}
                            startTime={videoRef.current?.currentTime || 0}
                            onClose={closeFullscreen}
                        />
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}


// ============================================
// FULLSCREEN VIDEO MODAL
// Matches .video-fullscreen-modal from index_anigravity.html
// ============================================
function FullscreenVideoModal({
    src,
    startTime,
    onClose,
}: {
    src: string;
    startTime: number;
    onClose: () => void;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [buffered, setBuffered] = useState(0);
    const [controlsHidden, setControlsHidden] = useState(false);

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Init the video and auto-play
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.currentTime = startTime;
        video.play().catch(() => { });

        const onTimeUpdate = () => { setCurrentTime(video.currentTime); setDuration(video.duration); };
        const onProgress = () => {
            if (video.buffered.length > 0) {
                setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
            }
        };
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => setIsPlaying(false);
        const onWaiting = () => setIsLoading(true);
        const onPlaying = () => setIsLoading(false);
        const onCanPlay = () => setIsLoading(false);

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('progress', onProgress);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('canplay', onCanPlay);

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('progress', onProgress);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onEnded);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('canplay', onCanPlay);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Lock body scroll + keyboard controls (matching HTML: Space, K, M, Arrows, Escape)
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const handleKey = (e: KeyboardEvent) => {
            const video = videoRef.current;
            if (!video) return;
            if (e.key === 'Escape') onClose();
            if (e.key === ' ' || e.key === 'k') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
            if (e.key === 'ArrowLeft') video.currentTime -= 5;
            if (e.key === 'ArrowRight') video.currentTime += 5;
            if (e.key === 'm') { video.muted = !video.muted; setIsMuted(video.muted); setVolume(video.muted ? 0 : (video.volume || 1)); }
        };
        window.addEventListener('keydown', handleKey);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

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

    const handleVolumeChange = (val: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.volume = val; v.muted = val === 0;
        setVolume(val); setIsMuted(val === 0);
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setIsMuted(v.muted);
        setVolume(v.muted ? 0 : (v.volume || 1));
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
            if (!res.ok) throw new Error('fail');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `campus_notice_video_${Date.now()}.mp4`;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); document.body.removeChild(a);
        } catch { window.open(src, '_blank'); }
    };

    const toggleControlsVisibility = () => {
        setControlsHidden(h => !h);
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <motion.div
            className="video-fullscreen-modal active"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'flex' }}
        >
            {/* Close button — top right, matching .fullscreen-close-btn */}
            <motion.button
                onClick={onClose}
                className="fullscreen-close-btn"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.2)' }}
                whileTap={{ scale: 0.9 }}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" />
                </svg>
            </motion.button>

            {/* Video container — matching .fullscreen-player */}
            <div className={`custom-video-container fullscreen-player ${isPlaying ? 'playing' : ''} ${controlsHidden ? 'controls-hidden' : ''}`}>
                <video
                    ref={videoRef}
                    src={src}
                    preload="auto"
                    playsInline
                    className="w-full h-full"
                    onClick={togglePlay}
                />

                {/* Loading spinner */}
                {isLoading && (
                    <div className="video-loading active">
                        <div className="video-spinner" />
                    </div>
                )}

                {/* Mobile toggle controls button */}
                <button
                    className="video-ctrl-toggle"
                    onClick={toggleControlsVisibility}
                    title="Hide/Show Controls"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        {controlsHidden ? (
                            <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                        ) : (
                            <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                        )}
                    </svg>
                </button>

                {/* Big center play/pause overlay */}
                <div className="video-overlay" onClick={togglePlay}>
                    <div className="big-play-btn">
                        {isPlaying ? (
                            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                        ) : (
                            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                                <polygon points="5 3 19 12 5 21" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Controls bar — matching HTML website exactly */}
                <div className="video-controls" onClick={e => e.stopPropagation()}>
                    {/* Progress bar */}
                    <div className="video-progress-container" onClick={seek}>
                        <div className="video-buffered" style={{ width: `${buffered}%` }} />
                        <div className="video-progress-bar" style={{ width: `${progress}%` }} />
                    </div>

                    {/* Controls row */}
                    <div className="controls-row">
                        <div className="controls-left">
                            {/* Play/Pause */}
                            <button className="video-btn" onClick={togglePlay} title="Play/Pause">
                                {isPlaying ? (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <rect x="6" y="4" width="4" height="16" />
                                        <rect x="14" y="4" width="4" height="16" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <polygon points="5 3 19 12 5 21" />
                                    </svg>
                                )}
                            </button>

                            {/* Volume */}
                            <div className="volume-container">
                                <button className="video-btn" onClick={toggleMute} title="Mute/Unmute">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        {isMuted ? (
                                            <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
                                        ) : (
                                            <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></>
                                        )}
                                    </svg>
                                </button>
                                <input
                                    type="range"
                                    className="volume-slider"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={volume}
                                    onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                                />
                            </div>

                            {/* Time */}
                            <span className="video-time">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                        </div>

                        <div className="controls-right">
                            {/* Speed */}
                            <button className="speed-btn" onClick={cycleSpeed} title="Playback Speed">
                                {speed}x
                            </button>

                            {/* Download / Save Video */}
                            <button className="video-btn" onClick={downloadVideo} title="Save Video">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
