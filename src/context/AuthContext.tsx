'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    EmailAuthProvider,
    linkWithCredential,
    updatePassword,
    reauthenticateWithPopup,
    GoogleAuthProvider,
    signInWithCredential,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc, getDocFromCache, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, onValue, onDisconnect, set, serverTimestamp as rtdbServerTimestamp, off } from 'firebase/database';
import { auth, db, googleProvider, rtdb } from '@/lib/firebase';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { isOfflineCacheEnabled, isOnline, getCachedUserProfile, cacheUserProfile } from '@/lib/offlineCache';

// Types
export interface UserProfile {
    name: string;
    roll: string;
    dept: string;
    sem: string;
    section: string;
    bio: string;
    email: string;
    uid: string;
    photoURL: string;
    photoFileId?: string;
    isBlocked: boolean;
    allowLogout: boolean;
    forceLogout: boolean;
    isCR?: boolean;
    role?: string;
    registrationDate?: unknown;
    noticeSound?: string;
    messageSound?: string;
    fcmToken?: string;
}

export interface GlobalSettings {
    studentGoogleOnly: boolean;
    allowLogout: boolean;
    restrictGmail: boolean;
    globalChatLocked?: boolean;
}

type AuthStep = 'loading' | 'login' | 'verification' | 'profile' | 'authenticated';

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    authStep: AuthStep;
    globalSettings: GlobalSettings;
    handleGoogleLogin: () => Promise<void>;
    handleEmailLogin: (email: string, password: string) => Promise<void>;
    handleEmailRegister: (email: string, password: string) => Promise<void>;
    handleProfileSave: (data: ProfileSaveData) => Promise<void>;
    handleForgotPassword: (email: string) => Promise<void>;
    checkVerificationStatus: () => Promise<boolean>;
    resendVerificationEmail: () => Promise<void>;
    cancelRegistration: () => Promise<void>;
    logout: () => Promise<void>;
    updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
    authError: string | null;
    clearAuthError: () => void;
}

