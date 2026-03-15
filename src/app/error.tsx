'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error nicely inside browser console
        console.error('Unhandled app error:', error);
    }, [error]);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 px-4 py-12">
            <div className="bg-white dark:bg-black p-8 md:p-12 border-4 border-black dark:border-white shadow-[8px_8px_0px_#000] dark:shadow-[8px_8px_0px_#fff] max-w-xl w-full text-center relative overflow-hidden transition-colors">

                {/* Decorative background icon */}
                <div className="absolute -left-10 -top-10 opacity-5 dark:opacity-10 pointer-events-none">
                    <AlertTriangle className="w-64 h-64 text-red-500" />
                </div>

                <div className="relative z-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500 border-4 border-black rounded-full shadow-[4px_4px_0px_#000] mb-6">
                        <AlertTriangle className="w-10 h-10 text-white" />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black mb-2 uppercase italic tracking-tighter text-black dark:text-white">
                        System Crash
                    </h1>
                    <h2 className="text-sm md:text-base font-bold uppercase tracking-widest mb-6 bg-red-500 text-white inline-block px-3 py-1 border-2 border-black dark:border-white">
                        Fatal Error Encountered
                    </h2>

                    <p className="text-sm md:text-base font-mono font-medium mb-6 opacity-80 dark:text-white">
                        Something went terribly wrong while rendering this page. Don't panic, the server monkeys have been notified.
                    </p>

                    <div className="bg-gray-100 dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 p-4 mb-8 text-left overflow-x-auto relative group">
                        <p className="text-xs font-mono text-red-500 font-bold mb-2 uppercase tracking-widest border-b border-black/10 dark:border-white/10 pb-1">Error Details</p>
                        <code className="text-xs font-mono text-black dark:text-gray-300 break-words whitespace-pre-wrap">
                            {error.message || "Unknown Application Error"}
                        </code>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => reset()}
                            className="flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black font-bold py-3 px-6 border-4 border-black dark:border-white transition-all hover:translate-y-1 hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] uppercase text-sm tracking-widest"
                        >
                            <RotateCcw className="w-5 h-5" />
                            <span>Try Again</span>
                        </button>

                        <Link href="/" className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-6 border-4 border-black transition-all hover:translate-y-1 hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-sm tracking-widest">
                            <Home className="w-5 h-5" />
                            <span>Go Home</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
