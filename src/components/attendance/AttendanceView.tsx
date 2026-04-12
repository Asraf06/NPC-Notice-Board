'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, getDoc, onSnapshot, writeBatch, deleteDoc } from 'firebase/firestore';
import { ClipboardCheck, Calendar, Search, Save, AlertCircle, CheckCircle2, History, Clock, Users, UserCheck, UserX, Timer, Settings2, Layers, Radio, Trash2, Plus, MapPin } from 'lucide-react';
import PeriodGroupConfig, { PeriodGroupsConfig, PeriodGroup } from './PeriodGroupConfig';
import CustomSelect from '@/components/CustomSelect';

interface StudentListRecord {
    id: string;
    name: string;
    boardRoll: string;
}

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
    scannedAt?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    manualEntry?: boolean;
    scanMethod?: string;
    location?: {
        latitude: number;
        longitude: number;
        distance?: number;
    };
}

// Represents a resolved period for the dropdown (may be a single period or a merged group)
interface ResolvedPeriod {
    key: string;           // Unique key used for Firestore doc IDs and as the period selector value
    displayLabel: string;  // e.g. "Mathematics (Period 1-2)" or "09:00 AM-09:45 AM — English"
    subject: string;
    rawPeriods: string[];  // The raw time strings this resolved period covers
    isGroup: boolean;
}

// QR scan record (from attendance_sessions with scanMethod='qr')
interface QRScanRecord {
    id: string;
    studentName: string;
    boardRoll: string;
    scannedAt: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    location?: { distance?: number };
    uid: string;
}

type ActiveSection = 'live-feed' | 'attendance-sheet' | 'manual-add';

