'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';

interface RoutinePromptModalProps {
    isOpen: boolean;
    title: string;
    defaultValue: string;
    onClose: () => void;
    onConfirm: (value: string) => void;
}

export default function RoutinePromptModal({ isOpen, title, defaultValue, onClose, onConfirm }: RoutinePromptModalProps) {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, defaultValue]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div
                className="bg-white dark:bg-black border-4 border-black dark:border-white w-full max-w-md shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] dark:shadow-[12px_12px_0px_0px_rgba(255,255,255,0.1)] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black uppercase tracking-tighter">{title}</h3>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') onConfirm(value);
                            if (e.key === 'Escape') onClose();
                        }}
                        className="w-full p-4 border-2 border-black dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 font-bold outline-none focus:border-purple-600 dark:focus:border-purple-500 transition-all text-sm uppercase"
                        placeholder="ENTER VALUE..."
                    />

                    <div className="flex gap-4 mt-8">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 border-2 border-black dark:border-white font-black uppercase text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onConfirm(value)}
                            className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-black border-2 border-black dark:border-white font-black uppercase text-xs hover:opacity-80 transition-all flex items-center justify-center gap-2"
                        >
                            <Check className="w-4 h-4" /> Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
