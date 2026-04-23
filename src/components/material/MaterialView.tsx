'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, FileText, HelpCircle, Edit3 } from 'lucide-react';
import { db, rtdb } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { ref, onValue, update } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import MaterialCard from './MaterialCard';
import MaterialUploadModal from './MaterialUploadModal';
import DeleteMaterialModal from './DeleteMaterialModal';
import type { MaterialData } from './MaterialCard';
import { deleteUploadedFiles } from '@/lib/uploadService';

type TabKey = 'syllabus' | 'notes' | 'questions';

const TAB_CONFIG: Record<TabKey, {
    label: string;
    firestoreType: string;
    icon: typeof BookOpen;
    activeColor: string;
    iconBg: string;
    iconColor: string;
    emptyText: string;
}> = {
    syllabus: {
        label: 'Syllabus',
        firestoreType: 'Syllabus',
        icon: BookOpen,
        activeColor: 'bg-blue-600',
        iconBg: 'bg-blue-100 dark:bg-blue-900/40',
        iconColor: 'text-blue-600 dark:text-blue-400',
        emptyText: 'No syllabus uploaded yet.',
    },
    notes: {
        label: 'Lecture Notes',
        firestoreType: 'Note',
        icon: FileText,
        activeColor: 'bg-green-600',
        iconBg: 'bg-green-100 dark:bg-green-900/40',
        iconColor: 'text-green-600 dark:text-green-400',
        emptyText: 'No notes available.',
    },
    questions: {
        label: 'Old Questions',
        firestoreType: 'Question',
        icon: HelpCircle,
        activeColor: 'bg-amber-600',
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
        iconColor: 'text-amber-600 dark:text-amber-400',
        emptyText: 'No question papers yet.',
    },
};

const TABS: TabKey[] = ['syllabus', 'notes', 'questions'];

