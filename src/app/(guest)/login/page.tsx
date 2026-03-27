'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
    const { authStep, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (authStep === 'authenticated') {
            router.push('/notices');
        }
    }, [authStep, router]);

    return (
        <div className="w-full h-[100dvh] bg-black dark:bg-black relative">
            <div className="absolute inset-0 bg-black/50 z-10 pointer-events-none" />
        </div>
    );
}
