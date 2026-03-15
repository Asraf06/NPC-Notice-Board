'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { db, rtdb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, update } from 'firebase/database';

export interface ActivePeer {
    uid: string;
    name: string;
    photo: string;
    dept: string;
    info?: string;
    type?: 'dm' | 'group' | 'global' | 'cr' | 'admin' | 'ai';
}

interface ChatContextType {
    activeChatId: string | null;
    activePeer: ActivePeer | null;
    startChat: (uid: string, name?: string, photo?: string, dept?: string) => Promise<void>;
    setActiveChat: (chatId: string, peer: ActivePeer) => void;
    closeChat: () => void;
    isMobileChatOpen: boolean;
    setMobileChatOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function useChat() {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error('useChat must be used within ChatProvider');
    return ctx;
}

export function ChatProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [activePeer, _setActivePeer] = useState<ActivePeer | null>(null);
    const [isMobileChatOpen, setMobileChatOpen] = useState(false);

    const setActiveChat = useCallback((chatId: string, peer: ActivePeer) => {
        setActiveChatId(chatId);
        _setActivePeer(peer);
        setMobileChatOpen(true);
    }, []);

    const startChat = useCallback(async (uid: string, name?: string, photo?: string, dept?: string) => {
        if (!user) return;

        let peerName = name || 'User';
        let peerPhoto = photo || '';
        let peerDept = dept || '';

        // Fetch details if missing
        if (!name || !photo || !dept) {
            try {
                const snap = await getDoc(doc(db, 'students', uid));
                if (snap.exists()) {
                    const data = snap.data();
                    peerName = data.name || 'User';
                    peerPhoto = data.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(peerName)}`;
                    peerDept = data.dept || '';
                }
            } catch (error) {
                console.error('Failed to fetch user for chat', error);
            }
        }

        const sortedUids = [user.uid, uid].sort();
        const chatId = `${sortedUids[0]}_${sortedUids[1]}`;

        setActiveChatId(chatId);
        _setActivePeer({
            uid,
            name: peerName,
            photo: peerPhoto,
            dept: peerDept,
            info: peerDept,
            type: 'dm'
        });
        setMobileChatOpen(true);

        // Reset unread count
        try {
            await update(ref(rtdb, `user_chats/${user.uid}/${uid}`), { unread: 0 });
        } catch (e) {
            console.error(e);
        }
    }, [user]);

    const closeChat = useCallback(() => {
        setActiveChatId(null);
        _setActivePeer(null);
        setMobileChatOpen(false);
    }, []);

    return (
        <ChatContext.Provider value={{
            activeChatId,
            activePeer,
            startChat,
            setActiveChat,
            closeChat,
            isMobileChatOpen,
            setMobileChatOpen
        }}>
            {children}
        </ChatContext.Provider>
    );
}
