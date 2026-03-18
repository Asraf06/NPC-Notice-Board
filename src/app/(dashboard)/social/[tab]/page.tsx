import ClientPage from './ClientPage';

// Statically generate these paths for Capacitor export
export async function generateStaticParams() {
    return [
        { tab: 'chats' },
        { tab: 'friends' },
        { tab: 'requests' }
    ];
}

export default function SocialTab() {
    return <ClientPage />;
}
