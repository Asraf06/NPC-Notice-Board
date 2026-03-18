import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { X } from 'lucide-react';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceRect?: DOMRect | null;
}

// Apple's easing curve
const appleEase: [number, number, number, number] = [0.2, 0, 0, 1];

export default function ProfileModal({ isOpen, onClose, sourceRect }: ProfileModalProps) {
    const { userProfile, updateUserProfile } = useAuth();
    const { showAlert } = useUI();
    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (userProfile && isOpen) {
            setName(userProfile.name || '');
            setBio(userProfile.bio || '');
        }
    }, [userProfile, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await updateUserProfile({ name, bio });
            onClose();
        } catch (error) {
            console.error('Profile update failed:', error);
            showAlert('Update Failed', 'Failed to update profile', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate the offset from viewport center to the profile icon
    // This makes the modal literally start at the icon and fly to center
    const initialOffset = useMemo(() => {
        if (!sourceRect) return { x: 0, y: -40 };
        const iconCenterX = sourceRect.left + sourceRect.width / 2;
        const iconCenterY = sourceRect.top + sourceRect.height / 2;
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;
        return {
            x: iconCenterX - viewportCenterX,
            y: iconCenterY - viewportCenterY,
        };
    }, [sourceRect]);

    if (!userProfile) return null;

    const imgUrl = userProfile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name || 'User')}`;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: appleEase }}
                        onClick={onClose}
                    />

                    {/* Modal — flies from profile icon to center */}
                    <div className="fixed inset-0 z-[151] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            className="bg-white dark:bg-black border-2 border-black dark:border-zinc-800 w-full max-w-md p-8 relative shadow-[12px_12px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[12px_12px_0px_0px_rgba(255,255,255,0.1)] pointer-events-auto overflow-hidden"
                            initial={{
                                scale: 0.15,
                                opacity: 0,
                                x: initialOffset.x,
                                y: initialOffset.y,
                                borderRadius: '50%',
                            }}
                            animate={{
                                scale: 1,
                                opacity: 1,
                                x: 0,
                                y: 0,
                                borderRadius: '0px',
                            }}
                            exit={{
                                scale: 0.15,
                                opacity: 0,
                                x: initialOffset.x,
                                y: initialOffset.y,
                                borderRadius: '50%',
                            }}
                            transition={{
                                duration: 0.4,
                                ease: appleEase,
                            }}
                        >
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-black dark:text-white" />
                            </button>

                            {/* Profile Header */}
                            <motion.div
                                className="text-center mb-6"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15, duration: 0.25, ease: appleEase }}
                            >
                                <div className="w-20 h-20 mx-auto rounded-full border-2 border-black dark:border-white overflow-hidden mb-3">
                                    <img id="edit-profile-img" src={imgUrl} className="w-full h-full object-cover" alt="Profile" referrerPolicy="no-referrer" />
                                </div>
                                <h2 className="text-xl font-bold uppercase tracking-wider text-black dark:text-white">My Profile</h2>
                            </motion.div>

                            {/* Form */}
                            <motion.form
                                onSubmit={handleSubmit}
                                className="space-y-4 text-left"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.3, ease: appleEase }}
                            >
                                {/* Read-Only Fields */}
                                <div>
                                    <label className="block text-xs uppercase font-bold mb-1 opacity-60 text-black dark:text-white">Roll</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={userProfile.roll}
                                        className="w-full bg-gray-100 dark:bg-zinc-900 border-2 border-transparent p-2 font-mono opacity-60 cursor-not-allowed text-black dark:text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs uppercase font-bold mb-1 opacity-60 text-black dark:text-white">Batch</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={userProfile.section}
                                            className="w-full bg-gray-100 dark:bg-zinc-900 border-2 border-transparent p-2 font-mono opacity-60 cursor-not-allowed text-black dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase font-bold mb-1 opacity-60 text-black dark:text-white">Dept</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={userProfile.dept}
                                            className="w-full bg-gray-100 dark:bg-zinc-900 border-2 border-transparent p-2 font-mono opacity-60 cursor-not-allowed text-black dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase font-bold mb-1 opacity-60 text-black dark:text-white">Sem</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={userProfile.sem}
                                            className="w-full bg-gray-100 dark:bg-zinc-900 border-2 border-transparent p-2 font-mono opacity-60 cursor-not-allowed text-black dark:text-white"
                                        />
                                    </div>
                                </div>

                                {/* Editable Fields */}
                                <div>
                                    <label className="block text-xs uppercase font-bold mb-1 text-black dark:text-white">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-transparent border-2 border-gray-300 focus:border-black dark:border-zinc-700 dark:focus:border-white p-2 outline-none text-black dark:text-white transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase font-bold mb-1 text-black dark:text-white">Bio</label>
                                    <input
                                        type="text"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Add a bio..."
                                        className="w-full bg-transparent border-2 border-gray-300 focus:border-black dark:border-zinc-700 dark:focus:border-white p-2 outline-none text-black dark:text-white transition-colors"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase mt-2 hover:opacity-90 flex items-center justify-center gap-2 transition-opacity"
                                >
                                    {isLoading ? (
                                        <span>Saving...</span>
                                    ) : (
                                        <span>Update Profile</span>
                                    )}
                                </button>
                            </motion.form>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
