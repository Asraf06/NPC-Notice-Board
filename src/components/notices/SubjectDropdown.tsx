'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

interface SubjectOption {
    val: string;
    label: string;
}

interface SubjectDropdownProps {
    options: SubjectOption[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

export default function SubjectDropdown({ options, value, onChange, placeholder = 'All Subjects' }: SubjectDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    useSmoothScroll(scrollRef);

    const currentLabel = options.find(o => o.val === value)?.label || placeholder;

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <>
            {/* Trigger */}
            <div
                className="select-trigger overflow-hidden min-w-0 flex items-center justify-between gap-2"
                onClick={() => setIsOpen(true)}
            >
                <span className="truncate font-bold min-w-0 flex-1 text-left">{currentLabel}</span>
                <ChevronDown className="w-4 h-4 shrink-0" />
            </div>

            {/* Selection Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-[200] modal-backdrop flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-sm p-6 relative shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-xl font-bold mb-4 uppercase border-b-2 border-black dark:border-white pb-2">
                            {placeholder}
                        </h3>
                        <div ref={scrollRef} className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="locomotive-content-wrapper">
                                {options.map(opt => (
                                    <button
                                        key={opt.val}
                                        onClick={() => handleSelect(opt.val)}
                                        className="w-full text-left p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900 font-mono text-sm uppercase flex justify-between items-center group"
                                    >
                                        <span>{opt.label}</span>
                                        <Check className={`w-4 h-4 ${opt.val === value ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
