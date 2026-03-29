'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Calendar as CalendarIcon, Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

interface AttendanceRecord {
    id: string;
    uid: string;
    date: string;
    status: 'present' | 'absent' | 'late';
}

export default function ProfileAttendanceStats() {
    const { userProfile, user } = useAuth();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

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

        // Calculate full missed days
        const dateMap: Record<string, { total: number, attended: number }> = {};
        records.forEach(r => {
            if (!dateMap[r.date]) dateMap[r.date] = { total: 0, attended: 0 };
            dateMap[r.date].total++;
            if (r.status === 'present' || r.status === 'late') dateMap[r.date].attended++;
        });

        let fullMissedDays = 0;
        Object.values(dateMap).forEach(day => {
            if (day.total > 0 && day.attended === 0) fullMissedDays++;
        });

        const attendancePercent = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

        return {
            totalPeriods: total,
            present: presentCount + lateCount,
            absent: absentCount,
            percent: attendancePercent,
            totalDays: distinctDates.size,
            fullMissedDays,
        };
    }, [records]);

    if (loading) {
        return (
            <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-black p-6 animate-pulse">
                <div className="h-6 w-48 bg-gray-200 dark:bg-zinc-800 mb-4"></div>
                <div className="grid grid-cols-3 gap-3">
                    {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 dark:bg-zinc-800"></div>)}
                </div>
            </div>
        );
    }

    return (
        <div className="border-2 border-black dark:border-zinc-800 bg-white dark:bg-black mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.05)] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-3 border-b-2 border-black dark:border-zinc-800 bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-between">
                <h3 className="font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-500" /> Attendance
                </h3>
            </div>

            {/* Summary stats row */}
            <div className="p-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {/* Attendance % */}
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-3 border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] text-center">
                        <h4 className="text-2xl font-black">{stats.percent}%</h4>
                        <p className="text-[9px] font-mono font-bold uppercase opacity-80 mt-0.5">Attendance</p>
                    </div>

                    {/* Periods Missed */}
                    <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-400 p-3 text-center shadow-[2px_2px_0px_rgba(239,68,68,0.3)]">
                        <h4 className="text-2xl font-black text-red-600 dark:text-red-400">{stats.absent}</h4>
                        <p className="text-[9px] font-mono font-bold uppercase text-red-700 dark:text-red-300 mt-0.5">Missed</p>
                    </div>

                    {/* Days Missed */}
                    <div className="bg-orange-50 dark:bg-orange-900/10 border-2 border-orange-400 p-3 text-center shadow-[2px_2px_0px_rgba(249,115,22,0.3)]">
                        <h4 className="text-2xl font-black text-orange-600 dark:text-orange-400">{stats.fullMissedDays}</h4>
                        <p className="text-[9px] font-mono font-bold uppercase text-orange-700 dark:text-orange-300 mt-0.5">Days Off</p>
                    </div>
                </div>

                {/* Link to full overview */}
                <Link
                    href="/attendance"
                    className="w-full flex items-center justify-center gap-2 bg-gray-50 dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 px-4 py-2.5 text-xs font-bold uppercase hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all group shadow-[3px_3px_0px_rgba(0,0,0,0.2)] hover:shadow-[1px_1px_0px_rgba(0,0,0,0.2)] hover:translate-x-[1px] hover:translate-y-[1px]"
                >
                    <CalendarIcon className="w-4 h-4 opacity-60" />
                    View Full Calendar & History
                    <ArrowRight className="w-3 h-3 opacity-50 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>
        </div>
    );
}
