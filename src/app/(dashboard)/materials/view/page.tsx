'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { ArrowLeft, Download, ExternalLink, FileText, Image as ImageIcon, Film, Maximize2, Minimize2, ZoomIn, ZoomOut, Search, ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import { useRef } from 'react';

function DocumentViewerContent() {
    const searchParams = useSearchParams();
    const url = searchParams.get('url') || '';
    const urlsParam = searchParams.get('urls');
    const title = searchParams.get('title') || 'Document';

    let urlsToRender: string[] = [];
    if (urlsParam) {
        try {
            urlsToRender = JSON.parse(urlsParam);
        } catch (e) {
            urlsToRender = url ? [url] : [];
        }
    } else if (url) {
        urlsToRender = [url];
    }

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [fileType, setFileType] = useState<'pdf' | 'image' | 'video' | 'other'>('other');
    const [isZoomEnabled, setIsZoomEnabled] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    const pdfScrollRef = useRef<HTMLDivElement>(null);
    useSmoothScroll(pdfScrollRef);

    useEffect(() => {
        if (!url) return;
        const lower = url.toLowerCase();
        if (lower.includes('.pdf') || lower.includes('/pdf') || lower.includes('raw/upload') || lower.match(/\.(doc|docx|xls|xlsx|ppt|pptx)/)) {
            setFileType('pdf');
        } else if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)/)) {
            setFileType('image');
        } else if (lower.match(/\.(mp4|webm|mov|avi)/)) {
            setFileType('video');
        } else {
            // Try to detect from ImageKit/Cloudinary patterns
            if (lower.includes('ik.imagekit.io')) {
                // Could be any type, try PDF first
                setFileType('pdf');
            } else {
                setFileType('pdf'); // Default to PDF viewer
            }
        }
    }, [url]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                setIsSpacePressed(true);
                e.preventDefault(); // Prevent page scroll when space is pressed
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpacePressed(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const handleDownload = async (targetUrl?: string) => {
        const downloadSingle = async (fileUrl: string, name: string) => {
            try {
                const res = await fetch(fileUrl);
                if (!res.ok) throw new Error('Fetch failed');
                const blob = await res.blob();
                const contentType = res.headers.get('content-type') || '';
                let filename = name;
                if (!filename.includes('.')) {
                    if (contentType.includes('pdf')) filename += '.pdf';
                    else if (contentType.includes('png')) filename += '.png';
                    else if (contentType.includes('jpeg') || contentType.includes('jpg')) filename += '.jpg';
                    else if (contentType.includes('gif')) filename += '.gif';
                    else if (contentType.includes('webp')) filename += '.webp';
                    else if (contentType.includes('mp4')) filename += '.mp4';
                }
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                }, 100);
            } catch (error) {
                console.error('Download error:', error);
                let fallbackUrl = fileUrl;
                if (fileUrl.includes('ik.imagekit.io')) {
                    const sep = fileUrl.includes('?') ? '&' : '?';
                    fallbackUrl = `${fileUrl}${sep}ik-attachment=true`;
                }
                window.open(fallbackUrl, '_blank');
            }
        };

        setIsDownloading(true);
        if (targetUrl) {
            await downloadSingle(targetUrl, `${title}_image_${Date.now()}`);
        } else if (urlsToRender.length > 1) {
            // Sequential download for multiple files
            for (let i = 0; i < urlsToRender.length; i++) {
                await downloadSingle(urlsToRender[i], `${title}_part_${i + 1}`);
                // Small delay to prevent browser blocking multiple downloads
                await new Promise(r => setTimeout(r, 300));
            }
        } else {
            await downloadSingle(url, title);
        }
        setIsDownloading(false);
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Google Docs Viewer URL for PDF files
    const getViewerUrl = (rawUrl: string) => {
        return `https://docs.google.com/viewer?url=${encodeURIComponent(rawUrl)}&embedded=true`;
    };

    if (!url) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="font-bold uppercase tracking-wider opacity-40">No document URL provided</p>
                    <Link href="/materials" className="mt-4 inline-block text-purple-600 underline font-bold text-sm">
                        ← Back to Materials
                    </Link>
                </div>
            </main>
        );
    }

    const isZoomActive = isZoomEnabled || isSpacePressed;

    return (
        <main className={`flex-1 flex flex-col ${isFullscreen ? 'fixed inset-0 z-[200] bg-white dark:bg-black' : ''}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-black border-b-2 border-black dark:border-zinc-800 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href="/materials"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors border-2 border-transparent hover:border-black dark:hover:border-zinc-600"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="font-black text-sm uppercase tracking-wider truncate">{title}</h1>
                        <p className="text-[9px] font-mono opacity-40 uppercase truncate">
                            {fileType === 'pdf' && '📄 Document'}
                            {fileType === 'image' && '🖼️ Image'}
                            {fileType === 'video' && '🎬 Video'}
                            {fileType === 'other' && '📁 File'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Zoom Toggle (Only for Image) */}
                    {fileType === 'image' && (
                        <button
                            onClick={() => setIsZoomEnabled(!isZoomEnabled)}
                            className={`p-2 border-2 transition-all ${isZoomEnabled ? 'bg-purple-600 text-white border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-gray-100 dark:bg-zinc-800 border-black dark:border-zinc-600 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}
                            title={isZoomEnabled ? 'Disable Zoom/Pan' : 'Enable Zoom/Pan (or hold Space)'}
                        >
                            <Search className="w-4 h-4" />
                        </button>
                    )}

                    {/* Fullscreen Toggle */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 bg-gray-100 dark:bg-zinc-800 border-2 border-black dark:border-zinc-600 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>

                    {/* Download */}
                    <button
                        onClick={() => handleDownload()}
                        disabled={isDownloading}
                        className="p-2 bg-purple-600 text-white border-2 border-black dark:border-white hover:bg-purple-700 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                        title={urlsToRender.length > 1 ? "Download All" : "Download"}
                    >
                        {isDownloading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                    </button>

                    {/* Open External */}
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-gray-100 dark:bg-zinc-800 border-2 border-black dark:border-zinc-600 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all"
                        title="Open in New Tab"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>

            {/* Document Content */}
            <div className={`flex-1 overflow-hidden relative ${isZoomActive ? 'cursor-grab active:cursor-grabbing' : ''} bg-gray-200 dark:bg-zinc-950`}>

                {fileType === 'pdf' && (
                    <div ref={pdfScrollRef} className="w-full h-full overflow-y-auto custom-scrollbar flex flex-col">
                        <div className="locomotive-content-wrapper flex flex-col w-full h-full">
                            {urlsToRender.map((pdfUrl, index) => (
                                <div key={index} className="w-full h-full shrink-0 bg-white">
                                    <iframe
                                        src={getViewerUrl(pdfUrl)}
                                        className="w-full h-full border-none block"
                                        title={`${title} - Part ${index + 1}`}
                                        allowFullScreen
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {fileType === 'image' && (
                    <TransformWrapper
                        key={isZoomActive ? 'zoom-on' : 'zoom-off'}
                        disabled={!isZoomActive}
                        pinch={{ disabled: false }}
                        wheel={{ disabled: !isZoomActive, step: 0.1 }}
                        panning={{ disabled: !isZoomActive }}
                        initialScale={1}
                        minScale={0.5}
                        maxScale={5}
                        limitToBounds={false} // This allows panning the picture border to the middle of the screen
                    >
                        {({ zoomIn, zoomOut, resetTransform }) => (
                            <div className={`w-full h-full relative flex items-center justify-center ${isZoomActive ? 'p-0' : 'p-4'}`}>
                                {isZoomActive ? (
                                    <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2 bg-white/90 dark:bg-black/90 p-2 rounded-lg border-2 border-black dark:border-zinc-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <button onClick={() => zoomIn(0.5)} className="p-2 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded"><ZoomIn className="w-5 h-5" /></button>
                                        <button onClick={() => zoomOut(0.5)} className="p-2 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded"><ZoomOut className="w-5 h-5" /></button>
                                        <button onClick={() => resetTransform()} className="p-2 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded text-xs font-bold font-mono">RESET</button>
                                    </div>
                                ) : (
                                    urlsToRender.length > 1 && (
                                        <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2 bg-white/90 dark:bg-black/90 p-2 rounded-lg border-2 border-black dark:border-zinc-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            <button
                                                onClick={() => {
                                                    const el = document.querySelector('.custom-scrollbar');
                                                    el?.scrollBy({ top: -500, behavior: 'smooth' });
                                                }}
                                                className="p-2 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded"
                                                title="Scroll Up"
                                            >
                                                <ChevronUp className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const el = document.querySelector('.custom-scrollbar');
                                                    el?.scrollBy({ top: 500, behavior: 'smooth' });
                                                }}
                                                className="p-2 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded"
                                                title="Scroll Down"
                                            >
                                                <ChevronDown className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )
                                )}
                                <TransformComponent
                                    wrapperClass={`w-full h-full relative ${isZoomActive ? 'overflow-hidden p-0' : 'max-h-full overflow-y-auto custom-scrollbar p-0 md:p-4'}`}
                                    contentClass="flex flex-col items-center justify-start gap-6 min-w-full min-h-full pb-10"
                                >
                                    {urlsToRender.map((imgUrl, index) => (
                                        <div
                                            key={index}
                                            className={`relative flex items-center justify-center border-2 border-black dark:border-zinc-700 bg-black shadow-2xl my-2 overflow-hidden shrink-0 min-h-[50vh] ${isZoomActive ? 'w-full border-none m-0' : 'w-[95%] sm:w-[90%] md:w-[80%] max-w-5xl'}`}
                                        >
                                            {/* Blurred Backdrop */}
                                            <div
                                                className="absolute inset-0 bg-cover bg-center opacity-40 blur-3xl scale-125"
                                                style={{ backgroundImage: `url(${imgUrl})` }}
                                            />
                                            {/* Foreground Image */}
                                            <img
                                                src={imgUrl}
                                                alt={`${title} - Page ${index + 1}`}
                                                className={`relative z-10 object-contain pointer-events-none transition-all duration-300 ${isZoomActive ? 'w-full h-auto' : 'max-h-[85vh] w-auto h-auto'}`}
                                                referrerPolicy="no-referrer"
                                            />
                                            {/* Individual Download Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownload(imgUrl);
                                                }}
                                                className="absolute top-4 right-4 z-20 p-2 bg-purple-600 text-white rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:scale-110 active:scale-95 transition-all"
                                                title="Download this image"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </TransformComponent>
                            </div>
                        )}
                    </TransformWrapper>
                )}

                {fileType === 'video' && (
                    <div className="w-full h-full flex items-center justify-center p-4">
                        <video
                            src={url}
                            controls
                            className="max-w-full max-h-full shadow-2xl border-2 border-black dark:border-zinc-700"
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                )}

                {fileType === 'other' && (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center p-8">
                            <FileText className="w-20 h-20 mx-auto mb-6 opacity-20" />
                            <p className="font-bold uppercase tracking-wider mb-2 text-sm">Preview Not Available</p>
                            <p className="text-xs opacity-50 mb-6 font-mono">This file type cannot be previewed in the browser</p>
                            <button
                                onClick={() => handleDownload()}
                                disabled={isDownloading}
                                className="px-6 py-3 bg-purple-600 text-white font-bold uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform disabled:opacity-50"
                            >
                                {isDownloading ? 'Downloading...' : 'Download File'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function DocumentViewerPage() {
    return (
        <Suspense fallback={
            <main className="flex-1 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </main>
        }>
            <DocumentViewerContent />
        </Suspense>
    );
}
