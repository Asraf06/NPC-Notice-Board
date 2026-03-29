'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Calendar as CalendarIcon, Clock, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Info, ExternalLink, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AttendanceRecord {
    id: string;
    uid: string;
    studentName: string;
    boardRoll: string;
    dept: string;
    sem: string;
    date: string;
    period?: string;
    status: 'present' | 'absent' | 'late';
}

export default function AttendanceOverview() {
    const { userProfile, user } = useAuth();
    const router = useRouter();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Calendar state
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    useEffect(() => {
        const fetchAttendance = async () => {
            if (!user?.uid || !userProfile?.dept || !userProfile?.sem || !userProfile?.section) {
                setLoading(false);
                return;
            }

            try {
                const attendanceQuery = query(
                    collection(db, 'attendance_records'),
                    where('uid', '==', user.uid)
                );
                
                const snapshot = await getDocs(attendanceQuery);
                const fetchedRecords: AttendanceRecord[] = [];
                snapshot.forEach(doc => {
                    fetchedRecords.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
                });

                setRecords(fetchedRecords);
            } catch (error) {
                console.error("Error fetching attendance records:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();
    }, [user?.uid, userProfile]);

    // Derived Statistics
    const stats = useMemo(() => {
        const total = records.length;
        let presentCount = 0;
        let lateCount = 0;
        let absentCount = 0;
        const distinctDates = new Set<string>();

        records.forEach(r => {
            distinctDates.add(r.date);
            if (r.status === 'present') presentCount++;
            else if (r.status === 'late') lateCount++;
            else if (r.status === 'absent') absentCount++;
        });

        const dateMap: Record<string, { total: number, attended: number, missed: number, periods: AttendanceRecord[] }> = {};
        records.forEach(r => {
            if (!dateMap[r.date]) {
                dateMap[r.date] = { total: 0, attended: 0, missed: 0, periods: [] };
            }
            dateMap[r.date].total++;
            dateMap[r.date].periods.push(r);
            if (r.status === 'present' || r.status === 'late') {
                dateMap[r.date].attended++;
            } else {
                dateMap[r.date].missed++;
            }
        });

        const attendancePercent = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;
        let fullMissedDays = 0;
        
        Object.values(dateMap).forEach(dayStats => {
            if (dayStats.total > 0 && dayStats.attended === 0) {
                fullMissedDays++;
            }
        });

        return {
            totalPeriods: total,
            present: presentCount + lateCount,
            absent: absentCount,
            percent: attendancePercent,
            totalDays: distinctDates.size,
            fullMissedDays,
            dateMap
        };
    }, [records]);

    // Calendar Generation Logic
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    
    const prevMonth = () => {
        setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
        setSelectedDate(null);
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
        setSelectedDate(null);
    };

    const getDayColorClass = (dateString: string) => {
        const dayStats = stats.dateMap[dateString];
        if (!dayStats || dayStats.total === 0) return 'bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 border-gray-100 dark:border-zinc-800 opacity-50';

        const percent = (dayStats.attended / dayStats.total) * 100;
        if (percent === 100) {
            return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500 font-bold shadow-[2px_2px_0px_rgba(168,85,247,0.5)] z-10';
        } else if (percent > 0) {
            return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-500 font-bold shadow-[2px_2px_0px_rgba(234,179,8,0.5)] z-10';
        } else {
            return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500 font-bold shadow-[2px_2px_0px_rgba(239,68,68,0.5)] z-10';
        }
    };

    const getDayString = (day: number) => {
        const d = String(day).padStart(2, '0');
        const m = String(currentMonth + 1).padStart(2, '0');
        return `${currentYear}-${m}-${d}`;
    };

    const selectedDayDetails = selectedDate ? stats.dateMap[selectedDate] : null;

    if (loading) {
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 py-8 md:py-10">
                    <div className="animate-pulse">
                        <div className="h-8 w-64 bg-gray-200 dark:bg-zinc-800 mb-8"></div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-zinc-800"></div>)}
                        </div>
                        <div className="h-96 bg-gray-200 dark:bg-zinc-800"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-8 md:py-10 pb-24 md:pb-10">
                {/* Page Title */}
                <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                            Attendance
                        </h1>
                        <p className="text-sm opacity-50 mt-1 font-mono">Your attendance history & analytics</p>
                    </div>
                    {userProfile?.isCR && (
                        <button
                            onClick={() => router.push('/attendance-manager')}
                            className="flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-xs font-bold uppercase border-2 border-black dark:border-white shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_rgba(255,255,255,0.2)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            <CalendarIcon className="w-4 h-4" />
                            Manage Attendance
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
                    {/* Total Attendance */}
                    <div className="col-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-5 border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-80 mb-1">Total Attendance</p>
                            <h2 className="text-4xl md:text-5xl font-black">{stats.percent}%</h2>
                            <p className="text-xs font-medium uppercase mt-2 opacity-90">{stats.present} / {stats.totalPeriods} Classes Attended</p>
                        </div>
                        <div className="hidden sm:block opacity-20">
                            <CheckCircle className="w-20 h-20" />
                        </div>
                    </div>

                    {/* Periods Missed */}
                    <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-500 p-4 shadow-[4px_4px_0px_rgba(239,68,68,0.4)]">
                        <AlertTriangle className="w-5 h-5 text-red-500 mb-2" />
                        <h4 className="text-2xl font-black text-red-600 dark:text-red-400">{stats.absent}</h4>
                        <p className="text-[10px] font-mono font-bold uppercase text-red-800 dark:text-red-300 mt-1">Periods Missed</p>
                    </div>

                    {/* Days Missed */}
                    <div className="bg-orange-50 dark:bg-orange-900/10 border-2 border-orange-500 p-4 shadow-[4px_4px_0px_rgba(249,115,22,0.4)]">
                        <Clock className="w-5 h-5 text-orange-500 mb-2" />
                        <h4 className="text-2xl font-black text-orange-600 dark:text-orange-400">{stats.fullMissedDays}</h4>
                        <p className="text-[10px] font-mono font-bold uppercase text-orange-800 dark:text-orange-300 mt-1">Full Days Missed</p>
                    </div>
                </div>

                {/* Calendar + Day Details */}
                <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.05)] overflow-hidden">
                    <div className="px-6 py-4 border-b-2 border-black dark:border-zinc-800 bg-indigo-50 dark:bg-indigo-900/10 flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-bold uppercase text-sm tracking-wider">Visual Calendar</h3>
                    </div>

                    <div className="p-4 md:p-6 flex flex-col xl:flex-row gap-6">
                        {/* Calendar Grid */}
                        <div className="flex-1 min-w-[300px] border-b-2 border-black/10 dark:border-zinc-800/50 xl:border-b-0 xl:border-r-2 pb-6 xl:pb-0 xl:pr-6">
                            <div className="flex items-center justify-between mb-4 bg-gray-50 dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 p-2">
                                <button onClick={prevMonth} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 border border-transparent hover:border-black dark:hover:border-zinc-600 transition-colors">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="font-mono font-black uppercase tracking-widest">{monthNames[currentMonth]} {currentYear}</span>
                                <button onClick={nextMonth} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 border border-transparent hover:border-black dark:hover:border-zinc-600 transition-colors">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
                                {weekDays.map(d => (
                                    <div key={d} className="text-center text-[10px] font-black uppercase text-gray-500 py-1">{d}</div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1 md:gap-2">
                                {Array.from({ length: firstDay }).map((_, i) => (
                                    <div key={`empty-${i}`} className="aspect-square" />
                                ))}
                                
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const dateString = getDayString(day);
                                    const hasData = !!stats.dateMap[dateString];
                                    const isSelected = selectedDate === dateString;
                                    const isClickable = hasData || userProfile?.isCR;

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => isClickable && setSelectedDate(isSelected ? null : dateString)}
                                            disabled={!isClickable}
                                            className={`
                                                aspect-square flex items-center justify-center text-xs sm:text-sm transition-all border-2
                                                ${getDayColorClass(dateString)}
                                                ${isSelected ? 'scale-110 shadow-[4px_4px_0px_rgba(0,0,0,1)] ring-2 ring-black dark:ring-white rotate-2 z-20' : 'hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_rgba(0,0,0,0.5)]'}
                                                ${!isClickable ? 'cursor-default' : 'cursor-pointer'}
                                            `}
                                            title={hasData ? 'Click to view details' : (userProfile?.isCR ? 'Click to manage this day' : 'No records')}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="mt-4 flex flex-wrap gap-3 justify-center text-[9px] font-mono font-bold uppercase tracking-wider">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-purple-100 border border-purple-400"></div> All Attended</div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-100 border border-yellow-400"></div> Partial</div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-100 border border-red-400"></div> Full Absent</div>
                            </div>
                        </div>

                        {/* Day Details Panel */}
                        <div className="flex-[1.2] flex flex-col">
                            <AnimatePresence mode="popLayout">
                                {selectedDate ? (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="bg-indigo-50 dark:bg-zinc-900 border-2 border-indigo-400 dark:border-indigo-500 p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_rgba(99,102,241,0.2)]"
                                    >
                                        <div className="flex justify-between items-center mb-3 pb-3 border-b-2 border-indigo-200 dark:border-indigo-800">
                                            <h4 className="font-mono font-black uppercase text-indigo-900 dark:text-indigo-300">
                                                Details for {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </h4>
                                            {selectedDayDetails && (
                                                <span className="text-xs font-bold px-2 py-1 bg-white dark:bg-black border border-indigo-200 dark:border-indigo-800">
                                                    {selectedDayDetails.attended}/{selectedDayDetails.total} Attended
                                                </span>
                                            )}
                                        </div>
                                        
                                        {selectedDayDetails ? (
                                            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                                {selectedDayDetails.periods.map((record) => (
                                                    <div key={record.id} className="flex justify-between items-center bg-white dark:bg-black border-2 border-black dark:border-zinc-700 p-2.5">
                                                        <div className="min-w-0 pr-3">
                                                            <div className="text-xs font-bold uppercase truncate">{record.period || 'Unknown Subject'}</div>
                                                        </div>
                                                        <div className={`px-2 py-1 text-[10px] font-black uppercase shrink-0 border-2
                                                            ${record.status === 'present' ? 'bg-green-100 text-green-700 border-green-500' : ''}
                                                            ${record.status === 'late' ? 'bg-yellow-100 text-yellow-700 border-yellow-500' : ''}
                                                            ${record.status === 'absent' ? 'bg-red-100 text-red-700 border-red-500' : ''}
                                                        `}>
                                                            {record.status}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 text-gray-500 dark:text-zinc-500 font-mono text-sm uppercase font-bold">
                                                No attendance records for this date.
                                            </div>
                                        )}
                                        
                                        {userProfile?.isCR && (
                                            <button
                                                onClick={() => router.push(`/attendance-manager?date=${selectedDate}`)}
                                                className="w-full mt-3 flex items-center justify-center gap-2 bg-black text-white dark:bg-white dark:text-black p-2.5 text-xs font-bold uppercase transition-transform hover:-translate-y-0.5 shadow-[2px_2px_0px_rgba(0,0,0,0.5)] border-2 border-transparent active:translate-y-0 active:shadow-none"
                                            >
                                                Manage This Day <ExternalLink className="w-3 h-3" />
                                            </button>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex flex-col justify-center items-center p-8 text-center"
                                    >
                                        <CalendarIcon className="w-16 h-16 opacity-10 mb-4" />
                                        <p className="font-mono text-sm font-bold uppercase opacity-40 mb-2">Select a Date</p>
                                        <p className="font-mono text-[10px] opacity-30 leading-relaxed uppercase max-w-xs">
                                            Click any colored day on the calendar to see which subjects you attended or missed.
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Info Footer */}
                <div className="mt-4 bg-gray-50 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 p-3 flex gap-3 text-sm">
                    <Info className="w-5 h-5 shrink-0 opacity-50" />
                    <p className="font-mono text-[10px] opacity-70 leading-relaxed uppercase">
                        A full day is considered missed if no periods were attended. Late arrivals count towards your attendance percentage.
                    </p>
                </div>
            </div>
        </div>
    );
}
