'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Camera } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import QRScannerModal from './QRScannerModal';

const HIDE_FAB_ROUTES = ['/auth', '/cr-dashboard', '/attendance-manager', '/edit-profile'];

export default function AttendanceFAB() {
    const { user, userProfile } = useAuth();
    const pathname = usePathname();
    const [showModal, setShowModal] = useState(false);

    // Don't show FAB on auth pages or management pages
    const hideFAB = HIDE_FAB_ROUTES.some(route => pathname?.startsWith(route)) || !user || !userProfile;

    if (hideFAB) return null;

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="fixed bottom-24 right-6 z-50 md:bottom-10 md:right-10 flex h-14 w-14 items-center justify-center rounded-none bg-yellow-400 border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:bg-yellow-500"
                aria-label="Scan Attendance"
            >
                <Camera className="w-6 h-6 text-black" />
            </button>

            {showModal && <QRScannerModal isOpen={showModal} onClose={() => setShowModal(false)} />}
        </>
    );
}
