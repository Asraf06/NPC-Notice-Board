import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { Send, Reply, X, CornerUpLeft, Trash2, Pencil, Paperclip, Settings, MessageCircle, Loader2, Type, RotateCcw, Plus, Image as ImageIcon, Film, FileText, CheckCircle2, AlertCircle, Lock, Copy } from 'lucide-react';
import { rtdb } from '@/lib/firebase';
import { ref, update } from 'firebase/database';
import { secureUploadFile } from '@/lib/uploadService';
import type { MessageData, ActiveChatType } from './ChatView';
import ImageLightbox from '@/components/notices/ImageLightbox';
import CollageRenderer from '@/components/notices/CollageRenderer';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

// Upload helpers are now handled by the secure /api/upload route
// See: src/lib/uploadService.ts

interface ChatAreaProps {
    messages: MessageData[];
    chatId: string;
    chatType: ActiveChatType;
    peerName: string;
    peerInfo: string;
    peerPhoto: string;
    peerStatus?: 'online' | 'offline';
    peerLastOnline?: number;
    chatTheme: 'modern' | 'classic' | 'digital';
    onThemeChange: (theme: 'modern' | 'classic' | 'digital') => void;
    fontSize: number;
    onFontSizeChange: (size: number) => void;
    bubbleSize: 1 | 2 | 3 | 4 | 5;
    onBubbleSizeChange: (size: 1 | 2 | 3 | 4 | 5) => void;
    modernPreset: string;
    onModernPresetChange: (preset: string) => void;
    externalToggle?: boolean;
    onExternalToggleConsumed?: () => void;
    onSendMessage: (text: string, replyTo?: { id: string; text: string; sender: string } | null, attachments?: { type: string; url: string; thumb?: string; service?: string; fileId?: string | null }[]) => Promise<void>;
    onHeaderClick?: () => void;
    onGroupIconEdit?: () => void;
}

