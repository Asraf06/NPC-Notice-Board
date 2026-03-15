'use client';

import { motion } from 'framer-motion';

// Apple iOS easing curve — starts fast, decelerates smoothly
const appleEase: [number, number, number, number] = [0.2, 0, 0, 1];

export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            className="w-full h-full flex flex-1"
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
                duration: 0.3,
                ease: appleEase,
            }}
            suppressHydrationWarning
        >
            {children}
        </motion.div>
    );
}
