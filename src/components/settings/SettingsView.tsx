'use client';

import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, Bell, Info, Download, Check, Smartphone } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { usePwaInstall } from '@/context/PwaInstallContext';
import { useNativeApp } from '@/hooks/useNativeApp';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

export default function SettingsView() {
    const { theme, toggleTheme } = useTheme();
    const { permissionStatus, requestPermission } = useNotifications();
    const { isInstallable, isInstalled, triggerInstall } = usePwaInstall();
    const { userProfile, updateUserProfile } = useAuth();
    const isNativeApp = useNativeApp();
    const [showDeniedGuide, setShowDeniedGuide] = useState(false);

    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0';

    const handleInstallClick = async () => {
        await triggerInstall();
    };

    const handleNotificationEnable = async () => {
        if (permissionStatus === 'denied') {
            setShowDeniedGuide(true);
            return;
        }
        await requestPermission();
        if (Notification.permission === 'denied') {
            setShowDeniedGuide(true);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-8 md:py-10 pb-8 md:pb-10">
                {/* Page Title */}
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                        Settings
                    </h1>
                    <p className="text-sm opacity-50 mt-1 font-mono">Customize your experience</p>
                </div>

                {/* Appearance Section */}
                <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-black mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.05)]">
                    <div className="px-6 py-4 border-b-2 border-black dark:border-zinc-800">
                        <h3 className="font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                            Appearance
                        </h3>
                    </div>
                    <div className="p-6">
                        {/* Dark Mode Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-900 shrink-0">
                                    {theme === 'dark' ? (
                                        <Moon className="w-5 h-5 text-purple-500" />
                                    ) : (
                                        <Sun className="w-5 h-5 text-yellow-500" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-sm uppercase">Dark Mode</p>
                                    <p className="text-xs opacity-50">
                                        {theme === 'dark' ? 'Dark theme is active' : 'Light theme is active'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={toggleTheme}
                                className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                                    theme === 'dark' ? 'bg-purple-600' : 'bg-gray-300'
                                }`}
                            >
                                <div
                                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                                        theme === 'dark' ? 'translate-x-[30px]' : 'translate-x-[4px]'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Theme Preview */}
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <button
                                onClick={() => theme === 'dark' && toggleTheme()}
                                className={`p-4 border-2 transition-all ${
                                    theme === 'light'
                                        ? 'border-black dark:border-white bg-gray-50 dark:bg-zinc-900'
                                        : 'border-gray-200 dark:border-zinc-800 hover:border-gray-400 dark:hover:border-zinc-600'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Sun className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase">Light</span>
                                </div>
                                <div className="h-8 bg-white border border-gray-200 rounded-sm" />
                            </button>
                            <button
                                onClick={() => theme === 'light' && toggleTheme()}
                                className={`p-4 border-2 transition-all ${
                                    theme === 'dark'
                                        ? 'border-black dark:border-white bg-gray-50 dark:bg-zinc-900'
                                        : 'border-gray-200 dark:border-zinc-800 hover:border-gray-400 dark:hover:border-zinc-600'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Moon className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase">Dark</span>
                                </div>
                                <div className="h-8 bg-zinc-900 border border-zinc-700 rounded-sm" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notifications Section */}
                <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-black mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.05)]">
                    <div className="px-6 py-4 border-b-2 border-black dark:border-zinc-800">
                        <h3 className="font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                            <Bell className="w-4 h-4" />
                            Notifications
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-900 shrink-0">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm uppercase">Push Notifications</p>
                                    <p className="text-xs opacity-50">
                                        {permissionStatus === 'granted'
                                            ? 'Notifications are enabled'
                                            : permissionStatus === 'denied'
                                            ? 'Notifications are blocked'
                                            : 'Enable push notifications'}
                                    </p>
                                </div>
                            </div>
                            {permissionStatus !== 'granted' && (
                                <div className="flex items-center gap-2">
                                    {permissionStatus === 'denied' && (
                                        <span className="text-xs font-bold uppercase text-red-500 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                                            Blocked
                                        </span>
                                    )}
                                    <button
                                        onClick={handleNotificationEnable}
                                        className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black text-xs font-bold uppercase hover:opacity-80 transition-opacity"
                                    >
                                        Enable
                                    </button>
                                </div>
                            )}
                            {permissionStatus === 'granted' && (
                                <span className="text-xs font-bold uppercase text-green-600 dark:text-green-400 px-3 py-1.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                                    Active
                                </span>
                            )}
                        </div>

                        {/* Notice Sound selection area natively */}
                        {isNativeApp && permissionStatus === 'granted' && (
                            <>
                                <div className="mt-6 pt-5 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-900 shrink-0">
                                            <Bell className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm uppercase">Notice Ringtone</p>
                                            <p className="text-xs opacity-50">Use alternate sound for notices</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newValue = userProfile?.noticeSound === 'notice_alternate' ? 'notice_default' : 'notice_alternate';
                                            updateUserProfile({ noticeSound: newValue });
                                        }}
                                        className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                                            userProfile?.noticeSound === 'notice_alternate' ? 'bg-purple-600' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div
                                            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                                                userProfile?.noticeSound === 'notice_alternate' ? 'translate-x-[30px]' : 'translate-x-[4px]'
                                            }`}
                                        />
                                    </button>
                                </div>
                                
                                {/* Message Sound selection area natively */}
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-900 shrink-0">
                                            <Bell className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm uppercase">Message Ringtone</p>
                                            <p className="text-xs opacity-50">Use alternate sound for chats</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newValue = userProfile?.messageSound === 'message_alternate' ? 'message_default' : 'message_alternate';
                                            updateUserProfile({ messageSound: newValue });
                                        }}
                                        className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                                            userProfile?.messageSound === 'message_alternate' ? 'bg-purple-600' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div
                                            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                                                userProfile?.messageSound === 'message_alternate' ? 'translate-x-[30px]' : 'translate-x-[4px]'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </>
                        )}

                        {showDeniedGuide && permissionStatus === 'denied' && (
                            <div className="mt-6 p-4 border-2 border-red-500/30 bg-red-50 dark:bg-red-950/20">
                                <h4 className="font-bold text-sm uppercase italic text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                                    <Info className="w-4 h-4" /> Action Required
                                </h4>
                                <p className="text-xs opacity-80 mb-3 font-medium">
                                    Your browser has permanently blocked notifications for this site. We cannot show the prompt again. To enable them:
                                </p>
                                <ol className="list-decimal list-inside space-y-2 opacity-80 text-xs font-mono ml-2">
                                    <li>Click the lock icon (🔒) or settings icon in your browser's address bar.</li>
                                    <li>Find "Notifications" in the site settings.</li>
                                    <li>Change the permission from "Block" to "Allow" or "Ask".</li>
                                    <li>Reload this page.</li>
                                </ol>
                                <button 
                                    onClick={() => setShowDeniedGuide(false)}
                                    className="mt-4 text-[10px] font-bold uppercase underline opacity-60 hover:opacity-100"
                                >
                                    Dismiss Guide
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Install App Section — hidden on native apps */}
                {!isNativeApp && (
                <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-black mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.05)]">
                    <div className="px-6 py-4 border-b-2 border-black dark:border-zinc-800">
                        <h3 className="font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                            <Smartphone className="w-4 h-4" />
                            Install App
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-900 shrink-0">
                                    {isInstalled ? (
                                        <Check className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <Download className="w-5 h-5 text-purple-500" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-sm uppercase">
                                        {isInstalled ? 'App Installed' : 'Install on Device'}
                                    </p>
                                    <p className="text-xs opacity-50">
                                        {isInstalled
                                            ? 'NPC Notice Board is installed on your device'
                                            : isInstallable
                                            ? 'Get the full app experience on your device'
                                            : 'Open in a supported browser to install'}
                                    </p>
                                </div>
                            </div>
                            {isInstalled ? (
                                <span className="text-xs font-bold uppercase text-green-600 dark:text-green-400 px-3 py-1.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                                    Installed
                                </span>
                            ) : isInstallable ? (
                                <button
                                    onClick={handleInstallClick}
                                    className="px-4 py-2 bg-purple-600 text-white text-xs font-bold uppercase hover:opacity-80 transition-opacity flex items-center gap-1.5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Install
                                </button>
                            ) : (
                                <span className="text-xs font-bold uppercase opacity-40 px-3 py-1.5 border border-gray-200 dark:border-zinc-800">
                                    N/A
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                )}

                {/* About Section */}
                <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.05)]">
                    <div className="px-6 py-4 border-b-2 border-black dark:border-zinc-800">
                        <h3 className="font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            About
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Version</span>
                            <span className="text-sm font-mono opacity-50">{appVersion}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
