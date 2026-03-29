'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { processQRScan } from '@/lib/attendanceScanner';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function QRScannerModal({ isOpen, onClose }: QRScannerModalProps) {
    const { userProfile } = useAuth();
    const { showAlert } = useUI();
    const [mounted, setMounted] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [statusText, setStatusText] = useState("Initializing camera...");
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(true);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const regionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const initScanner = async () => {
        setError(null);
        setScanning(true);
        setStatusText("Requesting camera access...");
        
        try {
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode("reader");
            }

            const state = scannerRef.current.getState();
            if (state === 2) { // SCANNING
                await scannerRef.current.stop();
            }

            await scannerRef.current.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                async (decodedText) => {
                    if (scannerRef.current?.getState() === 2) {
                        await scannerRef.current.stop();
                    }
                    setScanning(false);
                    setScannedData(decodedText);
                    handleScan(decodedText);
                },
                (errorMessage) => {
                    // Ignore common parse errors
                }
            );
            setStatusText("Point camera at class QR code");
        } catch (err: any) {
            console.error(err);
            setError("Cannot access camera. Please check permissions.");
            setScanning(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setScannedData(null);
            setError(null);
            setTimeout(initScanner, 300); // Give DOM time to render reader div
        } else {
            if (scannerRef.current) {
                const state = scannerRef.current.getState();
                if (state === 2) {
                    scannerRef.current.stop().catch(console.error);
                }
            }
        }
        
        return () => {
            if (scannerRef.current) {
                const state = scannerRef.current.getState();
                if (state === 2) {
                    scannerRef.current.stop().catch(console.error);
                }
            }
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
                onClose(); // Optional: Keep open but show success mark, but let's close to be clean
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
        initScanner();
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
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
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-100 p-6 text-center z-10">
                                <AlertTriangle className="w-12 h-12 text-red-600 mb-2" />
                                <p className="text-black font-bold uppercase text-sm mb-4">{error}</p>
                                <button 
                                    onClick={handleRetry}
                                    className="px-4 py-2 bg-black text-white font-bold tracking-tight uppercase flex items-center gap-2 hover:bg-gray-800"
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
                        <p className="text-center font-mono font-bold text-sm text-black">
                            {statusText}
                        </p>
                    </div>

                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
