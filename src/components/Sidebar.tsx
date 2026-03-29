'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import {
    LayoutGrid,
    User,
    Settings,
    LogOut,
    Clipboard,
    Download,
    ClipboardCheck,
} from 'lucide-react';

const baseSidebarItems = [
    { id: '/notices', label: 'Notices', icon: LayoutGrid },
    { id: '/attendance', label: 'Attendance', icon: ClipboardCheck },
    { id: '/profile', label: 'Profile', icon: User },
    { id: '/install', label: 'Install App', icon: Download },
    { id: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
    const { userProfile, globalSettings, logout } = useAuth();
    const pathname = usePathname();

    const sidebarItems = baseSidebarItems;

    const showLogout = globalSettings.allowLogout || userProfile?.allowLogout;
    const imgUrl = userProfile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.name || 'S')}`;

    return (
        <aside className="hidden md:flex flex-col w-[240px] lg:w-[260px] h-full border-r-2 border-black dark:border-zinc-800 bg-white dark:bg-black shrink-0 z-20">
            {/* Logo/Branding */}
            <div className="h-16 border-b-2 border-black dark:border-zinc-800 flex items-center px-5 gap-3 shrink-0">
                <div className="bg-black text-white dark:bg-white dark:text-black p-1.5">
                    <Clipboard className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="font-bold uppercase tracking-tight leading-none text-sm">
                        NPC<br />Notice Board
                    </h1>
                </div>
            </div>

            {/* User Info */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <img
                        src={imgUrl}
                        alt="Profile"
                        className="w-10 h-10 rounded-full border-2 border-black dark:border-zinc-600 object-cover"
                        referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                        <p className="font-bold text-sm uppercase truncate">{userProfile?.name || 'Student'}</p>
                        <p className="text-[11px] font-mono opacity-50 truncate">
                            {userProfile?.section}/{userProfile?.dept}/{userProfile?.sem}
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-3 px-3 space-y-1">
                {sidebarItems.map(item => {
                    const Icon = item.icon;
                    const isActive = item.id === '/notices'
                        ? pathname === '/notices' || pathname === '/'
                        : pathname.startsWith(item.id);

                    return (
                        <Link
                            key={item.id}
                            href={item.id}
                            className={`sidebar-nav-item relative flex items-center gap-3 px-3 py-2.5 font-bold uppercase text-xs tracking-wide transition-all group ${
                                isActive
                                    ? 'text-black dark:text-white'
                                    : 'text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
                            }`}
                        >
                            {/* Active indicator bar */}
                            {isActive && (
                                <motion.div
                                    className="absolute left-0 top-1 bottom-1 w-[3px] bg-black dark:bg-white rounded-full"
                                    layoutId="sidebar-indicator"
                                    transition={{
                                        type: 'spring',
                                        stiffness: 500,
                                        damping: 35,
                                    }}
                                />
                            )}

                            {/* Active background highlight */}
                            {isActive && (
                                <motion.div
                                    className="absolute inset-0 bg-gray-100 dark:bg-zinc-900 rounded-lg -z-10"
                                    layoutId="sidebar-bg"
                                    transition={{
                                        type: 'spring',
                                        stiffness: 500,
                                        damping: 35,
                                    }}
                                />
                            )}

                            <Icon className="w-5 h-5 shrink-0" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom section: Logout */}
            {showLogout && (
                <div className="p-3 border-t border-gray-200 dark:border-zinc-800 mt-auto">
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 font-bold uppercase text-xs tracking-wide text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors rounded-lg group"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            )}
        </aside>
    );
}
