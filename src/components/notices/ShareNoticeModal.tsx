'use client';

import { useState, useRef } from 'react';
import { X, Share2, Send, Link2, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { rtdb } from '@/lib/firebase';
import { ref, push, update, runTransaction, serverTimestamp } from 'firebase/database';
import type { NoticeData } from './NoticeCard';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

interface FriendData {
    uid: string;
    name: string;
    dept?: string;
    photo?: string;
}

interface ShareNoticeModalProps {
    notice: NoticeData;
    friends: FriendData[];
    onClose: () => void;
}

export default function ShareNoticeModal({ notice, friends, onClose }: ShareNoticeModalProps) {
    const { user, userProfile } = useAuth();
    const { showAlert } = useUI();
    const scrollRef = useRef<HTMLDivElement>(null);
    useSmoothScroll(scrollRef);
    const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    const copyLink = async () => {
        const origin = window.location.origin;
        const link = `${origin}/?noticeId=${notice.id}`;
        try {
            await navigator.clipboard.writeText(link);
            setLinkCopied(true);
            showAlert('Link Copied!', 'The shareable link has been copied to your clipboard.', 'success');
            setTimeout(() => setLinkCopied(false), 3000);
        } catch {
            showAlert('Error', 'Failed to copy link. Please try manually.', 'error');
        }
    };

    const toggleFriend = (uid: string) => {
        setSelectedFriends(prev => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid);
            else next.add(uid);
            return next;
        });
    };

    const sendSharedNotice = async () => {
        if (selectedFriends.size === 0) {
            showAlert('Select Friends', 'Please select at least one friend to share with.', 'info');
            return;
        }
        if (!user || !userProfile) return;

        setSending(true);
        const customMessage = message.trim();
        const shareText = customMessage || 'Check out this notice:';

        const myImg = userProfile.photoURL || `https://ui-avatars.com/api/?name=${userProfile.name}`;

        try {
            const promises: any[] = [];

            for (const friendId of selectedFriends) {
                const friend = friends.find(f => f.uid === friendId);
                if (!friend) continue;

                const chatId = [user.uid, friendId].sort().join('_');

                // Send message
                const msgRef = ref(rtdb, `chats/${chatId}/messages`);
                promises.push(push(msgRef, {
                    senderId: user.uid,
                    text: shareText,
                    timestamp: serverTimestamp(),
                    isSharedNotice: true,
                    noticeId: notice.id,
                    noticeTitle: notice.title
                }));

                // Update my chat metadata
                const myChatRef = ref(rtdb, `user_chats/${user.uid}/${friendId}`);
                promises.push(update(myChatRef, {
                    lastMessage: `📌 Shared: ${notice.title}`,
                    timestamp: serverTimestamp(),
                    name: friend.name,
                    dept: friend.dept,
                    photo: friend.photo,
                    unread: 0
                }));

                // Update friend's chat metadata with unread increment
                const friendChatRef = ref(rtdb, `user_chats/${friendId}/${user.uid}`);
                promises.push(runTransaction(friendChatRef, (current) => {
                    return {
                        ...current,
                        lastMessage: `📌 Shared: ${notice.title}`,
                        timestamp: Date.now(),
                        name: userProfile.name,
                        dept: userProfile.dept,
                        photo: myImg,
                        unread: ((current as Record<string, unknown>)?.unread as number || 0) + 1
                    };
                }));
            }

            await Promise.all(promises);
            showAlert('Shared!', `Notice sent to ${selectedFriends.size} friend(s).`, 'success');
            onClose();
        } catch (e) {
            console.error('Share error:', e);
            showAlert('Error', 'Failed to share notice. Please try again.', 'error');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[220] modal-backdrop flex items-center justify-center p-4">
            <div className="bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-md p-6 relative shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <h3 className="text-xl font-bold mb-2 uppercase border-b-2 border-black dark:border-white pb-2 flex items-center gap-2">
                    <Share2 className="w-5 h-5" /> Share Notice
                </h3>
                <p className="text-sm font-mono opacity-70 mb-4 truncate">{notice.title}</p>

                {/* Copy Link Button */}
                <button
                    onClick={copyLink}
                    className={`w-full py-2.5 mb-4 border-2 font-bold uppercase text-sm flex items-center justify-center gap-2 transition-all ${linkCopied
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600'
                        : 'border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black'
                        }`}
                >
                    {linkCopied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                    {linkCopied ? 'Link Copied!' : 'Copy Shareable Link'}
                </button>

                {/* Friends list */}
                <div className="mb-4">
                    <p className="text-xs font-bold uppercase mb-2 opacity-50">Select Friends</p>
                    <div ref={scrollRef} className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar border border-gray-200 dark:border-gray-800 p-2">
                        <div className="locomotive-content-wrapper">
                            {friends.length === 0 ? (
                                <div className="text-center opacity-50 text-sm font-mono py-4">
                                    No friends yet. Add friends to share notices.
                                </div>
                            ) : (
                                friends.map(f => {
                                    const img = f.photo || `https://ui-avatars.com/api/?name=${f.name}`;
                                    return (
                                        <label
                                            key={f.uid}
                                            className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-zinc-900 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedFriends.has(f.uid)}
                                                onChange={() => toggleFriend(f.uid)}
                                                className="w-5 h-5 accent-black dark:accent-white cursor-pointer"
                                            />
                                            <img src={img} className="w-8 h-8 rounded-full border border-gray-300 object-cover" alt="" />
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-sm font-bold truncate">{f.name}</p>
                                                <p className="text-[10px] opacity-50 font-mono">{f.dept || 'Student'}</p>
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Optional message */}
                <div className="mb-4">
                    <label className="text-xs font-bold uppercase opacity-50 block mb-1">Add a Message (Optional)</label>
                    <input
                        type="text"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Check this out!"
                        className="w-full p-2 border-2 border-black dark:border-white bg-transparent outline-none font-mono text-sm"
                    />
                </div>

                {/* Send button */}
                <button
                    onClick={sendSharedNotice}
                    disabled={sending}
                    className="w-full py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase hover:opacity-80 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send to Selected'}
                </button>
            </div>
        </div>
    );
}
