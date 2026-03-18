'use client';

import { useParams } from 'next/navigation';
import ChatView from '@/components/chat/ChatView';

export default function SocialTab() {
    const params = useParams();
    const tab = params.tab as string;
    
    return <ChatView initialTab={tab} />;
}
