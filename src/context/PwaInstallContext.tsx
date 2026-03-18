'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface PwaInstallContextType {
    isInstallable: boolean;
    isInstalled: boolean;
    triggerInstall: () => Promise<'accepted' | 'dismissed' | null>;
}

const PwaInstallContext = createContext<PwaInstallContextType>({
    isInstallable: false,
    isInstalled: false,
    triggerInstall: async () => null,
});

export const usePwaInstall = () => useContext(PwaInstallContext);

export function PwaInstallProvider({ children }: { children: ReactNode }) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (typeof window !== 'undefined') {
            const standalone = window.matchMedia('(display-mode: standalone)').matches;
            setIsInstalled(standalone);
        }

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        const installedHandler = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, []);

    const triggerInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
        if (!deferredPrompt) return null;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
        }
        setDeferredPrompt(null);
        return outcome;
    }, [deferredPrompt]);

    return (
        <PwaInstallContext.Provider value={{
            isInstallable: !!deferredPrompt,
            isInstalled,
            triggerInstall,
        }}>
            {children}
        </PwaInstallContext.Provider>
    );
}
