'use client';

import { useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface CustomSelectOption {
    value: string;
    label: string;
}

interface CustomSelectProps {
    options: CustomSelectOption[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
}

export default function CustomSelect({ options, value, onChange, placeholder = 'Select Option', className = '' }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const currentLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={`flex items-center justify-between gap-2 text-left ${className}`}
            >
                <span className="truncate flex-1">{currentLabel}</span>
                <ChevronDown className="w-4 h-4 shrink-0" />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[250] modal-backdrop flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-sm p-6 relative shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-xl font-bold mb-4 uppercase border-b-2 border-black dark:border-white pb-2 pr-6">
                            {placeholder}
                        </h3>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {options.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-left p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900 font-mono text-sm uppercase flex justify-between items-center group transition-colors"
                                >
                                    <span>{opt.label}</span>
                                    <Check className={`w-4 h-4 ${opt.value === value ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
