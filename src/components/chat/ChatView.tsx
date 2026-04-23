'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat, ActivePeer } from '@/context/ChatContext';
import { useUI } from '@/context/UIContext';
import { db, rtdb } from '@/lib/firebase';
import { apiUrl } from '@/lib/apiBase';
import {
    collection, onSnapshot, doc, writeBatch, deleteDoc, getDoc, getDocs, query, where, serverTimestamp as fsServerTimestamp
} from 'firebase/firestore';
import {
    ref, onValue, push, update, serverTimestamp as rtdbServerTimestamp, off, runTransaction
} from 'firebase/database';
import { useRouter } from 'next/navigation';
import { secureUploadFile } from '@/lib/uploadService';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/cropImage';
import ChatSidebar from './ChatSidebar';
import ChatArea from './ChatArea';
import { ArrowLeft, Settings, Image as ImageIcon, X, Check, Loader2 } from 'lucide-react';

/* ─── Types ─── */
export interface FriendData {
    uid: string;
    name: string;
    photo: string;
    dept: string;
    status: 'accepted' | 'sent' | 'received';
    timestamp?: { seconds: number };
}

export interface ChatMeta {
    lastMessage: string;
    timestamp: number;
    name: string;
    dept: string;
    photo: string;
    unread: number;
}

export interface MessageData {
    key: string;
    senderId: string;
    senderName?: string;
    senderPhoto?: string;
    senderRole?: string;
    text: string;
    timestamp: number;
    isCR?: boolean;
    isDeleted?: boolean;
    edited?: boolean;
    replyTo?: string;
    replyToText?: string;
    replyToSender?: string;
    attachments?: { type: string; url: string; thumb?: string; service?: string; fileId?: string | null }[];
    isSharedNotice?: boolean;
    noticeId?: string;
    noticeTitle?: string;
}

export type ChatTab = 'recent' | 'friends' | 'ai' | 'teacher' | 'groups' | 'search';
export type ActiveChatType = 'dm' | 'group' | 'global' | 'cr' | 'admin' | 'ai';
const ADMIN_UID = 'Q8lLnFIFuPeVcS9HU0y9p7iKKyo2';

/* ═══════════════════════════════════════════
   MAIN CHAT VIEW
   ═══════════════════════════════════════════ */
