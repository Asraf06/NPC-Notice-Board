'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import PeerProfileModal from '@/components/profile/PeerProfileModal';

// ========== TYPES ==========
type AlertType = 'info' | 'error' | 'success' | 'warning';

interface AlertState {
    visible: boolean;
    title: string;
    message: string;
    type: AlertType;
    callback?: (() => void) | null;
}

interface UIContextType {
    showToast: (message: string, duration?: number) => void;
    showAlert: (title: string, message: string, type?: AlertType, callback?: (() => void) | null) => void;
    closeAlert: () => void;
    openProfile: (uid: string) => void;
    isScannerOpen: boolean;
    openScanner: () => void;
    closeScanner: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function useUI() {
    const ctx = useContext(UIContext);
    if (!ctx) throw new Error('useUI must be used within UIProvider');
    return ctx;
}

// ========== PROVIDER ==========
export function UIProvider({ children }: { children: ReactNode }) {
    // Toast state
    const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
    const [toastTimeout, setToastTimeoutId] = useState<NodeJS.Timeout | null>(null);

    const showToast = useCallback((message: string, duration = 3000) => {
        if (toastTimeout) clearTimeout(toastTimeout);
        setToast({ message, visible: true });
        const id = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
        setToastTimeoutId(id);
    }, [toastTimeout]);

    // Alert state
    const [alertState, setAlertState] = useState<AlertState>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        callback: null,
    });

    const showAlert = useCallback((title: string, message: string, type: AlertType = 'info', callback: (() => void) | null = null) => {
        setAlertState({ visible: true, title, message, type, callback });
    }, []);

    const closeAlert = useCallback(() => {
        setAlertState(prev => ({ ...prev, visible: false }));
        setTimeout(() => {
            if (alertState.callback) alertState.callback();
        }, 200);
    }, [alertState.callback]);

    // Profile state
    const [profileUid, setProfileUid] = useState<string | null>(null);
    const openProfile = useCallback((uid: string) => {
        setProfileUid(uid);
    }, []);

    // Scanner state
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const openScanner = useCallback(() => setIsScannerOpen(true), []);
    const closeScanner = useCallback(() => setIsScannerOpen(false), []);

    // Listen for global events triggered outside React (e.g. from utility files like uploadService)
    useEffect(() => {
        const handleGlobalAlert = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail) {
                showAlert(customEvent.detail.title || 'Alert', customEvent.detail.message || '', customEvent.detail.type || 'info');
            }
        };
        window.addEventListener('global-alert', handleGlobalAlert);
        return () => window.removeEventListener('global-alert', handleGlobalAlert);
    }, [showAlert]);

    return (
        <UIContext.Provider value={{ showToast, showAlert, closeAlert, openProfile, isScannerOpen, openScanner, closeScanner }}>
            {children}

            {/* Toast Notification */}
            <div
                className={`fixed bottom-20 left-1/2 -translate-x-1/2 bg-black text-white dark:bg-white dark:text-black px-6 py-3 rounded-full shadow-[0_8px_16px_rgba(0,0,0,0.3)] text-xs font-bold uppercase tracking-widest z-[200] transition-all duration-300 pointer-events-none ${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                    }`}
                suppressHydrationWarning
            >
                {toast.message}
            </div>

            {/* Custom Alert Modal */}
            <div
                className={`fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-200 ${alertState.visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={closeAlert}
                suppressHydrationWarning
            >
                <div
                    className={`bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-sm p-8 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] transition-transform duration-200 ${alertState.visible ? 'scale-100' : 'scale-95'
                        }`}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Icon */}
                    <div className="mb-4 flex justify-center">
                        {alertState.type === 'error' && (
                            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <svg className="w-10 h-10 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                            </div>
                        )}
                        {alertState.type === 'success' && (
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                        )}
                        {(alertState.type === 'info' || alertState.type === 'warning') && (
                            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <svg className="w-10 h-10 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                            </div>
                        )}
                    </div>

                    <h3 className="text-xl font-bold uppercase mb-2">{alertState.title}</h3>
                    <p className="text-sm opacity-70 mb-6">{alertState.message}</p>
                    <button
                        onClick={closeAlert}
                        className="w-full py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase hover:opacity-80 transition-all"
                        autoFocus
                    >
                        OK
                    </button>
                </div>
            </div>

            {/* Peer Profile Modal */}
            <PeerProfileModal
                isOpen={!!profileUid}
                uid={profileUid}
                onClose={() => setProfileUid(null)}
            />
        </UIContext.Provider>
    );
}