export default function ChatArea({
    messages,
    chatId,
    chatType,
    peerName,
    peerInfo,
    peerPhoto,
    peerStatus,
    peerLastOnline,
    chatTheme,
    onThemeChange,
    fontSize,
    onFontSizeChange,
    bubbleSize,
    onBubbleSizeChange,
    modernPreset,
    onModernPresetChange,
    externalToggle,
    onExternalToggleConsumed,
    onSendMessage,
    onHeaderClick,
    onGroupIconEdit,
}: ChatAreaProps) {
    const { userProfile, globalSettings } = useAuth();
    const { showToast } = useUI();
    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [replyTo, setReplyTo] = useState<{ id: string; text: string; sender: string } | null>(null);
    const [showAppearancePanel, setShowAppearancePanel] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [lightboxData, setLightboxData] = useState<{ attachments: any[]; index: number } | null>(null);
    const [activeActionId, setActiveActionId] = useState<string | null>(null);

    // Staging Bar State
    interface StagedAttachment {
        id: string;
        file: File;
        status: 'pending' | 'uploading' | 'done' | 'error';
        result?: { type: string; url: string; thumb?: string; service?: string; fileId?: string | null };
        previewUrl?: string;
    }
    const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([]);

    // Process background uploads whenever pending files exist
    useEffect(() => {
        const processPending = async () => {
            const pendingFiles = stagedFiles.filter(f => f.status === 'pending');
            if (pendingFiles.length === 0) return;

            try {
                for (const pendingFile of pendingFiles) {
                    // Mark as uploading
                    setStagedFiles(prev => prev.map(f => f.id === pendingFile.id ? { ...f, status: 'uploading' } : f));

                    try {
                        const uploaded = await secureUploadFile(pendingFile.file);

                        if (uploaded) {
                            const result: { type: string; url: string; thumb?: string; service?: string; fileId?: string | null } = {
                                type: uploaded.type, url: uploaded.url
                            };
                            if (uploaded.thumb) result.thumb = uploaded.thumb;
                            if (uploaded.service) result.service = uploaded.service;
                            if (uploaded.fileId) result.fileId = uploaded.fileId;
                            setStagedFiles(prev => prev.map(f => f.id === pendingFile.id ? { ...f, status: 'done', result } : f));
                        } else {
                            setStagedFiles(prev => prev.map(f => f.id === pendingFile.id ? { ...f, status: 'error' } : f));
                        }
                    } catch (err) {
                        console.error('Upload failed for', pendingFile.file.name, err);
                        setStagedFiles(prev => prev.map(f => f.id === pendingFile.id ? { ...f, status: 'error' } : f));
                    }
                }
            } catch (err) {
                console.error("API Keys error", err);
                showToast("Failed to fetch API keys for upload.");
                setStagedFiles(prev => prev.map(f => f.status === 'pending' ? { ...f, status: 'error' } : f));
            }
        };

        processPending();
    }, [stagedFiles]);

    // Clean up Object URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            stagedFiles.forEach(f => {
                if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
            });
        };
    }, []);

    // Open appearance panel from external trigger (mobile gear icon)
    useEffect(() => {
        if (externalToggle) {
            setShowAppearancePanel(true);
            onExternalToggleConsumed?.();
        }
    }, [externalToggle, onExternalToggleConsumed]);

    /* ─── Close panel on outside click ─── */
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setShowAppearancePanel(false);
            }
        };
        if (showAppearancePanel) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAppearancePanel]);

    /* ─── Auto-scroll to bottom on new messages ─── */
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 250;
        if (isNearBottom) {
            requestAnimationFrame(() => {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
            });
        }
    }, [messages]);

    useEffect(() => {
        // Force scroll to bottom on mount or chat switch
        const forceScroll = () => {
            const el = containerRef.current;
            if (el) {
                el.scrollTop = el.scrollHeight;
                el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
            }
        };

        // Fire multiple times to ensure images and Locomotive have caught up
        forceScroll();
        const timers = [50, 150, 300].map(ms => setTimeout(forceScroll, ms));
        return () => timers.forEach(clearTimeout);
    }, [chatId]);

    /* ─── Send Handler ─── */
    const handleSend = useCallback(async () => {
        const text = inputText.trim();
        const hasAttachments = stagedFiles.some(f => f.status === 'done');
        if ((!text && !hasAttachments) || isSending) return;

        // Prevent send if still uploading
        if (stagedFiles.some(f => f.status === 'uploading' || f.status === 'pending')) {
            showToast("Please wait for uploads to finish");
            return;
        }

        setIsSending(true);
        try {
            // Sanitize: strip any undefined values so Firebase RTDB won't reject
            const finalAttachments = stagedFiles
                .filter(f => f.status === 'done' && f.result)
                .map(f => {
                    const att: { type: string; url: string; thumb?: string; service?: string; fileId?: string | null } = { type: f.result!.type, url: f.result!.url };
                    if (f.result!.thumb) att.thumb = f.result!.thumb;
                    if (f.result!.service) att.service = f.result!.service;
                    if (f.result!.fileId) att.fileId = f.result!.fileId;
                    return att;
                });

            await onSendMessage(text, replyTo, finalAttachments.length > 0 ? finalAttachments : undefined);

            setInputText('');
            setReplyTo(null);
            setStagedFiles([]); // Clear staging bar
            inputRef.current?.focus();
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (err) {
            console.error('Send error:', err);
        }
        setIsSending(false);
    }, [inputText, isSending, onSendMessage, replyTo, stagedFiles]);

    /* ─── File Upload Handler (Staging) ─── */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles: StagedAttachment[] = [];
            let hasLargeFiles = false;

            for (let i = 0; i < e.target.files.length; i++) {
                const file = e.target.files[i];
                if (file.size > 10 * 1024 * 1024) {
                    hasLargeFiles = true;
                    continue;
                }

                const id = Math.random().toString(36).substring(2, 9);
                let previewUrl = undefined;
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    previewUrl = URL.createObjectURL(file);
                }

                newFiles.push({ id, file, status: 'pending', previewUrl });
            }

            if (hasLargeFiles) {
                showToast("Some files are over the 10MB limit and were skipped.");
            }

            if (newFiles.length > 0) {
                setStagedFiles(prev => [...prev, ...newFiles]);
            }

            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeStagedFile = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setStagedFiles(prev => {
            const fileToRemove = prev.find(f => f.id === id);
            if (fileToRemove?.previewUrl) URL.revokeObjectURL(fileToRemove.previewUrl);
            return prev.filter(f => f.id !== id);
        });
    };

    const clearStagedFiles = () => {
        stagedFiles.forEach(f => {
            if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        setStagedFiles([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const initiateReply = (key: string, text: string, sender: string) => {
        setReplyTo({ id: key, text: text ? text.substring(0, 80) : 'Attachment', sender });
        inputRef.current?.focus();
    };

    const unsendMessage = async (key: string) => {
        if (!chatId) return;
        try {
            const isGroup = chatId.startsWith('group_') || chatId === 'global_chat' || chatId === 'cr_group';
            const path = isGroup
                ? `group_chats/${chatId}/messages/${key}`
                : `chats/${chatId}/messages/${key}`;
            await update(ref(rtdb, path), { text: 'Message unsent', isDeleted: true });
        } catch (err) { console.error(err); }
    };

    /* ─── Theme Helpers ─── */
    const handleThemeSelect = (theme: 'modern' | 'classic' | 'digital') => {
        onThemeChange(theme);
        const labels: Record<string, string> = { modern: 'Modern', classic: 'Classic', digital: 'Default' };
        showToast(`Switched to ${labels[theme]} theme`);
    };

    const handleResetTheme = () => {
        onThemeChange('modern');
        onFontSizeChange(14);
        onBubbleSizeChange(3);
        onModernPresetChange('from-indigo-600 to-purple-700');
        showToast('Theme reset to default');
    };

    const bubbleSizeLabels: Record<number, string> = { 1: 'Tiny', 2: 'Small', 3: 'Compact', 4: 'Medium', 5: 'Comfortable' };

    const presetGradients = [
        { name: 'Purple', gradient: 'from-purple-600 to-indigo-700', preview: 'from-purple-500 to-indigo-600' },
        { name: 'Ocean', gradient: 'from-blue-600 to-cyan-500', preview: 'from-blue-500 to-cyan-400' },
        { name: 'Emerald', gradient: 'from-emerald-600 to-teal-500', preview: 'from-emerald-500 to-teal-400' },
        { name: 'Rose', gradient: 'from-rose-600 to-pink-500', preview: 'from-rose-500 to-pink-400' },
        { name: 'Violet', gradient: 'from-violet-700 to-purple-500', preview: 'from-violet-600 to-purple-400' },
        { name: 'Sunset', gradient: 'from-orange-500 to-yellow-400', preview: 'from-orange-400 to-yellow-300' },
        { name: 'Slate', gradient: 'from-zinc-600 to-zinc-400', preview: 'from-zinc-500 to-zinc-300' },
        { name: 'Magenta', gradient: 'from-fuchsia-600 to-pink-600', preview: 'from-fuchsia-500 to-pink-500' },
    ];

    const isGroup = chatType === 'group' || chatType === 'global' || chatType === 'cr';

    const getStatusText = () => {
        if (isGroup || chatType === 'ai') return peerInfo === 'Official Support' ? 'Helpdesk • Contact Admin' : peerInfo;
        if (peerStatus === 'online') return 'Active now';
        if (peerStatus === 'offline' && peerLastOnline) {
            const date = new Date(peerLastOnline);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Active just now';
            if (diffMins < 60) return `Active ${diffMins}m ago`;
            if (diffHours < 24) return `Active ${diffHours}h ago`;
            if (diffDays === 1) return 'Active yesterday';
            return `Active ${date.toLocaleDateString()}`;
        }
        return peerInfo === 'Official Support' ? 'Helpdesk • Contact Admin' : peerInfo;
    };

    // Background based on theme
    const bgClass = chatTheme === 'digital'
        ? 'bg-black'
        : chatTheme === 'classic'
            ? 'bg-gray-50 dark:bg-zinc-950'
            : 'bg-zinc-950';

    return (
        <div className="flex-1 flex flex-col overflow-hidden transition-colors duration-500 relative">
            {/* ── Chat Header ── */}
            <div
                className={`hidden md:flex items-center gap-3 p-4 border-b-2 border-black dark:border-zinc-800 bg-white dark:bg-black shrink-0 transition-colors duration-500`}
            >
                <div className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={onHeaderClick}>
                    <div className="relative group">
                        <img
                            src={peerPhoto || `https://ui-avatars.com/api/?name=${peerName}`}
                            className={`w-10 h-10 object-cover border-2 border-black dark:border-zinc-600 transition-all duration-500 hover:brightness-75 cursor-pointer ${chatTheme === 'digital' ? 'rounded-none' : 'rounded-full'}`}
                            alt=""
                            referrerPolicy="no-referrer"
                        />
                        {peerStatus === 'online' && !isGroup && chatType !== 'ai' && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-black rounded-full" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-sm uppercase truncate tracking-tighter">{peerName}</p>
                        <p className="text-[10px] opacity-60 font-mono uppercase tracking-widest truncate">
                            {getStatusText()}
                        </p>
                    </div>
                </div>

                {/* Right-side action buttons */}
                <div className="flex items-center gap-1 relative">
                    {/* Group Icon Update Button */}
                    {isGroup && (userProfile?.isCR || userProfile?.role === 'admin') && onGroupIconEdit && (
                        <button
                            onClick={onGroupIconEdit}
                            className="p-2 rounded-full transition-all duration-300 hover:bg-gray-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                            title="Change Group Icon"
                        >
                            <ImageIcon className="w-5 h-5" />
                        </button>
                    )}
                    {/* Theme Settings Button */}
                    <button
                        onClick={() => setShowAppearancePanel(!showAppearancePanel)}
                        className={`p-2 rounded-full transition-all duration-300 ${showAppearancePanel
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 rotate-90'
                            : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-white'
                            }`}
                        title="Chat Settings / Theme"
                    >
                        <Settings className="w-5 h-5 transition-transform duration-300" />
                    </button>
                </div>
            </div>

            {/* ── Chat Appearance Panel (visible on all screen sizes) ── */}
            {showAppearancePanel && (
                <div
                    ref={panelRef}
                    className="absolute top-0 right-0 z-[160] w-80 max-w-[90vw] max-h-[75vh] bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden"
                    style={{ animation: 'chatPanelIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)', marginTop: '8px', marginRight: '8px' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-zinc-700/50 bg-zinc-800/50">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-purple-600/20 rounded-lg">
                                <Settings className="w-4 h-4 text-purple-400" />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-tight text-white">Chat Appearance</h3>
                        </div>
                        <button
                            onClick={() => setShowAppearancePanel(false)}
                            className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-500 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Panel Content */}
                    <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(75vh-56px)] custom-scrollbar">
                        {/* Theme Style */}
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2.5 block">Theme Style</label>
                            <div className="grid grid-cols-3 gap-2">
                                {/* Default/Digital */}
                                <button onClick={() => handleThemeSelect('digital')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 group ${chatTheme === 'digital' ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20 scale-[1.02]' : 'border-transparent bg-zinc-800 hover:border-zinc-600'}`}>
                                    <div className="w-8 h-8 bg-black border-2 border-white flex items-center justify-center text-white text-[10px] font-mono transition-transform duration-300 group-hover:scale-110">▪</div>
                                    <span className="text-xs font-bold text-zinc-300 group-hover:text-white">Default</span>
                                </button>
                                {/* Modern */}
                                <button onClick={() => handleThemeSelect('modern')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 group ${chatTheme === 'modern' ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20 scale-[1.02]' : 'border-transparent bg-zinc-800 hover:border-zinc-600'}`}>
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${modernPreset} shadow-lg transition-transform duration-300 group-hover:scale-110`}></div>
                                    <span className="text-xs font-bold text-zinc-300 group-hover:text-white">Modern</span>
                                </button>
                                {/* Classic */}
                                <button onClick={() => handleThemeSelect('classic')} className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 group ${chatTheme === 'classic' ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20 scale-[1.02]' : 'border-transparent bg-zinc-800 hover:border-zinc-600'}`}>
                                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110"></div>
                                    <span className="text-xs font-bold text-zinc-300 group-hover:text-white">Classic</span>
                                </button>
                            </div>
                        </div>

                        {/* Preset Themes — only for Modern */}
                        {chatTheme === 'modern' && (
                            <>
                                <div className="border-t border-zinc-700/50"></div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2.5 block">Preset Themes</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {presetGradients.map((p) => (
                                            <button
                                                key={p.name}
                                                onClick={() => { onModernPresetChange(p.gradient); showToast(`Applied ${p.name} preset`); }}
                                                className={`aspect-square rounded-xl bg-gradient-to-br ${p.preview} transition-all duration-300 hover:scale-105 active:scale-95 ring-2 ${modernPreset === p.gradient ? 'ring-purple-400 ring-offset-2 ring-offset-zinc-900 shadow-lg shadow-purple-500/30' : 'ring-transparent hover:ring-zinc-500'}`}
                                                title={p.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="border-t border-zinc-700/50"></div>

                        {/* Font Size */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5"><Type className="w-3 h-3" /> Font Size</label>
                                <span className="text-xs font-mono text-purple-400">{fontSize}px</span>
                            </div>
                            <input type="range" min="12" max="20" value={fontSize} onChange={(e) => onFontSizeChange(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg cursor-pointer accent-purple-500" style={{ accentColor: '#a855f7' }} />
                            <div className="flex justify-between text-[9px] text-zinc-600 mt-1"><span>Small</span><span>Large</span></div>
                        </div>

                        {/* Bubble Size */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5"><MessageCircle className="w-3 h-3" /> Bubble Size</label>
                                <span className="text-xs font-mono text-purple-400">{bubbleSizeLabels[bubbleSize]}</span>
                            </div>
                            <input type="range" min="1" max="5" value={bubbleSize} step="1" onChange={(e) => onBubbleSizeChange(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)} className="w-full h-2 bg-zinc-700 rounded-lg cursor-pointer accent-purple-500" style={{ accentColor: '#a855f7' }} />
                            <div className="flex justify-between text-[9px] text-zinc-600 mt-1"><span>Tiny</span><span>Comfortable</span></div>
                        </div>

                        {/* Reset */}
                        <button onClick={handleResetTheme} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 border border-zinc-700 active:scale-95">
                            <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
                        </button>
                    </div>
                </div>
            )}

            {/* ── Messages Display Container ── */}
            <div
                ref={containerRef}
                className={`flex-1 overflow-y-auto custom-scrollbar transition-colors duration-500 ${bgClass}`}
                onClick={() => setActiveActionId(null)}
                style={{
                    scrollbarColor: chatTheme === 'classic' ? 'black #f9fafb' : chatTheme === 'digital' ? 'white black' : '#444 transparent',
                    scrollbarWidth: 'thin',
                    fontSize: `${fontSize}px`,
                }}
                data-lenis-prevent
            >
                <div className="p-4 md:p-6 space-y-1.5 min-h-full flex flex-col justify-end">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-10 py-20 grayscale flex-1">
                            <MessageCircle className="w-20 h-20 mb-4" />
                            <p className="text-sm font-black uppercase tracking-[0.2em]">Start a conversation</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isMe = msg.senderId === userProfile?.uid;
                            const prevMsg = idx > 0 ? messages[idx - 1] : null;
                            const isNewSequence = !prevMsg || prevMsg.senderId !== msg.senderId;

                            return (
                                <MessageBubble
                                    key={msg.key}
                                    msg={msg}
                                    isMe={isMe}
                                    theme={chatTheme}
                                    isGroupChat={isGroup}
                                    showAvatar={!isMe && isGroup && isNewSequence}
                                    showName={!isMe && isGroup && isNewSequence}
                                    bubbleSize={bubbleSize}
                                    modernPreset={modernPreset}
                                    onReply={() => initiateReply(msg.key, msg.text, isMe ? 'You' : (msg.senderName || 'User'))}
                                    onUnsend={() => unsendMessage(msg.key)}
                                    onImageClick={(idx, atts) => setLightboxData({ attachments: atts, index: idx })}
                                    activeActionId={activeActionId}
                                    onToggleActions={(id) => setActiveActionId(activeActionId === id ? null : id)}
                                />
                            );
                        })
                    )}
                    <div ref={messagesEndRef} className="h-4 shrink-0" />
                </div>
            </div>

            {/* ── Reply Bar ── */}
            {replyTo && (
                <div className="px-5 py-3 bg-gray-50 dark:bg-zinc-900 border-t-2 border-black dark:border-zinc-800 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
                    <div className="w-1 bg-purple-600 self-stretch rounded-full" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase text-purple-600 tracking-wider mb-0.5">Replying to {replyTo.sender}</p>
                        <p className="text-xs opacity-60 truncate font-mono italic">"{replyTo.text}"</p>
                    </div>
                    <button
                        onClick={() => setReplyTo(null)}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full border border-black/10 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ── Staging Bar (separate section above input) ── */}
            {stagedFiles.length > 0 && (
                <div className="w-full px-4 pt-3 pb-1 bg-white dark:bg-black border-t-2 border-black dark:border-zinc-800 shrink-0 z-20 relative transition-colors duration-500 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="max-w-[1200px] mx-auto">
                        <div className="bg-gray-100 dark:bg-zinc-900/90 rounded-xl border border-black/10 dark:border-zinc-700/50 p-3 backdrop-blur-sm">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                    <Paperclip className="w-3.5 h-3.5" />
                                    <span>
                                        {stagedFiles.every(f => f.status === 'done') ? (
                                            <span className="text-green-600 dark:text-green-400">{stagedFiles.length} Ready to Send</span>
                                        ) : stagedFiles.some(f => f.status === 'error') ? (
                                            <span className="text-red-500"><span className="font-black">{stagedFiles.filter(f => f.status === 'error').length} Failed</span>, {stagedFiles.filter(f => f.status === 'done').length} Ready</span>
                                        ) : (
                                            <span>Uploading {stagedFiles.filter(f => f.status === 'done').length}/{stagedFiles.length}...</span>
                                        )}
                                    </span>
                                </span>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => fileInputRef.current?.click()}
                                        className="text-[10px] font-bold uppercase px-2.5 py-1 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-black dark:text-white rounded-lg transition-colors flex items-center gap-1 active:scale-95">
                                        <Plus className="w-3 h-3" /> Add More
                                    </button>
                                    <button type="button" onClick={clearStagedFiles}
                                        className="text-[10px] font-bold uppercase px-2.5 py-1 bg-red-100 dark:bg-red-600/20 hover:bg-red-200 dark:hover:bg-red-600/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-lg transition-colors flex items-center gap-1 active:scale-95">
                                        <Trash2 className="w-3 h-3" /> Clear All
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 overflow-x-auto pb-2 pt-2 px-2 custom-scrollbar">
                                {stagedFiles.map((file) => (
                                    <div key={file.id} className="relative w-14 h-14 shrink-0">
                                        {/* Thumbnail Box */}
                                        <div className={`w-full h-full rounded-lg overflow-hidden relative border-2 transition-colors ${file.status === 'uploading' ? 'border-purple-500 border-dashed animate-pulse' :
                                            file.status === 'error' ? 'border-red-500' :
                                                file.status === 'done' ? 'border-green-500/50' : 'border-zinc-300 dark:border-zinc-700'
                                            }`}>
                                            {file.previewUrl ? (
                                                file.file.type.startsWith('image/') ? (
                                                    <img src={file.previewUrl} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col justify-center items-center bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500">
                                                        <Film className="w-5 h-5 mb-0.5" />
                                                    </div>
                                                )
                                            ) : (
                                                <div className="w-full h-full flex flex-col justify-center items-center bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500">
                                                    <FileText className="w-5 h-5 mb-0.5" />
                                                </div>
                                            )}

                                            {/* Status Badge */}
                                            {file.status === 'done' && (
                                                <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm z-10">
                                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                                </div>
                                            )}
                                            {file.status === 'error' && (
                                                <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm z-10">
                                                    <AlertCircle className="w-2.5 h-2.5" />
                                                </div>
                                            )}
                                            {file.status === 'uploading' && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px] z-10">
                                                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Remove Button (Outside overflow-hidden so it's fully visible!) */}
                                        <button
                                            onClick={(e) => removeStagedFile(file.id, e)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black dark:bg-zinc-700 border-2 border-white dark:border-zinc-900 shadow-sm hover:bg-red-500 dark:hover:bg-red-600 hover:scale-[1.15] text-white rounded-full flex items-center justify-center transition-all z-20"
                                        >
                                            <X className="w-3 h-3 stroke-[3]" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Input Controls ── */}
            <div className={`w-full p-4 pb-2 ${stagedFiles.length > 0 ? 'border-t border-black/5 dark:border-zinc-800/50' : 'border-t-2 border-black dark:border-zinc-800'} bg-white dark:bg-black shrink-0 mt-auto shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-20 relative transition-colors duration-500`}>
                <div className="max-w-[1200px] mx-auto">
                    {chatId === 'global_chat' && globalSettings?.globalChatLocked ? (
                        <div className="flex flex-col items-center justify-center py-3 text-center border-2 border-dashed border-red-500/30 bg-red-500/5 rounded-xl">
                            <Lock className="w-5 h-5 text-red-500 mb-1" />
                            <p className="text-xs font-bold uppercase tracking-widest text-red-500">Global Chat is currently muted</p>
                            <p className="text-[10px] opacity-60 font-mono mt-0.5">Only administrators can send messages.</p>
                        </div>
                    ) : (
                        <div className="flex items-end gap-2 w-full">
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileSelect}
                                accept="image/*,video/*,.pdf,.doc,.docx"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSending}
                                className="flex items-center justify-center w-[50px] h-[50px] border-2 border-black dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>

                            <div className="flex-1 relative group flex">
                                <textarea
                                    ref={inputRef}
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type something..."
                                    rows={1}
                                    disabled={isSending}
                                    className={`w-full resize-none border-2 border-black dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 px-4 py-3 text-sm font-mono focus:outline-none focus:border-purple-600 transition-all max-h-40 min-h-[50px] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.02)] dark:shadow-none placeholder:opacity-30 ${chatTheme === 'digital' ? 'rounded-none' : 'rounded-none'}`}
                                />
                            </div>

                            <button
                                onClick={handleSend}
                                disabled={(!inputText.trim() && stagedFiles.length === 0) || isSending}
                                className={`h-[50px] px-6 flex items-center gap-2 font-black uppercase text-xs transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none disabled:opacity-30 disabled:grayscale shrink-0
                                    ${chatTheme === 'digital'
                                        ? 'bg-white text-black border-2 border-white'
                                        : 'bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]'
                                    }`}
                            >
                                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                <span className="hidden sm:inline">{isSending ? 'Sending...' : 'Send'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* LIGHTBOX FOR CHAT MEDIA */}
            {lightboxData && lightboxData.attachments.length > 0 && (
                <ImageLightbox
                    attachments={lightboxData.attachments}
                    initialIndex={lightboxData.index}
                    onClose={() => setLightboxData(null)}
                />
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════
   MODERN MESSAGE BUBBLE COMPONENT
   ═══════════════════════════════════════════ */
function MessageBubble({
    msg, isMe, theme, isGroupChat, showAvatar, showName, bubbleSize = 3, modernPreset = 'from-indigo-600 to-purple-700', onReply, onUnsend, onImageClick, activeActionId, onToggleActions
}: {
    msg: MessageData;
    isMe: boolean;
    theme: 'modern' | 'classic' | 'digital';
    isGroupChat: boolean;
    showAvatar: boolean;
    showName: boolean;
    bubbleSize?: 1 | 2 | 3 | 4 | 5;
    modernPreset?: string;
    onReply: () => void;
    onUnsend: () => void;
    onImageClick: (index: number, imageAttachments: any[]) => void;
    activeActionId: string | null;
    onToggleActions: (id: string) => void;
}) {
    // Bubble size mappings — 5 levels: Tiny → Small → Compact → Medium → Comfortable
    const sizeMap = {
        1: { px: 'px-2', py: 'py-1', mb: 'mb-0.5', maxW: 'max-w-[55%]', gap: 'gap-1' },
        2: { px: 'px-2.5', py: 'py-1.5', mb: 'mb-1', maxW: 'max-w-[62%]', gap: 'gap-1' },
        3: { px: 'px-3', py: 'py-2', mb: 'mb-1.5', maxW: 'max-w-[70%]', gap: 'gap-1.5' },
        4: { px: 'px-4', py: 'py-3', mb: 'mb-3', maxW: 'max-w-[80%]', gap: 'gap-2' },
        5: { px: 'px-5', py: 'py-4', mb: 'mb-4', maxW: 'max-w-[85%]', gap: 'gap-3' },
    };
    const sz = sizeMap[bubbleSize] || sizeMap[3];
    const time = msg.timestamp > 0
        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    const isActionsVisible = activeActionId === msg.key;

    const handleBubbleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleActions(msg.key);
    };

    if (msg.isDeleted) {
        return (
            <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 px-4`}>
                <div className="px-4 py-2 border border-dashed border-black/20 dark:border-white/20 text-[10px] font-bold uppercase tracking-widest text-gray-500 italic opacity-40">
                    — Message Unsent —
                </div>
            </div>
        );
    }

    const senderName = msg.senderName || 'Anonymous';
    const isTeacher = msg.senderRole === 'teacher';

    /* ─── CLASSIC THEME ─── */
    if (theme === 'classic') {
        const bg = isMe ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-200 text-black dark:bg-zinc-800 dark:text-white';
        return (
            <div className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end ${sz.gap} ${sz.mb} group px-4 transition-all duration-300`}>
                {showAvatar && (
                    <img src={msg.senderPhoto || `https://ui-avatars.com/api/?name=${senderName}`} className="w-8 h-8 rounded-full border border-gray-400 grayscale shrink-0 mb-1" alt="" referrerPolicy="no-referrer" />
                )}
                <div className={`${sz.maxW} min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {showName && (
                        <span className="text-[10px] font-black uppercase opacity-40 mb-1 tracking-widest px-1">
                            {senderName}{msg.isCR && ' (CR)'}
                        </span>
                    )}
                    <div
                        onClick={handleBubbleClick}
                        className={`${sz.px} ${sz.py} text-sm relative border-2 border-black dark:border-white transition-all duration-300 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] ${bg} cursor-pointer max-w-full`}
                    >
                        {msg.replyTo && <ReplyPreview data={{ 
                            id: typeof msg.replyTo === 'object' ? (msg.replyTo as any).id : msg.replyTo, 
                            text: msg.replyToText || (typeof msg.replyTo === 'object' ? (msg.replyTo as any).text : ''), 
                            sender: msg.replyToSender || (typeof msg.replyTo === 'object' ? (msg.replyTo as any).sender : '') 
                        }} theme="classic" isMe={isMe} />}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mb-2 max-w-[300px] overflow-hidden rounded-[8px] border border-white/10 shrink-0">
                                <CollageRenderer
                                    attachments={msg.attachments}
                                    layout={msg.attachments.length >= 3 ? 'masonry' : 'grid'}
                                    onImageClick={onImageClick}
                                />
                            </div>
                        )}
                        {msg.isSharedNotice && msg.noticeId && (
                            <Link href={`/?noticeId=${msg.noticeId}`} onClick={(e) => e.stopPropagation()}>
                                <div className="mb-2 p-3 border-2 border-dashed border-current bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-colors">
                                    <div className="flex items-center gap-2 mb-1 opacity-70">
                                        <span className="text-sm">📌</span>
                                        <span className="text-[10px] uppercase font-bold tracking-widest">Shared Notice</span>
                                    </div>
                                    <div className="font-bold text-sm line-clamp-2">
                                        {msg.noticeTitle}
                                    </div>
                                </div>
                            </Link>
                        )}
                        {msg.text && (
                            <p className="font-mono whitespace-pre-wrap leading-relaxed break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{msg.text}</p>
                        )}
                        <p className="text-[8px] opacity-50 mt-2 font-mono text-right">{time}</p>
                        <BubbleActions onReply={onReply} onUnsend={onUnsend} onCopy={() => { navigator.clipboard.writeText(msg.text || ''); }} isMe={isMe} theme="classic" visible={isActionsVisible} />
                    </div>
                </div>
            </div>
        );
    }

    /* ─── DIGITAL THEME ─── */
    if (theme === 'digital') {
        const bg = isMe ? 'bg-white text-black' : 'bg-black text-white border-2 border-white';
        return (
            <div className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end ${sz.gap} ${sz.mb} group px-4 transition-all duration-300`}>
                {showAvatar && (
                    <img src={msg.senderPhoto || `https://ui-avatars.com/api/?name=${senderName}`} className="w-9 h-9 border-2 border-white grayscale shrink-0 mb-1" alt="" referrerPolicy="no-referrer" />
                )}
                <div className={`${sz.maxW} min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {showName && (
                        <span className="text-[10px] font-mono text-white mb-1 uppercase tracking-[0.3em] font-bold">
                            &gt; {senderName}{msg.isCR && ' [CR]'}
                        </span>
                    )}
                    <div
                        onClick={handleBubbleClick}
                        className={`${sz.px} ${sz.py} text-xs relative font-mono tracking-wide transition-all duration-300 ${bg} cursor-pointer max-w-full`}
                    >
                        {msg.replyTo && <ReplyPreview data={{ 
                            id: typeof msg.replyTo === 'object' ? (msg.replyTo as any).id : msg.replyTo, 
                            text: msg.replyToText || (typeof msg.replyTo === 'object' ? (msg.replyTo as any).text : ''), 
                            sender: msg.replyToSender || (typeof msg.replyTo === 'object' ? (msg.replyTo as any).sender : '') 
                        }} theme="digital" isMe={isMe} />}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mb-2 max-w-[300px] overflow-hidden rounded-[8px] border border-white/10 shrink-0">
                                <CollageRenderer
                                    attachments={msg.attachments}
                                    layout={msg.attachments.length >= 3 ? 'masonry' : 'grid'}
                                    onImageClick={onImageClick}
                                />
                            </div>
                        )}
                        {msg.isSharedNotice && msg.noticeId && (
                            <Link href={`/?noticeId=${msg.noticeId}`} onClick={(e) => e.stopPropagation()}>
                                <div className="mb-2 p-2 border border-current bg-white/10 hover:bg-white/20 transition-colors">
                                    <div className="flex items-center gap-2 mb-1 text-[10px] opacity-70 uppercase tracking-widest">
                                        <span>[ 📌 SHARE ]</span>
                                    </div>
                                    <div className="text-sm truncate">
                                        {msg.noticeTitle}
                                    </div>
                                </div>
                            </Link>
                        )}
                        {msg.text && (
                            <p className="whitespace-pre-wrap leading-relaxed break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{msg.text}</p>
                        )}
                        <p className="text-[9px] opacity-40 mt-3 text-right uppercase font-bold">{time}</p>
                        <BubbleActions onReply={onReply} onUnsend={onUnsend} onCopy={() => { navigator.clipboard.writeText(msg.text || ''); }} isMe={isMe} theme="digital" visible={isActionsVisible} />
                    </div>
                </div>
            </div>
        );
    }

    /* ─── MODERN THEME (Default) ─── */
    const bg = isMe
        ? `bg-gradient-to-br ${modernPreset} text-white rounded-2xl rounded-br-sm shadow-[0_4px_15px_rgba(79,70,229,0.3)]`
        : 'bg-zinc-800 text-white rounded-2xl rounded-bl-sm border border-zinc-700 shadow-xl';

    return (
        <div className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end ${sz.gap} ${sz.mb} group px-4 transition-all duration-300`}>
            {showAvatar && (
                <img src={msg.senderPhoto || `https://ui-avatars.com/api/?name=${senderName}`} className="w-8 h-8 rounded-full border-2 border-zinc-700 shadow-md shrink-0 mb-1" alt="" referrerPolicy="no-referrer" />
            )}
            <div className={`${sz.maxW} min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {showName && (
                    <span className={`text-[10px] font-black uppercase mb-1 tracking-tight px-2 flex items-center gap-1.5 ${isTeacher ? 'text-amber-500' : 'text-blue-400'}`}>
                        {senderName} {msg.isCR && <span className="bg-purple-600 text-[8px] px-1.5 py-0.5 rounded-full text-white">CR</span>}
                    </span>
                )}
                <div
                    onClick={handleBubbleClick}
                    className={`${sz.px} ${sz.py} relative transition-all duration-300 hover:scale-[1.01] ${bg} cursor-pointer max-w-full`}
                >
                    {msg.replyTo && <ReplyPreview data={{ 
                        id: typeof msg.replyTo === 'object' ? (msg.replyTo as any).id : msg.replyTo, 
                        text: msg.replyToText || (typeof msg.replyTo === 'object' ? (msg.replyTo as any).text : ''), 
                        sender: msg.replyToSender || (typeof msg.replyTo === 'object' ? (msg.replyTo as any).sender : '') 
                    }} theme="modern" isMe={isMe} />}
                    {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-2 max-w-[300px] overflow-hidden rounded-[8px] border border-white/10 shrink-0">
                            <CollageRenderer
                                attachments={msg.attachments}
                                layout={msg.attachments.length >= 3 ? 'masonry' : 'grid'}
                                onImageClick={onImageClick}
                            />
                        </div>
                    )}
                    {msg.isSharedNotice && msg.noticeId && (
                        <Link href={`/?noticeId=${msg.noticeId}`} onClick={(e) => e.stopPropagation()}>
                            <div className="mb-2 p-3 rounded-xl bg-black/20 hover:bg-black/30 backdrop-blur-sm border border-white/10 transition-all hover:scale-[1.02]">
                                <div className="flex items-center gap-2 mb-1 opacity-80">
                                    <span className="text-sm">📌</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Shared Notice</span>
                                </div>
                                <div className="font-bold text-sm leading-tight text-white drop-shadow-md">
                                    {msg.noticeTitle}
                                </div>
                            </div>
                        </Link>
                    )}
                    {msg.text && (
                        <p className="leading-relaxed whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{msg.text}</p>
                    )}
                    <div className="flex items-center justify-end gap-1.5 mt-2 opacity-40 text-[9px] font-bold uppercase tracking-widest">
                        {msg.edited && <span>Edited</span>}
                        <span>{time}</span>
                    </div>
                    <BubbleActions onReply={onReply} onUnsend={onUnsend} onCopy={() => { navigator.clipboard.writeText(msg.text || ''); }} isMe={isMe} theme="modern" visible={isActionsVisible} />
                </div>
            </div>
        </div>
    );
}

function ReplyPreview({ data, theme, isMe }: { data: any, theme: string, isMe: boolean }) {
    const base = "mb-2 pl-3 border-l-4 py-2 text-xs rounded transition-all overflow-hidden";
    const styles: any = {
        classic: `${base} border-black bg-black/5 dark:bg-white/5 font-mono opacity-80`,
        digital: `${base} border-white bg-white/5 font-mono text-cyan-300`,
        modern: `${base} ${isMe ? 'border-white/50 bg-white/10' : 'border-indigo-500 bg-zinc-900/50'} opacity-90`
    };

    const sender = typeof data === 'object' ? (data.sender || 'User') : 'User';
    const rawText = typeof data === 'object' ? (data.text || 'Attachment') : String(data);
    const text = rawText.length > 50 ? rawText.substring(0, 50) + '...' : rawText;

    return (
        <div className={styles[theme] || styles.modern}>
            <span className="font-black block text-[9px] uppercase tracking-tighter mb-1 select-none">{sender}</span>
            <p className="truncate opacity-75 italic text-[11px] max-w-full">{text}</p>
        </div>
    );
}

function BubbleActions({ onReply, onUnsend, onCopy, isMe, theme, visible }: { onReply: () => void, onUnsend: () => void, onCopy: () => void, isMe: boolean, theme: string, visible: boolean }) {
    const isDigital = theme === 'digital';

    // Base styles: normally opacity-0, but if visible=true -> opacity-100 and interactive
    // We combine hover logic (desktop) with visible logic (mobile/tap)
    const visibilityClass = visible
        ? "opacity-100 pointer-events-auto scale-100"
        : "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto scale-90 group-hover:scale-100";

    const base = `absolute top-1/2 -translate-y-1/2 transition-all flex gap-1 z-20 ${visibilityClass}`;
    const pos = isMe ? "right-[calc(100%+8px)] flex-row-reverse" : "left-[calc(100%+8px)] flex-row";

    const chipBase = "flex items-center gap-1.5 p-1.5 shadow-2xl backdrop-blur-md";
    const chipStyles: any = {
        classic: `${chipBase} bg-white dark:bg-black border-2 border-black dark:border-white rounded-none`,
        digital: `${chipBase} bg-black border-2 border-white rounded-none`,
        modern: `${chipBase} bg-zinc-900/90 border border-zinc-700/50 rounded-full duration-300`
    };

    return (
        <div className={`${base} ${pos}`} onClick={(e) => e.stopPropagation()}>
            <div className={chipStyles[theme] || chipStyles.modern}>
                <button onClick={onReply} className="p-1.5 hover:bg-white/10 rounded-full transition-colors active:scale-90" title="Reply">
                    <CornerUpLeft className={`w-4 h-4 ${isDigital ? 'text-white' : 'text-purple-500'}`} />
                </button>
                <button onClick={onCopy} className="p-1.5 hover:bg-white/10 rounded-full transition-colors active:scale-90" title="Copy">
                    <Copy className={`w-4 h-4 ${isDigital ? 'text-white' : 'text-blue-400'}`} />
                </button>
                {isMe && (
                    <button onClick={onUnsend} className="p-1.5 hover:bg-red-500/10 rounded-full transition-colors active:scale-90" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                )}
            </div>
        </div>
    );
}

