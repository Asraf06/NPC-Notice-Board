'use client';

import { useState, useEffect, useRef } from 'react';
import { BookOpen, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

interface Subject {
    id: string;
    name: string;
    code: string;
    dept: string;
    sem: string;
}

const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

export default function BooksView() {
    const { userProfile } = useAuth();
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [openSemesters, setOpenSemesters] = useState<Record<string, boolean>>({});

    const currentSemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!userProfile?.dept) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'notice_subjects'),
            where('dept', 'in', [userProfile.dept, 'all', 'All', 'ALL'])
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data: Subject[] = [];
            snapshot.forEach(doc => {
                data.push({ id: doc.id, ...doc.data() } as Subject);
            });
            // Alphabetical sort by subject name
            data.sort((a, b) => a.name.localeCompare(b.name));
            setSubjects(data);
            setLoading(false);
        }, (err) => {
            console.error("Failed to fetch subjects", err);
            setLoading(false);
        });

        return () => unsub();
    }, [userProfile]);

    useEffect(() => {
        if (!userProfile?.sem || !SEMESTERS.includes(userProfile.sem)) return;

        const currentIndex = SEMESTERS.indexOf(userProfile.sem);
        
        // Open current and all newer semesters
        const initialOpenState: Record<string, boolean> = {};
        SEMESTERS.forEach((sem, index) => {
            initialOpenState[sem] = index >= currentIndex;
        });
        
        setOpenSemesters(initialOpenState);
        
        // Scroll to current semester after short delay to allow DOM to render
        setTimeout(() => {
            if (currentSemRef.current) {
                currentSemRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 500);

    }, [userProfile]);

    const toggleSemester = (sem: string) => {
        setOpenSemesters(prev => ({
            ...prev,
            [sem]: !prev[sem]
        }));
    };

    return (
        <div className="w-full h-full min-h-0 overflow-y-auto custom-scrollbar min-w-0">
            <div className="locomotive-content-wrapper max-w-4xl mx-auto px-4 py-8 relative">
                <div className="mb-10">
                    <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-2">
                        Book List
                    </h1>
                    <p className="text-xs font-mono font-bold opacity-50 uppercase tracking-widest bg-gray-100 dark:bg-zinc-800 px-3 py-1 inline-block">
                        {userProfile?.dept || 'Unknown'} DEPARTMENT
                    </p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse h-full w-full">
                        <RefreshCw className="w-12 h-12 mb-4 opacity-20 animate-spin" />
                        <p className="text-xs font-black uppercase tracking-widest opacity-30">Loading Books...</p>
                    </div>
                ) : (
                    <div className="space-y-6 pb-20">
                        {SEMESTERS.map((sem) => {
                            const semSubjects = subjects.filter(s => {
                                const subjectSem = s.sem?.toLowerCase() || '';
                                return s.sem === sem || subjectSem === 'all' || subjectSem === 'all semester';
                            });
                            
                            const isCurrentSem = userProfile?.sem === sem;
                            const isOpen = !!openSemesters[sem];

                            return (
                                <div 
                                    key={sem} 
                                    ref={isCurrentSem ? currentSemRef : null}
                                    className={`border-2 transition-all bg-white dark:bg-zinc-900 ${isCurrentSem ? 'border-purple-500 shadow-[8px_8px_0px_0px_#8b5cf6]' : 'border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:-translate-y-1 hover:-translate-x-1 transition-transform'}`}
                                >
                                    <button
                                        onClick={() => toggleSemester(sem)}
                                        className={`w-full flex items-center justify-between p-4 md:p-6 text-left transition-colors ${
                                            isCurrentSem ? 'bg-purple-50 dark:bg-purple-900/30' : 'bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-zinc-900/80'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {isCurrentSem && (
                                                <div className="bg-purple-500 text-white px-3 py-1 text-[11px] font-black uppercase tracking-widest flex-shrink-0 relative top-[-1px]">
                                                    CURRENT
                                                </div>
                                            )}
                                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter">
                                                {sem} Semester
                                            </h2>
                                            <span className="text-xs font-mono font-bold opacity-40">({semSubjects.length} Books)</span>
                                        </div>
                                        {isOpen ? <ChevronUp className="w-6 h-6 shrink-0" /> : <ChevronDown className="w-6 h-6 shrink-0 opacity-50" />}
                                    </button>

                                    {isOpen && (
                                        <div className="p-4 md:p-6 border-t-2 border-black dark:border-white bg-gray-50 dark:bg-zinc-950">
                                            {semSubjects.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {semSubjects.map(subject => (
                                                        <div key={subject.id} className="p-4 bg-white dark:bg-zinc-900 border-2 border-dashed border-gray-300 dark:border-zinc-700 flex flex-col gap-2 relative group hover:border-black dark:hover:border-white transition-colors">
                                                            <div className="absolute top-0 right-0 bg-black text-white dark:bg-white dark:text-black px-2 py-1 text-[10px] font-black font-mono">
                                                                {subject.code}
                                                            </div>
                                                            <div className="flex items-start gap-3 mt-4">
                                                                <BookOpen className="w-5 h-5 opacity-40 shrink-0 mt-0.5 text-blue-500 dark:text-blue-400 group-hover:opacity-100 transition-opacity" />
                                                                <h3 className="font-bold text-sm uppercase leading-tight">
                                                                    {subject.name}
                                                                </h3>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-12 text-center border-2 border-dashed border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                                                    <p className="font-mono text-xs font-bold uppercase tracking-widest opacity-40">No books found for this semester.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="h-20 lg:hidden" />
        </div>
    );
}
