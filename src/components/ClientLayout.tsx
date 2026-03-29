'use client';

import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ChatProvider } from '@/context/ChatContext';
import { UIProvider } from '@/context/UIContext';
import { NotificationProvider } from '@/context/NotificationContext';
import AuthOverlay from '@/components/AuthOverlay';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import InstallPrompt from '@/components/InstallPrompt';
import SectionMigrationScreen from '@/components/SectionMigrationScreen';
import OfflineBanner from '@/components/OfflineBanner';
import AttendanceFAB from '@/components/attendance/AttendanceFAB';

import { usePathname } from 'next/navigation';

// Routes where bottom nav should be hidden (utility/detail pages)
const HIDE_NAV_ROUTES = ['/profile', '/settings', '/install', '/attendance'];

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
    const { authStep, userProfile } = useAuth();
    const pathname = usePathname();

    // Show nothing behind the auth overlay until authenticated
    if (authStep !== 'authenticated') return null;

    // Safety net: if user has no section, show migration screen
    if (userProfile && !userProfile.section) {
        return <SectionMigrationScreen />;
    }

    const hideBottomNav = HIDE_NAV_ROUTES.some(route => pathname.startsWith(route));

    return (
        <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-white dark:bg-black">
            <OfflineBanner />
            <Header />

            {/* Main Layout Shell — Fixed container since individual views handle scrolling */}
            <div className="flex-1 flex overflow-hidden relative w-full min-w-0">
                <div className="flex-1 flex flex-col min-w-0 min-h-0 relative bg-white dark:bg-black w-full">
                    {children}
                </div>
            </div>

            {!hideBottomNav && <BottomNav />}
            {!hideBottomNav && <InstallPrompt />}
            <AttendanceFAB />
        </div>
    );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <AuthOverlay />
            <AuthenticatedShell>
                {children}
            </AuthenticatedShell>
        </>
    );
}
