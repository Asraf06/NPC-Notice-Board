'use client';
import dynamic from 'next/dynamic';

const HolidaysView = dynamic(() => import('@/components/holidays/HolidaysView'), {
    ssr: false,
});

export default function HolidaysPage() {
    return <HolidaysView />;
}
