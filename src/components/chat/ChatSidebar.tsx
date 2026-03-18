'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
    MessageCircle, Users, GraduationCap, Globe2, Search, Check, X,
    Shield, ShieldCheck, ClipboardList, ChevronRight, Bot, PlusCircle, Sparkles, MessageSquare
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FriendData, ChatMeta, ChatTab } from './ChatView';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

interface ChatSidebarProps {
    friends: FriendData[];
    sentRequests: Set<string>;
    receivedRequests: FriendData[];
    chatMeta: Record<string, ChatMeta>;
    activeTab: ChatTab;
    onTabChange: (tab: ChatTab) => void;
    activePeerId: string | null;
    onStartDM: (uid: string, name: string, dept: string, photo: string) => void;
    onStartGroupChat: (dept?: string, sem?: string) => void;
    onStartGlobalChat: () => void;
    onStartCRGroupChat: () => void;
    onStartAIChat: (chatId?: string) => void;
    onSendRequest: (uid: string, name: string, photo: string, dept: string) => void;
    onCancelRequest: (uid: string) => void;
    onAcceptRequest: (uid: string, name: string, photo: string, dept: string) => void;
    onRejectRequest: (uid: string) => void;
    adminUid: string;
    classGroupIcon: string | null;
    globalGroupIcon: string | null;
}

interface TeacherAssignment {
    dept: string;
    sem?: string;
    subject?: string;
}

interface TeacherData {
    uid: string;
    name: string;
    dept?: string;
    parentDept?: string;
    department?: string; // Legacy
    photoURL?: string;
    role?: string;
    assignments?: TeacherAssignment[];
}

