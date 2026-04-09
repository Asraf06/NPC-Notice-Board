'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutGrid, Calendar, FolderOpen, MessageSquare, Plus } from 'lucide-react';
import { useUI } from '@/context/UIContext';

const items = [
    { id: '/notices', label: 'Notices', icon: LayoutGrid },
    { id: '/routine', label: 'Routine', icon: Calendar },
    { id: '/materials', label: 'Material', icon: FolderOpen },
    { id: '/social/recent', label: 'Social', icon: MessageSquare },
];

export default function BottomNav() {
    const pathname = usePathname();
    const { openScanner } = useUI();

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-black border-t-2 border-black dark:border-zinc-800 flex items-center justify-around z-[100] px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] safe-bottom">
            {items.slice(0, 2).map((item) => {
                const Icon = item.icon;
                const isActive = item.id === '/'
                    ? pathname === '/'
                    : item.id.startsWith('/social/')
                        ? pathname.startsWith('/social')
                        : pathname.startsWith(item.id);

                return (
                    <Link
                        key={item.id}
                        href={item.id}
                        className={`nav-item relative flex flex-[1] flex-col items-center justify-center gap-1 transition-all ${isActive ? 'active text-black dark:text-white' : 'opacity-50 hover:opacity-100'}`}
                    >
                        {isActive && (
                            <motion.div
                                className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-6 h-[2px] bg-black dark:bg-white"
                                layoutId="bottom-nav-indicator"
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            />
                        )}
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                    </Link>
                );
            })}

            {/* Middle '+' Action Button for QR Scanner */}
            <div className="flex flex-[1] -mt-10 justify-center z-[110]">
                <button
                    onClick={openScanner}
                    className="flex h-12 w-12 items-center justify-center rounded-none bg-yellow-400 border-2 border-black text-black shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all active:bg-yellow-500"
                    title="Scan Attendance"
                >
                    <Plus className="w-8 h-8" strokeWidth={2.5} />
                </button>
            </div>

            {items.slice(2).map((item) => {
                const Icon = item.icon;
                const isActive = item.id === '/'
                    ? pathname === '/'
                    : item.id.startsWith('/social/')
                        ? pathname.startsWith('/social')
                        : pathname.startsWith(item.id);

                return (
                    <Link
                        key={item.id}
                        href={item.id}
                        className={`nav-item relative flex flex-[1] flex-col items-center justify-center gap-1 transition-all ${isActive ? 'active text-black dark:text-white' : 'opacity-50 hover:opacity-100'}`}
                    >
                        {isActive && (
                            <motion.div
                                className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-6 h-[2px] bg-black dark:bg-white"
                                layoutId="bottom-nav-indicator"
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            />
                        )}
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
