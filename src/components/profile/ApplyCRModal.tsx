'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Phone, Link as LinkIcon, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';

interface ApplyCRModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ApplyCRModal({ isOpen, onClose }: ApplyCRModalProps) {
    const { userProfile } = useAuth();
    const { showAlert, showToast } = useUI();
    const [whatsapp, setWhatsapp] = useState('');
    const [socialLink, setSocialLink] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !userProfile) return null;
    if (typeof document === 'undefined') return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!whatsapp.trim() || !socialLink.trim()) {
            showAlert('Required Fields', 'Both WhatsApp number and a social profile link are required.', 'error');
            return;
        }

        setIsSubmitting(true);

        try {
            // Document ID is the user's UID so they can only have 1 active application
            await setDoc(doc(db, 'cr_applications', userProfile.uid), {
                uid: userProfile.uid,
                name: userProfile.name,
                roll: userProfile.roll,
                dept: userProfile.dept,
                sem: userProfile.sem,
                section: userProfile.section,
                whatsapp: whatsapp.trim(),
                socialLink: socialLink.trim(),
                status: 'pending',
                timestamp: serverTimestamp()
            });

            showToast('CR Application submitted successfully!');
            onClose();
        } catch (error) {
            console.error('Error submitting application:', error);
            showAlert('Submission Failed', 'Could not send request. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-black w-full max-w-sm border-2 border-black dark:border-zinc-800 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] flex flex-col">
                <div className="px-4 py-3 border-b-2 border-black dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-900">
                    <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Apply for CR
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 font-mono text-xs opacity-70 border-b border-gray-200 dark:border-zinc-800 pb-4">
                    As a Class Representative, you will be responsible for managing your class's Allowed Rolls list and creating official notices. 
                    <br/><br/>
                    Please provide your contact info so the Admin can verify your identity.
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">WhatsApp Number</label>
                        <div className="relative">
                            <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                            <input
                                type="text"
                                value={whatsapp}
                                onChange={e => setWhatsapp(e.target.value)}
                                placeholder="e.g. +8801XXXXXXXXX"
                                className="w-full bg-transparent border-2 border-black dark:border-zinc-700 p-2 pl-9 outline-none text-sm font-mono focus:border-purple-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">Facebook / Profile Link</label>
                        <div className="relative">
                            <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                            <input
                                type="url"
                                value={socialLink}
                                onChange={e => setSocialLink(e.target.value)}
                                placeholder="https://facebook.com/..."
                                className="w-full bg-transparent border-2 border-black dark:border-zinc-700 p-2 pl-9 outline-none text-sm focus:border-purple-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border-2 border-black dark:border-zinc-700 font-bold uppercase text-sm hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase text-sm flex justify-center items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
