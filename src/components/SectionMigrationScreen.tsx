'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

/**
 * SectionMigrationScreen
 * 
 * Safety-net screen shown to any logged-in user who has no `section` field.
 * This shouldn't happen in normal flow (migration script + updated registration),
 * but acts as a fallback.
 */
export default function SectionMigrationScreen() {
    const { updateUserProfile } = useAuth();
    const [section, setSection] = useState('23-24');
    const [saving, setSaving] = useState(false);

    const sections = ['23-24'];

    const handleConfirm = async () => {
        setSaving(true);
        try {
            await updateUserProfile({ section });
        } catch (error) {
            console.error('Section migration failed:', error);
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] bg-white dark:bg-black flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center">
                {/* Icon */}
                <div className="w-20 h-20 mx-auto mb-6 border-4 border-black dark:border-white rounded-full flex items-center justify-center">
                    <span className="text-3xl">🎓</span>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2 text-black dark:text-white">
                    Welcome Back!
                </h1>
                <p className="text-sm opacity-70 mb-8 font-serif text-black dark:text-zinc-400">
                    We&apos;ve upgraded! Please select your batch/section to continue using the Notice Board.
                </p>

                {/* Section Select */}
                <div className="text-left mb-6">
                    <label className="block text-xs uppercase font-bold mb-2 text-black dark:text-white">
                        Your Batch
                    </label>
                    <CustomSelect
                        value={section}
                        onChange={setSection}
                        options={sections.map(s => ({ value: s, label: s }))}
                        placeholder="Select Batch"
                        className="w-full bg-transparent border-2 border-black dark:border-zinc-700 p-3 rounded-none outline-none text-lg font-mono font-bold dark:bg-black text-black dark:text-white"
                    />
                </div>

                {/* Confirm Button */}
                <button
                    onClick={handleConfirm}
                    disabled={saving}
                    className="w-full py-4 bg-black text-white dark:bg-white dark:text-black font-bold uppercase text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        'Confirm & Continue'
                    )}
                </button>

                <p className="text-[10px] opacity-40 mt-4 font-mono text-black dark:text-zinc-500">
                    This is a one-time setup. Contact admin if you need to change it later.
                </p>
            </div>
        </div>
    );
}
