'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowUp, Plus, Settings2, Pin, PinOff, Users, Image as ImageIcon, ClipboardCheck, QrCode } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, getDocs, getDoc, doc, where } from 'firebase/firestore';
import { useUI } from '@/context/UIContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { isOfflineCacheEnabled, cacheNotices, cacheCategories, getCachedNotices, getCachedCategories, isOnline } from '@/lib/offlineCache';
import NoticeCard from './NoticeCard';
import NoticeModal from './NoticeModal';
import ImageLightbox from './ImageLightbox';
import ShareNoticeModal from './ShareNoticeModal';
import DeleteNoticeModal from './DeleteNoticeModal';
import CreateNoticeModal from './CreateNoticeModal';
import EditNoticeModal from './EditNoticeModal';
import SubjectDropdown from './SubjectDropdown';
import CRDashboardModal from '../admin/CRDashboardModal';
import ManageBoardRollsModal from '../admin/ManageBoardRollsModal';
import AttendanceQRModal from '../admin/AttendanceQRModal';
import type { NoticeData } from './NoticeCard';

interface CategoryData {
    id: string;
    name: string;
    value: string;
}

interface SubjectData {
    name: string;
    code: string;
    dept: string;
    sem: string;
}

// Default hardcoded categories (matching HTML)
const DEFAULT_CATEGORIES = [
    { name: 'ALL NOTICES', value: 'all' },
    { name: 'URGENT', value: 'urgent' },
    { name: 'EXAMS', value: 'exam' },
    { name: 'GENERAL', value: 'general' },
    { name: 'CLASS TEST', value: 'class_test' },
];

