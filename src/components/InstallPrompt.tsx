'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InstallPrompt() {
    const [prompt, setPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [dismissState, setDismissState] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setPrompt(e);

            // Wait a few seconds after load to show the prompt
            const timer = setTimeout(() => {
                const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

                // Check preferences
                const neverShow = localStorage.getItem('pwa_never_show');
                const showLater = localStorage.getItem('pwa_show_later');
                const sessionDismiss = sessionStorage.getItem('pwa_session_dismiss');

                let shouldShow = true;
                if (neverShow === 'true') shouldShow = false;
                if (sessionDismiss === 'true') shouldShow = false;
                if (showLater) {
                    const laterTime = parseInt(showLater, 10);
                    if (Date.now() < laterTime) shouldShow = false;
                }

                if (!isInstalled && shouldShow) {
                    setIsVisible(true);
                }
            }, 3000);

            return () => clearTimeout(timer);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!prompt) return;
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
            setIsVisible(false);
        }
        setPrompt(null);
    };

    const handleNotNow = () => {
        sessionStorage.setItem('pwa_session_dismiss', 'true');
        setIsVisible(false);
        setTimeout(() => setDismissState(false), 500); // reset state after closing
    };

    const handleMaybeLater = () => {
        // Show again in 3 days
        const time = Date.now() + 3 * 24 * 60 * 60 * 1000;
        localStorage.setItem('pwa_show_later', time.toString());
        setIsVisible(false);
        setTimeout(() => setDismissState(false), 500);
    };

    const handleNoThanks = () => {
        localStorage.setItem('pwa_never_show', 'true');
        setIsVisible(false);
        setTimeout(() => setDismissState(false), 500);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 200, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 200, opacity: 0, transition: { duration: 0.2 } }}
                    className="fixed bottom-24 left-4 right-4 z-[100] md:left-auto md:right-8 md:bottom-8 md:w-[360px]"
                >
                    <div className="bg-white dark:bg-black border-4 border-black dark:border-white p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] overflow-hidden">

                        <AnimatePresence mode="wait">
                            {!dismissState ? (
                                <motion.div
                                    key="main-prompt"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-black uppercase text-xl italic tracking-tighter">Install App?</h3>
                                        <button onClick={() => setDismissState(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors border-2 border-transparent hover:border-black dark:hover:border-zinc-700">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <p className="text-xs font-bold opacity-70 mb-4 uppercase leading-tight">
                                        Install NPC Notice Board on your device for a better app-like experience.
                                    </p>
                                    <button
                                        onClick={handleInstall}
                                        className="w-full py-3 mt-2 bg-purple-600 text-white font-black uppercase text-sm flex items-center justify-center gap-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                                    >
                                        <Download className="w-4 h-4" />
                                        Install Now
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="dismiss-options"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
                                    className="flex flex-col gap-2"
                                >
                                    <div className="flex justify-between items-center border-b-2 border-black dark:border-zinc-800 pb-2 mb-2">
                                        <h3 className="font-black uppercase text-sm italic tracking-tighter">Dismiss Install</h3>
                                        <button onClick={() => setDismissState(false)} className="text-[10px] font-bold underline opacity-70 hover:opacity-100 uppercase transition-opacity">Back</button>
                                    </div>

                                    <button onClick={handleNotNow} className="w-full py-3 hover:bg-gray-100 dark:hover:bg-zinc-900 border-2 border-transparent border-b-gray-100 dark:border-b-zinc-800 hover:border-black dark:hover:border-zinc-700 font-bold text-xs uppercase text-left px-3 transition-colors flex justify-between items-center">
                                        <span>Not Now</span>
                                        <span className="opacity-40 text-[9px] font-mono tracking-tighter">next login</span>
                                    </button>

                                    <button onClick={handleMaybeLater} className="w-full py-3 hover:bg-gray-100 dark:hover:bg-zinc-900 border-2 border-transparent border-b-gray-100 dark:border-b-zinc-800 hover:border-black dark:hover:border-zinc-700 font-bold text-xs uppercase text-left px-3 transition-colors flex justify-between items-center">
                                        <span>Maybe Later</span>
                                        <span className="opacity-40 text-[9px] font-mono tracking-tighter">in 3 days</span>
                                    </button>

                                    <button onClick={handleNoThanks} className="w-full py-3 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 border-2 border-transparent hover:border-red-600 dark:hover:border-red-800 font-bold text-xs uppercase text-left px-3 transition-colors flex justify-between items-center group">
                                        <span>No Thanks</span>
                                        <span className="opacity-40 text-[9px] font-mono tracking-tighter group-active:text-red-500">never ask again</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
