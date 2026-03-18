import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { X, UserX, MessageSquare, UserPlus, UserCheck, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useUI } from '@/context/UIContext';

interface PeerProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    uid: string | null;
}

interface PeerData {
    name: string;
    photoURL: string;
    roll: string;
    dept: string;
    sem: string;
    section?: string;
    bio: string;
}

type FriendStatus = 'none' | 'sent' | 'received' | 'accepted';

export default function PeerProfileModal({ isOpen, onClose, uid }: PeerProfileModalProps) {
    const { user } = useAuth();
    const { startChat } = useChat();
    const { showAlert, showToast } = useUI();
    const [userData, setUserData] = useState<PeerData | null>(null);
    const [loading, setLoading] = useState(false);
    const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (isOpen && uid && user) {
            fetchData();
        } else {
            setUserData(null);
            setFriendStatus('none');
        }
    }, [isOpen, uid, user]);

    const fetchData = async () => {
        if (!uid || !user) return;
        setLoading(true);
        try {
            // Fetch User Profile
            const userDoc = await getDoc(doc(db, 'students', uid));
            if (userDoc.exists()) {
                setUserData(userDoc.data() as PeerData);
            } else {
                // Check teachers? For now assume student
                setUserData(null);
            }

            // Fetch Friend Status
            const friendDoc = await getDoc(doc(db, 'students', user.uid, 'friends', uid));
            if (friendDoc.exists()) {
                const data = friendDoc.data();
                setFriendStatus(data.status as FriendStatus);
            } else {
                setFriendStatus('none');
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFriend = async () => {
        if (!uid || !user) return;
        setActionLoading(true);
        try {
            // Add to my sent
            await setDoc(doc(db, 'students', user.uid, 'friends', uid), {
                status: 'sent',
                timestamp: serverTimestamp()
            });
            // Add to their received
            await setDoc(doc(db, 'students', uid, 'friends', user.uid), {
                status: 'received',
                timestamp: serverTimestamp()
            });
            setFriendStatus('sent');
            showToast('Friend request sent');
        } catch (error) {
            console.error(error);
            showToast('Failed to send request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAcceptFriend = async () => {
        if (!uid || !user) return;
        setActionLoading(true);
        try {
            // Update my status
            await setDoc(doc(db, 'students', user.uid, 'friends', uid), {
                status: 'accepted',
                timestamp: serverTimestamp()
            }, { merge: true });
            // Update their status
            await setDoc(doc(db, 'students', uid, 'friends', user.uid), {
                status: 'accepted',
                timestamp: serverTimestamp()
            }, { merge: true });
            setFriendStatus('accepted');
            showToast('Friend request accepted');
        } catch (error) {
            console.error(error);
            showToast('Failed to accept request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnfriend = async () => {
        if (!uid || !user) return;

        showAlert('Unfriend?', 'Are you sure you want to remove this friend?', 'warning', async () => {
            setActionLoading(true);
            try {
                await deleteDoc(doc(db, 'students', user.uid, 'friends', uid));
                await deleteDoc(doc(db, 'students', uid, 'friends', user.uid));
                setFriendStatus('none');
                showToast('Unfriended successfully');
            } catch (error) {
                console.error(error);
                showToast('Failed to unfriend');
            } finally {
                setActionLoading(false);
            }
        });
    };

    const handleChat = async () => {
        if (uid && userData) {
            await startChat(uid, userData.name, userData.photoURL, userData.dept);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-black border-2 border-black dark:border-zinc-800 w-full max-w-sm p-6 relative shadow-[12px_12px_0px_0px_rgba(255,255,255,0.2)]">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
                >
                    <X className="w-5 h-5 text-black dark:text-white" />
                </button>

                {loading ? (
                    <div className="text-center py-10">
                        <div className="animate-spin w-8 h-8 border-2 border-black dark:border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-sm font-mono opacity-60 text-black dark:text-white">Loading profile...</p>
                    </div>
                ) : userData ? (
                    <div className="flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full border-2 border-black dark:border-white overflow-hidden mb-4 shadow-lg bg-gray-100">
                            <img
                                src={userData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}`}
                                className="w-full h-full object-cover"
                                alt={userData.name}
                                referrerPolicy="no-referrer"
                            />
                        </div>
                        <h2 className="text-2xl font-bold uppercase text-center leading-none mb-1 text-black dark:text-white">{userData.name}</h2>

                        <div className="flex gap-2 mb-4">
                            <span className="text-xs font-mono bg-gray-100 dark:bg-zinc-900 text-black dark:text-zinc-300 px-2 py-1">Roll: {userData.roll}</span>
                        </div>

                        <div className="w-full border-t border-dashed border-gray-300 dark:border-gray-700 my-2"></div>

                        <div className="grid grid-cols-3 w-full gap-4 text-center my-4">
                            {userData.section && (
                                <div className="bg-gray-50 dark:bg-zinc-900 p-2 border border-black dark:border-zinc-700">
                                    <p className="text-[10px] uppercase font-bold text-gray-500">Batch</p>
                                    <p className="font-mono font-bold text-black dark:text-white">{userData.section}</p>
                                </div>
                            )}
                            <div className="bg-gray-50 dark:bg-zinc-900 p-2 border border-black dark:border-zinc-700">
                                <p className="text-[10px] uppercase font-bold text-gray-500">Department</p>
                                <p className="font-mono font-bold text-black dark:text-white">{userData.dept}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-zinc-900 p-2 border border-black dark:border-zinc-700">
                                <p className="text-[10px] uppercase font-bold text-gray-500">Semester</p>
                                <p className="font-mono font-bold text-black dark:text-white">{userData.sem}</p>
                            </div>
                        </div>

                        <div className="w-full mb-6">
                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 text-center">Bio</p>
                            <p className="text-sm font-serif italic text-center opacity-80 min-h-[3rem] text-black dark:text-zinc-300">
                                {userData.bio || 'No bio available.'}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="w-full flex flex-col gap-2">
                            {friendStatus === 'none' && (
                                <button
                                    onClick={handleAddFriend}
                                    disabled={actionLoading}
                                    className="w-full py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase hover:opacity-90 flex items-center justify-center gap-2"
                                >
                                    <UserPlus className="w-4 h-4" /> Add Friend
                                </button>
                            )}

                            {friendStatus === 'sent' && (
                                <button
                                    disabled
                                    className="w-full py-3 bg-gray-200 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500 font-bold uppercase flex items-center justify-center gap-2 cursor-not-allowed"
                                >
                                    <Clock className="w-4 h-4" /> Request Sent
                                </button>
                            )}

                            {friendStatus === 'received' && (
                                <button
                                    onClick={handleAcceptFriend}
                                    disabled={actionLoading}
                                    className="w-full py-3 bg-green-600 text-white font-bold uppercase hover:bg-green-700 flex items-center justify-center gap-2"
                                >
                                    <UserCheck className="w-4 h-4" /> Accept Request
                                </button>
                            )}

                            {friendStatus === 'accepted' && (
                                <>
                                    <button
                                        onClick={handleChat}
                                        className="w-full py-3 bg-blue-600 text-white font-bold uppercase hover:bg-blue-700 flex items-center justify-center gap-2"
                                    >
                                        <MessageSquare className="w-4 h-4" /> Send Message
                                    </button>
                                    <button
                                        onClick={handleUnfriend}
                                        className="w-full py-2 border-2 border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold uppercase text-xs flex items-center justify-center gap-2"
                                    >
                                        <UserX className="w-4 h-4" /> Unfriend
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-red-500 font-bold">User profile not found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