export default function AttendanceView() {
    const { userProfile } = useAuth();
    const { showToast, showAlert } = useUI();

    const getInitialDate = () => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const dateParam = params.get('date');
            if (dateParam) return dateParam;
        }
        return new Date().toISOString().split('T')[0];
    };

    const [selectedDate, setSelectedDate] = useState<string>(getInitialDate());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isPublished, setIsPublished] = useState(false);
    const [studentList, setStudentList] = useState<StudentListRecord[]>([]);
    const [publishing, setPublishing] = useState(false);

    // Section Toggle
    const [activeSection, setActiveSection] = useState<ActiveSection>('attendance-sheet');

    // Live QR Feed
    const [qrScans, setQrScans] = useState<QRScanRecord[]>([]);

    // Manual Add
    const [manualSearchQuery, setManualSearchQuery] = useState('');

    // Routine Integration State
    const [routineData, setRoutineData] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [availablePeriods, setAvailablePeriods] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Period Grouping State
    const [periodGroups, setPeriodGroups] = useState<PeriodGroupsConfig>({});
    const [showGroupConfig, setShowGroupConfig] = useState(false);
    const [resolvedPeriods, setResolvedPeriods] = useState<ResolvedPeriod[]>([]);

    // Fetch Routine Data
    useEffect(() => {
        if (!userProfile?.dept || !userProfile?.sem || !userProfile?.section) return;
        
        const docId = `${userProfile.section}_${userProfile.dept}_${userProfile.sem}`.replace(/\s+/g, '_').toLowerCase();
        
        getDoc(doc(db, 'routines', docId)).then((snap) => {
            if (snap.exists()) {
                setRoutineData(snap.data());
            }
        });
    }, [userProfile]);

    // Handle Date/Routine overlap to compute available periods AND resolve groups
    useEffect(() => {
        if (!routineData) return;

        const dayName = new Date(selectedDate + 'T00:00:00')
            .toLocaleDateString('en-US', { weekday: 'short' })
            .toUpperCase();

        const periodsForDay = routineData.schedule[dayName] || [];
        setAvailablePeriods(periodsForDay);

        // ── Resolve periods: merge grouped ones into single entries ──
        const dayGroups: PeriodGroup[] = periodGroups[dayName] || [];
        const consumed = new Set<string>();
        const resolved: ResolvedPeriod[] = [];

        for (let i = 0; i < periodsForDay.length; i++) {
            const p = periodsForDay[i];
            if (consumed.has(p.time)) continue;

            // Check if this period belongs to a group
            const matchingGroup = dayGroups.find(g => g.periods.includes(p.time));

            if (matchingGroup) {
                // Add all periods in the group to consumed
                matchingGroup.periods.forEach(pt => consumed.add(pt));
                resolved.push({
                    key: matchingGroup.periods.join('__'),  // Unique composite key
                    displayLabel: matchingGroup.displayLabel,
                    subject: matchingGroup.subject,
                    rawPeriods: matchingGroup.periods,
                    isGroup: true,
                });
            } else {
                consumed.add(p.time);
                resolved.push({
                    key: p.time,
                    displayLabel: `${p.time} — ${p.subject}`,
                    subject: p.subject,
                    rawPeriods: [p.time],
                    isGroup: false,
                });
            }
        }
        setResolvedPeriods(resolved);

        // Helper to parse time strings like "09:45 AM" or "14:30" or "09:45-10:30" to minutes
        const parseTimeToMins = (tStr: string) => {
            let [time, modifier] = tStr.trim().split(/\s+/);
            if (!time) return 0;
            let [hours, mins] = time.split(':').map(Number); // eslint-disable-line prefer-const
            
            if (modifier) {
                modifier = modifier.toUpperCase();
                if (hours === 12 && modifier === 'AM') hours = 0;
                if (hours < 12 && modifier === 'PM') hours += 12;
            }
            return hours * 60 + (mins || 0);
        };

        // Pre-select period using resolved periods. If today, try to match current time.
        if (resolved.length > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (selectedDate === todayStr) {
                const now = new Date();
                const curMins = now.getHours() * 60 + now.getMinutes();
                
                let foundKey = resolved[0].key;
                let minDiff = Infinity;
                
                for (const rp of resolved) {
                    // Use the first raw period's start and last raw period's end for time matching
                    const firstTime = rp.rawPeriods[0];
                    const lastTime = rp.rawPeriods[rp.rawPeriods.length - 1];
                    const startParts = firstTime.split('-').map((s: string) => s.trim());
                    const endParts = lastTime.split('-').map((s: string) => s.trim());

                    if (startParts.length >= 1 && endParts.length >= 2) {
                        const startMins = parseTimeToMins(startParts[0]);
                        const endMins = parseTimeToMins(endParts[1] || endParts[0]);
                        
                        if (curMins >= startMins && curMins <= endMins) {
                            foundKey = rp.key;
                            break;
                        }
                        
                        if (startMins > curMins) {
                            const diff = startMins - curMins;
                            if (diff < minDiff) {
                                minDiff = diff;
                                foundKey = rp.key;
                            }
                        }
                    }
                }
                
                // Fallback: select last resolved period if all are past
                const lastResolved = resolved[resolved.length - 1];
                const lastTimePart = lastResolved.rawPeriods[lastResolved.rawPeriods.length - 1].split('-')[1] || '0:0';
                if (minDiff === Infinity && curMins > parseTimeToMins(lastTimePart.trim())) {
                    foundKey = lastResolved.key;
                }

                setSelectedPeriod(foundKey);
            } else {
                setSelectedPeriod(resolved[0].key);
            }
        } else {
            setSelectedPeriod('');
            setRecords([]);
        }
    }, [selectedDate, routineData, periodGroups]);

    // Load student roster from registered students AND period groups for the CR's class
    useEffect(() => {
        if (!userProfile?.isCR) return;

        const loadClassData = async () => {
            if (!userProfile.dept || !userProfile.sem) return;
            const classDocId = `${userProfile.dept}_${userProfile.sem}`;

            try {
                // 1. Auto-build roster from ALL registered students in this dept+sem
                const studentsQuery = query(
                    collection(db, 'students'),
                    where('dept', '==', userProfile.dept),
                    where('sem', '==', userProfile.sem)
                );
                const studentsSnap = await getDocs(studentsQuery);
                
                if (!studentsSnap.empty) {
                    const roster: StudentListRecord[] = studentsSnap.docs
                        .map(d => {
                            const data = d.data();
                            return {
                                id: d.id,
                                name: data.name || 'Unknown',
                                boardRoll: (data.roll || '').toString(),
                            };
                        })
                        .filter(s => s.boardRoll) // skip empty rolls
                        .sort((a, b) => parseInt(a.boardRoll) - parseInt(b.boardRoll));
                    
                    setStudentList(roster);
                }

                // 2. Load period groups config (kept in attendance_metadata)
                const metaDoc = await getDoc(doc(db, 'attendance_metadata', classDocId));
                if (metaDoc.exists()) {
                    const data = metaDoc.data();
                    if (data.periodGroups) {
                        setPeriodGroups(data.periodGroups as PeriodGroupsConfig);
                    }
                }
            } catch (err) {
                console.error("Error loading class data:", err);
            }
        };

        loadClassData();
    }, [userProfile]);

    // Save period groups to Firestore
    const handleSavePeriodGroups = async (groups: PeriodGroupsConfig) => {
        if (!userProfile?.dept || !userProfile?.sem) return;
        const classDocId = `${userProfile.dept}_${userProfile.sem}`;
        try {
            await setDoc(doc(db, 'attendance_metadata', classDocId), {
                periodGroups: groups,
            }, { merge: true });
            setPeriodGroups(groups);
            showToast('Period groups saved! They will apply every week automatically.');
        } catch (err) {
            console.error('Error saving period groups:', err);
            showToast('Failed to save period groups.');
            throw err;
        }
    };

    const checkIfPublished = async (): Promise<boolean> => {
        if (!userProfile?.dept || !userProfile?.sem || !selectedPeriod) return false;
        try {
            const docId = `${userProfile.dept}_${userProfile.sem}_${selectedDate}_${selectedPeriod.replace(/[^a-zA-Z0-9]/g, '')}`;
            const pDoc = await getDoc(doc(db, 'attendance_publish', docId));
            const published = pDoc.exists() && pDoc.data().status === 'published';
            setIsPublished(published);
            return published;
        } catch (error) {
            console.error("Error checking publish status:", error);
            return false;
        }
    };

    // Check publish status when date/period changes
    useEffect(() => {
        if (!userProfile?.isCR) return;
        if (!selectedPeriod) return;
        checkIfPublished();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, selectedPeriod, userProfile]);

    // ─── LIVE QR FEED: Listen for real-time QR scans ───
    useEffect(() => {
        if (!userProfile?.isCR || !selectedPeriod || !userProfile.dept || !userProfile.sem) {
            setQrScans([]);
            return;
        }

        const q = query(
            collection(db, 'attendance_sessions'),
            where('dept', '==', userProfile.dept),
            where('sem', '==', userProfile.sem),
            where('date', '==', selectedDate),
            where('period', '==', selectedPeriod)
        );

        const unsubscribe = onSnapshot(q, {
            next: (snapshot) => {
                const scans: QRScanRecord[] = snapshot.docs
                    .filter(d => d.data().scanMethod === 'qr')
                    .map(d => ({
                        id: d.id,
                        studentName: d.data().studentName,
                        boardRoll: d.data().boardRoll,
                        scannedAt: d.data().scannedAt,
                        location: d.data().location,
                        uid: d.data().uid,
                    }));
                setQrScans(scans);
            },
            error: (err) => console.error("QR Feed error:", err),
        });

        return () => unsubscribe();
    }, [selectedDate, selectedPeriod, userProfile]);

    // ─── ATTENDANCE SHEET: Merge student list with sessions/records ───
    useEffect(() => {
        if (!userProfile?.isCR) return;
        if (!selectedPeriod) return;
        if (!userProfile.dept || !userProfile.sem || studentList.length === 0) {
            setRecords([]);
            return;
        }

        setLoading(true);
        const targetCollection = isPublished ? "attendance_records" : "attendance_sessions";

        const q = query(
            collection(db, targetCollection),
            where("dept", "==", userProfile.dept),
            where("sem", "==", userProfile.sem),
            where("date", "==", selectedDate),
            where("period", "==", selectedPeriod)
        );

        const unsubscribe = onSnapshot(q, {
            next: (snapshot) => {
                const fetchedRecords: AttendanceRecord[] = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                } as AttendanceRecord));

                // Merge with ALL known students. Missing students show as absent.
                const mergedRecords: AttendanceRecord[] = studentList.map(student => {
                    const existingRec = fetchedRecords.find(r => r.boardRoll === student.boardRoll);
                    if (existingRec) return existingRec;

                    return {
                        id: `local_${student.boardRoll}`,
                        uid: '',
                        studentName: student.name,
                        boardRoll: student.boardRoll,
                        dept: userProfile.dept!,
                        sem: userProfile.sem!,
                        date: selectedDate,
                        period: selectedPeriod,
                        status: 'absent' as const
                    };
                });

                mergedRecords.sort((a, b) => parseInt(a.boardRoll) - parseInt(b.boardRoll));
                setRecords(mergedRecords);
                setLoading(false);
            },
            error: (error) => {
                console.error('Error fetching roster/records:', error);
                showToast('Error loading attendance data: ' + (error instanceof Error ? error.message : 'Unknown error'));
                setLoading(false);
            }
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, selectedPeriod, userProfile, studentList, isPublished]);

    const handleCopyPreviousPeriod = async () => {
        if (!availablePeriods.length || !selectedPeriod) return;
        
        const currentIndex = availablePeriods.findIndex(p => p.time === selectedPeriod);
        if (currentIndex <= 0) {
            showToast("No previous period to copy from today.");
            return;
        }

        const prevPeriodTime = availablePeriods[currentIndex - 1].time;
        
        showAlert(
            "Copy Previous Attendance", 
            `Bring over attendance from the previous period (${prevPeriodTime})? This will override current unsaved changes.`,
            "warning",
            async () => {
                setLoading(true);
                try {
                    const q = query(
                        collection(db, "attendance_records"),
                        where("dept", "==", userProfile!.dept),
                        where("sem", "==", userProfile!.sem),
                        where("date", "==", selectedDate),
                        where("period", "==", prevPeriodTime)
                    );
                    const prevSnap = await getDocs(q);
                    
                    if (prevSnap.empty) {
                        showToast("No attendance recorded for the previous period.");
                        return;
                    }

                    const prevDict: Record<string, 'present'|'absent'|'late'> = {};
                    prevSnap.forEach(d => { prevDict[d.data().boardRoll] = d.data().status; });

                    const targetCollection = isPublished ? "attendance_records" : "attendance_sessions";
                    const cleanPeriod = selectedPeriod.replace(/[^a-zA-Z0-9]/g, '');
                    const batch = writeBatch(db);
                    let hasWrites = false;

                    for (const student of studentList) {
                         const status = prevDict[student.boardRoll] || 'absent';
                         const newDocId = `${student.boardRoll}_${selectedDate}_${cleanPeriod}`;
                         const docRef = doc(db, targetCollection, newDocId);
                         batch.set(docRef, {
                            uid: '', 
                            studentName: student.name,
                            boardRoll: student.boardRoll,
                            dept: userProfile!.dept,
                            sem: userProfile!.sem,
                            date: selectedDate,
                            period: selectedPeriod,
                            status: status,
                            scannedAt: new Date(),
                            manualEntry: true,
                            addedBy: userProfile!.uid
                         });
                         hasWrites = true;
                    }

                    if (hasWrites) await batch.commit();
                    
                    showToast("Copied from previous period. Remember to Publish/Update.");
                } catch(e) {
                    console.error(e);
                    showToast("Failed to copy previous period.");
                } finally {
                    setLoading(false);
                }
            }
        );
    };

    const handleStatusChange = async (recordId: string, newStatus: 'present' | 'absent' | 'late') => {

        const record = records.find(r => r.id === recordId);
        if (!record) return;

        const oldStatus = record.status;
        // Optimistic update
        setRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: newStatus } : r));

        const targetCollection = isPublished ? "attendance_records" : "attendance_sessions";

        try {
            if (recordId.startsWith('local_')) {
                const cleanPeriod = selectedPeriod.replace(/[^a-zA-Z0-9]/g, '');
                const customId = `${record.boardRoll}_${selectedDate}_${cleanPeriod}`;
                const newDocRef = doc(db, targetCollection, customId);
                
                await setDoc(newDocRef, {
                    uid: record.uid || '',
                    studentName: record.studentName,
                    boardRoll: record.boardRoll,
                    dept: record.dept,
                    sem: record.sem,
                    date: record.date,
                    period: selectedPeriod,
                    status: newStatus,
                    scannedAt: new Date(),
                    manualEntry: true,
                    addedBy: userProfile?.uid
                });
            } else {
                await updateDoc(doc(db, targetCollection, recordId), { status: newStatus });
            }
            showToast("Status updated!");
        } catch (error) {
            console.error("Error updating record:", error);
            showToast("Failed to update status.");
            // Revert
            setRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: oldStatus } : r));
        }
    };

    // Delete a QR scan from the live feed
    const handleDeleteQRScan = async (scanId: string) => {
        showAlert(
            "Remove QR Scan",
            "Remove this student's QR scan? They'll appear as absent.",
            "warning",
            async () => {
                try {
                    await deleteDoc(doc(db, 'attendance_sessions', scanId));
                    showToast("Scan removed.");
                } catch (err) {
                    console.error(err);
                    showToast("Failed to remove scan.");
                }
            }
        );
    };

    // Manual add a student with a specific status
    const handleManualAdd = async (student: StudentListRecord, status: 'present' | 'late') => {
        if (!selectedPeriod || !userProfile) return;
        const cleanPeriod = selectedPeriod.replace(/[^a-zA-Z0-9]/g, '');
        const customId = `${student.boardRoll}_${selectedDate}_${cleanPeriod}`;
        const targetCollection = isPublished ? "attendance_records" : "attendance_sessions";

        try {
            await setDoc(doc(db, targetCollection, customId), {
                uid: '',
                studentName: student.name,
                boardRoll: student.boardRoll,
                dept: userProfile.dept,
                sem: userProfile.sem,
                date: selectedDate,
                period: selectedPeriod,
                status: status,
                scannedAt: new Date(),
                manualEntry: true,
                scanMethod: 'manual',
                addedBy: userProfile.uid
            });
            showToast(`${student.name} marked as ${status}.`);
        } catch (err) {
            console.error(err);
            showToast("Failed to add student.");
        }
    };

    const markAllAs = (status: 'present' | 'absent') => {
        showAlert(
            `Mark All ${status === 'present' ? 'Present' : 'Absent'}`,
            `Are you sure you want to mark ALL ${records.length} students as ${status}?`,
            "warning",
            () => {
                records.forEach(r => {
                    if (r.status !== status) {
                        handleStatusChange(r.id, status);
                    }
                });
            }
        );
    };

    const handlePublish = async () => {
        if (!userProfile?.dept || !userProfile?.sem || !selectedDate || !selectedPeriod) return;

        // Confirmation
        showAlert(
            isPublished ? "Confirm Update" : "Confirm Publish",
            isPublished ? `Are you sure you want to update this period's (${selectedPeriod}) attendance report?` : `Are you sure you want to PUBLISH attendance for ${selectedPeriod}?`,
            "warning",
            async () => {
                setPublishing(true);
                try {
                    const cleanPeriod = selectedPeriod.replace(/[^a-zA-Z0-9]/g, '');
                    
                    if (!isPublished) {
                        const batch = writeBatch(db);
                        let hasWrites = false;
                        
                        // Push everything to attendance_records
                        for (const rec of records) {
                            const newRecId = `${rec.boardRoll}_${selectedDate}_${cleanPeriod}`;
                            const newDocRef = doc(db, 'attendance_records', newRecId);
                            
                            batch.set(newDocRef, {
                                uid: rec.uid || '',
                                studentName: rec.studentName,
                                boardRoll: rec.boardRoll,
                                dept: rec.dept,
                                sem: rec.sem,
                                date: rec.date,
                                period: selectedPeriod,
                                status: rec.status,
                                scannedAt: rec.scannedAt || new Date(),
                                manualEntry: rec.id.startsWith('local_') || rec.manualEntry || false,
                                scanMethod: rec.scanMethod || (rec.id.startsWith('local_') ? 'manual' : 'unknown'),
                                location: rec.location || null,
                                addedBy: userProfile!.uid
                            });

                            // Clear from sessions (unless local)
                            if (!rec.id.startsWith('local_')) {
                                batch.delete(doc(db, 'attendance_sessions', rec.id));
                            }
                            hasWrites = true;
                        }

                        if (hasWrites) await batch.commit();
                    }

                    const docId = `${userProfile!.dept}_${userProfile!.sem}_${selectedDate}_${cleanPeriod}`;
                    await setDoc(doc(db, 'attendance_publish', docId), {
                        status: 'published',
                        publishedAt: new Date(),
                        publishedBy: userProfile!.uid,
                        publishedByName: userProfile!.name,
                        dept: userProfile!.dept,
                        sem: userProfile!.sem,
                        date: selectedDate,
                        period: selectedPeriod,
                        totalStudents: records.length,
                        present: records.filter(r => r.status === 'present').length,
                        absent: records.filter(r => r.status === 'absent').length,
                        late: records.filter(r => r.status === 'late').length,
                    });

                    setIsPublished(true);
                    showAlert("Success", isPublished ? "Attendance report has been updated!" : "Attendance report has been published!", "success");
                } catch (err) {
                    console.error("Error publishing:", err);
                    showAlert("Error", "Failed to publish attendance.", "error");
                } finally {
                    setPublishing(false);
                }
            }
        );
    };

    // Access guard
    if (!userProfile?.isCR) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center p-8 max-w-sm border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_rgba(255,255,255,0.1)]" style={{ borderRadius: '2px' }}>
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-black font-mono uppercase mb-2">Access Denied</h2>
                    <p className="text-sm font-mono opacity-70">Only Class Representatives (CR) can view and manage attendance here.</p>
                </div>
            </div>
        );
    }

    const filteredRecords = records.filter(r =>
        r.status !== 'absent' &&
        (r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
         r.boardRoll.includes(searchQuery))
    );

    const stats = {
        present: records.filter(r => r.status === 'present').length,
        absent: records.filter(r => r.status === 'absent').length,
        late: records.filter(r => r.status === 'late').length,
        total: records.length
    };

    const attendancePercent = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;

    const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Filter students not yet in attendance for manual add
    const studentsNotInSheet = studentList.filter(
        s => !records.find(r => r.boardRoll === s.boardRoll && r.status !== 'absent')
    ).filter(
        s => s.name.toLowerCase().includes(manualSearchQuery.toLowerCase()) || s.boardRoll.includes(manualSearchQuery)
    );

    return (
        <div className="w-full h-full overflow-y-auto pb-0 relative">
            {/* ─── Top Header Bar ─── */}
            <div className="border-b-2 border-black dark:border-zinc-700 bg-yellow-300 dark:bg-yellow-500/90 px-4 md:px-6 py-4">
                <div className="flex flex-col md:flex-row gap-3 md:gap-0 items-start md:items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-black p-2.5 border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.3)]">
                            <ClipboardCheck className="w-6 h-6 text-yellow-300" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black font-mono uppercase tracking-tight leading-none text-black">
                                Attendance Manager
                            </h1>
                            <p className="text-xs font-mono font-bold opacity-70 uppercase text-black mt-0.5">
                                {userProfile.dept} — Semester {userProfile.sem} • CR Panel
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-end gap-3 w-full md:w-auto min-w-0">
                        <div className="flex flex-col items-start gap-1 w-full md:w-auto min-w-0">
                            <span className="text-[10px] font-black font-mono uppercase tracking-wider text-black/60">Select Date</span>
                            <div className="relative w-full md:w-[150px] flex items-center border-2 border-black bg-white font-mono text-sm font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-shadow">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none" />
                                <div className="w-full pl-9 pr-3 py-2 text-black pointer-events-none">
                                    {selectedDate ? selectedDate.split('-').reverse().join('/') : 'DD/MM/YYYY'}
                                </div>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    title="Select Date"
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onClick={(e) => {
                                        try {
                                            if ('showPicker' in HTMLInputElement.prototype) {
                                                (e.target as HTMLInputElement).showPicker();
                                            }
                                        } catch (err) {
                                            // Fallback for browsers that don't support showPicker automatically
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col items-start gap-1 w-full md:w-auto min-w-0">
                            <span className="text-[10px] font-black font-mono uppercase tracking-wider text-black/60">Select Period / Subject</span>
                            <div className="flex items-center gap-2 w-full min-w-0">
                                <CustomSelect 
                                    className="w-full md:w-[280px] min-w-0 px-3 py-2 border-2 border-black bg-white text-black font-mono text-sm font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)] flex-1 hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-shadow focus:outline-none appearance-none"
                                    value={selectedPeriod}
                                    onChange={setSelectedPeriod}
                                    options={resolvedPeriods.length === 0 ? [{ value: '', label: 'No Classes Scheduled' }] : resolvedPeriods.map(rp => ({ value: rp.key, label: rp.isGroup ? `🔗 ${rp.displayLabel}` : rp.displayLabel }))}
                                    placeholder="Select Period"
                                />
                                <button
                                    onClick={() => setShowGroupConfig(true)}
                                    className="p-2 border-2 border-black bg-indigo-100 text-indigo-800 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] transition-all active:shadow-none active:translate-y-[2px] active:translate-x-[2px]"
                                    title="Configure Period Groups"
                                >
                                    <Layers className={`w-4 h-4`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <p className="text-xs font-mono font-semibold text-black/60 mt-2">{formattedDate}</p>
            </div>

            {/* ─── Section Switcher Tabs ─── */}
            <div className="flex border-b-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-x-auto">
                <SectionTab
                    label="📡 Live QR Feed"
                    badge={qrScans.length}
                    active={activeSection === 'live-feed'}
                    onClick={() => setActiveSection('live-feed')}
                />
                <SectionTab
                    label="📋 Attendance Sheet"
                    badge={stats.present + stats.late}
                    active={activeSection === 'attendance-sheet'}
                    onClick={() => setActiveSection('attendance-sheet')}
                />
                <SectionTab
                    label="➕ Manual Add"
                    active={activeSection === 'manual-add'}
                    onClick={() => setActiveSection('manual-add')}
                />
            </div>

            {/* ─── Main Content Area ─── */}
            <div className="px-4 md:px-6 mt-4 w-full pb-32">

                {/* ══════ SECTION 1: LIVE QR FEED ══════ */}
                {activeSection === 'live-feed' && (
                    <div className="animate-in fade-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-black font-mono uppercase tracking-tight flex items-center gap-2">
                                    <Radio className="w-5 h-5 text-green-500 animate-pulse" /> Live QR Scans
                                </h2>
                                <p className="text-[10px] font-mono opacity-50 uppercase">Students who scanned the QR code appear here in real-time</p>
                            </div>
                            <div className="bg-green-100 dark:bg-green-900/30 border-2 border-green-500 px-3 py-1 font-mono text-sm font-black text-green-700 dark:text-green-400">
                                {qrScans.length} scanned
                            </div>
                        </div>

                        {qrScans.length === 0 ? (
                            <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 p-12 text-center">
                                <Radio className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p className="font-mono text-sm font-bold uppercase opacity-40">Waiting for QR scans...</p>
                                <p className="font-mono text-xs opacity-30 mt-1">Students will appear here as they scan the class QR code</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {qrScans.map((scan, i) => (
                                    <div key={scan.id} className="flex items-center justify-between p-3 border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_rgba(255,255,255,0.1)] hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="w-7 h-7 flex items-center justify-center bg-green-100 dark:bg-green-900/40 border-2 border-green-500 text-green-700 dark:text-green-400 font-black font-mono text-xs">
                                                {i + 1}
                                            </span>
                                            <div>
                                                <h4 className="font-bold font-mono text-sm">{scan.studentName}</h4>
                                                <div className="flex items-center gap-2 text-[10px] font-mono opacity-60">
                                                    <span>Roll: {scan.boardRoll}</span>
                                                    {scan.scannedAt && (
                                                        <span className="flex items-center gap-0.5">
                                                            <Clock className="w-2.5 h-2.5" />
                                                            {(scan.scannedAt?.toDate?.() || new Date(scan.scannedAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                    {scan.location?.distance !== undefined && (
                                                        <span className="flex items-center gap-0.5">
                                                            <MapPin className="w-2.5 h-2.5" />
                                                            {scan.location.distance}m away
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteQRScan(scan.id)}
                                            className="p-2 border-2 border-red-300 dark:border-red-700 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                            title="Remove (cheating detected)"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ══════ SECTION 2: ATTENDANCE SHEET ══════ */}
                {activeSection === 'attendance-sheet' && (
                    <div className="animate-in fade-in duration-200">
                        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 w-full">

                            {/* ─── LEFT SIDEBAR: Stats & Quick Actions ─── */}
                            <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-4">

                                {/* Published Banner */}
                                {isPublished && (
                                    <div className="border-2 border-green-600 bg-green-100 dark:bg-green-900/30 p-3 flex items-center gap-2 text-green-800 dark:text-green-300 font-mono text-xs font-bold uppercase shadow-[3px_3px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_rgba(255,255,255,0.1)]">
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        Published & Saved
                                    </div>
                                )}

                                {/* Attendance % Ring */}
                                <div className="border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_rgba(255,255,255,0.1)] p-5">
                                    <div className="text-[10px] font-bold font-mono uppercase tracking-widest opacity-50 mb-3">Today&apos;s Overview</div>
                                    <div className="flex items-center justify-center mb-4">
                                        <div className="relative w-28 h-28">
                                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-gray-200 dark:stroke-zinc-700" />
                                                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                                                    strokeDasharray={`${attendancePercent * 2.64} 264`}
                                                    strokeLinecap="round"
                                                    className={attendancePercent >= 75 ? 'stroke-green-500' : attendancePercent >= 50 ? 'stroke-yellow-500' : 'stroke-red-500'}
                                                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-2xl font-black font-mono">{attendancePercent}%</span>
                                                <span className="text-[9px] font-mono uppercase opacity-50 font-bold">Attendance</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <StatCard icon={<Users className="w-4 h-4" />} label="Total" value={stats.total} color="text-black dark:text-white" bg="bg-gray-100 dark:bg-zinc-800" />
                                        <StatCard icon={<UserCheck className="w-4 h-4" />} label="Present" value={stats.present} color="text-green-700 dark:text-green-400" bg="bg-green-50 dark:bg-green-900/20" />
                                        <StatCard icon={<UserX className="w-4 h-4" />} label="Absent" value={stats.absent} color="text-red-700 dark:text-red-400" bg="bg-red-50 dark:bg-red-900/20" />
                                        <StatCard icon={<Timer className="w-4 h-4" />} label="Late" value={stats.late} color="text-yellow-700 dark:text-yellow-400" bg="bg-yellow-50 dark:bg-yellow-900/20" />
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                {studentList.length > 0 && records.length > 0 && (
                                    <div className="border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_rgba(255,255,255,0.1)] p-4">
                                        <div className="text-[10px] font-bold font-mono uppercase tracking-widest opacity-50 mb-3">Quick Actions</div>
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => handleCopyPreviousPeriod()}
                                                disabled={loading || availablePeriods.length <= 1}
                                                className="w-full px-3 py-2 border-2 border-black dark:border-zinc-600 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.05)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ClipboardCheck className="w-3.5 h-3.5" /> Copy Previous Period
                                            </button>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => markAllAs('present')}
                                                    className="w-full px-3 py-2 border-2 border-black dark:border-zinc-600 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.05)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                                                >
                                                    <UserCheck className="w-3.5 h-3.5" /> All Present
                                                </button>
                                                <button
                                                    onClick={() => markAllAs('absent')}
                                                    className="w-full px-3 py-2 border-2 border-black dark:border-zinc-600 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.05)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                                                >
                                                    <UserX className="w-3.5 h-3.5" /> All Absent
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ─── RIGHT: Student List ─── */}
                            <div className="flex-1 min-w-0">
                                {/* Search Bar */}
                                <div className="mb-3">
                                    {studentList.length === 0 ? (
                                        <div className="p-3 border-2 border-dashed border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-sm font-mono text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                            <p><strong>No students found!</strong> No students have registered for {userProfile.dept} — Semester {userProfile.sem} yet. The roster auto-populates from registered users.</p>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                                            <input
                                                type="text"
                                                placeholder="Search by name or board roll..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-4 py-3 bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-600 focus:bg-gray-50 dark:focus:bg-zinc-800 outline-none font-mono text-sm transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_rgba(255,255,255,0.1)]"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Table Header */}
                                {filteredRecords.length > 0 && (
                                    <div className="hidden md:grid grid-cols-[40px_1fr_120px_240px] gap-2 px-4 py-2 border-2 border-black dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 font-mono text-[10px] font-black uppercase tracking-wider opacity-70 mb-0 shadow-[3px_3px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_rgba(255,255,255,0.1)]">
                                        <span>#</span>
                                        <span>Student</span>
                                        <span className="text-center">Info</span>
                                        <span className="text-center">Status</span>
                                    </div>
                                )}

                                {/* Student Records */}
                                <div className="border-2 border-black dark:border-zinc-700 border-t-0 md:border-t-0 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_rgba(255,255,255,0.1)] min-h-[200px]">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center p-16 opacity-50">
                                            <History className="w-8 h-8 animate-spin mb-4" />
                                            <span className="font-mono text-sm uppercase font-bold">Loading records...</span>
                                        </div>
                                    ) : filteredRecords.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-16 opacity-40 text-center">
                                            <Calendar className="w-12 h-12 mb-4 mx-auto" />
                                            <span className="font-mono text-base uppercase font-black">No Records</span>
                                            <p className="font-mono text-xs max-w-xs mt-2">
                                                {studentList.length === 0 ? "No students registered yet." : "No attendance data for this date yet."}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-200 dark:divide-zinc-800">
                                            {filteredRecords.map((record, index) => (
                                                <div key={record.id} className="p-3 md:p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors md:grid md:grid-cols-[40px_1fr_120px_240px] md:gap-2">
                                                    {/* # Number */}
                                                    <span className="hidden md:flex items-center justify-center text-xs font-mono font-bold opacity-40 w-6 h-6 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600">
                                                        {index + 1}
                                                    </span>

                                                    {/* Student Info */}
                                                    <div className="min-w-0 flex items-center gap-2">
                                                        <span className="md:hidden text-[10px] font-mono font-bold opacity-30 bg-gray-200 dark:bg-zinc-700 w-5 h-5 flex items-center justify-center shrink-0 border border-gray-300 dark:border-zinc-600">
                                                            {index + 1}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <h3 className="font-bold font-mono tracking-tight text-sm leading-tight truncate">{record.studentName}</h3>
                                                            <span className="text-[10px] font-mono font-medium opacity-50">Roll: {record.boardRoll}</span>
                                                        </div>
                                                    </div>

                                                    {/* Info Tags */}
                                                    <div className="flex gap-1.5 items-center justify-start md:justify-center text-[10px] font-mono font-medium pl-7 md:pl-0">
                                                        {record.scannedAt && !record.id.startsWith('local_') && (
                                                            <span className="flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 border border-blue-300 dark:border-blue-700">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {(record.scannedAt?.toDate?.() || new Date(record.scannedAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                        {record.scanMethod === 'qr' && (
                                                            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 border border-green-300 dark:border-green-700">QR</span>
                                                        )}
                                                        {record.manualEntry && (
                                                            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 border border-purple-300 dark:border-purple-700">Manual</span>
                                                        )}
                                                        {!record.scannedAt && !record.manualEntry && record.id.startsWith('local_') && (
                                                            <span className="opacity-30">—</span>
                                                        )}
                                                    </div>

                                                    {/* Status Buttons */}
                                                    <div className="flex items-center gap-1 md:gap-2 shrink-0 justify-end md:justify-center pl-7 md:pl-0">
                                                        <StatusButton
                                                            label="Present"
                                                            active={record.status === 'present'}
                                                            activeColor="bg-green-400 dark:bg-green-500"
                                                            onClick={() => handleStatusChange(record.id, 'present')}
                                                        />
                                                        <StatusButton
                                                            label="Absent"
                                                            active={record.status === 'absent'}
                                                            activeColor="bg-red-400 dark:bg-red-500"
                                                            onClick={() => handleStatusChange(record.id, 'absent')}
                                                        />
                                                        <StatusButton
                                                            label="Late"
                                                            active={record.status === 'late'}
                                                            activeColor="bg-yellow-400 dark:bg-yellow-500"
                                                            onClick={() => handleStatusChange(record.id, 'late')}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════ SECTION 3: MANUAL ADD ══════ */}
                {activeSection === 'manual-add' && (
                    <div className="animate-in fade-in duration-200">
                        <div className="mb-4">
                            <h2 className="text-lg font-black font-mono uppercase tracking-tight flex items-center gap-2">
                                <Plus className="w-5 h-5 text-purple-500" /> Manual Add Students
                            </h2>
                            <p className="text-[10px] font-mono opacity-50 uppercase">Add students who couldn&apos;t scan the QR code and set their status</p>
                        </div>

                        {/* Search */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                            <input
                                type="text"
                                placeholder="Search student by name or roll..."
                                value={manualSearchQuery}
                                onChange={(e) => setManualSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-3 bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-600 outline-none font-mono text-sm shadow-[3px_3px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_rgba(255,255,255,0.1)]"
                            />
                        </div>

                        {!selectedPeriod ? (
                            <div className="border-2 border-dashed border-amber-400 p-8 text-center">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                                <p className="font-mono text-sm font-bold uppercase opacity-60">Select a period first</p>
                            </div>
                        ) : studentsNotInSheet.length === 0 ? (
                            <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 p-8 text-center">
                                <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="font-mono text-sm font-bold uppercase opacity-40">
                                    {manualSearchQuery ? 'No matching students found' : 'All students are already in the attendance sheet'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {studentsNotInSheet.map(student => (
                                    <div key={student.id} className="flex items-center justify-between p-3 border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.1)]">
                                        <div>
                                            <h4 className="font-bold font-mono text-sm">{student.name}</h4>
                                            <span className="text-[10px] font-mono opacity-50">Roll: {student.boardRoll}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleManualAdd(student, 'present')}
                                                className="px-3 py-1.5 border-2 border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold font-mono text-xs uppercase hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                            >
                                                Present
                                            </button>
                                            <button
                                                onClick={() => handleManualAdd(student, 'late')}
                                                className="px-3 py-1.5 border-2 border-yellow-500 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-bold font-mono text-xs uppercase hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                                            >
                                                Late
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── FLOATING Publish / Update Action ─── */}
            {records.length > 0 && (
                <div className="fixed bottom-0 left-0 w-full sm:bottom-6 sm:right-6 sm:left-auto sm:w-auto z-50 px-4 pb-4 sm:p-0 pointer-events-none">
                    <div className="pointer-events-auto flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-zinc-900 p-3 sm:p-4 border-2 border-black dark:border-zinc-600 shadow-[8px_8px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_rgba(255,255,255,0.1)]">
                        <div className="flex justify-between items-center w-full sm:w-auto gap-4 md:gap-6">
                            <div className="flex flex-col items-start gap-1">
                                <div className="flex items-center gap-2 font-mono text-xs sm:text-sm font-black uppercase tracking-wider">
                                    <span className="text-green-600 dark:text-green-500">{stats.present}P</span>
                                    <span className="opacity-30">•</span>
                                    <span className="text-red-600 dark:text-red-500">{stats.absent}A</span>
                                    <span className="opacity-30">•</span>
                                    <span className="text-yellow-600 dark:text-yellow-500">{stats.late}L</span>
                                </div>
                                {isPublished && (
                                    <span className="text-[10px] font-mono font-bold uppercase text-green-600 dark:text-green-400 flex items-center gap-1 shrink-0">
                                        <CheckCircle2 className="w-3 h-3" /> Saved
                                    </span>
                                )}
                            </div>
                            
                            <button
                                onClick={handlePublish}
                                disabled={publishing || studentList.length === 0}
                                className="px-6 py-2.5 sm:py-3 border-2 border-black dark:border-white font-black font-mono uppercase text-sm flex items-center gap-2 transition-all bg-[#a3e635] text-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                            >
                                <Save className="w-5 h-5" />
                                {publishing ? (isPublished ? 'Updating...' : 'Publishing...') : (isPublished ? 'Update Report' : 'Publish Report')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ─── Period Group Configuration Modal ─── */}
            <PeriodGroupConfig
                isOpen={showGroupConfig}
                onClose={() => setShowGroupConfig(false)}
                routineData={routineData}
                existingGroups={periodGroups}
                onSave={handleSavePeriodGroups}
            />
        </div>
    );
}

// ── Sub-components ──────────────────────────────────────────

function SectionTab({ label, badge, active, onClick }: { label: string; badge?: number; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-4 flex items-center gap-2
                ${active
                    ? 'border-black dark:border-white bg-gray-100 dark:bg-zinc-800 text-black dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                }`}
        >
            {label}
            {badge !== undefined && badge > 0 && (
                <span className={`min-w-[20px] h-5 flex items-center justify-center px-1 text-[10px] font-black rounded-sm
                    ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-300 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300'}`}>
                    {badge}
                </span>
            )}
        </button>
    );
}

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: number; color: string; bg: string }) {
    return (
        <div className={`p-3 ${bg} border-2 border-black dark:border-zinc-600 shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.05)] flex items-center gap-2.5`}>
            <div className={`${color} opacity-60`}>{icon}</div>
            <div>
                <div className={`text-xl font-black font-mono leading-none ${color}`}>{value}</div>
                <div className="text-[9px] font-bold font-mono uppercase opacity-50 mt-0.5">{label}</div>
            </div>
        </div>
    );
}

function StatusButton({ label, active, activeColor, onClick }: {
    label: string;
    active: boolean;
    activeColor: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-9 h-9 md:w-auto md:h-10 px-0 md:px-3 flex items-center justify-center border-2 border-black dark:border-zinc-500 font-black font-mono text-xs uppercase transition-all active:scale-90
                ${active ? `${activeColor} text-black shadow-[2px_2px_0px_rgba(0,0,0,1)]` : 'bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 opacity-60 hover:opacity-100'}`}
        >
            <span className="md:hidden">{label.charAt(0)}</span>
            <span className="hidden md:inline">{label}</span>
        </button>
    );
}
