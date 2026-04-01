'use client';

import { useState, useEffect } from 'react';
import { useAuth, ProfileSaveData } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LogIn, MailCheck, AlertCircle, Lock, Mail, User, CheckCircle2, ArrowRight, Loader2, X, Eye, EyeOff } from 'lucide-react';
import { parseFirebaseError } from '@/lib/errorParser';
import CustomSelect from './CustomSelect';

const validatePassword = (pass: string) => {
    return {
        length: pass.length >= 8,
        uppercase: /[A-Z]/.test(pass),
        lowercase: /[a-z]/.test(pass),
        number: /[0-9]/.test(pass),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(pass)
    };
};

export default function AuthOverlay() {
    const {
        user,
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
        authError,
        clearAuthError,
    } = useAuth();

    // UI Context
    const { showAlert, showToast } = useUI();

    // Show custom auth error (e.g. access control restrictions)
    useEffect(() => {
        if (authError) {
            showAlert('Login Restricted', authError, 'warning', () => clearAuthError());
        }
    }, [authError, showAlert, clearAuthError]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
    const [loginLoading, setLoginLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const passwordRules = validatePassword(password);
    const isPasswordValid = Object.values(passwordRules).every(Boolean);

    // Profile form state
    const [profileStep, setProfileStep] = useState<1 | 2>(1);
    const [profileName, setProfileName] = useState('');
    const [profileRoll, setProfileRoll] = useState('');
    const [profileDept, setProfileDept] = useState('Computer');
    const [profileSem, setProfileSem] = useState('1st');
    const [profileSection, setProfileSection] = useState('23-24');
    const [profileBio, setProfileBio] = useState('');
    const [profilePassword, setProfilePassword] = useState('');
    const [showPasswordSetup, setShowPasswordSetup] = useState(false);
    const [showProfilePassword, setShowProfilePassword] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);

    const profilePasswordRules = validatePassword(profilePassword);
    const isProfilePasswordValid = Object.values(profilePasswordRules).every(Boolean);

    const [departments, setDepartments] = useState<string[]>(['Computer', 'Civil', 'Electrical', 'Mechanical']);
    const [sections, setSections] = useState<string[]>(['23-24']);

    // Verification state
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(false);

    // Fetch departments and sections from Firestore
    useEffect(() => {
        async function fetchData() {
            try {
                const qDept = query(collection(db, 'departments'), orderBy('name'));
                const snapDept = await getDocs(qDept);
                if (!snapDept.empty) {
                    const names = snapDept.docs.map(d => d.data().name as string);
                    setDepartments(names);
                    setProfileDept(names[0]);
                }
            } catch {
                // Fallback departments already set
            }

            try {
                const qSec = query(collection(db, 'sections'), orderBy('name'));
                const snapSec = await getDocs(qSec);
                if (!snapSec.empty) {
                    const secNames = snapSec.docs.map(d => d.data().name as string);
                    setSections(secNames);
                    setProfileSection(secNames[0]);
                }
            } catch {
                // Fallback sections already set
            }
        }
        fetchData();
    }, []);

    // Pre-fill name from Google account
    useEffect(() => {
        if (authStep === 'profile' && user) {
            setProfileName(user.displayName || '');
            const providers = user.providerData.map(p => p.providerId);
            setShowPasswordSetup(providers.includes('google.com'));
        }
    }, [authStep, user]);

    if (authStep === 'authenticated') return null;

    // --- HANDLERS ---
    const onGoogleLogin = async () => {
        try {
            await handleGoogleLogin();
        } catch (err: any) {
            showAlert('Login Error', parseFirebaseError(err, 'Google login failed'), 'error');
        }
    };

    const onEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            showToast('Email and Password required!');
            return;
        }
        setLoginLoading(true);
        try {
            await handleEmailLogin(email, password);
        } catch (err: any) {
            showAlert('Login Error', parseFirebaseError(err, 'Login failed'), 'error');
        } finally {
            setLoginLoading(false);
        }
    };

    const onRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || !confirmPassword) {
            showAlert('Input Error', 'Please fill in all fields.', 'info');
            return;
        }
        if (!isPasswordValid) {
            showAlert('Password Error', 'Password does not meet all requirements.', 'error');
            return;
        }
        if (password !== confirmPassword) {
            showAlert('Password Error', 'Passwords do not match.', 'error');
            return;
        }
        try {
            await handleEmailRegister(email, password);
            showAlert('Account Created', `Verification email sent to ${email}. Check your Inbox & Spam folder!`, 'success');
        } catch (err: any) {
            showAlert('Registration Error', parseFirebaseError(err, 'Registration failed'), 'error');
        }
    };

    const onForgotPassword = async () => {
        if (!email) {
            showAlert('Input Required', 'Please enter your email address in the field above.', 'info');
            return;
        }
        try {
            await handleForgotPassword(email);
            showAlert('Email Sent', `Password reset link sent to ${email}`, 'success');
        } catch (err: any) {
            showAlert('Error', parseFirebaseError(err, 'Failed to send reset email'), 'error');
        }
    };

    const onCheckVerification = async () => {
        setVerifyLoading(true);
        try {
            const verified = await checkVerificationStatus();
            if (!verified) {
                showAlert('Not Verified', "We haven't received the verification yet. Please verify and try again.", 'warning');
            }
        } catch {
            showAlert('Error', 'Failed to check verification status.', 'error');
        } finally {
            setVerifyLoading(false);
        }
    };

    const onResendEmail = async () => {
        setResendCooldown(true);
        try {
            await resendVerificationEmail();
            showAlert('Sent', 'Verification link sent! Please check your Inbox and Spam folder.', 'success');
            setTimeout(() => setResendCooldown(false), 60000);
        } catch (err: any) {
            showAlert('Error', parseFirebaseError(err, 'Failed to send email'), 'error');
            setResendCooldown(false);
        }
    };

    const onProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileLoading(true);
        try {
            const data: ProfileSaveData = {
                name: profileName.trim(),
                roll: profileRoll.trim(),
                dept: profileDept,
                sem: profileSem,
                section: profileSection,
                bio: profileBio,
                password: showPasswordSetup ? profilePassword : undefined,
            };
            await handleProfileSave(data);
            showAlert('Success', 'Account verified and password linked!', 'success');
        } catch (err: any) {
            showAlert('Verification Error', parseFirebaseError(err, 'Failed to save profile'), 'error');
        } finally {
            setProfileLoading(false);
        }
    };

    const onCancelRegistration = async () => {
        showAlert('Cancel Registration?', 'This will sign you out and let you start over. Continue?', 'info', async () => {
            await cancelRegistration();
            window.location.reload();
        });
    };

    const semesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

    return (
        <div className="fixed inset-0 z-[200] bg-[#f9fafb]/50 dark:bg-black/50 backdrop-blur-md flex items-center justify-center p-4 grid-bg">
            <div className="w-full max-w-sm bg-white dark:bg-black border-2 border-black dark:border-white p-8 relative shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#A655F7] text-black dark:text-white">

                {/* LOADING STATE */}
                {authStep === 'loading' && (
                    <div className="text-center">
                        <div className="loader mx-auto mb-4" />
                        <p className="mono-font text-sm uppercase tracking-widest">Authenticating...</p>
                    </div>
                )}

                {/* LOGIN FORM */}
                {authStep === 'login' && (
                    <div>
                        <h1 className="text-3xl font-bold mb-2 uppercase">NPC Notice Board</h1>
                        <p className="text-sm mb-6 opacity-70">Official Campus Updates</p>

                        <button
                            onClick={onGoogleLogin}
                            className="w-full py-3 border-2 border-black dark:border-white font-bold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all uppercase tracking-wider flex items-center justify-center gap-3"
                        >
                            <LogIn className="w-5 h-5" />
                            Enter with Google
                        </button>

                        {/* Email auth section (conditionally hidden) */}
                        {!globalSettings.studentGoogleOnly && (
                            <div>
                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300 dark:border-gray-800" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-white dark:bg-black px-2 text-gray-500 font-bold">Or use email</span>
                                    </div>
                                </div>

                                <div className="flex mb-5 border-2 border-black dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('login')}
                                        className={`flex-1 py-2 text-xs font-bold uppercase transition-all ${activeTab === 'login' ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                                    >
                                        Log In
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('register')}
                                        className={`flex-1 py-2 text-xs font-bold uppercase transition-all ${activeTab === 'register' ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                                    >
                                        Register
                                    </button>
                                </div>

                                {activeTab === 'login' ? (
                                    <form onSubmit={onEmailLogin} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                            placeholder="EMAIL ADDRESS"
                                            className="w-full p-3 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white outline-none placeholder-gray-500 font-mono text-sm focus:bg-gray-50 dark:focus:bg-zinc-800 transition-colors text-black dark:text-white"
                                        />
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                required
                                                placeholder="PASSWORD"
                                                className="w-full p-3 pr-10 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white outline-none placeholder-gray-500 font-mono text-sm focus:bg-gray-50 dark:focus:bg-zinc-800 transition-colors text-black dark:text-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <div className="flex flex-col pt-2 gap-3">
                                            <button
                                                type="submit"
                                                disabled={loginLoading}
                                                className="w-full py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase hover:opacity-80 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none disabled:opacity-50"
                                            >
                                                {loginLoading ? 'Processing...' : 'Login'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={onForgotPassword}
                                                className="w-full py-2 text-xs font-bold uppercase opacity-60 hover:opacity-100 hover:underline"
                                            >
                                                Forgot Password?
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <form onSubmit={onRegister} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                            placeholder="NEW EMAIL ADDRESS"
                                            className="w-full p-3 bg-transparent border-2 border-black dark:border-zinc-700 outline-none placeholder-gray-400 font-mono text-sm focus:border-black dark:focus:border-white transition-colors"
                                        />
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                required
                                                placeholder="CREATE PASSWORD"
                                                className="w-full p-3 pr-10 bg-transparent border-2 border-black dark:border-zinc-700 outline-none placeholder-gray-400 font-mono text-sm focus:border-black dark:focus:border-white transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {password.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold bg-gray-50 dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 p-3">
                                                <div className={passwordRules.length ? "text-green-600 dark:text-green-400" : "text-gray-400"}>
                                                    {passwordRules.length ? '✓' : '○'} 8+ Chars
                                                </div>
                                                <div className={passwordRules.uppercase ? "text-green-600 dark:text-green-400" : "text-gray-400"}>
                                                    {passwordRules.uppercase ? '✓' : '○'} Uppercase
                                                </div>
                                                <div className={passwordRules.lowercase ? "text-green-600 dark:text-green-400" : "text-gray-400"}>
                                                    {passwordRules.lowercase ? '✓' : '○'} Lowercase
                                                </div>
                                                <div className={passwordRules.number ? "text-green-600 dark:text-green-400" : "text-gray-400"}>
                                                    {passwordRules.number ? '✓' : '○'} Number
                                                </div>
                                                <div className={`col-span-2 ${passwordRules.special ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                                                    {passwordRules.special ? '✓' : '○'} Special Char (!@#$%)
                                                </div>
                                            </div>
                                        )}

                                        <div className="relative">
                                            <input
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                required
                                                placeholder="CONFIRM PASSWORD"
                                                className={`w-full p-3 pr-10 bg-transparent border-2 outline-none font-mono text-sm transition-colors ${confirmPassword.length > 0 && password !== confirmPassword
                                                        ? 'border-red-500 text-red-500 placeholder-red-300 dark:border-red-500 dark:text-red-400 dark:placeholder-red-800 focus:border-red-500 focus:dark:border-red-500'
                                                        : 'border-black dark:border-zinc-700 placeholder-gray-400 focus:border-black dark:focus:border-white text-black dark:text-white'
                                                    }`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className={`absolute right-3 top-1/2 -translate-y-1/2 ${confirmPassword.length > 0 && password !== confirmPassword
                                                        ? 'text-red-500 dark:text-red-400'
                                                        : 'text-gray-400 hover:text-black dark:hover:text-white'
                                                    }`}
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <div className="flex flex-col pt-2">
                                            <button
                                                type="submit"
                                                disabled={loginLoading}
                                                className="w-full py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase hover:opacity-80 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none disabled:opacity-50"
                                            >
                                                Create Account
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* EMAIL VERIFICATION STEP */}
                {authStep === 'verification' && (
                    <div className="text-center">
                        <div className="mb-6">
                            <MailCheck className="w-16 h-16 mx-auto mb-4 text-green-500" />
                            <h2 className="text-xl font-bold mb-2 uppercase">Verify Email</h2>
                            <p className="text-sm opacity-70 mb-4">We sent a verification link to:</p>
                            <p className="font-mono font-bold text-sm bg-gray-100 dark:bg-zinc-900 p-2 rounded mb-6">
                                {user?.email}
                            </p>
                            <p className="text-xs opacity-60 mb-6">
                                Please check your inbox (and spam folder) and click the link to activate your account.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={onCheckVerification}
                                disabled={verifyLoading}
                                className="w-full py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase hover:opacity-80 transition-all disabled:opacity-50"
                            >
                                {verifyLoading ? 'Checking...' : 'I Verified It'}
                            </button>
                            <button
                                onClick={onResendEmail}
                                disabled={resendCooldown}
                                className="w-full py-3 border-2 border-black dark:border-white font-bold uppercase hover:bg-gray-100 dark:hover:bg-zinc-900 text-xs disabled:opacity-50"
                            >
                                {resendCooldown ? 'Link Sent! (Wait 60s)' : 'Resend Email'}
                            </button>
                            <button
                                onClick={() => { cancelRegistration(); window.location.reload(); }}
                                className="w-full py-2 text-xs font-bold uppercase opacity-60 hover:opacity-100 hover:underline"
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                )}

                {/* PROFILE SETUP STEP */}
                {authStep === 'profile' && (
                    <div>
                        <h2 className="text-xl font-bold mb-6 border-b-2 border-black dark:border-white pb-2">Identification</h2>
                        {profileStep === 1 ? (
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                if (!profileName.trim()) {
                                    showAlert('Input Error', 'Please enter your Full Name', 'warning');
                                    return;
                                }
                                if (showPasswordSetup && !isProfilePasswordValid) {
                                    showAlert('Password Error', 'Password does not meet all requirements.', 'error');
                                    return;
                                }
                                setProfileStep(2);
                            }} className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div>
                                    <label className="block text-xs uppercase font-bold mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={profileName}
                                        onChange={e => setProfileName(e.target.value)}
                                        required
                                        className="w-full bg-transparent border-b-2 border-gray-300 focus:border-black dark:focus:border-white outline-none py-2 rounded-none"
                                    />
                                </div>

                                {showPasswordSetup && (
                                    <div>
                                        <label className="block text-xs uppercase font-bold mb-1">Set Account Password</label>
                                        <div className="relative">
                                            <input
                                                type={showProfilePassword ? "text" : "password"}
                                                value={profilePassword}
                                                onChange={e => setProfilePassword(e.target.value)}
                                                required
                                                placeholder="Create a strong password"
                                                className="w-full pr-10 bg-transparent border-b-2 border-gray-300 focus:border-black dark:focus:border-white outline-none py-2 rounded-none font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowProfilePassword(!showProfilePassword)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white"
                                            >
                                                {showProfilePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        
                                        {profilePassword.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold bg-gray-50 dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 p-3 mt-3">
                                                <div className={profilePasswordRules.length ? "text-green-600 dark:text-green-400" : "text-gray-400"}>
                                                    {profilePasswordRules.length ? '✓' : '○'} 8+ Chars
                                                </div>
                                                <div className={profilePasswordRules.uppercase ? "text-green-600 dark:text-green-400" : "text-gray-400"}>
                                                    {profilePasswordRules.uppercase ? '✓' : '○'} Uppercase
                                                </div>
                                                <div className={profilePasswordRules.lowercase ? "text-green-600 dark:text-green-400" : "text-gray-400"}>
                                                    {profilePasswordRules.lowercase ? '✓' : '○'} Lowercase
                                                </div>
                                                <div className={profilePasswordRules.number ? "text-green-600 dark:text-green-400" : "text-gray-400"}>
                                                    {profilePasswordRules.number ? '✓' : '○'} Number
                                                </div>
                                                <div className={`col-span-2 ${profilePasswordRules.special ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                                                    {profilePasswordRules.special ? '✓' : '○'} Special Char (!@#$%)
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="w-full py-3 bg-black text-white dark:bg-white dark:text-black font-bold mt-4 uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none"
                                >
                                    Next Step <ArrowRight className="inline w-4 h-4 ml-2" />
                                </button>
                                <button
                                    type="button"
                                    onClick={onCancelRegistration}
                                    className="w-full py-2 border-2 border-dashed border-red-500 text-red-500 font-bold mt-2 uppercase text-xs hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                                >
                                    Cancel Setup
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={onProfileSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs uppercase font-bold mb-1">Department</label>
                                        <CustomSelect
                                            value={profileDept}
                                            onChange={setProfileDept}
                                            options={departments.map(d => ({ value: d, label: d }))}
                                            placeholder="Select Dept"
                                            className="w-full bg-transparent border-2 border-black dark:border-zinc-700 p-2 rounded-none outline-none dark:bg-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase font-bold mb-1">Board Roll</label>
                                        <input
                                            type="number"
                                            value={profileRoll}
                                            onChange={e => setProfileRoll(e.target.value)}
                                            required
                                            className="w-full bg-transparent border-b-2 border-gray-300 focus:border-black dark:focus:border-white outline-none py-2 rounded-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase font-bold mb-1">Semester</label>
                                        <CustomSelect
                                            value={profileSem}
                                            onChange={setProfileSem}
                                            options={semesters.map(s => ({ value: s, label: s }))}
                                            placeholder="Select Sem"
                                            className="w-full bg-transparent border-2 border-black dark:border-zinc-700 p-2 rounded-none outline-none dark:bg-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase font-bold mb-1">Batch</label>
                                        <CustomSelect
                                            value={profileSection}
                                            onChange={setProfileSection}
                                            options={sections.map(s => ({ value: s, label: s }))}
                                            placeholder="Select Batch"
                                            className="w-full bg-transparent border-2 border-black dark:border-zinc-700 p-2 rounded-none outline-none dark:bg-black"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs uppercase font-bold mb-1">Bio (Optional)</label>
                                        <input
                                            type="text"
                                            value={profileBio}
                                            onChange={e => setProfileBio(e.target.value)}
                                            placeholder="Short bio..."
                                            className="w-full bg-transparent border-b-2 border-gray-300 focus:border-black dark:focus:border-white outline-none py-2 rounded-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 mt-4">
                                    <button
                                        type="submit"
                                        disabled={profileLoading}
                                        className="w-full py-3 bg-black text-white dark:bg-white dark:text-black font-bold uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none disabled:opacity-50"
                                    >
                                        {profileLoading ? 'Verifying...' : 'Confirm Identity'}
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setProfileStep(1)}
                                            className="w-1/3 py-2 border-2 border-black dark:border-zinc-700 font-bold uppercase text-xs hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
                                        >
                                            Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onCancelRegistration}
                                            className="flex-1 py-2 border-2 border-dashed border-red-500 text-red-500 font-bold uppercase text-xs hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                                        >
                                            Cancel Setup
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
