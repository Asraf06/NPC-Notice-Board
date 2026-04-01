'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { processQRScan } from '@/lib/attendanceScanner';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function QRScannerModal({ isOpen, onClose }: QRScannerModalProps) {
    const { userProfile } = useAuth();
    const { showAlert } = useUI();
    const [mounted, setMounted] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [statusText, setStatusText] = useState("Initializing...");
    const [error, setError] = useState<string | null>(null);
    const [permissionGuide, setPermissionGuide] = useState<string | null>(null);
    const [scanning, setScanning] = useState(true);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const regionRef = useRef<HTMLDivElement>(null);
    // Track if we're currently executing the start process
    const isStartingRef = useRef(false);

    useEffect(() => {
        setMounted(true);
        return () => {
            // ultimate destruction cleanup
            stopScannerSafe();
            setMounted(false);
        };
    }, []);

    const stopScannerSafe = async () => {
        if (!scannerRef.current) return;
        try {
            const state = scannerRef.current.getState();
            // State 2 = SCANNING
            if (state === 2) {
                await scannerRef.current.stop();
            }
        } catch (e) {
            console.warn("Safely caught html5-qrcode stop transition error:", e);
        }
    };

    const requestPermissions = async (): Promise<boolean> => {
        let hasCamera = false;
        let hasLocation = false;
        let errMsg = "Permissions Required";
        let guideMsg = "";

        if (Capacitor.isNativePlatform()) {
            // Android App Flow
            try {
                // Check Camera
                let camStatus = await CapCamera.checkPermissions();
                if (camStatus.camera === 'prompt' || camStatus.camera === 'prompt-with-rationale') {
                    camStatus = await CapCamera.requestPermissions({ permissions: ['camera'] });
                }
                hasCamera = camStatus.camera === 'granted';

                // Check Location
                let locStatus = await Geolocation.checkPermissions();
                if (locStatus.location === 'prompt' || locStatus.location === 'prompt-with-rationale') {
                    locStatus = await Geolocation.requestPermissions();
                }
                hasLocation = locStatus.location === 'granted';

                if (!hasCamera || !hasLocation) {
                    guideMsg = "APP GUIDE: Open your device Settings > Apps > Notice Board > Permissions. Allow BOTH Camera and Location access to scan.";
                }
            } catch (e: any) {
                console.error('Capacitor permission error:', e);
                guideMsg = "Failed to request permissions automatically. Please check your device settings and manually allow Camera and Location.";
            }
        } else {
            // Web Browser Flow
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                stream.getTracks().forEach(track => track.stop()); // Stop immediately
                hasCamera = true;
            } catch (e) {
                hasCamera = false;
            }

            try {
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 0 });
                });
                hasLocation = true;
            } catch (e) {
                hasLocation = false;
            }

            if (!hasCamera || !hasLocation) {
                guideMsg = "WEBSITE GUIDE: Click the lock icon (🔒) or site settings icon in your web browser address bar. Set BOTH Camera and Location to 'Allow', then click Try Again.";
            }
        }

        if (!hasCamera || !hasLocation) {
            let missing = [];
            if (!hasCamera) missing.push("Camera");
            if (!hasLocation) missing.push("Location");
            setError(`Missing: ${missing.join(" & ")}`);
            setPermissionGuide(guideMsg);
            return false;
        }

        return true;
    };

    const initScanner = async (checkCancelled: () => boolean) => {
        // Prevent overlapping starts
        if (isStartingRef.current) return;
        isStartingRef.current = true;

        setError(null);
        setScanning(true);
        setStatusText("Requesting permissions...");
        
        try {
            if (checkCancelled()) return;
            const hasPermission = await requestPermissions();
            if (!hasPermission || checkCancelled()) {
                setScanning(false);
                return;
            }

            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode("reader");
            }

            await stopScannerSafe();
            if (checkCancelled()) return;

            await scannerRef.current.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                async (decodedText) => {
                    await stopScannerSafe();
                    setScanning(false);
                    setScannedData(decodedText);
                    handleScan(decodedText);
                },
                (errorMessage) => {
                    // Ignore common parse errors silently
                }
            );
            
            if (checkCancelled()) {
                 await stopScannerSafe();
                 return;
            }
            setStatusText("Point camera at class QR code");
        } catch (err: any) {
            if (!checkCancelled()) {
                console.error("html5-qrcode start failed:", err);
                setError("Cannot access camera. Please check permissions.");
                setScanning(false);
            }
        } finally {
            isStartingRef.current = false;
        }
    };

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        let isCancelled = false;

        if (isOpen) {
            setScannedData(null);
            setError(null);
            setPermissionGuide(null);
            // Delay start so animations and #reader can mount
            timeoutId = setTimeout(() => {
                if (!isCancelled) initScanner(() => isCancelled);
            }, 350); 
        } else {
            isCancelled = true;
            // Component is closing, gracefully stop if running
            setTimeout(stopScannerSafe, 500); // Give start time to finish if it just fired
        }
        
        return () => {
            isCancelled = true;
            clearTimeout(timeoutId);
        };
    }, [isOpen]);

    const handleScan = async (qrText: string) => {
        if (!userProfile) return;
        
        try {
            const result = await processQRScan(qrText, userProfile, (msg) => {
                setStatusText(msg);
            });
            
            if (result.success) {
                showAlert("Success", "Attendance recorded!", "success");
                onClose();
            } else {
                setError(result.message);
                setStatusText("Scan Failed");
            }
        } catch (err: any) {
            setError(err.message || "Unknown error occurred.");
            setStatusText("Error");
        }
    };

    const handleRetry = () => {
        setScannedData(null);
        setError(null);
        setPermissionGuide(null);
        initScanner(() => false);
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="qr-scanner-modal"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md"
                >
                    {/* Header Actions */}
                    <div className="absolute top-4 right-4 flex gap-4 z-10">
                        <button
                            onClick={onClose}
                            className="bg-red-500 border-2 border-black p-2 shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all rounded-none"
                        >
                            <X className="w-6 h-6 text-black" />
                        </button>
                    </div>

                    <div className="w-full max-w-sm flex flex-col items-center">
                        <h2 className="text-2xl font-black uppercase text-white tracking-tighter mb-6 flex items-center gap-2">
                            <Camera className="w-6 h-6 text-[#00ff00]" />
                            Scan Attendance
                        </h2>

                        {/* Scanner Container */}
                        <div className="relative w-[300px] h-[300px] bg-white border-4 border-black shadow-[8px_8px_0_0_#00ff00] mb-8 overflow-hidden rounded-none flex items-center justify-center group">
                            
                            {error ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-100 p-4 text-center z-10 overflow-y-auto">
                                    <AlertTriangle className="w-10 h-10 text-red-600 mb-2 shrink-0" />
                                    <p className="text-black font-bold uppercase text-sm mb-2 shrink-0">{error}</p>
                                    {permissionGuide && (
                                        <div className="bg-white/80 p-3 mb-4 border-2 border-red-200 shadow-[2px_2px_0_0_rgba(220,38,38,0.5)]">
                                            <p className="text-xs font-mono font-bold text-red-900 leading-tight">
                                                {permissionGuide}
                                            </p>
                                        </div>
                                    )}
                                    <button 
                                        onClick={handleRetry}
                                        className="px-4 py-2 bg-black text-white font-bold tracking-tight uppercase flex items-center gap-2 hover:bg-gray-800 shrink-0"
                                    >
                                        <RefreshCcw className="w-4 h-4" /> Try Again
                                    </button>
                                </div>
                            ) : !scanning && scannedData && !error ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-100 p-6 text-center z-10">
                                    <CheckCircle2 className="w-12 h-12 text-green-600 mb-2" />
                                    <p className="text-black font-bold uppercase text-sm">Validating...</p>
                                </div>
                            ) : null}

                            <div id="reader" className="w-full h-full object-cover z-0" ref={regionRef}></div>
                            
                            {/* Scanning Overlay Animation */}
                            {scanning && !error && (
                                <div className="absolute inset-0 pointer-events-none z-10 border-[6px] border-[#00ff00]/50" />
                            )}
                            {scanning && !error && (
                                <motion.div 
                                    className="absolute left-0 right-0 h-1 bg-[#00ff00] shadow-[0_0_10px_#00ff00] z-20 pointer-events-none"
                                    animate={{ top: ['0%', '100%', '0%'] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                />
                            )}
                        </div>

                        <div className="bg-white border-2 border-black p-4 w-[300px] shadow-[4px_4px_0_0_#fff]">
                            <p className="text-center font-mono font-bold text-sm text-black inline-block min-h-[20px]">
                                {statusText}
                            </p>
                        </div>

                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
