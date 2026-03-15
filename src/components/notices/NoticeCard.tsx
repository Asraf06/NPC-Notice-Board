'use client';

import { FileText, AlertTriangle, GraduationCap, Crown, PlayCircle, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export interface NoticeData {
    id: string;
    title: string;
    body: string;
    type: string;
    targetDept: string;
    targetSem: string;
    targetSection?: string;
    author?: string;
    authorUid?: string;
    subject?: string;
    timestamp?: { seconds: number };
    attachments?: { url: string; type: string; thumb?: string; name?: string; service?: string; fileId?: string | null }[];
    layout?: string;
}

interface NoticeCardProps {
    notice: NoticeData;
    onOpen: (id: string, sourceRect?: DOMRect) => void;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
}

export default function NoticeCard({ notice, onOpen, onEdit, onDelete }: NoticeCardProps) {
    const { userProfile, user } = useAuth();
    const n = notice;

    const date = n.timestamp ? new Date(n.timestamp.seconds * 1000).toLocaleDateString() : 'N/A';

    // Pick icon based on type
    const IconComponent = n.type === 'urgent' ? AlertTriangle
        : n.type === 'exam' ? GraduationCap
            : FileText;

    // Check if current user owns this notice (CR feature)
    const isOwner = userProfile && userProfile.isCR && n.authorUid === user?.uid;

    // Attachment preview (first item thumbnail)
    const firstAttachment = n.attachments && n.attachments.length > 0 ? n.attachments[0] : null;

    return (
        <div
            onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onOpen(n.id, rect);
            }}
            className="group bg-white dark:bg-black border-2 border-black dark:border-white p-0 cursor-pointer hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] transition-all duration-200 transform hover:-translate-y-1 relative overflow-hidden"
        >
            {/* Urgent badge */}
            {n.type === 'urgent' && (
                <div className="absolute top-0 right-0 bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold px-2 py-1 uppercase z-10">
                    Urgent
                </div>
            )}

            {/* Owner badge */}
            {isOwner && (
                <div className="absolute top-0 left-0 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 uppercase z-10 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Your Notice
                </div>
            )}

            {/* Attachment preview thumbnail */}
            {firstAttachment && (
                firstAttachment.type === 'video' ? (
                    <div className="w-full h-32 bg-black flex items-center justify-center mb-4">
                        <PlayCircle className="text-white w-10 h-10" />
                    </div>
                ) : (
                    <div className="w-full h-32 overflow-hidden mb-4 border-b border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-zinc-900">
                        <img
                            src={firstAttachment.thumb || firstAttachment.url}
                            className="w-full h-full object-cover transition-opacity duration-300"
                            loading="lazy"
                            alt=""
                        />
                    </div>
                )
            )}

            {/* Card content */}
            <div className="p-6 pt-2">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 border border-gray-200 dark:border-gray-800 rounded-full">
                        <IconComponent className="w-6 h-6" />
                    </div>
                    <span className="font-mono text-xs opacity-60">{date}</span>
                </div>

                <h3 className="text-xl font-bold mb-2 uppercase leading-tight group-hover:underline decoration-2 underline-offset-4 break-words">
                    {n.title}
                </h3>

                {n.subject && (
                    <div className="mb-3">
                        <span className="text-xs font-mono border border-gray-300 dark:border-gray-700 px-2 py-0.5 inline-block max-w-full break-words whitespace-normal text-left">
                            {n.subject}
                        </span>
                    </div>
                )}

                <p className="text-sm opacity-70 line-clamp-2 font-serif break-words">
                    {n.body.replace(/<[^>]*>?/gm, '')}
                </p>

                <div className="mt-4 flex gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase border border-black dark:border-white px-2 py-0.5 inline-block max-w-[45%] truncate">
                        {n.targetDept}
                    </span>
                    <span className="text-[10px] font-bold uppercase border border-black dark:border-white px-2 py-0.5 inline-block max-w-[45%] truncate">
                        {n.targetSem}
                    </span>
                    {n.attachments && n.attachments.length > 1 && (
                        <span className="text-[10px] font-bold uppercase bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 shrink-0">
                            +{n.attachments.length - 1} more
                        </span>
                    )}
                </div>
            </div>

            {/* Owner actions overlay (Edit/Delete) */}
            {isOwner && (
                <div className="absolute bottom-0 left-0 right-0 p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex justify-end gap-2 z-20" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit?.(n.id); }}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase flex items-center gap-1.5 rounded shadow-lg transition-colors"
                    >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete?.(n.id); }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase flex items-center gap-1.5 rounded shadow-lg transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                </div>
            )}
        </div>
    );
}
