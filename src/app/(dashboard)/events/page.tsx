'use client';

import EventsView from '@/components/events/EventsView';

export default function EventsPage() {
    return (
        <main className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
            <EventsView />
        </main>
    );
}
