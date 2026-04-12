'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Plus, Trash2, Loader2, Info, UserCheck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { useRef } from 'react';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

interface ManageBoardRollsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface RollItem {
    value: string;
    addedBy: string;
    addedByName: string;
    type: string;
    timestamp: number;
}

export default function ManageBoardRollsModal({ isOpen, onClose }: ManageBoardRollsModalProps) {
    const { userProfile } = useAuth();
    const { showAlert } = useUI();
    const [rolls, setRolls] = useState<RollItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRolls, setSelectedRolls] = useState<Set<string>>(new Set());
    const [newRoll, setNewRoll] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [strictMode, setStrictMode] = useState(false);
    const [strictModeRequestPending, setStrictModeRequestPending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    useSmoothScroll(scrollRef);

    const docId = userProfile ? `${userProfile.section}_${userProfile.dept}_${userProfile.sem}` : '';

    useEffect(() => {
        if (!isOpen || !docId) return;
        fetchRolls();
    }, [isOpen, docId]);

    const fetchRolls = async () => {
        setIsLoading(true);
        try {
            const ref = doc(db, 'class_rolls', docId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const classData = snap.data();
                setStrictMode(classData.strictMode === true);
                
                const reqSnap = await getDoc(doc(db, 'strict_mode_requests', docId));
                setStrictModeRequestPending(reqSnap.exists() && reqSnap.data().status === 'pending');

                const data = classData.rolls || [];
                // Normalize data
                const normalized = data.map((r: any) => {
                    if (typeof r === 'object') return r;
                    return { value: r.toString(), type: 'Legacy', addedByName: 'Unknown' };
                }).sort((a: RollItem, b: RollItem) => Number(a.value) - Number(b.value));
                setRolls(normalized);
            } else {
                setRolls([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddRoll = async () => {
        if (!newRoll.trim() || !userProfile || !docId) return;
        setIsSubmitting(true);

        const rollStrs = newRoll.split(/[\n, \t]+/).map(r => r.replace(/[^0-9]/g, '')).filter(r => r.length > 0);
        const uniqueRolls = [...new Set(rollStrs)];
        
        if (uniqueRolls.length === 0) {
             showAlert('Error', 'No valid numerical board rolls found in input.', 'error');
             setIsSubmitting(false);
             return;
        }

        const timestamp = Date.now();

        try {
            const ref = doc(db, 'class_rolls', docId);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                const currentRolls = snap.data().rolls || [];
                const existingRollValues = currentRolls.map((r: any) => typeof r === 'object' ? r.value : r.toString());
                
                const newRollsToAdd = uniqueRolls.filter(r => !existingRollValues.includes(r));

                if (newRollsToAdd.length === 0) {
                    showAlert('Info', 'All entered rolls are already in the list.', 'info');
                    setNewRoll('');
                    setIsSubmitting(false);
                    return;
                }

                const rollObjs: RollItem[] = newRollsToAdd.map((roll, i) => ({
                    value: roll,
                    addedBy: userProfile.uid,
                    addedByName: userProfile.name || 'CR',
                    type: 'CR',
                    timestamp: timestamp + i
                }));

                await updateDoc(ref, {
                    rolls: arrayUnion(...rollObjs)
                });
                
                showAlert('Success', `Added ${newRollsToAdd.length} new roll(s).`, 'success');
            } else {
                const rollObjs: RollItem[] = uniqueRolls.map((roll, i) => ({
                    value: roll,
                    addedBy: userProfile.uid,
                    addedByName: userProfile.name || 'CR',
                    type: 'CR',
                    timestamp: timestamp + i
                }));
            
                await setDoc(ref, {
                    dept: userProfile.dept,
                    sem: userProfile.sem,
                    rolls: rollObjs
                });
                
                showAlert('Success', `Added ${uniqueRolls.length} roll(s).`, 'success');
            }

            setNewRoll('');
            fetchRolls();
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to add roll(s).', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveRoll = async (rollVal: string) => {
        if (!docId) return;
        if (!confirm(`Remove roll ${rollVal} from allowed list?`)) return;

        try {
            const ref = doc(db, 'class_rolls', docId);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;

            const existingRolls = snap.data().rolls || [];
            const updatedRolls = existingRolls.filter((r: any) => {
                const v = typeof r === 'object' ? r.value : r;
                return v.toString() !== rollVal.toString();
            });

            await updateDoc(ref, { rolls: updatedRolls });
            fetchRolls();
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to remove roll.', 'error');
        }
    };

    const handleCheckUser = async (rollVal: string) => {
        try {
            const q = query(collection(db, 'users'), where('boardRoll', '==', rollVal.toString()));
            const snap = await getDocs(q);

            if (snap.empty) {
                showAlert('User Not Found', `No user registered with board roll ${rollVal}.`, 'info');
            } else {
                let msg = '';
                snap.forEach(doc => {
                    const data = doc.data();
                    msg += `Name: ${data.name || 'N/A'}\nEmail: ${data.email || data.parentEmail || 'N/A'}\nDept & Sem: ${data.dept || 'N/A'}, ${data.sem || 'N/A'}\nStatus: ${data.role || 'user'}\n\n`;
                });
                showAlert(`User Details (Roll: ${rollVal})`, msg.trim(), 'info');
            }
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to check user details.', 'error');
        }
    };

    const filteredRolls = rolls.filter(r => r.value.includes(searchQuery));

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedRolls(new Set(filteredRolls.map(r => r.value)));
        } else {
            setSelectedRolls(new Set());
        }
    };

    const handleSelectRoll = (rollVal: string) => {
        const newSet = new Set(selectedRolls);
        if (newSet.has(rollVal)) newSet.delete(rollVal);
        else newSet.add(rollVal);
        setSelectedRolls(newSet);
    };

    const handleDeleteSelected = async () => {
        if (!docId || selectedRolls.size === 0) return;
        if (!confirm(`Delete ${selectedRolls.size} selected rolls?`)) return;
        setIsLoading(true);
        try {
            const ref = doc(db, 'class_rolls', docId);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;
            const existingRolls = snap.data().rolls || [];
            const updatedRolls = existingRolls.filter((r: any) => {
                const v = typeof r === 'object' ? r.value : r.toString();
                return !selectedRolls.has(v.toString());
            });
            await updateDoc(ref, { rolls: updatedRolls });
            setSelectedRolls(new Set());
            fetchRolls();
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to delete rolls.', 'error');
            setIsLoading(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!docId || rolls.length === 0) return;
        if (!confirm(`DANGER: Are you sure you want to delete ALL ${rolls.length} rolls for this section?`)) return;
        setIsLoading(true);
        try {
            const ref = doc(db, 'class_rolls', docId);
            await updateDoc(ref, { rolls: [] });
            setSelectedRolls(new Set());
            fetchRolls();
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to delete all rolls.', 'error');
            setIsLoading(false);
        }
    };

    const requestStrictMode = async () => {
        if (!docId || !userProfile) return;
        if (!confirm('Request Admin to enable Strict Mode? This will restrict registration to only the board rolls in this list.')) return;
        
        try {
            await setDoc(doc(db, 'strict_mode_requests', docId), {
                docId,
                dept: userProfile.dept,
                sem: userProfile.sem,
                section: userProfile.section,
                requestedBy: userProfile.name || 'CR',
                requestedByUid: userProfile.uid,
                status: 'pending',
                timestamp: Date.now()
            });
            setStrictModeRequestPending(true);
            showAlert('Success', 'Strict mode request sent to admin.', 'success');
        } catch (err) {
            console.error(err);
            showAlert('Error', 'Failed to send request.', 'error');
        }
    };

    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-md p-6 relative shadow-[12px_12px_0px_0px_rgba(255,255,255,0.2)] max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors">
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-xl font-bold uppercase mb-2 pr-10 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6" /> Allowed Rolls
                    </span>
                    <span className="text-sm font-mono bg-black text-white dark:bg-white dark:text-black px-2 py-0.5 rounded">
                        {rolls.length}
                    </span>
                </h2>
                <p className="text-xs font-mono opacity-60 mb-4 border-b pb-2">
                    Managing: {userProfile?.dept} {userProfile?.sem}
                </p>

                {/* Strict Mode Banner */}
                <div className={`mb-4 p-3 border-2 text-xs font-mono flex flex-col gap-2 ${strictMode ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400' : 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'}`}>
                    <div className="flex items-center justify-between font-bold uppercase tracking-wider">
                        <span>Strict Mode: {strictMode ? 'ON' : 'OFF'}</span>
                        <ShieldCheck className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] leading-tight opacity-80">
                        {strictMode 
                            ? "Strict mode is active. Only users matching this list can register or login." 
                            : "Registration is open to all rolls. To lock this list down, send a request to the Admin."}
                    </p>
                    {!strictMode && (
                        <button 
                            onClick={requestStrictMode}
                            disabled={strictModeRequestPending}
                            className={`mt-1 py-1.5 px-3 border-2 font-bold uppercase text-[10px] transition-colors ${strictModeRequestPending ? 'border-gray-400 text-gray-500 bg-gray-100 dark:bg-transparent dark:border-zinc-700 dark:text-zinc-500 cursor-not-allowed' : 'border-amber-600 bg-amber-500 text-white hover:bg-amber-600'}`}
                        >
                            {strictModeRequestPending ? 'Request Pending...' : 'Request Strict Mode'}
                        </button>
                    )}
                </div>

                {/* Add Roll Form */}
                <div className="flex items-center justify-between mb-2 mt-2">
                    <p className="text-[10px] uppercase font-bold opacity-60">Add Roll Number(s)</p>
                    <div className="group relative inline-block">
                        <Info className="w-3 h-3 opacity-50 cursor-help" />
                        <div className="hidden group-hover:block absolute z-10 w-48 p-2 mt-1 -ml-40 text-[10px] text-white bg-black border border-white/20 shadow-lg">
                            <p className="font-bold mb-1 uppercase border-b border-white/20 pb-1">Formats</p>
                            <p className="opacity-80 mb-1 leading-snug">Paste comma, space, or newline separated rolls.</p>
                            <p className="font-mono bg-white/10 p-1">101, 102<br/>or<br/>101<br/>102</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 mb-4">
                    <textarea
                        rows={2}
                        value={newRoll}
                        onChange={e => setNewRoll(e.target.value)}
                        placeholder="e.g. 101, 102 or Paste..."
                        className="flex-1 p-2 border-2 border-black dark:border-white bg-transparent font-mono font-bold outline-none focus:ring-2 focus:ring-purple-500 resize-y min-h-[46px] custom-scrollbar text-sm"
                    />
                    <button
                        onClick={handleAddRoll}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-bold uppercase hover:opacity-80 disabled:opacity-50 flex items-center justify-center shrink-0"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    </button>
                </div>

                {/* Actions & Search */}
                {rolls.length > 0 && (
                    <div className="flex flex-col gap-2 mb-2">
                        <input
                            type="text"
                            placeholder="Search board rolls..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full p-2 text-sm border-2 border-gray-200 dark:border-zinc-800 bg-transparent outline-none font-mono focus:border-black dark:focus:border-white transition-colors"
                        />
                        <div className="flex justify-between items-center bg-gray-100 dark:bg-zinc-800 p-2 text-xs font-mono">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filteredRolls.length > 0 && selectedRolls.size === filteredRolls.length}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 cursor-pointer accent-black dark:accent-white"
                                />
                                Select All
                            </label>
                            <div className="flex gap-2">
                                {selectedRolls.size > 0 && (
                                    <button onClick={handleDeleteSelected} className="px-2 py-1 bg-red-500 text-white font-bold uppercase text-[10px] hover:bg-red-600 transition-colors border border-red-600">
                                        Delete Selected
                                    </button>
                                )}
                                <button onClick={handleDeleteAll} className="px-2 py-1 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold uppercase text-[10px] transition-colors">
                                    Delete All
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* List */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-zinc-800 p-2 bg-gray-50 dark:bg-zinc-900/50">
                    <div className="locomotive-content-wrapper">
                        {isLoading ? (
                            <div className="text-center opacity-50 py-8 font-mono text-sm">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                Loading...
                            </div>
                        ) : filteredRolls.length > 0 ? (
                            <div className="space-y-2">
                                {filteredRolls.map((r, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-black border border-gray-200 dark:border-zinc-800">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedRolls.has(r.value)}
                                                onChange={() => handleSelectRoll(r.value)}
                                                className="w-4 h-4 cursor-pointer accent-black dark:accent-white"
                                            />
                                            <div>
                                                <span className="font-mono font-bold block leading-none">{r.value}</span>
                                                <span className="text-[9px] opacity-50 font-mono uppercase">
                                                    {r.type} {r.addedByName !== 'Unknown' && `by ${r.addedByName}`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <button onClick={() => handleCheckUser(r.value)} className="text-blue-500 hover:text-blue-700 transition-colors" title="Check Registered User">
                                                <UserCheck className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleRemoveRoll(r.value)} className="text-red-500 hover:text-red-700 transition-colors" title="Delete Roll">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : rolls.length > 0 ? (
                            <div className="text-center opacity-50 py-8 font-mono text-sm">
                                No matching rolls found.
                            </div>
                        ) : (
                            <div className="text-center opacity-50 py-8 font-mono text-sm">
                                <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                No specific rolls set.<br />Anyone can register (Default).
                            </div>
                        )}
                    </div>
                </div>

                <p className="text-[10px] opacity-40 mt-2 font-mono text-center">
                    Only listed rolls can register for this Dept/Sem.
                </p>
            </div>
        </div>,
        document.body
    );
}