export default function MaterialView() {
    const { userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<TabKey>('syllabus');
    const [materials, setMaterials] = useState<MaterialData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
    const [tabNames, setTabNames] = useState<Record<string, string>>({});
    const [editTabState, setEditTabState] = useState<{ isOpen: boolean, tab: TabKey | null, currentValue: string }>({ isOpen: false, tab: null, currentValue: '' });

    // Load materials from Firestore
    const loadMaterials = useCallback(async () => {
        if (!userProfile) return;
        setIsLoading(true);

        try {
            const q = query(
                collection(db, 'materials'),
                where('section', '==', userProfile.section),
                where('dept', '==', userProfile.dept),
                where('sem', '==', userProfile.sem),
                orderBy('timestamp', 'desc')
            );
            const snap = await getDocs(q);
            const mats: MaterialData[] = [];
            snap.forEach(docSnap => {
                mats.push({ id: docSnap.id, ...docSnap.data() } as MaterialData);
            });
            setMaterials(mats);
        } catch (e) {
            console.error('Materials load failed:', e);
        } finally {
            setIsLoading(false);
        }
    }, [userProfile]);

    useEffect(() => {
        loadMaterials();
    }, [loadMaterials]);

    // Load custom tab names from RTDB
    useEffect(() => {
        if (!userProfile) return;
        const dbRef = ref(rtdb, `class_material_tabs/${userProfile.dept}_${userProfile.sem}_${userProfile.section}`);
        
        const unsubscribe = onValue(dbRef, (snapshot) => {
            if (snapshot.exists()) {
                setTabNames(snapshot.val());
            } else {
                setTabNames({});
            }
        });
        
        return () => unsubscribe();
    }, [userProfile]);

    // Can upload? (CR or Admin)
    const canUpload = userProfile && (
        userProfile.isCR ||
        userProfile.role === 'admin' ||
        userProfile.email === 'admin@gmail.com'
    );

    const handleEditTabName = (tab: TabKey) => {
        if (!canUpload || !userProfile) return;
        const currentName = tabNames[tab] || TAB_CONFIG[tab].label;
        setEditTabState({ isOpen: true, tab, currentValue: currentName });
    };

    // Filter materials by type for each category
    const getMaterialsForTab = (tab: TabKey): MaterialData[] => {
        return materials.filter(m => m.type === TAB_CONFIG[tab].firestoreType);
    };

    const router = useRouter();

    // View handler — opens document viewer route (client-side, no reload)
    const handleView = (material: MaterialData) => {
        const params = new URLSearchParams();
        if (material.attachments && material.attachments.length > 0) {
            params.set('urls', JSON.stringify(material.attachments.map(a => a.url)));
            // Fallback url for the viewer if it expects a single one initially
            params.set('url', material.attachments[0].url);
        } else {
            params.set('url', material.url);
        }
        if (material.subject) params.set('title', material.subject);
        router.push(`/materials/view?${params.toString()}`);
    };

    // Download handler — direct download via client-side fetch (no new tab, no server proxy needed)
    const handleDownload = async (material: MaterialData) => {
        const downloadSingleFile = async (url: string, index?: number) => {
            const filename = material.subject ? (index !== undefined ? `${material.subject}-${index + 1}` : material.subject) : 'download';
            try {
                // Fetch raw file (no attachment params — those interfere with a.download)
                const res = await fetch(url);
                if (!res.ok) throw new Error('Fetch failed');
                const blob = await res.blob();

                // Determine file extension from content-type
                const contentType = res.headers.get('content-type') || '';
                let ext = '';
                if (!filename.includes('.')) {
                    if (contentType.includes('pdf')) ext = '.pdf';
                    else if (contentType.includes('png')) ext = '.png';
                    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
                    else if (contentType.includes('gif')) ext = '.gif';
                    else if (contentType.includes('webp')) ext = '.webp';
                    else if (contentType.includes('mp4')) ext = '.mp4';
                }

                // Create blob URL (same-origin) so a.download is respected
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename + ext;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                // Cleanup after small delay to ensure download starts
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                }, 100);
            } catch (error) {
                console.error('Download error:', error);
                // Fallback: service-specific attachment download in new tab
                let fallbackUrl = url;
                if (url.includes('cloudinary.com')) {
                    fallbackUrl = url.replace('/upload/', '/upload/fl_attachment/');
                } else if (url.includes('ik.imagekit.io')) {
                    const sep = url.includes('?') ? '&' : '?';
                    fallbackUrl = `${url}${sep}ik-attachment=true`;
                }
                window.open(fallbackUrl, '_blank');
            }
        };

        if (material.attachments && material.attachments.length > 0) {
            // Trigger downloads sequentially with a slight delay to avoid browser blocking
            for (let i = 0; i < material.attachments.length; i++) {
                await downloadSingleFile(material.attachments[i].url, i);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } else {
            await downloadSingleFile(material.url);
        }
    };

    // Delete handler triggers the modal
    const handleDelete = (docId: string) => {
        setMaterialToDelete(docId);
    };

    // Render a material section (used for both mobile single-tab and desktop grid)
    const renderSection = (tab: TabKey, forceShow = false) => {
        const config = TAB_CONFIG[tab];
        const Icon = config.icon;
        const tabMaterials = getMaterialsForTab(tab);

        // On mobile, hide inactive tabs (unless forceShow for desktop grid)
        const mobileVisibility = !forceShow && activeTab !== tab ? 'hidden md:block' : '';

        return (
            <div
                key={tab}
                className={`p-6 border-2 border-black dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group ${mobileVisibility}`}
            >
                {/* Background Icon */}
                <Icon className="absolute -right-4 -bottom-4 w-24 h-24 opacity-5 -rotate-12 group-hover:rotate-0 transition-transform" />

                {/* Section Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 ${config.iconBg}`}>
                            <Icon className={`w-6 h-6 ${config.iconColor}`} />
                        </div>
                        <h3 className="font-bold uppercase tracking-widest text-sm">{tabNames[tab] || config.label}</h3>
                    </div>
                    {canUpload && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleEditTabName(tab); }}
                            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors z-20"
                            title="Edit Tab Name"
                        >
                            <Edit3 className="w-4 h-4 opacity-50 hover:opacity-100" />
                        </button>
                    )}
                </div>

                {/* Material List */}
                <div className="space-y-3 relative z-10">
                    {isLoading ? (
                        <div className="py-10 text-center">
                            <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : tabMaterials.length === 0 ? (
                        <p className="text-[10px] opacity-30 font-bold uppercase tracking-widest text-center py-6">
                            — Empty Stack —
                        </p>
                    ) : (
                        tabMaterials.map(mat => (
                            <MaterialCard
                                key={mat.id}
                                material={mat}
                                onView={handleView}
                                onDownload={handleDownload}
                                onDelete={handleDelete}
                            />
                        ))
                    )}
                </div>
            </div>
        );
    };

    const feedRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={feedRef} className="w-full h-full min-h-0 overflow-y-auto custom-scrollbar">
            <div className="locomotive-content-wrapper">
                <div className="p-4 md:p-8 max-w-5xl mx-auto w-full pb-20 md:pb-8">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8 pt-4">
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tight">Material Hub</h2>
                            <p className="text-xs font-mono opacity-60">Syllabus, Notes & Question Papers</p>
                        </div>
                        {canUpload && (
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="px-4 py-2 bg-purple-600 text-white font-bold uppercase border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform text-sm"
                            >
                                Upload Material
                            </button>
                        )}
                    </div>

                    {/* Mobile Tab Bar (Hidden on Desktop) */}
                    <div className="flex md:hidden gap-2 mb-4 p-1 bg-gray-100 dark:bg-zinc-900 border-2 border-black dark:border-zinc-700">
                        {TABS.map(tab => {
                            const config = TAB_CONFIG[tab];
                            const isActive = activeTab === tab;
                            const displayName = tabNames[tab] || (config.label.split(' ')[0] === 'Lecture' ? 'Notes' : config.label.split(' ')[0]);
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-wider border-2 transition-all overflow-hidden text-ellipsis whitespace-nowrap px-1 ${isActive
                                        ? `${config.activeColor} text-white border-black`
                                        : 'bg-gray-200 dark:bg-zinc-800 text-black dark:text-white border-transparent'
                                        }`}
                                >
                                    {displayName}
                                </button>
                            );
                        })}
                    </div>

                    {/* Material Sections Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {TABS.map(tab => renderSection(tab))}
                    </div>
                </div>

                {/* Upload Modal */}
                <MaterialUploadModal
                    isOpen={showUploadModal}
                    onClose={() => setShowUploadModal(false)}
                    onUploaded={loadMaterials}
                />

                {/* Delete Modal */}
                {materialToDelete && (
                    <DeleteMaterialModal
                        materialId={materialToDelete}
                        onClose={() => setMaterialToDelete(null)}
                        onDeleted={() => {
                            setMaterialToDelete(null);
                            loadMaterials();
                        }}
                    />
                )}

                {/* Rename Dialog */}
                {editTabState.isOpen && editTabState.tab && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setEditTabState({ isOpen: false, tab: null, currentValue: '' }); }}>
                        <div className="bg-white dark:bg-black w-full max-w-sm border-2 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 z-10" onClick={e => e.stopPropagation()}>
                            <h3 className="text-xl font-bold mb-3 uppercase flex items-center gap-2">
                                <Edit3 className="w-5 h-5" /> Rename Section
                            </h3>
                            <p className="text-xs opacity-70 mb-5 font-mono leading-relaxed">
                                Enter a new name for '{TAB_CONFIG[editTabState.tab].label}'. This will be visible to everyone in your class.
                            </p>
                            <input 
                                type="text"
                                className="w-full p-3 bg-gray-100 dark:bg-zinc-900 border-2 border-black dark:border-white mb-6 font-bold tracking-widest uppercase text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                value={editTabState.currentValue}
                                onChange={(e) => setEditTabState(prev => ({ ...prev, currentValue: e.target.value }))}
                                autoFocus
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        const newName = editTabState.currentValue.trim();
                                        const currentName = tabNames[editTabState.tab!] || TAB_CONFIG[editTabState.tab!].label;
                                        if (newName && newName !== currentName && userProfile) {
                                            const dbRef = ref(rtdb, `class_material_tabs/${userProfile.dept}_${userProfile.sem}_${userProfile.section}`);
                                            await update(dbRef, { [editTabState.tab!]: newName });
                                        }
                                        setEditTabState({ isOpen: false, tab: null, currentValue: '' });
                                    }
                                }}
                            />
                            <div className="flex gap-3 justify-end whitespace-nowrap">
                                <button 
                                    className="px-4 py-2 border-2 border-black dark:border-white uppercase font-bold text-xs tracking-widest hover:bg-black/5"
                                    onClick={() => setEditTabState({ isOpen: false, tab: null, currentValue: '' })}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className="px-4 py-2 bg-purple-600 text-white border-2 border-black dark:border-white uppercase font-bold text-xs tracking-widest hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    onClick={async () => {
                                        const newName = editTabState.currentValue.trim();
                                        const currentName = tabNames[editTabState.tab!] || TAB_CONFIG[editTabState.tab!].label;
                                        if (newName && newName !== currentName && userProfile) {
                                            const dbRef = ref(rtdb, `class_material_tabs/${userProfile.dept}_${userProfile.sem}_${userProfile.section}`);
                                            await update(dbRef, { [editTabState.tab!]: newName });
                                        }
                                        setEditTabState({ isOpen: false, tab: null, currentValue: '' });
                                    }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
