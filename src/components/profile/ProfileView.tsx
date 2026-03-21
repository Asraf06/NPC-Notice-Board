'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { Shield, Mail, Hash, Building2, BookOpen, Users, Camera, Trash2, Edit2, X, Check, Loader2 } from 'lucide-react';
import { secureUploadWithProgress, deleteUploadedFiles } from '@/lib/uploadService';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/cropImage';

export default function ProfileView() {
    const { user, userProfile, updateUserProfile } = useAuth();
    const { showAlert, showToast } = useUI();
    
    // Editing states
    const [isEditingName, setIsEditingName] = useState(false);
    const [name, setName] = useState(userProfile?.name || '');
    
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bio, setBio] = useState(userProfile?.bio || '');

    // Upload states
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Crop states
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    if (!userProfile) return null;

    const imgUrl = userProfile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name || 'User')}&background=000&color=fff&size=200`;
    const hasGooglePhoto = !!user?.photoURL;

    const compressImage = (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 400; // Optimal size for DP
                    const MAX_HEIGHT = 400;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                        else reject(new Error("Compression failed"));
                    }, 'image/jpeg', 0.85);
                };
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.addEventListener('load', () => setImageSrc(reader.result?.toString() || null));
        reader.readAsDataURL(file);
        
        if(fileInputRef.current) fileInputRef.current.value = '';
    };

    const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleConfirmCrop = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const croppedImageFile = await getCroppedImg(imageSrc, croppedAreaPixels);
            if (!croppedImageFile) throw new Error("Could not crop image");

            const compressedFile = await compressImage(croppedImageFile);
            
            // Generate user specific folder path for profile pictures
            const folderPath = `/profile/${userProfile.uid}`;
            const result = await secureUploadWithProgress(compressedFile, setUploadProgress, folderPath);

            if (result && result.url) {
                // Delete old profile photo if it exists on ImageKit
                if (userProfile.photoFileId) {
                    await deleteUploadedFiles([{ service: 'imagekit', fileId: userProfile.photoFileId }]);
                }
                
                await updateUserProfile({ photoURL: result.url, photoFileId: result.fileId || undefined });
                showToast('Profile photo updated successfully!');
            } else {
                throw new Error("Upload response was empty");
            }
        } catch (error) {
            console.error('Photo upload failed:', error);
            showAlert('Upload Failed', 'Could not upload your new profile photo', 'error');
        } finally {
            setIsUploading(false);
            setImageSrc(null); // Return to default profile view
            setZoom(1);
        }
    };

    const handleSaveName = async () => {
        if (!name.trim()) return;
        try {
            await updateUserProfile({ name: name.trim() });
            setIsEditingName(false);
            showToast('Name updated');
        } catch {
            showAlert('Error', 'Could not save name', 'error');
        }
    };

    const handleSaveBio = async () => {
        try {
            await updateUserProfile({ bio: bio.trim() });
            setIsEditingBio(false);
            showToast('Bio updated');
        } catch {
            showAlert('Error', 'Could not save bio', 'error');
        }
    };

    const handleRemovePhoto = async (type: 'google' | 'default') => {
        setShowDeleteModal(false);
        try {
            if (userProfile.photoFileId) {
                await deleteUploadedFiles([{ service: 'imagekit', fileId: userProfile.photoFileId }]);
            }

            let newUrl = '';
            if (type === 'google' && user?.photoURL) {
                newUrl = user.photoURL;
            }
            await updateUserProfile({ photoURL: newUrl, photoFileId: undefined });
            showToast('Profile photo removed!');
        } catch (error) {
            console.error(error);
            showAlert('Error', 'Could not remove photo', 'error');
        }
    };

    const infoItems = [
        { label: 'Email', value: userProfile.email, icon: Mail },
        { label: 'Board Roll', value: userProfile.roll, icon: Hash },
        { label: 'Department', value: userProfile.dept, icon: Building2 },
        { label: 'Semester', value: userProfile.sem, icon: BookOpen },
        { label: 'Batch', value: userProfile.section, icon: Users },
    ];

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-8 md:py-10 pb-8 md:pb-10">
                {/* Page Title */}
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                        My Profile
                    </h1>
                    <p className="text-sm opacity-50 mt-1 font-mono">Manage your account details</p>
                </div>

                {/* Crop Modal */}
                {imageSrc && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-black w-full max-w-lg border-2 border-black dark:border-zinc-800 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] flex flex-col max-h-[90vh]">
                            <div className="px-4 py-3 border-b-2 border-black dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-900">
                                <h3 className="font-black uppercase tracking-wider text-sm">Crop Image</h3>
                                <button
                                    onClick={() => { setImageSrc(null); setZoom(1); }}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="relative w-full h-[50vh] md:h-[400px] bg-gray-100 dark:bg-zinc-900">
                                <Cropper
                                    image={imageSrc}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={1}
                                    cropShape="round"
                                    showGrid={false}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                />
                            </div>
                            
                            <div className="p-4 border-t-2 border-black dark:border-zinc-800 flex flex-col gap-4 bg-white dark:bg-black">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold uppercase w-12 text-gray-500">Zoom</span>
                                    <input 
                                        type="range"
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        value={zoom}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="flex-1 accent-black dark:accent-white h-1.5 bg-gray-200 dark:bg-zinc-800 appearance-none rounded-full"
                                    />
                                </div>
                                <div className="flex gap-3 mt-2">
                                    <button 
                                        onClick={() => { setImageSrc(null); setZoom(1); }}
                                        className="flex-1 py-3 border-2 border-black dark:border-zinc-700 font-bold uppercase text-sm hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleConfirmCrop}
                                        disabled={isUploading}
                                        className="flex-1 py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase text-sm flex justify-center items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                                    >
                                        {isUploading ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                        ) : (
                                            <><Check className="w-4 h-4" /> Apply</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile Card */}
                <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-black mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.05)] relative">
                    {/* Cover / Avatar */}
                    <div className="h-28 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 relative">
                        <div className="absolute -bottom-12 left-6 flex items-end gap-3 z-10">
                            <div className="relative group">
                                <img
                                    src={imgUrl}
                                    alt="Profile"
                                    className="w-24 h-24 rounded-full border-4 border-white dark:border-black object-cover bg-white dark:bg-black"
                                    referrerPolicy="no-referrer"
                                />
                                {/* Upload Overlay */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="absolute inset-0 bg-black/50 text-white rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                >
                                    {isUploading ? (
                                        <div className="text-center">
                                            <Loader2 className="w-5 h-5 animate-spin mb-1 mx-auto" />
                                            <span className="text-[10px] font-bold">{uploadProgress}%</span>
                                        </div>
                                    ) : (
                                        <Camera className="w-6 h-6" />
                                    )}
                                </button>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                />
                            </div>

                            {/* Delete Photo Button */}
                            <button
                                onClick={() => setShowDeleteModal(!showDeleteModal)}
                                className="w-8 h-8 flex items-center justify-center bg-white dark:bg-black border-2 border-black dark:border-zinc-800 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors mb-1 shadow-sm"
                                title="Remove photo"
                            >
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                        </div>
                    </div>

                    {/* Delete Photo Options Popup */}
                    {showDeleteModal && (
                        <div className="absolute top-36 left-28 bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 shadow-xl z-20 w-48 p-2 rounded flex flex-col gap-1">
                            <div className="flex justify-between items-center mb-1 px-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500">Remove Photo</span>
                                <button onClick={() => setShowDeleteModal(false)} className="hover:opacity-70"><X className="w-3 h-3"/></button>
                            </div>
                            {hasGooglePhoto && (
                                <button
                                    onClick={() => handleRemovePhoto('google')}
                                    className="text-xs font-bold font-mono text-left px-2 py-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors w-full"
                                >
                                    Use Google Photo
                                </button>
                            )}
                            <button
                                onClick={() => handleRemovePhoto('default')}
                                className="text-xs font-bold font-mono text-left px-2 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors w-full"
                            >
                                Complete Delete
                            </button>
                        </div>
                    )}

                    {/* Name & Role */}
                    <div className="pt-16 px-6 pb-8">
                        {/* Name Section */}
                        <div className="flex items-center flex-wrap gap-2 mb-3 min-h-8">
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="bg-transparent border-b-2 border-black dark:border-white outline-none font-bold uppercase text-lg px-1 w-48 md:w-64"
                                        autoFocus
                                    />
                                    <button onClick={handleSaveName} className="p-1.5 bg-black text-white dark:bg-white dark:text-black rounded-sm hover:opacity-80"><Check className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => { setIsEditingName(false); setName(userProfile.name); }} className="p-1.5 border border-black dark:border-white rounded-sm hover:opacity-80"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-xl font-bold uppercase">{userProfile.name}</h2>
                                    
                                    {(userProfile.role === 'admin' || userProfile.isCR) && (
                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                                            {userProfile.role === 'admin' ? 'Admin' : 'CR'}
                                        </span>
                                    )}

                                    <button
                                        onClick={() => setIsEditingName(true)}
                                        className="p-1.5 text-black dark:text-white opacity-40 hover:opacity-100 transition-opacity"
                                        title="Edit Name"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Bio Section */}
                        <div className="flex items-start gap-2 min-h-[40px]">
                            {isEditingBio ? (
                                <div className="flex items-center gap-2 w-full max-w-sm">
                                    <textarea
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        className="bg-transparent border-2 border-black dark:border-zinc-700 p-2 outline-none text-sm italic w-full resize-none"
                                        rows={2}
                                        placeholder="Add a bio..."
                                        autoFocus
                                    />
                                    <div className="flex flex-col gap-2">
                                        <button onClick={handleSaveBio} className="p-1.5 bg-black text-white dark:bg-white dark:text-black rounded-sm hover:opacity-80"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => { setIsEditingBio(false); setBio(userProfile.bio || ''); }} className="p-1.5 border border-black dark:border-white rounded-sm hover:opacity-80"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 group w-full max-w-lg">
                                    <p className="text-sm opacity-70 italic break-words flex-1">
                                        {userProfile.bio || <span className="opacity-50 tracking-wider">No bio added...</span>}
                                    </p>
                                    <button
                                        onClick={() => setIsEditingBio(true)}
                                        className="p-1.5 text-black dark:text-white opacity-40 hover:opacity-100 transition-opacity shrink-0"
                                        title="Edit Bio"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-black mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.05)]">
                    <div className="px-6 py-4 border-b-2 border-black dark:border-zinc-800">
                        <h3 className="font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Account Information
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-zinc-900">
                        {infoItems.map(item => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className="flex items-center gap-4 px-6 py-3.5">
                                    <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-zinc-900 shrink-0">
                                        <Icon className="w-4 h-4 opacity-60" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase font-bold opacity-40 tracking-wider">{item.label}</p>
                                        <p className="text-sm font-mono truncate max-w-full">{item.value || '—'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