export default function ChatSidebar({
    friends,
    sentRequests,
    receivedRequests,
    chatMeta,
    activeTab,
    onTabChange,
    activePeerId,
    onStartDM,
    onStartGroupChat,
    onStartGlobalChat,
    onStartCRGroupChat,
    onStartAIChat,
    onSendRequest,
    onCancelRequest,
    onAcceptRequest,
    onRejectRequest,
    adminUid,
    classGroupIcon,
    globalGroupIcon,
}: ChatSidebarProps) {
    const { userProfile } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [friendSubTab, setFriendSubTabInternal] = useState<'list' | 'requests'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{
        uid: string; name: string; dept: string; photoURL: string; role: string;
    }[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Sync sub-tab with URL
    useEffect(() => {
        const view = searchParams.get('view');
        if (view === 'requests') {
            setFriendSubTabInternal('requests');
        } else if (view === 'list') {
            setFriendSubTabInternal('list');
        }
    }, [searchParams]);

    const setFriendSubTab = useCallback((sub: 'list' | 'requests') => {
        setFriendSubTabInternal(sub);
        const params = new URLSearchParams(searchParams.toString());
        params.set('view', sub);
        router.replace(`/social/friends?${params.toString()}`);
    }, [router, searchParams]);

    // Teachers state
    const [teachers, setTeachers] = useState<TeacherData[]>([]);
    const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);

    const friendUids = useMemo(() => new Set(friends.map(f => f.uid)), [friends]);

    /* ─── Load Teachers Logic (Matching Original loadTeacherList) ─── */
    useEffect(() => {
        if (activeTab !== 'teacher' || !userProfile?.dept) return;

        const fetchTeachers = async () => {
            setIsLoadingTeachers(true);
            try {
                const snap = await getDocs(collection(db, 'students'));
                const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as TeacherData));

                // Filter exactly like original: role=teacher, then check dept or assignments
                const teacherList = allUsers.filter(u => {
                    if (u.role !== 'teacher' || u.uid === userProfile.uid) return false;

                    // 1. Legacy department field check (matches original: t.department === userProfile.dept)
                    if (u.department === userProfile.dept) return true;

                    // 2. Also check primary dept field & parentDept
                    if (u.dept === userProfile.dept || u.parentDept === userProfile.dept) return true;

                    // 3. Assignment match — ONLY check dept, NO semester filter (matches original exactly)
                    if (u.assignments && Array.isArray(u.assignments)) {
                        return u.assignments.some(a => a.dept === userProfile.dept);
                    }

                    return false;
                });

                console.log(`[Teachers] Found ${teacherList.length} teachers for ${userProfile.dept}:`, teacherList.map(t => t.name));
                setTeachers(teacherList);
            } catch (err) {
                console.error('Teacher Fetch Error:', err);
            }
            setIsLoadingTeachers(false);
        };

        fetchTeachers();
    }, [activeTab, userProfile?.dept, userProfile?.uid]);



    /* ─── Compute total unread for Recent tab ─── */
    const totalUnread = useMemo(() => {
        return Object.values(chatMeta).reduce((sum, m) => sum + (m.unread || 0), 0);
    }, [chatMeta]);

    const tabs = [
        { id: 'recent' as ChatTab, icon: <MessageCircle className="w-5 h-5" />, label: 'Recent', total: totalUnread },
        { id: 'friends' as ChatTab, icon: <Users className="w-5 h-5" />, label: 'Friends', total: receivedRequests.length },
        { id: 'ai' as ChatTab, icon: <Bot className="w-5 h-5" />, label: 'AI' },
        { id: 'teacher' as ChatTab, icon: <GraduationCap className="w-5 h-5" />, label: 'Teachers' },
        { id: 'groups' as ChatTab, icon: <Users className="w-5 h-5" />, label: 'Groups' },
        { id: 'search' as ChatTab, icon: <Search className="w-5 h-5" />, label: 'Search' },
    ];

    const feedRef = useRef<HTMLDivElement>(null);
    useSmoothScroll(feedRef);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black overflow-hidden relative">
            {/* ── Sidebar Header ── */}
            <div className="p-4 border-b-2 border-black dark:border-zinc-800 bg-white dark:bg-black flex justify-between items-center">
                <h2 className="font-black uppercase text-xl tracking-tighter">Social</h2>
            </div>

            {/* ── Tab Navigation ── */}
            <div className="p-2 border-b-2 border-black dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/30">
                <div className="flex justify-between items-center gap-1 overflow-x-hidden no-scrollbar">
                    {tabs.map((t) => {
                        const hasBadge = (t.total || 0) > 0;
                        return (
                            <button
                                key={t.id}
                                onClick={() => onTabChange(t.id)}
                                className={`flex-1 flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all shrink-0 min-w-[54px] relative group ${activeTab === t.id
                                    ? 'border-black dark:border-white bg-white dark:bg-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)]'
                                    : 'border-transparent opacity-40 hover:opacity-100 hover:bg-white/50 dark:hover:bg-white/5'
                                    }`}
                            >
                                {t.icon}
                                {hasBadge && (
                                    <span className="absolute top-1 right-2 bg-red-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white dark:border-black animate-bounce shadow-sm">
                                        {t.total}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Tab Content Area ── */}
            <div ref={feedRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-white dark:bg-black pb-20 md:pb-0">
                <div className="locomotive-content-wrapper">
                    {/* RECENT TAB */}
                    {activeTab === 'recent' && (
                        <div className="divide-y-2 divide-gray-100 dark:divide-zinc-900/50">
                            <SectionLabel text="Recent Conversations" />
                            {Object.keys(chatMeta).length === 0 ? (
                                <EmptyState text="No conversations yet." />
                            ) : (
                                Object.entries(chatMeta)
                                    .filter(([, meta]) => meta.name && meta.name.trim() !== '')
                                    .sort(([, a], [, b]) => (b.timestamp || 0) - (a.timestamp || 0))
                                    .map(([uid, meta]) => (
                                        <ChatRow
                                            key={uid}
                                            name={meta.name || 'User'}
                                            subtitle={meta.lastMessage || ''}
                                            photo={meta.photo || ''}
                                            time={meta.timestamp ? new Date(meta.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            unread={meta.unread}
                                            isActive={activePeerId === uid}
                                            onClick={() => onStartDM(uid, meta.name || '', meta.dept || '', meta.photo || '')}
                                        />
                                    ))
                            )}
                        </div>
                    )}

                    {/* FRIENDS TAB */}
                    {activeTab === 'friends' && (
                        <div className="flex flex-col h-full bg-white dark:bg-black">
                            <div className="flex border-b-2 border-black dark:border-zinc-800 p-1 bg-gray-50 dark:bg-zinc-950">
                                <button
                                    onClick={() => setFriendSubTab('list')}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase transition-all ${friendSubTab === 'list' ? 'bg-black text-white dark:bg-white dark:text-black' : 'opacity-40'
                                        }`}
                                >
                                    My Circles
                                </button>
                                <button
                                    onClick={() => setFriendSubTab('requests')}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase transition-all relative ${friendSubTab === 'requests' ? 'bg-black text-white dark:bg-white dark:text-black' : 'opacity-40'
                                        }`}
                                >
                                    Requests
                                    {receivedRequests.length > 0 && (
                                        <span className="ml-1.5 px-2 py-0.5 bg-red-600 text-white rounded-full text-[8px] border border-white">
                                            {receivedRequests.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <div className="divide-y-2 divide-gray-50 dark:divide-zinc-900/50">
                                {friendSubTab === 'list' ? (
                                    friends.length === 0 ? (
                                        <EmptyState text="No active circles." />
                                    ) : (
                                        friends.map(f => (
                                            <ChatRow
                                                key={f.uid}
                                                name={f.name}
                                                subtitle={f.dept}
                                                photo={f.photo}
                                                isActive={activePeerId === f.uid}
                                                onClick={() => onStartDM(f.uid, f.name, f.dept, f.photo)}
                                            />
                                        ))
                                    )
                                ) : (
                                    receivedRequests.length === 0 ? (
                                        <EmptyState text="No pending requests." />
                                    ) : (
                                        receivedRequests.map(r => (
                                            <div key={r.uid} className="p-5 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <img src={r.photo || `https://ui-avatars.com/api/?name=${r.name}`} className="w-12 h-12 rounded-full border-2 border-black dark:border-zinc-600 object-cover" referrerPolicy="no-referrer" />
                                                    <div className="min-w-0">
                                                        <p className="font-black text-sm uppercase truncate">{r.name}</p>
                                                        <p className="text-[10px] opacity-60 font-mono truncate">{r.dept}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => onAcceptRequest(r.uid, r.name, r.photo, r.dept)} className="p-2.5 bg-black text-white dark:bg-white dark:text-black border-2 border-black hover:opacity-80 transition-all"><Check className="w-4 h-4" /></button>
                                                    <button onClick={() => onRejectRequest(r.uid)} className="p-2.5 border-2 border-black dark:border-white hover:bg-red-50 dark:hover:bg-red-900/10"><X className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {/* TEACHER TAB */}
                    {activeTab === 'teacher' && (
                        <div>
                            <SectionLabel text="Academic Mentors" />
                            <div className="divide-y-2 divide-gray-50 dark:divide-zinc-900/50">
                                {isLoadingTeachers ? (
                                    <TeacherSkeleton />
                                ) : teachers.length === 0 ? (
                                    <EmptyState text={`No teachers assigned to ${userProfile?.dept} - ${userProfile?.sem} sem (${userProfile?.section}).`} />
                                ) : (
                                    teachers.map(t => {
                                        const relevant = t.assignments?.find(a => a.dept === userProfile?.dept) || (t.assignments ? t.assignments[0] : null);
                                        const displayInfo = relevant
                                            ? `${relevant.dept} • ${relevant.subject || 'Faculty'}`
                                            : (t.dept || t.department || 'Faculty');
                                        const img = t.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=3b82f6&color=fff`;
                                        return (
                                            <ChatRow
                                                key={t.uid}
                                                name={t.name}
                                                subtitle={displayInfo}
                                                photo={img}
                                                isActive={activePeerId === t.uid}
                                                onClick={() => onStartDM(t.uid, t.name, displayInfo, img)}
                                                badge="TEACHER"
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* AI TAB */}
                    {activeTab === 'ai' && (
                        <div className="flex flex-col h-full bg-white dark:bg-black">
                            <SectionLabel text="AI Assistant" />
                            <div className="p-4 border-b-2 border-black dark:border-zinc-800 bg-emerald-50 dark:bg-emerald-950/20">
                                <button
                                    onClick={() => onStartAIChat()}
                                    className="w-full flex items-center justify-center gap-3 p-4 bg-black dark:bg-white text-white dark:text-black font-black uppercase text-sm rounded border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(34,197,94,1)] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                                >
                                    <PlusCircle className="w-5 h-5" />
                                    New Conversation
                                </button>
                            </div>
                            <SectionLabel text="Previous Chats" />
                            <div className="divide-y-2 divide-gray-50 dark:divide-zinc-900/50 p-4">
                                <EmptyState text="No chat history yet." />
                            </div>
                        </div>
                    )}

                    {/* GROUPS TAB */}
                    {activeTab === 'groups' && (
                        <div className="divide-y-2 divide-gray-100 dark:divide-zinc-900/50 bg-white dark:bg-black">
                            <SectionLabel text="Community Hubs" />

                            {/* Class Group */}
                            <div
                                onClick={() => onStartGroupChat()}
                                className={`p-5 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex items-center gap-4 border-l-4 ${activePeerId?.startsWith('group_') ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-600' : 'border-transparent'}`}
                            >
                                <div className="w-14 h-14 shrink-0 transition-transform hover:scale-105">
                                    {classGroupIcon ? (
                                        <img src={classGroupIcon} className="w-full h-full rounded-2xl object-cover border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                                    ) : (
                                        <div className="w-full h-full rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                            <Users className="w-6 h-6" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sm uppercase truncate text-blue-700 dark:text-blue-400">{userProfile?.section} / {userProfile?.dept} - {userProfile?.sem}</p>
                                    <p className="text-[10px] opacity-60 font-mono tracking-widest mt-0.5">Verified Class Portal</p>
                                </div>
                                <ChevronRight className="w-5 h-5 opacity-20" />
                            </div>

                            {/* Campus Global */}
                            <div
                                onClick={onStartGlobalChat}
                                className={`p-5 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all flex items-center gap-4 border-l-4 ${activePeerId === 'global_chat' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500' : 'border-transparent'}`}
                            >
                                <div className="w-14 h-14 shrink-0">
                                    {globalGroupIcon ? (
                                        <img src={globalGroupIcon} className="w-full h-full rounded-2xl object-cover border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" />
                                    ) : (
                                        <div className="w-full h-full rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                            <Globe2 className="w-6 h-6" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sm uppercase truncate text-amber-700 dark:text-amber-500">Campus Global</p>
                                    <p className="text-[10px] opacity-60 font-mono tracking-widest mt-0.5">Open Communication Hub</p>
                                </div>
                                <ChevronRight className="w-5 h-5 opacity-20" />
                            </div>

                            {/* CR Group Chat */}
                            {userProfile?.isCR && (
                                <div
                                    onClick={onStartCRGroupChat}
                                    className={`p-5 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all flex items-center gap-4 border-l-4 ${activePeerId === 'cr_group' ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-600' : 'border-transparent'}`}
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                        <Shield className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="font-black text-sm uppercase truncate text-purple-700 dark:text-purple-400">CR Council</p>
                                            <span className="bg-purple-600 text-[8px] px-1.5 py-0.5 rounded-full text-white font-black animate-pulse">SECRET</span>
                                        </div>
                                        <p className="text-[10px] opacity-60 font-mono tracking-widest">Class Representatives Only</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 opacity-20" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* SEARCH TAB */}
                    {activeTab === 'search' && (
                        <div className="bg-white dark:bg-black h-full">
                            <div className="p-4 border-b-2 border-black dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950">
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-purple-600 transition-colors">
                                        <Search className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            performSearch(e.target.value);
                                        }}
                                        placeholder="Roll, Name or Dept..."
                                        className="w-full pl-12 p-3.5 border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-black uppercase outline-none focus:border-purple-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    />
                                </div>
                            </div>
                            <div className="divide-y-2 divide-gray-50 dark:divide-zinc-900/50">
                                {isSearching ? (
                                    <div className="py-20 text-center opacity-20"><div className="w-10 h-10 border-4 border-current border-t-transparent rounded-full animate-spin mx-auto" /></div>
                                ) : searchQuery.length === 0 ? (
                                    <EmptyState text="Start Typing to Search" />
                                ) : searchResults.length === 0 ? (
                                    <EmptyState text="No matching members found." />
                                ) : (
                                    searchResults.map(u => {
                                        // Compute friend status LIVE from props (not baked-in)
                                        const isFriend = friendUids.has(u.uid);
                                        const isRequestSent = sentRequests.has(u.uid);
                                        const isRequestReceived = !!receivedRequests.find(r => r.uid === u.uid);

                                        return (
                                            <div key={u.uid} className="p-5 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-zinc-900/30 transition-colors">
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <img src={u.photoURL} className="w-12 h-12 rounded-full border-2 border-black dark:border-zinc-700 object-cover shrink-0" referrerPolicy="no-referrer" />
                                                    <div className="min-w-0">
                                                        <p className="font-black text-sm truncate uppercase tracking-tight">
                                                            {u.name}
                                                            {u.role === 'teacher' && <span className="ml-2 text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-sm">TEACHER</span>}
                                                        </p>
                                                        <p className="text-[10px] font-mono opacity-50 truncate uppercase tracking-widest">{u.dept}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {u.role === 'teacher' ? (
                                                        <button
                                                            onClick={() => onStartDM(u.uid, u.name, u.dept, u.photoURL)}
                                                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-[10px] font-black uppercase border-2 border-blue-700 hover:bg-blue-700 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none"
                                                        >
                                                            <MessageCircle className="w-4 h-4" />
                                                            Message
                                                        </button>
                                                    ) : isFriend ? (
                                                        <button
                                                            onClick={() => onStartDM(u.uid, u.name, u.dept, u.photoURL)}
                                                            className="p-2.5 bg-green-100 dark:bg-green-950/30 text-green-600 rounded-full hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors"
                                                            title="Send Message"
                                                        >
                                                            <MessageCircle className="w-5 h-5" />
                                                        </button>
                                                    ) : isRequestSent ? (
                                                        <button
                                                            onClick={() => onCancelRequest(u.uid)}
                                                            className="flex items-center gap-1.5 px-3 py-2 border-2 border-red-500 text-red-500 text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all active:translate-y-0.5"
                                                        >
                                                            <X className="w-4 h-4" />
                                                            Cancel
                                                        </button>
                                                    ) : isRequestReceived ? (
                                                        <button onClick={() => onAcceptRequest(u.uid, u.name, u.photoURL, u.dept)} className="flex items-center gap-1.5 px-3 py-2 bg-black text-white dark:bg-white dark:text-black border-2 border-black text-[10px] font-black uppercase" title="Accept Request">
                                                            <Check className="w-4 h-4" />
                                                            Accept
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => onSendRequest(u.uid, u.name, u.photoURL, u.dept)}
                                                            className="flex items-center gap-1.5 px-3 py-2 border-2 border-black dark:border-white text-[10px] font-black uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none"
                                                        >
                                                            <Users className="w-4 h-4" />
                                                            Add Friend
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    async function performSearch(q: string) {
        if (!q.trim()) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const snap = await getDocs(collection(db, 'students'));
            const lower = q.toLowerCase();
            const results = snap.docs
                .map(d => d.data())
                .filter(u =>
                    u.uid !== userProfile?.uid &&
                    (
                        (u.name || '').toLowerCase().includes(lower) ||
                        (u.roll && u.roll.toString().includes(lower)) ||
                        (u.dept && u.dept.toLowerCase().includes(lower))
                    )
                )
                .slice(0, 15)
                .map(u => ({
                    uid: u.uid,
                    name: u.name,
                    dept: u.dept || u.department || 'Student',
                    photoURL: u.photoURL || `https://ui-avatars.com/api/?name=${u.name}`,
                    role: u.role || 'student',
                }));
            setSearchResults(results);
        } catch (err) {
            console.error('Search error:', err);
        }
        setIsSearching(false);
    }
}

function SectionLabel({ text }: { text: string }) {
    return (
        <div className="px-5 py-2.5 bg-gray-50 dark:bg-zinc-950 border-b border-black/5 dark:border-white/5">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] opacity-40">{text}</span>
        </div>
    );
}

function ChatRow({ name, subtitle, photo, time, unread, isActive, onClick, badge }: {
    name: string; subtitle: string; photo: string; time?: string; unread?: number; isActive: boolean; onClick: () => void; badge?: string;
}) {
    return (
        <div
            onClick={onClick}
            className={`p-5 flex items-center gap-4 cursor-pointer transition-all border-l-4 ${isActive
                ? 'bg-gray-100 dark:bg-zinc-900 border-l-black dark:border-l-white scale-[1.01] z-10 shadow-lg'
                : 'hover:bg-gray-50 dark:hover:bg-zinc-900/30 border-l-transparent'
                }`}
        >
            <div className="relative shrink-0">
                <img src={photo || `https://ui-avatars.com/api/?name=${name}`} className="w-14 h-14 rounded-full border-2 border-black dark:border-zinc-700 object-cover shadow-sm" referrerPolicy="no-referrer" />
                {(unread || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-white dark:border-black animate-bounce">
                        {unread}
                    </span>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                    <p className={`font-black text-sm truncate uppercase tracking-tight ${isActive ? 'text-black dark:text-white' : 'text-gray-900 dark:text-zinc-100'}`}>
                        {name}
                        {badge && <span className="ml-2 text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-sm">{badge}</span>}
                    </p>
                    {time && <span className="text-[10px] opacity-40 font-mono tracking-tighter ml-2">{time}</span>}
                </div>
                <p className={`text-xs truncate font-mono uppercase tracking-widest ${isActive ? 'opacity-80' : 'opacity-40'}`}>{subtitle}</p>
            </div>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="py-24 px-10 text-center flex flex-col items-center gap-4 opacity-20 grayscale">
            <div className="w-12 h-1 bg-black dark:bg-white opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] font-mono leading-relaxed max-w-[200px]">{text}</p>
        </div>
    );
}

function TeacherSkeleton() {
    return (
        <div className="divide-y-2 divide-gray-50 dark:divide-zinc-900/50 animate-pulse">
            {[1, 2, 3].map(i => (
                <div key={i} className="p-5 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-zinc-800" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-zinc-800 w-1/3" />
                        <div className="h-3 bg-gray-100 dark:bg-zinc-900 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}