export default function ChatView({ initialTab }: { initialTab?: string }) {
    const router = useRouter();
    const { userProfile } = useAuth();
    const { openProfile, showToast, showAlert } = useUI();
    const {
        activeChatId,
        activePeer,
        startChat,
        setActiveChat,
        closeChat,
        isMobileChatOpen
    } = useChat();

    // ── Sidebar Data ──
    const [friends, setFriends] = useState<FriendData[]>([]);
    const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
    const [receivedRequests, setReceivedRequests] = useState<FriendData[]>([]);
    const [chatMeta, setChatMeta] = useState<Record<string, ChatMeta>>({});
    const [activeTab, setActiveTabInternal] = useState<ChatTab>((initialTab as ChatTab) || 'recent');

    // Sync activeTab with initialTab prop (from URL) — only on mount
    const initialTabApplied = useRef(false);
    useEffect(() => {
        if (initialTab && !initialTabApplied.current) {
            initialTabApplied.current = true;
            if (initialTab !== activeTab) {
                setActiveTabInternal(initialTab as ChatTab);
            }
        }
    }, [initialTab]);

    // Switch tabs via React state only — update URL shallowly (no navigation)
    const setActiveTab = useCallback((tab: ChatTab) => {
        setActiveTabInternal(tab);
        // Update URL for bookmarkability without triggering a route change
        try {
            window.history.replaceState(null, '', `/social/${tab}`);
        } catch { /* ignore in SSR */ }
    }, []);

    // ── Messages ──
    const [messages, setMessages] = useState<MessageData[]>([]);

    // ── Theme ──
    const [chatTheme, setChatTheme] = useState<'modern' | 'classic' | 'digital'>('modern');
    const [fontSize, setFontSize] = useState(14);
    const [bubbleSize, setBubbleSize] = useState<1 | 2 | 3 | 4 | 5>(3);
    const [modernPreset, setModernPreset] = useState('from-indigo-600 to-purple-700');
    const [mobileAppearanceOpen, setMobileAppearanceOpen] = useState(false);

    // ── Group Icons ──
    const [classGroupIcon, setClassGroupIcon] = useState<string | null>(null);
    const [globalGroupIcon, setGlobalGroupIcon] = useState<string | null>(null);

    // ── Group Icon Crop ──
    const [groupIconSrc, setGroupIconSrc] = useState<string | null>(null);
    const [groupIconCrop, setGroupIconCrop] = useState({ x: 0, y: 0 });
    const [groupIconZoom, setGroupIconZoom] = useState(1);
    const [groupIconCroppedArea, setGroupIconCroppedArea] = useState<any>(null);
    const [isGroupIconUploading, setIsGroupIconUploading] = useState(false);

    // ── Peer Presence ──
    const [peerStatus, setPeerStatus] = useState<'online' | 'offline'>('offline');
    const [peerLastOnline, setPeerLastOnline] = useState<number | undefined>(undefined);

    // Listener cleanup ref
    const messageListenerRef = useRef<(() => void) | null>(null);
    const groupIconInputRef = useRef<HTMLInputElement>(null);

    /* ─── Listen to friend relationships (Firestore) ─── */
    useEffect(() => {
        if (!userProfile?.uid) return;

        const unsub = onSnapshot(
            collection(db, 'students', userProfile.uid, 'friends'),
            (snapshot) => {
                const friendsList: FriendData[] = [];
                const sent = new Set<string>();
                const received: FriendData[] = [];

                snapshot.forEach((doc) => {
                    const data = doc.data() as Omit<FriendData, 'uid'>;
                    if (data.status === 'accepted') {
                        friendsList.push({ uid: doc.id, ...data });
                    } else if (data.status === 'sent') {
                        sent.add(doc.id);
                    } else if (data.status === 'received') {
                        received.push({ uid: doc.id, ...data });
                    }
                });

                setFriends(friendsList);
                setSentRequests(sent);
                setReceivedRequests(received);
            }
        );

        return () => unsub();
    }, [userProfile?.uid]);

    /* ─── Listen to recent chats metadata (RTDB) ─── */
    useEffect(() => {
        if (!userProfile?.uid) return;

        const chatListRef = ref(rtdb, `user_chats/${userProfile.uid}`);
        const unsub = onValue(chatListRef, (snapshot) => {
            const meta: Record<string, ChatMeta> = {};
            snapshot.forEach((child) => {
                meta[child.key!] = child.val();
            });
            setChatMeta(meta);
        });

        return () => off(chatListRef);
    }, [userProfile?.uid]);

    /* ─── Load chat theme ─── */
    useEffect(() => {
        const saved = localStorage.getItem('chatTheme');
        if (saved === 'classic' || saved === 'digital' || saved === 'modern') {
            setChatTheme(saved);
        }
    }, []);

    /* ─── Listen to group chat icons from RTDB ─── */
    useEffect(() => {
        if (!userProfile?.dept || !userProfile?.sem || !userProfile?.section) return;

        const classGroupChatId = `group_${userProfile.section}_${userProfile.dept}_${userProfile.sem}`.replace(/\s/g, '_').toLowerCase();

        // Listen for Class Group icon
        const classIconRef = ref(rtdb, `group_chats_meta/${classGroupChatId}/photoURL`);
        const classUnsub = onValue(classIconRef, (snap) => {
            setClassGroupIcon(snap.val() || null);
        });

        // Listen for Global Group icon
        const globalIconRef = ref(rtdb, `group_chats_meta/global_chat/photoURL`);
        const globalUnsub = onValue(globalIconRef, (snap) => {
            setGlobalGroupIcon(snap.val() || null);
        });

        return () => {
            off(classIconRef);
            off(globalIconRef);
        };
    }, [userProfile?.dept, userProfile?.sem, userProfile?.section]);

    /* ─── Cleanup message listener ─── */
    const cleanupMessageListener = useCallback(() => {
        if (messageListenerRef.current) {
            messageListenerRef.current();
            messageListenerRef.current = null;
        }
    }, []);

    /* ─── EFFECT: Load Messages when Active Chat Changes ─── */
    useEffect(() => {
        cleanupMessageListener();
        setMessages([]);

        if (!activeChatId || !userProfile?.uid) return;

        // Determine path based on ID format
        const isGroup = activeChatId.startsWith('group_') || activeChatId === 'global_chat' || activeChatId === 'cr_group';

        let messagesRef;
        if (isGroup) {
            messagesRef = ref(rtdb, `group_chats/${activeChatId}/messages`);
        } else {
            messagesRef = ref(rtdb, `chats/${activeChatId}/messages`);

            // Mark as read for DMs
            if (activePeer?.uid) {
                update(ref(rtdb, `user_chats/${userProfile.uid}/${activePeer.uid}`), { unread: 0 });
            }
        }

        const unsub = onValue(messagesRef, (snapshot) => {
            const newMsgs: MessageData[] = [];
            snapshot.forEach((child) => {
                newMsgs.push({ key: child.key!, ...child.val() });
            });
            setMessages(newMsgs);
        });

        messageListenerRef.current = () => off(messagesRef);

        return () => {
            // cleanup is handled by next effect run or component unmount
        };
    }, [activeChatId, userProfile?.uid, cleanupMessageListener, activePeer?.uid]);

    /* ─── EFFECT: Listen to Active Peer Presence (RTDB) ─── */
    useEffect(() => {
        setPeerStatus('offline');
        setPeerLastOnline(undefined);

        if (!activePeer?.uid || activePeer.type !== 'dm') return;

        const statusRef = ref(rtdb, `status/${activePeer.uid}`);
        const unsub = onValue(statusRef, (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                setPeerStatus(data.state === 'online' ? 'online' : 'offline');
                setPeerLastOnline(data.last_changed);
            }
        });

        return () => {
            unsub();
            off(statusRef);
        };
    }, [activePeer?.uid, activePeer?.type]);

    /* ─── Handlers for Sidebar ─── */

    const startDMChatHandler = useCallback((peerId: string, name: string, info: string, photo: string) => {
        startChat(peerId, name, photo, info);
    }, [startChat]);

    const startAIChatHandler = useCallback((chatId?: string) => {
        const id = chatId || `ai_${Date.now()}`;
        setActiveChat(id, {
            uid: id,
            name: 'AI Assistant',
            dept: 'Antigravity AI',
            photo: 'https://ui-avatars.com/api/?name=AI&background=000&color=fff',
            info: 'Intelligent Knowledge Base',
            type: 'ai'
        });
    }, [setActiveChat]);

    const startGroupChatHandler = useCallback((dept?: string, sem?: string) => {
        if (!userProfile) return;
        const d = dept || userProfile.dept;
        const s = sem || userProfile.sem;
        const sec = userProfile.section;
        const groupChatId = `group_${sec}_${d}_${s}`.replace(/\s/g, '_').toLowerCase();

        setActiveChat(groupChatId, {
            uid: groupChatId,
            name: `${sec} / ${d} - ${s}`,
            dept: 'Class Group',
            photo: classGroupIcon || `https://ui-avatars.com/api/?name=${d}&background=22c55e&color=fff`,
            info: 'Class Group Chat',
            type: 'group'
        });
    }, [userProfile, setActiveChat, classGroupIcon]);

    const startGlobalChatHandler = useCallback(() => {
        setActiveChat('global_chat', {
            uid: 'global_chat',
            name: 'Campus Global',
            dept: 'System',
            photo: globalGroupIcon || 'https://ui-avatars.com/api/?name=G&background=f59e0b&color=fff',
            info: 'Everyone can see messages',
            type: 'global'
        });
    }, [setActiveChat, globalGroupIcon]);

    const startCRGroupChatHandler = useCallback(() => {
        setActiveChat('cr_group', {
            uid: 'cr_group',
            name: "CR's Group",
            dept: 'Official',
            photo: '',
            info: 'Class Representatives Only',
            type: 'cr'
        });
    }, [setActiveChat]);

    /* ─── Send Message ─── */
    const sendMessage = useCallback(async (text: string, replyTo?: { id: string; text: string; sender: string } | null, attachments?: { type: string; url: string; thumb?: string; service?: string; fileId?: string | null }[]) => {
        if (!userProfile?.uid || !activeChatId || (!text.trim() && (!attachments || attachments.length === 0))) return;

        const isGroupChat = activeChatId.startsWith('group_') || activeChatId === 'global_chat' || activeChatId === 'cr_group';
        const timestamp = rtdbServerTimestamp();

        const payload: Record<string, unknown> = {
            senderId: userProfile.uid,
            senderName: userProfile.name,
            senderPhoto: userProfile.photoURL || `https://ui-avatars.com/api/?name=${userProfile.name}`,
            text: text.trim(),
            timestamp,
            isCR: userProfile.isCR || false,
        };

        if (replyTo) {
            payload.replyTo = replyTo.id;
            payload.replyToText = replyTo.text;
            payload.replyToSender = replyTo.sender;
        }

        if (attachments && attachments.length > 0) {
            // Sanitize: Firebase RTDB rejects undefined values
            payload.attachments = attachments.map(att => {
                const clean: Record<string, string> = { type: att.type, url: att.url };
                if (att.thumb) clean.thumb = att.thumb;
                return clean;
            });
        }

        // Build a descriptive lastMessage for the sidebar preview
        let lastMessagePreview = text.trim().substring(0, 50);
        if (!lastMessagePreview && attachments && attachments.length > 0) {
            const hasVideo = attachments.some(a => a.type === 'video' || a.type.startsWith('video/'));
            const hasImage = attachments.some(a => a.type === 'image' || a.type.startsWith('image/'));
            if (hasVideo && hasImage) lastMessagePreview = '📎 Sent attachments';
            else if (hasVideo) lastMessagePreview = attachments.length > 1 ? '🎥 Sent videos' : '🎥 Sent a video';
            else if (hasImage) lastMessagePreview = attachments.length > 1 ? '📷 Sent photos' : '📷 Sent a photo';
            else lastMessagePreview = '📎 Sent an attachment';
        }

        try {
            if (activePeer?.type === 'ai') {
                // AI Chat Mode (Mock for now)
                await push(ref(rtdb, `chats/${activeChatId}/messages`), payload);
                setTimeout(async () => {
                    const aiPayload = {
                        senderId: 'ai_bot',
                        senderName: 'Antigravity AI',
                        senderPhoto: 'https://ui-avatars.com/api/?name=AI&background=000&color=fff',
                        text: 'This feature is coming soon.',
                        timestamp: rtdbServerTimestamp(),
                    };
                    await push(ref(rtdb, `chats/${activeChatId}/messages`), aiPayload);
                }, 1000);
                return;
            }

            if (isGroupChat) {
                await push(ref(rtdb, `group_chats/${activeChatId}/messages`), payload);
            } else {
                await push(ref(rtdb, `chats/${activeChatId}/messages`), payload);

                if (activePeer?.uid) {
                    // Update recent chats (my side)
                    await update(ref(rtdb, `user_chats/${userProfile.uid}/${activePeer.uid}`), {
                        lastMessage: lastMessagePreview,
                        timestamp,
                        name: activePeer.name,
                        dept: activePeer.dept,
                        photo: activePeer.photo,
                        unread: 0,
                    });

                    // Update recent chats (peer's side)
                    await update(ref(rtdb, `user_chats/${activePeer.uid}/${userProfile.uid}`), {
                        lastMessage: lastMessagePreview,
                        timestamp,
                        name: userProfile.name,
                        dept: userProfile.dept || 'Student',
                        photo: userProfile.photoURL || '',
                    });

                    // Increment peer's unread
                    const peerUnreadRef = ref(rtdb, `user_chats/${activePeer.uid}/${userProfile.uid}/unread`);
                    runTransaction(peerUnreadRef, (current) => (current || 0) + 1);

                    // Fire-and-forget: send FCM push notification to peer
                    fetch(apiUrl('/api/notifications/chat'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            recipientUid: activePeer.uid,
                            senderUid: userProfile.uid,
                            senderName: userProfile.name,
                            messagePreview: lastMessagePreview || 'New message',
                        }),
                    }).catch(err => console.warn('[ChatNotif] Failed:', err));
                }
            }
        } catch (err) {
            console.error('Send message error:', err);
        }
    }, [userProfile, activeChatId, activePeer]);

    /* ─── Friend Handlers ─── */
    const sendRequest = useCallback(async (peerId: string, peerName: string, peerPhoto: string, peerDept: string) => {
        if (!userProfile?.uid) return;
        const batch = writeBatch(db);
        const myRef = doc(db, 'students', userProfile.uid, 'friends', peerId);
        batch.set(myRef, {
            status: 'sent',
            name: peerName,
            photo: peerPhoto,
            dept: peerDept,
            timestamp: fsServerTimestamp(),
        });
        const theirRef = doc(db, 'students', peerId, 'friends', userProfile.uid);
        batch.set(theirRef, {
            status: 'received',
            name: userProfile.name,
            photo: userProfile.photoURL || `https://ui-avatars.com/api/?name=${userProfile.name}`,
            dept: userProfile.dept || 'Student',
            timestamp: fsServerTimestamp(),
        });

        // Add to their notification history
        const theirNotifRef = doc(collection(db, 'students', peerId, 'notifications'));
        batch.set(theirNotifRef, {
            type: 'friend_request',
            title: 'New Friend Request',
            body: `${userProfile.name} wants to connect with you.`,
            author: userProfile.name,
            category: 'Social',
            timestamp: fsServerTimestamp(),
            viewed: false,
        });

        await batch.commit();

        // Send push notification
        fetch(apiUrl('/api/notifications/friend-request'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientUid: peerId,
                senderUid: userProfile.uid,
                senderName: userProfile.name,
                senderPhoto: userProfile.photoURL || '',
                senderDept: userProfile.dept || 'Student',
            }),
        }).catch(err => console.warn('[FriendNotif] API failed:', err));
    }, [userProfile]);

    const acceptRequest = useCallback(async (peerId: string, peerName: string, peerPhoto: string, peerDept: string) => {
        if (!userProfile?.uid) return;
        const batch = writeBatch(db);
        const myRef = doc(db, 'students', userProfile.uid, 'friends', peerId);
        batch.update(myRef, { status: 'accepted' });
        const theirRef = doc(db, 'students', peerId, 'friends', userProfile.uid);
        batch.update(theirRef, { status: 'accepted' });
        await batch.commit();

        await update(ref(rtdb, `user_chats/${userProfile.uid}/${peerId}`), {
            lastMessage: 'You are now connected!',
            timestamp: rtdbServerTimestamp(),
            name: peerName,
            dept: peerDept,
            photo: peerPhoto,
            unread: 0,
        });
        setActiveTab('recent');
    }, [userProfile]);

    const rejectRequest = useCallback(async (peerId: string) => {
        if (!userProfile?.uid) return;
        const batch = writeBatch(db);
        batch.delete(doc(db, 'students', userProfile.uid, 'friends', peerId));
        batch.delete(doc(db, 'students', peerId, 'friends', userProfile.uid));
        await batch.commit();
    }, [userProfile?.uid]);

    const cancelRequest = useCallback(async (peerId: string) => {
        if (!userProfile?.uid) return;
        const batch = writeBatch(db);
        batch.delete(doc(db, 'students', userProfile.uid, 'friends', peerId));
        batch.delete(doc(db, 'students', peerId, 'friends', userProfile.uid));
        await batch.commit();
    }, [userProfile?.uid]);

    /* ─── Header Click Handler (Open Profile) ─── */
    const handleHeaderClick = useCallback(() => {
        if (activePeer && activePeer.type === 'dm') {
            openProfile(activePeer.uid);
        }
    }, [activePeer, openProfile]);

    // Step 1: File selected → read as data URL to show crop modal
    const handleGroupIconFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => setGroupIconSrc(reader.result?.toString() || null));
        reader.readAsDataURL(file);
        if (groupIconInputRef.current) groupIconInputRef.current.value = '';
    };

    const onGroupIconCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
        setGroupIconCroppedArea(croppedAreaPixels);
    };

    // Step 2: Crop confirmed → crop, upload, update RTDB + activePeer
    const handleConfirmGroupIconCrop = async () => {
        if (!groupIconSrc || !groupIconCroppedArea || !userProfile?.uid) return;
        const isGroupType = activeChatId?.startsWith('group_') || activeChatId === 'global_chat' || activeChatId === 'cr_group';
        if (!activeChatId || !isGroupType) return;

        setIsGroupIconUploading(true);
        try {
            const croppedFile = await getCroppedImg(groupIconSrc, groupIconCroppedArea);
            if (!croppedFile) throw new Error('Could not crop image');

            const uploaded = await secureUploadFile(croppedFile, `/group_icons/${activeChatId}`);
            if (!uploaded) throw new Error('Upload returned no result');

            await update(ref(rtdb, `group_chats_meta/${activeChatId}`), {
                photoURL: uploaded.url,
                updatedBy: userProfile.uid,
                timestamp: rtdbServerTimestamp()
            });

            // Update the active peer photo so the header refreshes immediately
            if (activePeer) {
                setActiveChat(activeChatId, { ...activePeer, photo: uploaded.url });
            }

            showToast('Group icon updated!');
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to upload group icon.', 'error');
        } finally {
            setIsGroupIconUploading(false);
            setGroupIconSrc(null);
            setGroupIconZoom(1);
        }
    };

    const triggerGroupIconUpload = () => {
        if (userProfile?.isCR || userProfile?.role === 'admin') {
            groupIconInputRef.current?.click();
        } else {
            showToast('Only Admins/CRs can change group icon.');
        }
    };

    /* ─── Compute total unread ─── */
    const totalUnread = Object.values(chatMeta).reduce((sum, m) => sum + (m.unread || 0), 0) + receivedRequests.length;

    /* ─── Deep-link: Auto-open chat from ?chatWith=uid ─── */
    useEffect(() => {
        if (!userProfile?.uid) return;

        const handleOpenChat = (e: Event) => {
            const chatWith = (e as CustomEvent).detail?.chatWith;
            if (chatWith) {
                // Remove from URL so it doesn't re-trigger on refresh
                const url = new URL(window.location.href);
                url.searchParams.delete('chatWith');
                window.history.replaceState({}, '', url.pathname + url.search);

                startChat(chatWith);
            }
        };

        window.addEventListener('open-chat', handleOpenChat);

        // Check URL on initial load
        const params = new URLSearchParams(window.location.search);
        const urlChatWith = params.get('chatWith');
        if (urlChatWith) {
            handleOpenChat(new CustomEvent('open-chat', { detail: { chatWith: urlChatWith } }));
        }

        return () => window.removeEventListener('open-chat', handleOpenChat);
    }, [userProfile?.uid, startChat]);

    useEffect(() => {
        return () => cleanupMessageListener();
    }, [cleanupMessageListener]);

    return (
        <main className="flex-1 flex overflow-hidden h-full">
            {/* ── Sidebar ── */}
            <div className={`w-full md:w-80 lg:w-96 border-r-2 border-black dark:border-zinc-800 flex-shrink-0 flex flex-col bg-white dark:bg-black h-full ${isMobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
                <ChatSidebar
                    friends={friends}
                    sentRequests={sentRequests}
                    receivedRequests={receivedRequests}
                    chatMeta={chatMeta}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    activePeerId={activePeer?.uid || null}
                    onStartDM={startDMChatHandler}
                    onStartGroupChat={startGroupChatHandler}
                    onStartGlobalChat={startGlobalChatHandler}
                    onStartCRGroupChat={startCRGroupChatHandler}
                    onStartAIChat={startAIChatHandler}
                    onSendRequest={sendRequest}
                    onCancelRequest={cancelRequest}
                    onAcceptRequest={acceptRequest}
                    onRejectRequest={rejectRequest}
                    adminUid={ADMIN_UID}
                    classGroupIcon={classGroupIcon}
                    globalGroupIcon={globalGroupIcon}
                />
            </div>

            {/* ── Chat Area (Desktop: inline, Mobile: fullscreen overlay when open) ── */}
            {/* Desktop version — always inline */}
            <div className="hidden md:flex flex-1 flex-col h-full bg-zinc-950">
                {activeChatId && activePeer ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <ChatArea
                            messages={messages}
                            chatId={activeChatId}
                            chatType={activePeer.type as ActiveChatType}
                            peerName={activePeer.name}
                            peerInfo={activePeer.info || activePeer.dept}
                            peerPhoto={activePeer.photo}
                            peerStatus={peerStatus}
                            peerLastOnline={peerLastOnline}
                            chatTheme={chatTheme}
                            onThemeChange={setChatTheme}
                            fontSize={fontSize}
                            onFontSizeChange={setFontSize}
                            bubbleSize={bubbleSize}
                            onBubbleSizeChange={setBubbleSize}
                            modernPreset={modernPreset}
                            onModernPresetChange={setModernPreset}
                            externalToggle={mobileAppearanceOpen}
                            onExternalToggleConsumed={() => setMobileAppearanceOpen(false)}
                            onSendMessage={sendMessage}
                            onHeaderClick={handleHeaderClick}
                            onGroupIconEdit={triggerGroupIconUpload}
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center opacity-20">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-4 border-2 border-current rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </div>
                            <p className="text-xs font-bold uppercase tracking-widest">Select a Conversation</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile version — fullscreen overlay covering header & bottom nav */}
            {isMobileChatOpen && activeChatId && activePeer && (
                <div className="md:hidden fixed inset-0 z-[120] flex flex-col bg-white dark:bg-black">
                    {/* Mobile chat header with back button */}
                    <div className="flex items-center gap-3 p-3 border-b-2 border-black dark:border-zinc-800 bg-white dark:bg-black shrink-0">
                        <button onClick={closeChat} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex-1 flex items-center gap-3 min-w-0" onClick={handleHeaderClick}>
                            <div className="relative">
                                <img src={activePeer.photo || `https://ui-avatars.com/api/?name=${activePeer.name}`} className="w-8 h-8 rounded-full object-cover border border-gray-300" alt="" referrerPolicy="no-referrer" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{activePeer.name}</p>
                                <p className="text-[10px] opacity-50 font-mono uppercase truncate">{activePeer.info || activePeer.dept}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {(activePeer.type === 'group' || activePeer.type === 'cr' || activePeer.type === 'global') && (userProfile?.isCR || userProfile?.role === 'admin') && (
                                <button
                                    onClick={triggerGroupIconUpload}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg transition-all"
                                    title="Change Group Icon"
                                >
                                    <ImageIcon className="w-5 h-5 opacity-70" />
                                </button>
                            )}
                            <button
                                onClick={() => setMobileAppearanceOpen(prev => !prev)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg transition-all"
                            >
                                <Settings className="w-5 h-5 opacity-70" />
                            </button>
                        </div>
                    </div>

                    {/* Chat content — takes full remaining height */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <ChatArea
                            messages={messages}
                            chatId={activeChatId}
                            chatType={activePeer.type as ActiveChatType}
                            peerName={activePeer.name}
                            peerInfo={activePeer.info || activePeer.dept}
                            peerPhoto={activePeer.photo}
                            peerStatus={peerStatus}
                            peerLastOnline={peerLastOnline}
                            chatTheme={chatTheme}
                            onThemeChange={setChatTheme}
                            fontSize={fontSize}
                            onFontSizeChange={setFontSize}
                            bubbleSize={bubbleSize}
                            onBubbleSizeChange={setBubbleSize}
                            modernPreset={modernPreset}
                            onModernPresetChange={setModernPreset}
                            externalToggle={mobileAppearanceOpen}
                            onExternalToggleConsumed={() => setMobileAppearanceOpen(false)}
                            onSendMessage={sendMessage}
                            onHeaderClick={handleHeaderClick}
                            onGroupIconEdit={triggerGroupIconUpload}
                        />
                    </div>
                </div>
            )}

            {/* Hidden Input for Group Icon (accessible from headers) */}
            <input
                ref={groupIconInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleGroupIconFileSelect}
            />

            {/* Group Icon Crop Modal */}
            {groupIconSrc && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-black w-full max-w-lg border-2 border-black dark:border-zinc-800 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] flex flex-col max-h-[90vh]">
                        <div className="px-4 py-3 border-b-2 border-black dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-900">
                            <h3 className="font-black uppercase tracking-wider text-sm">Crop Group Icon</h3>
                            <button
                                onClick={() => { setGroupIconSrc(null); setGroupIconZoom(1); }}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="relative w-full h-[50vh] md:h-[400px] bg-gray-100 dark:bg-zinc-900">
                            <Cropper
                                image={groupIconSrc}
                                crop={groupIconCrop}
                                zoom={groupIconZoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setGroupIconCrop}
                                onCropComplete={onGroupIconCropComplete}
                                onZoomChange={setGroupIconZoom}
                            />
                        </div>
                        <div className="p-4 border-t-2 border-black dark:border-zinc-800 flex flex-col gap-4 bg-white dark:bg-black">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold uppercase w-12 text-gray-500">Zoom</span>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={groupIconZoom}
                                    onChange={(e) => setGroupIconZoom(Number(e.target.value))}
                                    className="flex-1 accent-black dark:accent-white h-1.5 bg-gray-200 dark:bg-zinc-800 appearance-none rounded-full"
                                />
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={() => { setGroupIconSrc(null); setGroupIconZoom(1); }}
                                    className="flex-1 py-3 border-2 border-black dark:border-zinc-700 font-bold uppercase text-sm hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmGroupIconCrop}
                                    disabled={isGroupIconUploading}
                                    className="flex-1 py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase text-sm flex justify-center items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {isGroupIconUploading ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                    ) : (
                                        <><Check className="w-4 h-4" /> Apply</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
