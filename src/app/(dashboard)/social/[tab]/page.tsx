import ClientPage from './ClientPage';

// Statically generate these paths for Capacitor export
export async function generateStaticParams() {
    return [
        { tab: 'recent' },
        { tab: 'friends' },
        { tab: 'ai' },
        { tab: 'teacher' },
        { tab: 'groups' },
        { tab: 'search' },
    ];
}

export default function SocialTab() {
    return <ClientPage />;
}