export default function NoticesView() {
    const { userProfile, user } = useAuth();
    const { showAlert, showToast } = useUI();
    const { markAsViewed } = useNotifications();
    const router = useRouter();

    // Data state
    const [allNotices, setAllNotices] = useState<NoticeData[]>([]);
    const [categories, setCategories] = useState<CategoryData[]>([]);
    const [studentSubjects, setStudentSubjects] = useState<SubjectData[]>([]);
    const [friends, setFriends] = useState<{ uid: string; name: string; dept?: string; photo?: string }[]>([]);
    const [noticesLoaded, setNoticesLoaded] = useState(false);

    // Filter state
    const [currentFilter, setCurrentFilter] = useState('all');
    const [currentSubjectFilter, setCurrentSubjectFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [selectedNotice, setSelectedNotice] = useState<NoticeData | null>(null);
    const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
    const [shareNotice, setShareNotice] = useState<NoticeData | null>(null);
    const [deleteNoticeId, setDeleteNoticeId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editNotice, setEditNotice] = useState<NoticeData | null>(null);
    const [showManageModal, setShowManageModal] = useState(false);
    const [showRollsModal, setShowRollsModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [pinnedTools, setPinnedTools] = useState<string[]>([]);

    // Lightbox state
    const [lightboxAttachments, setLightboxAttachments] = useState<{ url: string; type: string }[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(-1);

    // Scroll-to-top
    const [showScrollTop, setShowScrollTop] = useState(false);
    const feedRef = useRef<HTMLElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    // DATA FETCHING
    // ============================================

    // Fetch notices (real-time) with offline cache fallback
    useEffect(() => {
        if (!userProfile) return;

        // If offline and cache is enabled, load from cache immediately
        if (!isOnline() && isOfflineCacheEnabled()) {
            const cached = getCachedNotices();
            if (cached && cached.length > 0) {
                setAllNotices(cached as NoticeData[]);
                setNoticesLoaded(true);
            }
        }

        const q = query(collection(db, 'notices'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Prevent wiping out offline cache if Firebase emits empty offline snapshot
            if (!isOnline() && snapshot.metadata.fromCache && snapshot.empty) {
                console.log('[NoticesView] Ignored empty offline Firestore snapshot to protect local cache.');
                return;
            }

            const notices: NoticeData[] = [];
            snapshot.forEach(doc => {
                notices.push({ id: doc.id, ...doc.data() } as NoticeData);
            });
            setAllNotices(notices);
            setNoticesLoaded(true);

            // Save to offline cache if enabled
            if (isOfflineCacheEnabled() && isOnline()) {
                cacheNotices(notices);
            }
        }, (error) => {
            console.warn('[NoticesView] Firestore listener error, trying cache:', error);
            // On error (likely offline), try cache
            if (isOfflineCacheEnabled()) {
                const cached = getCachedNotices();
                if (cached && cached.length > 0) {
                    setAllNotices(cached as NoticeData[]);
                    setNoticesLoaded(true);
                }
            }
        });

        return () => unsubscribe();
    }, [userProfile]);

    // Fetch categories (real-time) with offline cache fallback
    useEffect(() => {
        if (!userProfile) return;

        // Offline fallback
        if (!isOnline() && isOfflineCacheEnabled()) {
            const cached = getCachedCategories();
            if (cached) setCategories(cached as CategoryData[]);
        }

        const q = query(collection(db, 'notice_categories'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Prevent wiping out offline cache if Firebase emits empty offline snapshot
            if (!isOnline() && snapshot.metadata.fromCache && snapshot.empty) {
                console.log('[NoticesView] Ignored empty offline snapshot for categories.');
                return;
            }

            const cats: CategoryData[] = [];
            snapshot.forEach(doc => {
                cats.push({ id: doc.id, ...doc.data() } as CategoryData);
            });
            setCategories(cats);

            // Save to offline cache if enabled
            if (isOfflineCacheEnabled() && isOnline()) {
                cacheCategories(cats);
            }
        });

        return () => unsubscribe();
    }, [userProfile]);

    // Fetch student subjects (one-time)
    useEffect(() => {
        if (!userProfile?.dept || !userProfile?.sem) return;

        const q = query(
            collection(db, 'notice_subjects'),
            where('dept', 'in', [userProfile.dept, 'all', 'All', 'ALL'])
        );

        getDocs(q).then(snapshot => {
            const subjects: SubjectData[] = [];
            snapshot.forEach(doc => {
                const data = doc.data() as SubjectData;
                const subjectSem = data.sem?.toLowerCase() || '';
                if (data.sem === userProfile.sem || subjectSem === 'all' || subjectSem === 'all semester') {
                    subjects.push(data);
                }
            });
            // Sort subjects alphabetically
            subjects.sort((a, b) => a.name.localeCompare(b.name));
            setStudentSubjects(subjects);
        });
    }, [userProfile?.dept, userProfile?.sem]);

    // Fetch friends (for share modal)
    useEffect(() => {
        if (!user) return;

        const friendsRef = collection(db, 'students', user.uid, 'friends');
        const unsubscribe = onSnapshot(friendsRef, (snapshot) => {
            const friendsList: { uid: string; name: string; dept?: string; photo?: string }[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.status === 'accepted') {
                    friendsList.push({
                        uid: doc.id,
                        name: data.name,
                        dept: data.dept,
                        photo: data.photo,
                    });
                }
            });
            setFriends(friendsList);
        });

        return () => unsubscribe();
    }, [user]);

    // ============================================
    // DEEP LINK: Auto-open notice from ?noticeId=xxx
    // ============================================
    useEffect(() => {
        if (!userProfile || !noticesLoaded) return;

        const params = new URLSearchParams(window.location.search);
        const noticeId = params.get('noticeId');
        if (!noticeId) return;

        // Remove from URL immediately so it doesn't re-trigger
        const url = new URL(window.location.href);
        url.searchParams.delete('noticeId');
        window.history.replaceState({}, '', url.pathname + url.search);

        // Try to find it in already-loaded notices first
        const existing = allNotices.find(n => n.id === noticeId);
        if (existing) {
            setSelectedNotice(existing);
            return;
        }

        // Otherwise fetch directly from Firestore
        getDoc(doc(db, 'notices', noticeId)).then(snap => {
            if (!snap.exists()) {
                showAlert('Not Found', 'This notice does not exist or has been deleted.', 'error');
                return;
            }
            const data = { id: snap.id, ...snap.data() } as NoticeData;
            const targetDept = (data.targetDept || 'all').toLowerCase();
            const targetSem = (data.targetSem || 'all').toLowerCase();
            const userDept = (userProfile.dept || '').toLowerCase();
            const userSem = (userProfile.sem || '').toLowerCase();

            const deptOk = targetDept === 'all' || targetDept === userDept;
            const semOk = targetSem === 'all' || targetSem === userSem;

            if (deptOk && semOk) {
                setSelectedNotice(data);
            } else {
                showAlert('Access Denied', 'This notice is not available for your department/semester.', 'warning');
            }
        }).catch(() => {
            showAlert('Error', 'Failed to load the notice. Please try again.', 'error');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userProfile, noticesLoaded]);

    // ============================================
    // INSTANT OPEN: Listen for 'open-notice' event from NotificationBell
    // (no page refresh, just opens the modal directly)
    // ============================================
    useEffect(() => {
        const handler = (e: Event) => {
            const noticeId = (e as CustomEvent).detail?.noticeId;
            if (!noticeId) return;

            // Push ?noticeId to URL so back button works
            const url = new URL(window.location.href);
            url.searchParams.set('noticeId', noticeId);
            window.history.pushState({ noticeId }, '', url.toString());

            // Try to find it in already-loaded notices first
            const existing = allNotices.find(n => n.id === noticeId);
            if (existing) {
                setSelectedNotice(existing);
                markAsViewed(noticeId);
                return;
            }

            // Otherwise fetch from Firestore
            getDoc(doc(db, 'notices', noticeId)).then(snap => {
                if (!snap.exists()) {
                    showAlert('Not Found', 'This notice does not exist or has been deleted.', 'error');
                    return;
                }
                setSelectedNotice({ id: snap.id, ...snap.data() } as NoticeData);
                markAsViewed(noticeId);
            }).catch(() => {
                showAlert('Error', 'Failed to load the notice.', 'error');
            });
        };

        window.addEventListener('open-notice', handler);
        return () => window.removeEventListener('open-notice', handler);
    }, [allNotices, markAsViewed, showAlert]);

    // Load pinned tools
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const load = () => {
            setPinnedTools(JSON.parse(localStorage.getItem('pinnedTools_v1') || '[]'));
        };
        load();
        window.addEventListener('pinnedToolsChanged', load);
        return () => window.removeEventListener('pinnedToolsChanged', load);
    }, []);

    const pinnedToolConfigs = useMemo(() => {
        return {
            'post_notice': {
                icon: <Plus className="w-5 h-5 text-white" />,
                bg: 'bg-purple-600 hover:bg-purple-700',
                action: () => setShowCreateModal(true),
                desc: 'Post Notice'
            },
            'manage_attendance': {
                icon: <ClipboardCheck className="w-5 h-5 text-white" />,
                bg: 'bg-emerald-600 hover:bg-emerald-700',
                action: () => router.push('/attendance-manager'),
                desc: 'Manage Attendance'
            },
            'manage_rolls': {
                icon: <Users className="w-5 h-5 text-white dark:text-black" />,
                bg: 'bg-black dark:bg-white text-white dark:text-black hover:opacity-80',
                action: () => setShowRollsModal(true),
                desc: 'Board Rolls'
            },
            'show_qr': {
                icon: <QrCode className="w-5 h-5 text-black" />,
                bg: 'bg-yellow-400 hover:bg-yellow-500',
                action: () => setShowQRModal(true),
                desc: 'Show QR'
            },
            'manage_icon': {
                icon: <ImageIcon className="w-5 h-5 text-white" />,
                bg: 'bg-blue-600 hover:bg-blue-700',
                action: () => router.push('/social'),
                desc: 'Group Icon'
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    // ============================================
    // FILTERING LOGIC (matches HTML renderNotices)
    // ============================================
    const filteredNotices = useMemo(() => {
        if (!userProfile) return [];

        return allNotices.filter(n => {
            const targetDept = n.targetDept || 'All';
            const targetSem = n.targetSem || 'All';
            const targetSection = n.targetSection || 'all';

            // Dept/Sem/Section matching (case-insensitive 'all')
            const deptMatch = targetDept.toLowerCase() === 'all' || targetDept === userProfile.dept;
            const semMatch = targetSem.toLowerCase() === 'all' || targetSem === userProfile.sem;
            const sectionMatch = targetSection.toLowerCase() === 'all' || targetSection === userProfile.section;

            // Category filter
            const typeMatch = currentFilter === 'all' || n.type === currentFilter;

            // Subject filter (with trim)
            let subjectMatch = true;
            if (currentSubjectFilter !== 'all') {
                if (!n.subject) {
                    subjectMatch = false;
                } else {
                    subjectMatch = n.subject.trim() === currentSubjectFilter.trim();
                }
            }

            // Search
            const sq = searchQuery.toLowerCase();
            const searchMatch = !sq ||
                n.title.toLowerCase().includes(sq) ||
                n.body.toLowerCase().includes(sq) ||
                (n.subject && n.subject.toLowerCase().includes(sq));

            return deptMatch && semMatch && sectionMatch && typeMatch && subjectMatch && searchMatch;
        });
    }, [allNotices, userProfile, currentFilter, currentSubjectFilter, searchQuery]);

    // ============================================
    // CATEGORIES (merged default + dynamic)
    // ============================================
    const mergedCategories = useMemo(() => {
        const cats = [...DEFAULT_CATEGORIES];
        categories.forEach(c => {
            if (!cats.find(x => x.value === c.value)) {
                cats.push({ name: c.name.toUpperCase(), value: c.value });
            }
        });
        return cats;
    }, [categories]);

    // Subject dropdown options
    const subjectOptions = useMemo(() => {
        const opts = [{ val: 'all', label: 'All Subjects' }];
        studentSubjects.forEach(s => {
            opts.push({ val: `${s.name} (${s.code})`, label: `${s.name} (${s.code})` });
        });
        return opts;
    }, [studentSubjects]);

    // ============================================
    // HANDLERS
    // ============================================
    const handleFilterChange = useCallback((value: string) => {
        setCurrentFilter(value);
    }, []);

    const handleSearch = useCallback((val: string) => {
        setSearchQuery(val);
    }, []);

    // Track if we pushed history for the notice modal
    const pushedHistoryRef = useRef(false);

    const openNoticeModal = useCallback((id: string, rect?: DOMRect) => {
        const notice = allNotices.find(n => n.id === id);
        if (notice) {
            setSourceRect(rect || null);
            setSelectedNotice(notice);
            // Push ?noticeId to URL so back button works
            const url = new URL(window.location.href);
            url.searchParams.set('noticeId', id);
            window.history.pushState({ noticeId: id }, '', url.toString());
            pushedHistoryRef.current = true;

            // Mark corresponding notification as viewed
            markAsViewed(id);
        }
    }, [allNotices, markAsViewed]);

    // Close notice modal (and sync history)
    const closeNoticeModal = useCallback(() => {
        setSelectedNotice(null);
        setSourceRect(null);
        if (pushedHistoryRef.current) {
            pushedHistoryRef.current = false;
            window.history.back();
        }
    }, []);

    // Listen for browser back button to close modal
    useEffect(() => {
        const handlePopState = () => {
            // If modal is open and user pressed back, close it
            pushedHistoryRef.current = false;
            setSelectedNotice(null);
            setSourceRect(null);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const openShareModal = useCallback(() => {
        if (selectedNotice) {
            setShareNotice(selectedNotice);
        }
    }, [selectedNotice]);

    const openDeleteModal = useCallback((id: string) => {
        setDeleteNoticeId(id);
    }, []);

    const handleImageClick = useCallback((index: number, imageAttachments: { url: string; type: string }[]) => {
        setLightboxAttachments(imageAttachments);
        setLightboxIndex(index);
    }, []);

    const handleNoticeDeleted = useCallback((id: string) => {
        // The real-time listener will auto-update, but we can also remove locally
        setAllNotices(prev => prev.filter(n => n.id !== id));
    }, []);

    const scrollToTop = useCallback(() => {
        feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    // Scroll observer for scroll-to-top button
    useEffect(() => {
        const feed = feedRef.current;
        if (!feed) return;

        const handleScroll = () => {
            setShowScrollTop(feed.scrollTop > 400);
        };

        feed.addEventListener('scroll', handleScroll, { passive: true });
        return () => feed.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden w-full">
                {/* ============================================
                    DESKTOP SIDEBAR
                    ============================================ */}
                <aside ref={sidebarRef} className="hidden md:flex w-64 flex-col border-r-2 border-black dark:border-zinc-800 p-6 gap-2 bg-gray-50 dark:bg-black overflow-y-auto custom-scrollbar">
                    <div className="locomotive-content-wrapper flex flex-col gap-2 w-full h-full">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Category</p>
                        <div className="flex flex-col gap-2">
                            {mergedCategories.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => handleFilterChange(c.value)}
                                    className={`filter-btn text-left px-4 py-3 font-bold border-2 border-transparent hover:border-black dark:hover:border-white bg-white dark:bg-gray-900 shadow-sm transition-all ${currentFilter === c.value
                                        ? 'bg-black! text-white! dark:bg-white! dark:text-black!'
                                        : ''
                                        }`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>

                        {/* Subject filter */}
                        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-800">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Subjects</p>
                            <SubjectDropdown
                                options={subjectOptions}
                                value={currentSubjectFilter}
                                onChange={setCurrentSubjectFilter}
                                placeholder="All Subjects"
                            />
                        </div>
                    </div>
                </aside>

                {/* ============================================
                    MAIN FEED
                    ============================================ */}
                <div className="flex-1 min-w-0 min-h-0 overflow-y-auto w-full p-4 pb-20 md:p-8 md:pb-8 bg-white dark:bg-black custom-scrollbar relative">
                    {/* MOBILE FILTERS */}
                        <div className="md:hidden space-y-4 mb-6">
                            {/* Mobile search */}
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                    placeholder="SEARCH NOTICES..."
                                    className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-black dark:border-zinc-800 focus:border-blue-600 dark:focus:border-blue-500 pl-10 pr-4 py-2 outline-none text-sm font-bold uppercase transition-all"
                                />
                            </div>

                            {/* Mobile category tabs */}
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                {mergedCategories.map(c => (
                                    <button
                                        key={c.value}
                                        onClick={() => handleFilterChange(c.value)}
                                        className={`shrink-0 px-4 py-1.5 border border-black dark:border-white text-xs font-bold uppercase whitespace-nowrap transition-all ${currentFilter === c.value
                                            ? 'bg-black text-white dark:bg-white dark:text-black'
                                            : ''
                                            }`}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>

                            {/* Mobile subject dropdown */}
                            <SubjectDropdown
                                options={subjectOptions}
                                value={currentSubjectFilter}
                                onChange={setCurrentSubjectFilter}
                                placeholder="All Subjects"
                            />
                        </div>

                        <div className="max-w-3xl mx-auto w-full min-w-0">
                            {/* DESKTOP SEARCH BAR */}
                            <div className="hidden md:block mb-8 relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                    placeholder="SEARCH NOTICES, EVENTS, OR UPDATES..."
                                    className="w-full bg-white dark:bg-black border-2 border-black dark:border-zinc-800 focus:border-purple-600 dark:focus:border-purple-500 pl-12 pr-6 py-4 outline-none text-lg font-black uppercase tracking-tight shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.05)] transition-all"
                                />
                            </div>

                            {/* NOTICE LIST */}
                            <div className="space-y-6">
                                {!noticesLoaded ? (
                                    <div className="text-center py-20 opacity-50">
                                        <div className="loader mx-auto mb-4" />
                                        <p className="mono-font text-sm">Loading notices...</p>
                                    </div>
                                ) : filteredNotices.length === 0 ? (
                                    <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800">
                                        <p className="mono-font text-sm">NO NOTICES FOUND</p>
                                    </div>
                                ) : (
                                    filteredNotices.map(n => (
                                        <NoticeCard
                                            key={n.id}
                                            notice={n}
                                            onOpen={openNoticeModal}
                                            onEdit={openNoticeModal}
                                            onDelete={openDeleteModal}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                </div>
            </div>

            {/* ============================================
                SCROLL TO TOP
                ============================================ */}
            {showScrollTop && !selectedNotice && !shareNotice && !deleteNoticeId && lightboxIndex < 0 && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-11 h-11 bg-black dark:bg-white text-white dark:text-black border-2 border-white dark:border-black flex items-center justify-center z-[55] transition-all hover:-translate-y-1 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] dark:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] animate-pop-in"
                >
                    <ArrowUp className="w-5 h-5" />
                </button>
            )}

            {/* ============================================
                MODALS
                ============================================ */}
            {selectedNotice && (
                <NoticeModal
                    notice={selectedNotice}
                    sourceRect={sourceRect}
                    onClose={closeNoticeModal}
                    onShare={openShareModal}
                    onEdit={(id) => {
                        const n = allNotices.find(x => x.id === id);
                        if (n) { closeNoticeModal(); setEditNotice(n); }
                    }}
                    onDelete={openDeleteModal}
                    onImageClick={handleImageClick}
                />
            )}

            {shareNotice && (
                <ShareNoticeModal
                    notice={shareNotice}
                    friends={friends}
                    onClose={() => setShareNotice(null)}
                />
            )}

            {deleteNoticeId && (
                <DeleteNoticeModal
                    noticeId={deleteNoticeId}
                    onClose={() => setDeleteNoticeId(null)}
                    onDeleted={handleNoticeDeleted}
                />
            )}

            {lightboxIndex >= 0 && lightboxAttachments.length > 0 && (
                <ImageLightbox
                    attachments={lightboxAttachments}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(-1)}
                />
            )}

            {/* Create Notice Modal */}
            <CreateNoticeModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

            {/* Edit Notice Modal */}
            {editNotice && <EditNoticeModal notice={editNotice} onClose={() => setEditNotice(null)} />}

            {/* CR Dashboard Modal */}
            <CRDashboardModal
                isOpen={showManageModal}
                onClose={() => setShowManageModal(false)}
                onOpenCreateNotice={() => setShowCreateModal(true)}
            />

            {/* Manage Board Rolls Modal */}
            <ManageBoardRollsModal isOpen={showRollsModal} onClose={() => setShowRollsModal(false)} />

            {/* MANAGE WEBSITE BUTTON (CR/Admin only) */}
            {(userProfile?.isCR || userProfile?.role === 'admin') && !selectedNotice && !shareNotice && !deleteNoticeId && !showCreateModal && !editNotice && !showManageModal && (
                <button
                    onClick={() => setShowManageModal(true)}
                    className="fixed bottom-24 right-4 md:bottom-6 md:right-6 bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black font-bold uppercase text-[10px] md:text-sm px-3 py-1.5 md:px-6 md:py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-1.5 z-[54] animate-pop-in"
                >
                    <Settings2 className="w-5 h-5" />
                    <span>Manage Website</span>
                </button>
            )}

            {/* PINNED TOOLS CONTAINER */}
            {pinnedTools.length > 0 && !selectedNotice && !shareNotice && !deleteNoticeId && !showCreateModal && !editNotice && !showManageModal && (
                <div className="fixed bottom-36 md:bottom-24 right-4 md:right-6 z-50 flex flex-col gap-2 md:gap-3 items-end pointer-events-none">
                    {pinnedTools.map(tid => {
                        const config = (pinnedToolConfigs as any)[tid];
                        if (!config) return null;
                        return (
                            <button
                                key={tid}
                                onClick={config.action}
                                className={`${config.bg} w-10 h-10 md:w-14 md:h-14 rounded-full shadow-lg hover:shadow-xl transition-all pointer-events-auto hover:-translate-y-1 flex items-center justify-center group border-2 border-black dark:border-white relative [&_svg]:w-4 [&_svg]:h-4 md:[&_svg]:w-5 md:[&_svg]:h-5`}
                                title={config.desc}
                            >
                                <span className="absolute right-full mr-3 px-2 py-1 bg-black text-white text-[10px] font-bold uppercase rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/20 shadow-lg">
                                    {config.desc}
                                </span>
                                {config.icon}
                            </button>
                        );
                    })}
                </div>
            )}


            {/* Attendance QR Modal */}
            <AttendanceQRModal isOpen={showQRModal} onClose={() => setShowQRModal(false)} />
        </>
    );
}
