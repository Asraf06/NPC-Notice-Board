'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutGrid, Calendar, FolderOpen, MessageSquare } from 'lucide-react';

const items = [
    { id: '/notices', label: 'Notices', icon: LayoutGrid },
    { id: '/routine', label: 'Routine', icon: Calendar },
    { id: '/materials', label: 'Material', icon: FolderOpen },
    { id: '/social/recent', label: 'Social', icon: MessageSquare },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-black border-t-2 border-black dark:border-zinc-800 flex items-center justify-around z-[100] px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
            {items.map(item => {
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
                        className={`nav-item relative flex flex-col items-center gap-1 transition-all ${isActive ? 'active text-black dark:text-white' : 'opacity-50'
                            }`}
                    >
                        {/* Animated active indicator — slides between items */}
                        {isActive && (
                            <motion.div
                                className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-6 h-[2px] bg-black dark:bg-white"
                                layoutId="bottom-nav-indicator"
                                transition={{
                                    type: 'spring',
                                    stiffness: 500,
                                    damping: 35,
                                }}
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
