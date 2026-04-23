'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Bell, BellOff, Check, CheckCheck, ExternalLink, Trash2, Sparkles } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

function timeAgo(timestamp: { seconds: number } | Date): string {
    const now = Date.now();
    const then = timestamp instanceof Date ? timestamp.getTime() : timestamp.seconds * 1000;
    const diff = Math.floor((now - then) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(then).toLocaleDateString();
}

export default function NotificationBell() {
    const {
        notifications,
        unreadCount,
        permissionStatus,
        requestPermission,
        markAsViewed,
        markAllAsViewed,
        deleteNotification,
        smartCleanup,
        isNotifPanelOpen,
        setNotifPanelOpen,
    } = useNotifications();
    const [isCleaning, setCleaning] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const panelRef = useRef<HTMLDivElement>(null);

    // Close panel on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setNotifPanelOpen(false);
            }
        };
        if (isNotifPanelOpen) {
            document.addEventListener('mousedown', handler);
        }
        return () => document.removeEventListener('mousedown', handler);
    }, [isNotifPanelOpen, setNotifPanelOpen]);

    const handleBellClick = useCallback(() => {
        if (permissionStatus === 'default' || permissionStatus === 'unsupported') {
            requestPermission();
            return;
        }
        setNotifPanelOpen(!isNotifPanelOpen);
    }, [permissionStatus, requestPermission, isNotifPanelOpen, setNotifPanelOpen]);

    const handleSmartClean = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isCleaning) return;
        setCleaning(true);
        try {
            const count = await smartCleanup();
            if (count > 0) {
                // Optionally show a small toast or just let the list update
                console.log(`[SmartClean] Removed ${count} orphaned notifications`);
            }
        } finally {
            setCleaning(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await deleteNotification(id);
    };

    const handleNotificationClick = useCallback((n: any) => {
        markAsViewed(n.noticeId || n.id);
        setNotifPanelOpen(false);

        if (n.type === 'friend_request') {
            router.push('/social/friends?view=requests');
            return;
        }

        // Default type or 'notice'
        const noticeId = n.noticeId;
        if (!noticeId) return;

        if (pathname === '/notices') {
            // Already on home — dispatch a custom event so NoticesView
            // can open the modal instantly without a page refresh
            window.dispatchEvent(new CustomEvent('open-notice', { detail: { noticeId } }));
        } else {
            router.push(`/notices?noticeId=${noticeId}`);
        }
    }, [markAsViewed, setNotifPanelOpen, router, pathname]);

    const bellDenied = permissionStatus === 'denied';

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button
                onClick={handleBellClick}
                className={`relative p-2 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-zinc-900 ${bellDenied ? 'opacity-40' : ''}`}
                title={
                    permissionStatus === 'default' ? 'Enable notifications'
                        : permissionStatus === 'denied' ? 'Notifications blocked by browser'
                            : permissionStatus === 'unsupported' ? 'Notifications not supported'
                                : 'Notifications'
                }
            >
                {bellDenied ? (
                    <BellOff className="w-5 h-5 opacity-50" />
                ) : (
                    <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-wiggle' : ''}`} />
                )}

                {/* Unread badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white dark:border-black px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Panel */}
            <AnimatePresence>
                {isNotifPanelOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-16 sm:top-full sm:mt-2 sm:w-96 max-h-[70vh] bg-white dark:bg-zinc-950 border-2 border-black dark:border-zinc-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)] z-[200] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 shrink-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-black uppercase tracking-widest">
                                    Notifications
                                </h3>
                                {notifications.length > 0 && (
                                    <button
                                        onClick={handleSmartClean}
                                        disabled={isCleaning}
                                        className={`flex items-center gap-1 text-[9px] font-bold uppercase transition-colors ${
                                            isCleaning ? 'text-gray-400' : 'text-cyan-600 dark:text-cyan-400 hover:text-cyan-500'
                                        }`}
                                        title="Remove notifications whose notices were deleted"
                                    >
                                        <Sparkles className={`w-3 h-3 ${isCleaning ? 'animate-spin' : ''}`} />
                                        {isCleaning ? 'Cleaning...' : 'Smart Clean'}
                                    </button>
                                )}
                            </div>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsViewed}
                                    className="flex items-center gap-1 text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 hover:underline"
                                >
                                    <CheckCheck className="w-3 h-3" />
                                    Mark all read
                                </button>
                            )}
                        </div>

                        {/* Notification List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                    <p className="text-xs font-bold uppercase opacity-40">No notifications yet</p>
                                    <p className="text-[10px] opacity-30 mt-1">New notices will appear here</p>
                                </div>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleNotificationClick(n)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                handleNotificationClick(n);
                                            }
                                        }}
                                        className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors flex gap-3 items-start group cursor-pointer ${!n.viewed ? 'bg-purple-50/50 dark:bg-purple-950/20' : ''}`}
                                    >
                                        {/* Viewed indicator */}
                                        <div className="shrink-0 mt-1">
                                            {n.viewed ? (
                                                <Check className="w-4 h-4 text-green-500 opacity-50" />
                                            ) : (
                                                <div className="w-2.5 h-2.5 bg-purple-500 rounded-full mt-0.5 animate-pulse" />
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {n.category && (
                                                    <span className="text-[9px] font-bold uppercase bg-black text-white dark:bg-white dark:text-black px-1.5 py-0.5 shrink-0">
                                                        {n.category}
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-mono opacity-40 truncate">
                                                    {n.timestamp && timeAgo(n.timestamp as { seconds: number })}
                                                </span>
                                            </div>
                                            <p className={`text-sm font-bold truncate mt-1 ${!n.viewed ? 'text-black dark:text-white' : 'opacity-70'}`}>
                                                {n.title}
                                            </p>
                                            <p className="text-[11px] opacity-50 truncate mt-0.5">
                                                {n.body}
                                            </p>
                                            <p className="text-[10px] opacity-30 font-mono mt-0.5">
                                                by {n.author}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2 shrink-0 self-center items-center">
                                            <button
                                                onClick={(e) => handleDelete(e, n.id)}
                                                className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                title="Delete notification"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                            <ExternalLink className="w-3.5 h-3.5 opacity-40 sm:opacity-0 sm:group-hover:opacity-40 transition-opacity" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
