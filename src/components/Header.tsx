'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Clipboard, MessageCircle, Moon, Sun, LogOut } from 'lucide-react';
import ProfileModal from './profile/ProfileModal';
import NotificationBell from './NotificationBell';

const navItems = [
    { id: '/notices', label: 'Notices' },
    { id: '/routine', label: 'Routine' },
    { id: '/materials', label: 'Materials' },
];

export default function Header() {
    const { userProfile, globalSettings, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profileSourceRect, setProfileSourceRect] = useState<DOMRect | null>(null);

    const openProfile = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setProfileSourceRect(rect);
        setIsProfileOpen(true);
    }, []);
    const pathname = usePathname();

    const imgUrl = userProfile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.name || 'S')}`;
    const showLogout = globalSettings.allowLogout || userProfile?.allowLogout;

    return (
        <>
            <header className="h-16 border-b-2 border-black dark:border-zinc-800 flex items-center justify-between px-4 lg:px-8 bg-white dark:bg-black shrink-0 z-20">
                {/* Logo */}
                <Link href="/notices" className="flex items-center gap-3">
                    <div className="bg-black text-white dark:bg-white dark:text-black p-1">
                        <Clipboard className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="font-bold uppercase tracking-tight leading-none text-[18px] sm:text-base">
                            NPC<br />Notice Board
                        </h1>
                    </div>
                </Link>

                {/* Desktop Nav Tabs — with animated sliding indicator */}
                <div className="hidden md:flex flex-1 justify-center gap-1 lg:gap-4 relative">
                    {navItems.map(item => {
                        const isActive = pathname === item.id;
                        return (
                            <Link
                                key={item.id}
                                href={item.id}
                                className={`header-nav-btn relative px-4 py-2 font-bold uppercase text-xs lg:text-sm transition-opacity ${isActive
                                    ? 'opacity-100'
                                    : 'opacity-50 hover:opacity-80'
                                    }`}
                            >
                                {item.label}
                                {/* Animated underline indicator — slides between tabs */}
                                {isActive && (
                                    <motion.div
                                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-black dark:bg-white"
                                        layoutId="header-tab-indicator"
                                        transition={{
                                            type: 'spring',
                                            stiffness: 500,
                                            damping: 35,
                                        }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-3">
                    {/* Chat Toggle (Desktop) */}
                    <Link
                        href="/social"
                        className="hidden md:flex relative p-2 border border-black dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                    >
                        <MessageCircle className="w-5 h-5" />
                    </Link>

                    {/* Notification Bell */}
                    <NotificationBell />

                    {/* Profile (Desktop) */}
                    <button
                        onClick={openProfile}
                        className="hidden md:flex items-center gap-2 hover:opacity-70 transition-opacity"
                    >
                        <img
                            src={imgUrl}
                            alt="Profile"
                            className="w-8 h-8 rounded-full border border-gray-300 object-cover"
                            referrerPolicy="no-referrer"
                        />
                        <div className="text-right leading-tight">
                            <p className="font-bold text-xs uppercase">{userProfile?.name || 'Student'}</p>
                            <p className="text-[10px] font-mono opacity-60">{userProfile?.section}/{userProfile?.dept}/{userProfile?.sem}</p>
                        </div>
                    </button>

                    {/* Profile (Mobile) */}
                    <button
                        onClick={openProfile}
                        className="md:hidden p-1"
                    >
                        <img
                            src={imgUrl}
                            alt="Profile"
                            className="w-8 h-8 rounded-full border border-gray-300 object-cover"
                            referrerPolicy="no-referrer"
                        />
                    </button>

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 border border-black dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                    >
                        {theme === 'dark' ? (
                            <Sun className="w-5 h-5" />
                        ) : (
                            <Moon className="w-5 h-5" />
                        )}
                    </button>

                    {/* Logout */}
                    {showLogout && (
                        <button
                            onClick={logout}
                            className="p-2 bg-black text-white dark:bg-white dark:text-black hover:opacity-80"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </header>

            {/* Profile Modal */}
            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => { setIsProfileOpen(false); }}
                sourceRect={profileSourceRect}
            />
        </>
    );
}