export interface ProfileSaveData {
    name: string;
    roll: string;
    dept: string;
    sem: string;
    section: string;
    bio: string;
    password?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authStep, setAuthStep] = useState<AuthStep>('loading');
    const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
        studentGoogleOnly: false,
        allowLogout: false,
        restrictGmail: false,
        globalChatLocked: false
    });
    const [authError, setAuthError] = useState<string | null>(null);
    const clearAuthError = () => setAuthError(null);
    const router = typeof window !== 'undefined' ? useRouter() : null;

    // Call native push notifications handler
    usePushNotifications(userProfile, router);

    // Listen to global settings
    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, 'settings', 'config'),
            (snap) => {
                if (snap.exists()) {
                    const config = snap.data() as GlobalSettings;
                    setGlobalSettings(config);
                }
            },
            (error) => {
                console.warn("Could not read settings/config. Check Firestore rules.", error.message);
            }
        );
        return () => unsub();
    }, []);

    // ============================================
    // OFFLINE AUTH BYPASS (Native APK only)
    // If the app is offline and offline caching is enabled,
    // skip Firebase auth entirely and use cached profile.
    // ============================================
    const offlineBypassApplied = useRef(false);

    // Auth state listener
    useEffect(() => {
        // ── IMMEDIATE OFFLINE BYPASS ──
        // If native + offline + cache enabled + cached profile: skip Firebase entirely
        if (Capacitor.isNativePlatform() && !isOnline() && isOfflineCacheEnabled()) {
            const cachedProfile = getCachedUserProfile();
            if (cachedProfile && !offlineBypassApplied.current) {
                console.log('[OfflineAuth] Immediate bypass — using cached profile');
                offlineBypassApplied.current = true;
                setUserProfile(cachedProfile as UserProfile);
                setAuthStep('authenticated');
                return; // Don't set up Firebase listeners at all
            }
        }

        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);

                // Email verification check
                if (!firebaseUser.emailVerified) {
                    setAuthStep('verification');
                    return;
                }

                // Listen to user profile
                const unsubProfile = onSnapshot(
                    doc(db, 'students', firebaseUser.uid),
                    async (docSnap) => {
                        const userData = docSnap.exists() ? (docSnap.data() as UserProfile) : null;

                        // Check if profile is missing or incomplete
                        if (!userData || !userData.name || !userData.roll) {
                            // If offline + native, try cached profile instead of hanging on getDoc
                            if (Capacitor.isNativePlatform() && !isOnline() && isOfflineCacheEnabled()) {
                                const cachedProfile = getCachedUserProfile();
                                if (cachedProfile) {
                                    console.log('[OfflineAuth] Profile incomplete from cache, using saved profile');
                                    setUserProfile(cachedProfile as UserProfile);
                                    setAuthStep('authenticated');
                                    return;
                                }
                            }
                            // Check if teacher account
                            if (!docSnap.exists()) {
                                try {
                                    const teacherDoc = await getDoc(doc(db, 'teachers', firebaseUser.uid));
                                    if (teacherDoc.exists()) {
                                        setAuthStep('profile');
                                        return;
                                    }
                                } catch (e) { console.warn('Teacher check failed:', e); }
                            }
                            setAuthStep('profile');
                            return;
                        }

                        // ── Cache profile IMMEDIATELY for offline use (before any getDoc calls) ──
                        if (Capacitor.isNativePlatform()) {
                            cacheUserProfile(userData);
                        }

                        // Check blocked/forceLogout
                        if (userData.isBlocked) {
                            await signOut(auth);
                            return;
                        }
                        if (userData.forceLogout) {
                            await setDoc(doc(db, 'students', firebaseUser.uid), { forceLogout: false }, { merge: true });
                            await signOut(auth);
                            return;
                        }

                        // Check Website Login Access (Department/Semester)
                        // Skip entirely when offline to avoid hanging
                        if (isOnline()) {
                            try {
                                const acDoc = await getDoc(doc(db, 'access_control', 'website_access'));
                                if (acDoc.exists()) {
                                    const acData = acDoc.data();
                                    const deptAccess = acData.departments?.[userData.dept]?.[userData.sem];
                                    if (!deptAccess || !deptAccess.login) {
                                        setAuthError(`Notice: Login access is currently restricted for ${userData.dept} ${userData.sem}. Please wait for your timeline.`);
                                        await signOut(auth);
                                        return;
                                    }
                                }
                            } catch (e) { console.error("Access control check failed", e) }
                        }

                        setUserProfile(userData);
                        setAuthStep('authenticated');

                        // --- START PRESENCE SYSTEM (only when online) ---
                        if (isOnline()) {
                            const userStatusRef = ref(rtdb, `status/${firebaseUser.uid}`);
                            const connectedRef = ref(rtdb, '.info/connected');

                            off(connectedRef);

                            onValue(connectedRef, (snap) => {
                                if (snap.val() === true) {
                                    onDisconnect(userStatusRef).set({
                                        state: 'offline',
                                        last_changed: rtdbServerTimestamp()
                                    }).then(() => {
                                        set(userStatusRef, {
                                            state: 'online',
                                            last_changed: rtdbServerTimestamp()
                                        });
                                    });
                                }
                            });
                        }
                        // --- END PRESENCE SYSTEM ---

                    },
                    (err) => {
                        console.error("Profile snapshot error:", err);
                        // If native + offline + cached profile → use cached data
                        if (Capacitor.isNativePlatform() && !isOnline() && isOfflineCacheEnabled()) {
                            const cachedProfile = getCachedUserProfile();
                            if (cachedProfile) {
                                console.log('[OfflineAuth] Using cached profile after snapshot error');
                                setUserProfile(cachedProfile as UserProfile);
                                setAuthStep('authenticated');
                                return;
                            }
                        }
                        if (auth.currentUser) {
                            setAuthStep('profile');
                        }
                    }
                );

                return () => unsubProfile();
            } else {
                // No firebase user — but if offline on native with cached profile, bypass
                if (Capacitor.isNativePlatform() && !isOnline() && isOfflineCacheEnabled()) {
                    const cachedProfile = getCachedUserProfile();
                    if (cachedProfile && !offlineBypassApplied.current) {
                        console.log('[OfflineAuth] No Firebase user but have cached profile, entering offline mode');
                        offlineBypassApplied.current = true;
                        setUserProfile(cachedProfile as UserProfile);
                        setAuthStep('authenticated');
                        return;
                    }
                }
                setUser(null);
                setUserProfile(null);
                setAuthStep('login');
            }
        });
        return () => unsub();
    }, []);

    // --- AUTH METHODS ---
    const handleGoogleLogin = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                try {
                    await GoogleAuth.initialize({
                        clientId: '529840057304-obbs5438idptq2qqlmor0ormdq2lf21f.apps.googleusercontent.com',
                        scopes: ['profile', 'email'],
                        grantOfflineAccess: true
                    });
                } catch (e) {
                    console.warn("Init notice:", e);
                }
                
                const result = await GoogleAuth.signIn();
                if (result.authentication && result.authentication.idToken) {
                    const credential = GoogleAuthProvider.credential(
                        result.authentication.idToken,
                        result.authentication.accessToken
                    );
                    await signInWithCredential(auth, credential);
                } else {
                    throw new Error("Missing Google ID Token");
                }
            } else {
                await signInWithPopup(auth, googleProvider);
            }
        } catch (error) {
            throw error;
        }
    };

    const handleEmailLogin = async (email: string, password: string) => {
        if (!email || !password) throw new Error('Email and password required');

        if (globalSettings.restrictGmail && !email.toLowerCase().endsWith('@gmail.com')) {
            throw new Error('Only @gmail.com addresses are allowed.');
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            throw error;
        }
    };

    const handleEmailRegister = async (email: string, password: string) => {
        if (!email || !password) throw new Error('Email and password required');

        if (globalSettings.restrictGmail && !email.toLowerCase().endsWith('@gmail.com')) {
            throw new Error('Please use a @gmail.com address to register.');
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);
        } catch (error) {
            throw error;
        }
    };

    const handleProfileSave = async (data: ProfileSaveData) => {
        if (!auth.currentUser) throw new Error('Authentication session lost. Please reload.');

        const { name, roll, dept, sem, section, bio, password } = data;

        if (!roll || roll.trim() === '') {
            throw new Error('Board Roll cannot be empty.');
        }

        // 1. Check if roll is already registered by another account
        const studentsQuery = query(collection(db, 'students'), where('roll', '==', roll.trim()));
        const studentsSnap = await getDocs(studentsQuery);
        if (!studentsSnap.empty) {
            // But wait, what if the user is re-registering and deleted their account but not the student doc?
            // Since uid is the doc id, if they logged in with the SAME account, it's fine.
            // Let's ensure no *other* user holds this roll.
            const otherUserWithRoll = studentsSnap.docs.find((d: any) => d.id !== auth.currentUser!.uid);
            if (otherUserWithRoll) {
                throw new Error(`Board Roll ${roll} is already registered to another account.`);
            }
        }

        // 2. Check Allowed Rolls (if defined by CR or Admin)
        const rollDocId = `${section}_${dept}_${sem}`;
        const rollRef = await getDoc(doc(db, 'class_rolls', rollDocId));
        
        if (rollRef.exists()) {
            const classRollsData = rollRef.data();
            const allowedRolls = classRollsData.rolls || [];
            
            if (allowedRolls.length > 0) {
                const isAllowed = allowedRolls.some((r: any) => {
                    const val = typeof r === 'object' ? r.value : r;
                    return val.toString() === roll.trim();
                });
                
                if (!isAllowed) {
                    throw new Error(`Board Roll ${roll} is not permitted to register for ${dept} ${sem}. Contact your CR/Admin to add you.`);
                }
            }
        }

        // Check website registration access
        const acDoc = await getDoc(doc(db, 'access_control', 'website_access'));
        if (acDoc.exists()) {
            const acData = acDoc.data();
            const deptAccess = acData.departments?.[dept]?.[sem];
            if (!deptAccess || !deptAccess.register) {
                throw new Error(`Registration is currently closed for ${dept} ${sem}.`);
            }
        }

        // Password linking for Google users
        if (password && password.length >= 6) {
            try {
                const providers = auth.currentUser.providerData.map(p => p.providerId);
                if (!providers.includes('password')) {
                    const credential = EmailAuthProvider.credential(auth.currentUser.email!, password);
                    try {
                        await linkWithCredential(auth.currentUser, credential);
                    } catch (linkErr: unknown) {
                        const errCode = (linkErr as { code?: string })?.code;
                        if (errCode === 'auth/requires-recent-login') {
                            await reauthenticateWithPopup(auth.currentUser, googleProvider);
                            await linkWithCredential(auth.currentUser, credential);
                        } else if (errCode !== 'auth/credential-already-in-use') {
                            throw linkErr;
                        }
                    }
                } else {
                    try {
                        await updatePassword(auth.currentUser, password);
                    } catch (updateErr: unknown) {
                        const errCode = (updateErr as { code?: string })?.code;
                        if (errCode === 'auth/requires-recent-login') {
                            await reauthenticateWithPopup(auth.currentUser, googleProvider);
                            await updatePassword(auth.currentUser, password);
                        } else {
                            throw updateErr;
                        }
                    }
                }
            } catch (err) {
                throw err;
            }
        }

        // Save profile to Firestore
        const profileData: UserProfile = {
            name,
            roll,
            dept,
            sem,
            section,
            bio,
            email: auth.currentUser.email!,
            uid: auth.currentUser.uid,
            photoURL: auth.currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
            isBlocked: false,
            allowLogout: false,
            forceLogout: false,
        };

        await setDoc(doc(db, 'students', auth.currentUser.uid), {
            ...profileData,
            registrationDate: serverTimestamp(),
        });

        setUserProfile(profileData);
        setAuthStep('authenticated');
    };

    const handleForgotPassword = async (email: string) => {
        if (!email) throw new Error('Please enter your email address');
        await sendPasswordResetEmail(auth, email);
    };

    const checkVerificationStatus = async (): Promise<boolean> => {
        if (!auth.currentUser) return false;
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
            window.location.reload();
            return true;
        }
        return false;
    };

    const resendVerificationEmail = async () => {
        if (!auth.currentUser) throw new Error('No user session');
        await sendEmailVerification(auth.currentUser);
    };

    const cancelRegistration = async () => {
        try {
            if (auth.currentUser) {
                try { await auth.currentUser.delete(); } catch { /* ignore */ }
            }
            await signOut(auth);
        } catch {
            await signOut(auth);
        }
    };

    const logout = async () => {
        const globalAllowed = globalSettings.allowLogout === true;
        const userAllowed = userProfile?.allowLogout === true;
        if (globalAllowed || userAllowed) {
            try {
                // Wrap in thorough try/catch as native bridges can sometimes throw uncatchable Promise rejections
                // If it crashes because it wasn't initialized, we catch it securely
                if (Capacitor.isNativePlatform()) {
                    try {
                        await GoogleAuth.initialize({
                            clientId: '529840057304-obbs5438idptq2qqlmor0ormdq2lf21f.apps.googleusercontent.com',
                        });
                        await GoogleAuth.signOut();
                    } catch (err) {
                        console.warn('Native Google SignOut skipped:', err);
                    }
                }
            } catch (e) {}
            
            await signOut(auth);
            if (router) {
                router.push('/login');
            }
        }
    };

    const updateUserProfile = async (data: Partial<UserProfile>) => {
        if (!auth.currentUser) throw new Error('No user logged in');

        await setDoc(doc(db, 'students', auth.currentUser.uid), data, { merge: true });

        // Update local state immediately for perceived speed
        setUserProfile(prev => prev ? { ...prev, ...data } : null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                userProfile,
                authStep,
                globalSettings,
                handleGoogleLogin,
                handleEmailLogin,
                handleEmailRegister,
                handleProfileSave,
                handleForgotPassword,
                checkVerificationStatus,
                resendVerificationEmail,
                cancelRegistration,
                logout,
                updateUserProfile,
                authError,
                clearAuthError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
