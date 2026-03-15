"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset, checkActionCode } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Loader2, CheckCircle2, XCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

function ActionHandlerContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'reset-password'>('loading');
    const [message, setMessage] = useState('Verifying your request...');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [actionCode, setActionCode] = useState<string | null>(null);

    useEffect(() => {
        const mode = searchParams.get('mode');
        const code = searchParams.get('oobCode');

        if (!mode || !code) {
            setStatus('error');
            setMessage('Invalid verification link. Please request a new one.');
            return;
        }

        setActionCode(code);

        const handleVerifyEmail = async () => {
            try {
                await applyActionCode(auth, code);
                setStatus('success');
                setMessage('Your email has been successfully verified! You can now log in.');
            } catch (error: any) {
                setStatus('error');
                setMessage(error.message || 'Failed to verify email. The link might be expired.');
            }
        };

        const handleResetPassword = async () => {
            try {
                // First verify the code is valid before asking for new password
                await verifyPasswordResetCode(auth, code);
                setStatus('reset-password');
                setMessage('Please enter your new password.');
            } catch (error: any) {
                setStatus('error');
                setMessage(error.message || 'Invalid or expired password reset link.');
            }
        };

        const handleRecoverEmail = async () => {
            try {
                await checkActionCode(auth, code);
                await applyActionCode(auth, code);
                setStatus('success');
                setMessage('Your email change has been successfully reversed.');
            } catch (error: any) {
                setStatus('error');
                setMessage(error.message || 'Failed to recover email.');
            }
        };

        // Execute based on mode
        switch (mode) {
            case 'verifyEmail':
                handleVerifyEmail();
                break;
            case 'resetPassword':
                handleResetPassword();
                break;
            case 'recoverEmail':
                handleRecoverEmail();
                break;
            default:
                setStatus('error');
                setMessage('Unknown action mode.');
        }
    }, [searchParams]);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            setMessage("Passwords don't match!");
            return;
        }

        if (newPassword.length < 6) {
            setMessage("Password must be at least 6 characters.");
            return;
        }

        if (!actionCode) return;

        setStatus('loading');
        setMessage('Resetting your password...');

        try {
            await confirmPasswordReset(auth, actionCode, newPassword);
            setStatus('success');
            setMessage('Your password has been reset successfully. You can now log in.');
        } catch (error: any) {
            setStatus('error');
            setMessage(error.message || 'Failed to reset password. Please try again.');
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-mono-50 dark:bg-zinc-900 p-4 selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-300">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white dark:bg-black border-2 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] p-8 relative overflow-hidden"
            >
                {/* Decorative dots grid pattern */}
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
                     style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '16px 16px' }} />

                <div className="relative z-10 text-center">
                    {status === 'loading' && (
                        <div className="py-8">
                            <Loader2 className="w-12 h-12 mx-auto animate-spin mb-6 text-black dark:text-white" />
                            <h2 className="text-2xl font-black uppercase tracking-tight mb-2 text-black dark:text-white">Processing...</h2>
                            <p className="text-gray-600 dark:text-gray-400 font-medium">{message}</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="py-6">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-6 border-2 border-green-600">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tight mb-3 text-black dark:text-white">Success!</h2>
                            <p className="text-gray-600 dark:text-gray-300 font-medium mb-8 leading-relaxed max-w-xs mx-auto">
                                {message}
                            </p>
                            <Link href="/login" 
                                  className="group flex items-center justify-center gap-2 w-full py-4 bg-black text-white dark:bg-white dark:text-black font-bold uppercase tracking-wider hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors border-2 border-transparent">
                                Go to Login
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="py-6">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 text-red-600 mb-6 border-2 border-red-600">
                                <XCircle className="w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tight mb-3 text-black dark:text-white">Failed</h2>
                            <p className="text-gray-600 dark:text-gray-300 font-medium mb-8 leading-relaxed max-w-xs mx-auto">
                                {message}
                            </p>
                            <Link href="/login" 
                                  className="group flex items-center justify-center gap-2 w-full py-4 bg-black text-white dark:bg-white dark:text-black font-bold uppercase tracking-wider hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors border-2 border-transparent">
                                Return to Login
                            </Link>
                        </div>
                    )}

                    {status === 'reset-password' && (
                        <div className="py-4 text-left">
                            <h2 className="text-2xl font-black uppercase tracking-tight mb-2 text-black dark:text-white text-center">Reset Password</h2>
                            <p className="text-gray-600 dark:text-gray-400 font-medium mb-6 text-center text-sm">
                                {message}
                            </p>

                            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 focus:border-black dark:focus:border-white focus:outline-none transition-colors text-black dark:text-white font-medium"
                                        placeholder="Min. 6 characters"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 focus:border-black dark:focus:border-white focus:outline-none transition-colors text-black dark:text-white font-medium"
                                        placeholder="Repeat new password"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                
                                <button
                                    type="submit"
                                    className="w-full py-4 mt-6 bg-black text-white dark:bg-white dark:text-black font-bold uppercase tracking-wider hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors border-2 border-transparent"
                                >
                                    Update Password
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

export default function ActionHandlerPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-mono-50 dark:bg-zinc-900">
                <Loader2 className="w-12 h-12 animate-spin text-black dark:text-white" />
            </div>
        }>
            <ActionHandlerContent />
        </Suspense>
    );
}
