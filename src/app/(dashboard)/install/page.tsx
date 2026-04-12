'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePwaInstall } from '@/context/PwaInstallContext';
import { useUI } from '@/context/UIContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Download, Smartphone, Monitor } from 'lucide-react';

interface ApkRelease {
    version: string;
    url: string;
    notes?: string;
    timestamp?: any;
    name?: string;
    fileId?: string;
}

export default function InstallPage() {
    const { userProfile } = useAuth();
    const { isInstallable, isInstalled, triggerInstall } = usePwaInstall();
    const { showToast, showAlert } = useUI();

    const [currentApk, setCurrentApk] = useState<ApkRelease | null>(null);
    const [oldApk, setOldApk] = useState<ApkRelease | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloadingApkUrl, setDownloadingApkUrl] = useState<string | null>(null);

    const [nativeVersion, setNativeVersion] = useState<string | null>(null);

    const isAdmin = userProfile?.role === 'admin';

    useEffect(() => {
        async function load() {
            try {
                const snap = await getDoc(doc(db, 'apps_management', 'apk_releases'));
                if (snap.exists()) {
                    const data = snap.data();
                    setCurrentApk(data.current || null);
                    setOldApk(data.old || null);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        async function checkNative() {
            if (Capacitor.isNativePlatform()) {
                try {
                    const info = await App.getInfo();
                    setNativeVersion(info.version);
                } catch (e) {
                    console.error(e);
                }
            }
        }

        load();
        checkNative();
    }, []);

    const isUpdateAvailable = currentApk && nativeVersion && currentApk.version && currentApk.version !== nativeVersion;

    // Helper to force APK download header instead of zip and specify explicit filename
    const handleDownload = async (url: string, e: React.MouseEvent) => {
        e.preventDefault();
        if (!url || downloadingApkUrl) return;
        
        try {
            setDownloadingApkUrl(url);
            
            let fetchUrl = url;
            try {
                const u = new URL(url);
                if (u.hostname.includes('imagekit.io')) {
                    u.searchParams.set('ik-attachment', 'true');
                    fetchUrl = u.toString();
                } else if (u.hostname.includes('cloudinary.com') && url.includes('/upload/')) {
                    if (!url.includes('fl_attachment')) {
                        fetchUrl = url.replace('/upload/', '/upload/fl_attachment/');
                    }
                }
            } catch {}

            showToast("Preparing download, please wait...");
            
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = 'npc-notice-board.apk'; // Force strictly this name
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            setTimeout(() => window.URL.revokeObjectURL(objectUrl), 100);
            showToast("Download started successfully!");
            
        } catch (error) {
            console.error("Download failed:", error);
            showToast("Direct download failed. Opening file in new tab...");
            window.open(url, '_blank'); // fallback
        } finally {
            setDownloadingApkUrl(null);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider border-b-4 border-black dark:border-white pb-2">
                Downloads & Installation
            </h1>

            {loading ? (
                <div className="p-8 text-center font-bold animate-pulse">Loading releases...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* APK SECTION */}
                    <div className="border-4 border-black dark:border-white p-5 bg-white dark:bg-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
                        <div className="flex items-center gap-3 mb-4">
                            <Smartphone className="w-6 h-6 text-purple-600" />
                            <h2 className="font-black uppercase text-xl">Install APK App</h2>
                        </div>

                        {nativeVersion && (
                            <p className="text-xs font-mono mb-4 text-purple-600 dark:text-purple-400 font-bold">
                                INSTALLED VERSION: {nativeVersion}
                            </p>
                        )}

                        <div className="space-y-4">
                            {currentApk ? (
                                <div className="border-2 border-black dark:border-zinc-800 p-3 bg-gray-50 dark:bg-zinc-950">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 uppercase">Newest</span>
                                            <h3 className="font-bold text-lg">Version {currentApk.version}</h3>
                                            {currentApk.notes && <p className="text-xs opacity-70 mt-1">{currentApk.notes}</p>}
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => handleDownload(currentApk.url, e)}
                                        disabled={downloadingApkUrl === currentApk.url}
                                        className="w-full mt-3 py-3 bg-black text-white dark:bg-white dark:text-black font-black uppercase text-sm flex items-center justify-center gap-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(147,51,234,0.5)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download className="w-4 h-4" />
                                        {downloadingApkUrl === currentApk.url ? 'Preparing...' : (isUpdateAvailable ? 'Update App' : 'Download APK')}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-sm border-2 border-dashed border-gray-400 p-3 text-center opacity-60">
                                    No modern channel APK found.
                                </div>
                            )}

                            {oldApk && (
                                <div className="border-2 border-black dark:border-zinc-800 p-3 bg-gray-50 dark:bg-zinc-950">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 uppercase">Older / Stable</span>
                                            <h3 className="font-bold text-lg">Version {oldApk.version}</h3>
                                            {oldApk.notes && <p className="text-xs opacity-70 mt-1">{oldApk.notes}</p>}
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => handleDownload(oldApk.url, e)}
                                        disabled={downloadingApkUrl === oldApk.url}
                                        className="w-full mt-3 py-2 bg-transparent hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-black uppercase text-xs flex items-center justify-center gap-2 border-2 border-black dark:border-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download className="w-4 h-4" />
                                        {downloadingApkUrl === oldApk.url ? 'Preparing...' : 'Download Static/Older'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PWA SECTION — hidden in native app */}
                    {!Capacitor.isNativePlatform() && (
                    <div className="border-4 border-black dark:border-white p-5 bg-white dark:bg-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
                        <div className="flex items-center gap-3 mb-4">
                            <Monitor className="w-6 h-6 text-purple-600" />
                            <h2 className="font-black uppercase text-xl">Install PWA App</h2>
                        </div>

                        <p className="text-xs opacity-70 mb-5 leading-relaxed">
                            Web Progressive App gives an ideal app-like native drawer interface directly over browser caches without full file installation.
                        </p>

                        {isInstalled ? (
                            <div className="p-4 border-2 border-purple-500 text-center text-sm font-bold text-purple-600 dark:text-purple-400">
                                PWA App is already installed on this browser!
                            </div>
                        ) : isInstallable ? (
                            <button
                                onClick={triggerInstall}
                                className="w-full py-3 bg-purple-600 text-white font-black uppercase text-sm flex items-center justify-center gap-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                            >
                                <Download className="w-4 h-4" />
                                Install PWA App Now
                            </button>
                        ) : (
                            <div className="p-4 border-2 border-dashed border-gray-400 text-center text-xs opacity-60">
                                PWA installation support is not available or explicitly blocked by this browser cache.
                            </div>
                        )}
                    </div>
                    )}
                </div>
            )}
        </div>
    );
}
