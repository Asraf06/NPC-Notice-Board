import Link from 'next/link';
import { Ghost, Home } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 px-4 py-12">
            <div className="bg-white dark:bg-black p-8 md:p-12 border-4 border-black dark:border-white shadow-[8px_8px_0px_#000] dark:shadow-[8px_8px_0px_#fff] max-w-xl w-full text-center relative overflow-hidden transition-colors">

                {/* Decorative background icon */}
                <div className="absolute -right-10 -top-10 opacity-5 dark:opacity-10 pointer-events-none">
                    <Ghost className="w-64 h-64 text-purple-500" />
                </div>

                <div className="relative z-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-500 border-4 border-black rounded-full shadow-[4px_4px_0px_#000] mb-6">
                        <Ghost className="w-10 h-10 text-white" />
                    </div>

                    <h1 className="text-6xl md:text-7xl font-black mb-2 uppercase italic tracking-tighter text-black dark:text-white">
                        404
                    </h1>
                    <h2 className="text-sm md:text-base font-bold uppercase tracking-widest mb-6 bg-black text-white dark:bg-white dark:text-black inline-block px-3 py-1 border-2 border-black dark:border-white">
                        Page Not Found
                    </h2>

                    <p className="text-sm md:text-base font-mono font-medium mb-10 opacity-80 dark:text-white">
                        The page you're looking for was moved, deleted, or never existed in the first place.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/" className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-8 border-4 border-black transition-all hover:translate-y-1 hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-sm tracking-widest">
                            <Home className="w-5 h-5" />
                            <span>Return Home</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
