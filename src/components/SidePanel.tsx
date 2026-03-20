'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
    X,
    LayoutGrid,
    User,
    Settings,
    LogOut,
    Moon,
    Sun,
    Calendar,
    FolderOpen,
    MessageSquare,
    Clipboard,
    Download,
} from 'lucide-react';

interface SidePanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const menuItems = [
    { id: '/notices', label: 'Notices', icon: LayoutGrid },
    { id: '/profile', label: 'Profile', icon: User },
    { id: '/install', label: 'Install App', icon: Download },
    { id: '/settings', label: 'Settings', icon: Settings },
];

export default function SidePanel({ isOpen, onClose }: SidePanelProps) {
    const { userProfile, globalSettings, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const pathname = usePathname();

    const showLogout = globalSettings.allowLogout || userProfile?.allowLogout;
    const imgUrl = userProfile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.name || 'S')}`;

    // Close on route change
    useEffect(() => {
        onClose();
    }, [pathname]);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={onClose}
                    />

                    {/* Panel — slides from right */}
                    <motion.div
                        className="fixed top-0 right-0 bottom-0 z-[201] w-[280px] max-w-[85vw] bg-black text-white flex flex-col shadow-2xl border-l border-white/20 dark:border-zinc-800"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 35,
                        }}
                    >
                        {/* Panel Header */}
                        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-white text-black p-1.5">
                                    <Clipboard className="w-4 h-4" />
                                </div>
                                <span className="font-bold uppercase text-sm tracking-wider">Menu</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-zinc-800 transition-colors rounded"
                                aria-label="Close menu"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* User Info */}
                        <div className="px-5 py-4 border-b border-zinc-800">
                            <div className="flex items-center gap-3">
                                <img
                                    src={imgUrl}
                                    alt="Profile"
                                    className="w-10 h-10 rounded-full border-2 border-zinc-600 object-cover"
                                    referrerPolicy="no-referrer"
                                />
                                <div className="min-w-0">
                                    <p className="font-bold text-sm uppercase truncate">{userProfile?.name || 'Student'}</p>
                                    <p className="text-[11px] font-mono text-zinc-400 truncate">
                                        {userProfile?.section}/{userProfile?.dept}/{userProfile?.sem}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Items */}
                        <nav className="flex-1 overflow-y-auto py-3 px-3">
                            {menuItems.map(item => {
                                const Icon = item.icon;
                                const isActive = item.id === '/notices'
                                    ? pathname === '/notices' || pathname === '/'
                                    : pathname.startsWith(item.id);

                                return (
                                    <Link
                                        key={item.id}
                                        href={item.id}
                                        onClick={onClose}
                                        className={`flex items-center gap-3 px-4 py-3 mb-0.5 font-bold uppercase text-xs tracking-wide transition-all rounded ${
                                            isActive
                                                ? 'bg-white text-black'
                                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                                        }`}
                                    >
                                        <Icon className="w-5 h-5 shrink-0" />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Bottom Section */}
                        <div className="border-t border-zinc-800 p-3 space-y-1 shrink-0">
                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="w-full flex items-center gap-3 px-4 py-3 font-bold uppercase text-xs tracking-wide text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all rounded"
                            >
                                {theme === 'dark' ? (
                                    <Sun className="w-5 h-5 text-yellow-400" />
                                ) : (
                                    <Moon className="w-5 h-5 text-purple-400" />
                                )}
                                <span>Toggle Theme</span>
                            </button>

                            {/* Logout */}
                            {showLogout && (
                                <button
                                    onClick={() => {
                                        onClose();
                                        logout();
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 font-bold uppercase text-xs tracking-wide text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-all rounded"
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span>Logout</span>
                                </button>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
