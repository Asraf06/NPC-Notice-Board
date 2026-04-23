'use client';

import { useState } from 'react';
import { Eye, Download, Trash2, Edit3, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export interface MaterialData {
    id: string;
    type: string;       // 'Syllabus' | 'Note' | 'Question'
    subject: string;
    description?: string;
    url: string;
    dept: string;
    sem: string;
    author?: string;
    authorUid?: string;
    timestamp?: { seconds: number };
    service?: string;     // 'imagekit' | 'cloudinary' | 'imgbb'
    fileId?: string;      // For deletion from cloud storage
    attachments?: {       // For multiple images/docs
        url: string;
        service: string | null;
        fileId: string | null;
    }[];
}

interface MaterialCardProps {
    material: MaterialData;
    onView: (material: MaterialData) => void;
    onDownload: (material: MaterialData) => void;
    onDelete: (id: string) => void;
    onEdit?: (material: MaterialData) => void;
}

export default function MaterialCard({ material, onView, onDownload, onDelete, onEdit }: MaterialCardProps) {
    const { userProfile } = useAuth();

    // Check if user can delete (author, CR, or admin)
    const canDelete = userProfile && (
        userProfile.uid === material.authorUid ||
        userProfile.role === 'admin' ||
        userProfile.email === 'admin@gmail.com'
    );

    const [showActions, setShowActions] = useState(false);

    return (
        <div 
            onClick={() => onView(material)}
            className="flex items-center justify-between p-4 bg-white dark:bg-black border-2 border-black dark:border-zinc-700 group hover:translate-x-1 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] cursor-pointer"
        >
            {/* Info */}
            <div className="flex-1 min-w-0 pr-4">
                <p className="font-black text-xs uppercase truncate leading-none mb-1">
                    {material.subject}
                </p>
                <p className="text-[9px] opacity-50 font-mono tracking-tighter truncate uppercase">
                    {material.description || 'Global Resource'} {material.author && `• By ${material.author}`}
                    {material.attachments && material.attachments.length > 1 && ` • ${material.attachments.length} Files`}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
                {/* Sliding Actions */}
                <div 
                    className={`flex items-center transition-all duration-300 ease-in-out origin-right overflow-hidden ${
                        showActions ? 'max-w-[200px] opacity-100 gap-1.5' : 'max-w-0 opacity-0 gap-0'
                    }`}
                >
                    {/* View Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onView(material); }}
                        className="p-1.5 sm:p-2 bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white hover:bg-purple-600 dark:hover:bg-purple-500 hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-sm whitespace-nowrap shrink-0"
                        title="View Document"
                    >
                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>

                    {/* Download Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDownload(material); }}
                        className="p-1.5 sm:p-2 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border border-black dark:border-zinc-600 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all shadow-[1px_1px_0px_0px_rgba(128,128,128,0.2)] rounded-sm whitespace-nowrap shrink-0"
                        title="Download"
                    >
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>

                    {/* Edit Button (CR/Author/Admin Only) */}
                    {canDelete && onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(material); }}
                            className="p-1.5 sm:p-2 bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all shadow-[1px_1px_0px_0px_rgba(168,85,247,0.1)] rounded-sm whitespace-nowrap shrink-0"
                            title="Edit Material"
                        >
                            <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                    )}

                    {/* Delete Button (CR/Author/Admin Only) */}
                    {canDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(material.id); }}
                            className="p-1.5 sm:p-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-[1px_1px_0px_0px_rgba(255,0,0,0.1)] rounded-sm whitespace-nowrap shrink-0"
                            title="Delete Material"
                        >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                    )}
                </div>

                {/* Toggle Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
                    className="p-1.5 sm:p-2 bg-white dark:bg-zinc-900 text-black dark:text-white border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all rounded-sm flex items-center justify-center shrink-0 z-10"
                    title={showActions ? "Hide Actions" : "Show Actions"}
                >
                    <ChevronLeft className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 ${showActions ? 'rotate-180' : ''}`} />
                </button>
            </div>
        </div>
    );
}
