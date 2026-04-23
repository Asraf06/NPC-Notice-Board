'use client';
import React, { useState, useEffect } from 'react';
import { useHolidays, Holiday, scheduleHolidayNotifications } from '@/hooks/useHolidays';
import { Calendar, CalendarCheck, Settings, X, Save, Clock, ChevronLeft, ChevronRight, Bell, Cloud, Smartphone, Sun, Moon } from 'lucide-react';
import Header from '../Header';
import { useAuth } from '@/context/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function HolidaysView() {
    const { holidays, loading } = useHolidays();
    const [currentCalDate, setCurrentCalDate] = useState(new Date());
    const [showSettings, setShowSettings] = useState(false);
    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
    
    const [notifEnabled, setNotifEnabled] = useState(true);
    const [notifOffset, setNotifOffset] = useState(1);
    const [notifHour, setNotifHour] = useState(8);
    const [notifMinute, setNotifMinute] = useState(0);
    const [notifAmpm, setNotifAmpm] = useState('AM');
    const [notifEngine, setNotifEngine] = useState<'offline' | 'cloud'>('offline');
    const [cloudTimeSlot, setCloudTimeSlot] = useState<'8am' | '8pm'>('8am');
    const [isTestingCloud, setIsTestingCloud] = useState(false);
    const [isNativeApp, setIsNativeApp] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Attempt to get user from auth context safely since we need UID for testing Cloud pushes
    let auth: any;
    try { auth = useAuth(); } catch (e) { auth = null; }
    const userProfile = auth?.userProfile || null;
    const firebaseUser = auth?.user || null;

    useEffect(() => {
        const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
        if (isNative) {
            setIsNativeApp(true);
        } else {
            // Website can only use cloud engine (no Capacitor local notifications)
            setNotifEngine('cloud');
        }
        
        const prefStr = localStorage.getItem('holiday_notification_pref');
        if (prefStr) {
            const prefs = JSON.parse(prefStr);
            setNotifEnabled(prefs.enabled !== false);
            if(prefs.offsetDays !== undefined) setNotifOffset(prefs.offsetDays);
            
            if(prefs.hour !== undefined) {
                const h24 = prefs.hour;
                setNotifAmpm(h24 >= 12 ? 'PM' : 'AM');
                let h12 = h24 % 12;
                if (h12 === 0) h12 = 12;
                setNotifHour(h12);
            }
            
            if(prefs.minute !== undefined) setNotifMinute(prefs.minute);
            if(prefs.engine !== undefined) setNotifEngine(prefs.engine);
            if(prefs.cloudTimeSlot !== undefined) setCloudTimeSlot(prefs.cloudTimeSlot);
        }
    }, [showSettings]);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            let h24 = notifHour;
            if (notifAmpm === 'PM' && h24 < 12) h24 += 12;
            if (notifAmpm === 'AM' && h24 === 12) h24 = 0;

            // For cloud engine on website, force engine to cloud
            const finalEngine = isNativeApp ? notifEngine : 'cloud';

            const newPrefs = {
                enabled: notifEnabled,
                offsetDays: notifOffset,
                hour: h24,
                minute: notifMinute,
                engine: finalEngine,
                cloudTimeSlot: cloudTimeSlot
            };
            localStorage.setItem('holiday_notification_pref', JSON.stringify(newPrefs));
            
            // Save to Firestore so the Vercel cron job can read preferences
            if (userProfile?.uid) {
                await setDoc(doc(db, 'students', userProfile.uid), {
                    holidayAlertPrefs: {
                        enabled: notifEnabled,
                        engine: finalEngine,
                        cloudTimeSlot: cloudTimeSlot,
                    }
                }, { merge: true });
            }

            await scheduleHolidayNotifications(holidays);
            
            // Also subscribe/unsubscribe to the Vercel topic based on Engine
            if (finalEngine === 'cloud' && notifEnabled) {
                 subscribeToCloudTopic();
            } else {
                 unsubscribeFromCloudTopic();
            }

            setShowSettings(false);
            alert("Notification preferences saved successfully!");
        } catch (e: any) {
            alert("Error saving: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const subscribeToCloudTopic = async () => {
        try {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            await PushNotifications.register();
        } catch (e) {
             console.warn("Could not register push:", e);
        }
    };

    const unsubscribeFromCloudTopic = async () => {
       /* Cloud unsubscription would typically happen on server sync, 
          but for simplicity we just trust the system or local checks */
    };

    const textCloudSystem = async () => {
        if (!userProfile?.uid || !firebaseUser) {
            alert("Error: You must be logged in to test Cloud Notifications.");
            return;
        }
        setIsTestingCloud(true);
        try {
            // Get a fresh Firebase ID token for server-side auth verification
            const idToken = await firebaseUser.getIdToken();

            // Capacitor apps lack local API routes since they are static exports.
            // We must route the fetch request to the live internet Vercel instance.
            const baseUrl = isNativeApp 
                ? 'https://npcnoticeboard.vercel.app' 
                : ''; 
                
            const res = await fetch(`${baseUrl}/api/admin/test-push`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ targetUid: userProfile.uid })
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data.error || 'Server error');
            alert(data.message);
        } catch (e: any) {
            alert("Error testing cloud: " + e.message);
        } finally {
            setIsTestingCloud(false);
        }
    };

    const changeMonth = (delta: number) => {
        const d = new Date(currentCalDate);
        d.setMonth(d.getMonth() + delta);
        setCurrentCalDate(d);
    };

    const isHoliday = (year: number, month: number, day: number): Holiday | undefined => {
        const current = new Date(year, month, day, 12, 0, 0, 0);
        return holidays.find(h => {
            if (!h.startDate) return false;
            const startStr = h.startDate.split('-');
            const endStr = h.endDate ? h.endDate.split('-') : startStr;
            const start = new Date(Number(startStr[0]), Number(startStr[1])-1, Number(startStr[2]), 0, 0, 0, 0);
            const end = new Date(Number(endStr[0]), Number(endStr[1])-1, Number(endStr[2]), 23, 59, 59, 999);
            return current >= start && current <= end;
        });
    };

    const renderCalendar = () => {
        const year = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const blanks = Array(firstDayIndex).fill(null);
        const days = Array.from({length: daysInMonth}, (_, i) => i + 1);

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        return (
            <div className="bg-white dark:bg-black border-2 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-4 md:p-6 mb-8 w-full max-w-xl mx-auto rounded-tl-2xl rounded-br-2xl relative overflow-hidden group">
                <div className="absolute inset-0 pattern-grid-lg opacity-5 pointer-events-none"></div>

                <div className="flex justify-between items-center mb-6 relative z-10">
                    <button onClick={() => changeMonth(-1)} className="p-2 border-2 border-black dark:border-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shadow-sm bg-white dark:bg-black rounded"><ChevronLeft className="w-5 h-5" /></button>
                    <h3 className="text-lg font-black uppercase tracking-widest">{monthNames[month]} {year}</h3>
                    <button onClick={() => changeMonth(1)} className="p-2 border-2 border-black dark:border-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shadow-sm bg-white dark:bg-black rounded"><ChevronRight className="w-5 h-5" /></button>
                </div>

                <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 text-center relative z-10">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-[10px] md:text-xs font-black uppercase opacity-50 tracking-tighter">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1 md:gap-2 relative z-10">
                    {blanks.map((_, i) => <div key={`blank-${i}`} className="h-10 md:h-12" />)}
                    {days.map(d => {
                        const holiday = isHoliday(year, month, d);
                        let bgClass = "bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800";
                        let textClass = "text-black dark:text-white hover:border-black dark:hover:border-white transition-colors cursor-default";
                        const isToday = isCurrentMonth && d === today.getDate();
                        
                        if (holiday) {
                            if (holiday.type === 'gov') bgClass = "bg-red-500 border border-red-700 shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)] dark:shadow-[inset_0_-3px_0_rgba(255,255,255,0.2)] ring-2 ring-red-200 dark:ring-red-900/50";
                            else if (holiday.type === 'college') bgClass = "bg-blue-500 border border-blue-700 shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)] dark:shadow-[inset_0_-3px_0_rgba(255,255,255,0.2)]";
                            else if (holiday.type === 'exam') bgClass = "bg-purple-500 border border-purple-700 shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)] dark:shadow-[inset_0_-3px_0_rgba(255,255,255,0.2)]";
                            else if (holiday.type === 'emergency') bgClass = "bg-yellow-400 border border-yellow-600 shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)] dark:shadow-[inset_0_-3px_0_rgba(255,255,255,0.2)]";
                            
                            textClass = holiday.type !== 'emergency' ? "text-white cursor-pointer transform hover:scale-110 hover:-translate-y-1 transition-all z-10" : "text-black cursor-pointer transform hover:scale-110 hover:-translate-y-1 transition-all z-10";
                        } else if (isToday) {
                            bgClass = "border-2 border-black dark:border-white bg-transparent shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.1)]";
                        }

                        return (
                            <div 
                                key={d} 
                                title={holiday?.name}
                                className={`${bgClass} ${textClass} h-10 md:h-12 rounded-lg flex items-center justify-center font-mono font-bold text-xs md:text-sm relative overflow-hidden`}
                                onClick={() => { if (holiday) setSelectedHoliday(holiday); }}
                            >
                                {holiday && <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 transform rotate-45 translate-x-4 -translate-y-4"></div>}
                                {d}
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto w-full min-h-0 bg-gray-50 dark:bg-black/95 custom-scrollbar">
            <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 mt-4 md:mt-8 pb-24">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-4 border-black dark:border-white pb-6 relative">
                    <div className="absolute -left-4 top-0 w-2 h-full bg-red-500 hidden sm:block"></div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <CalendarCheck className="w-8 h-8 text-red-600" />
                            Holiday List
                        </h1>
                        <p className="text-xs uppercase font-bold opacity-60 font-mono tracking-widest mt-2 ml-1">Govt & Insitutional Record</p>
                    </div>
                    <button 
                        onClick={() => setShowSettings(true)}
                        className="bg-black text-white dark:bg-white dark:text-black hover:opacity-80 px-4 py-2.5 rounded shadow-sm transition-all flex items-center gap-2 font-bold uppercase text-xs"
                    >
                        <Bell className="w-4 h-4" />
                        Alert Settings
                    </button>
                </div>

                
                {/* View Toggle */}
                <div className="flex bg-gray-200 dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 p-1 md:w-max mx-auto mb-6 relative z-10">
                    <button 
                        onClick={() => setViewMode('calendar')}
                        className={`flex-1 md:px-8 py-2 text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'calendar' ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                    >
                        Visual Calendar
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`flex-1 md:px-8 py-2 text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                    >
                        Agenda List
                    </button>
                </div>

                {viewMode === 'calendar' ? (
                    <>
                        {renderCalendar()}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                            <div className="flex flex-col items-center p-3 bg-white dark:bg-black border-2 border-red-500 shadow-[4px_4px_0_rgba(239,68,68,0.2)]">
                                <div className="w-4 h-4 bg-red-500 rounded-full mb-2"></div>
                                <span className="text-[10px] font-black uppercase">Govt Holiday</span>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-white dark:bg-black border-2 border-blue-500 shadow-[4px_4px_0_rgba(59,130,246,0.2)]">
                                <div className="w-4 h-4 bg-blue-500 rounded-full mb-2"></div>
                                <span className="text-[10px] font-black uppercase">College Event</span>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-white dark:bg-black border-2 border-purple-500 shadow-[4px_4px_0_rgba(168,85,247,0.2)]">
                                <div className="w-4 h-4 bg-purple-500 rounded-full mb-2"></div>
                                <span className="text-[10px] font-black uppercase">Exam Leave</span>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-white dark:bg-black border-2 border-yellow-400 shadow-[4px_4px_0_rgba(250,204,21,0.2)]">
                                <div className="w-4 h-4 bg-yellow-400 rounded-full mb-2"></div>
                                <span className="text-[10px] font-black uppercase text-center">Emergency</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white dark:bg-black border-2 border-black dark:border-white relative shadow-lg">
                    <div className="bg-black text-white dark:bg-white dark:text-black p-4 flex items-center gap-3">
                        <Calendar className="w-5 h-5" />
                        <h2 className="font-bold tracking-widest uppercase">Upcoming Agenda</h2>
                    </div>
                    
                    <div className="p-2 space-y-0 relative before:absolute before:inset-0 before:ml-8 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 dark:before:via-gray-700 before:to-transparent">
                        {loading ? (
                            <div className="p-8 text-center text-sm font-mono opacity-50 font-bold uppercase animate-pulse">Syncing Calendar data...</div>
                        ) : holidays.length === 0 ? (
                            <div className="p-8 text-center text-sm font-mono opacity-50 font-bold uppercase">No upcoming holidays on record</div>
                        ) : (
                            holidays.filter(h => {
                                if(!h.startDate) return true;
                                const endDate = h.endDate ? new Date(h.endDate) : new Date(h.startDate);
                                const today = new Date(); today.setHours(0,0,0,0);
                                return endDate >= today;
                            }).map((holiday) => {
                                const startStr = new Date(holiday.startDate).toLocaleDateString(undefined, {month:'long', day:'2-digit', year:'numeric'});
                                const endStr = holiday.endDate && holiday.endDate !== holiday.startDate 
                                    ? ` to ${new Date(holiday.endDate).toLocaleDateString(undefined, {month:'long', day:'2-digit'})}` 
                                    : '';
                                
                                let indicatorColor = "bg-red-500 ring-red-200 border-red-700";
                                let dateColorClass = "text-red-600 dark:text-red-400";
                                if(holiday.type === 'college') { indicatorColor = "bg-blue-500 ring-blue-200 border-blue-700"; dateColorClass = "text-blue-600 dark:text-blue-400"; }
                                if(holiday.type === 'exam') { indicatorColor = "bg-purple-500 ring-purple-200 border-purple-700"; dateColorClass = "text-purple-600 dark:text-purple-400"; }
                                if(holiday.type === 'emergency') { indicatorColor = "bg-yellow-400 ring-yellow-200 border-yellow-600"; dateColorClass = "text-yellow-600 dark:text-yellow-400"; }

                                return (
                                    <div key={holiday.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group select-none">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-black shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 bg-gray-50 dark:bg-zinc-900 border-transparent z-10 shadow-[0_0_0_2px_rgba(0,0,0,0.1)] dark:shadow-[0_0_0_2px_rgba(255,255,255,0.1)] overflow-hidden">
                                            <div className={`w-full h-full ${indicatorColor} ring-4`}></div>
                                        </div>
                                        
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 md:p-6 transition duration-300 transform group-hover:-translate-y-1 hover:shadow-lg">
                                            <div className="bg-white dark:bg-black border-2 border-black dark:border-zinc-800 p-4 md:p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)] dark:shadow-[4px_4px_0_rgba(255,255,255,0.05)] flex flex-col gap-1 items-start md:group-odd:items-end md:group-odd:text-right">
                                                <h3 className="font-black text-base md:text-lg uppercase tracking-tight leading-tight">{holiday.name}</h3>
                                                <p className={`text-xs font-bold font-mono tracking-tighter uppercase ${dateColorClass}`}>
                                                    {startStr}{endStr}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                 </div>
               </div>
            )}


                {selectedHoliday && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setSelectedHoliday(null)}>
                        <div className="bg-white dark:bg-black border-4 border-black dark:border-white w-full max-w-sm overflow-hidden shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] dark:shadow-[16px_16px_0px_0px_rgba(255,255,255,1)] animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                            <div className="bg-black text-white dark:bg-white dark:text-black p-4 flex justify-between items-center">
                                <h3 className="font-bold uppercase tracking-widest max-w-[200px] truncate">Holiday Details</h3>
                                <button onClick={() => setSelectedHoliday(null)} className="hover:opacity-70 transition-opacity p-2 -mr-2"><X className="w-5 h-5"/></button>
                            </div>
                            <div className="p-6">
                                <h2 className="text-2xl font-black uppercase mb-4 leading-tight">{selectedHoliday.name}</h2>
                                {(() => {
                                    const start = new Date(selectedHoliday.startDate);
                                    start.setHours(0,0,0,0);
                                    let end = new Date(selectedHoliday.startDate);
                                    if(selectedHoliday.endDate) {
                                        end = new Date(selectedHoliday.endDate);
                                    }
                                    end.setHours(0,0,0,0);
                                    
                                    const diffTime = Math.abs(end.getTime() - start.getTime());
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because inclusive

                                    const startStr = start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                                    const endStr = end.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

                                    return (
                                        <div className="space-y-4 font-mono text-sm">
                                            <div className="border border-gray-200 dark:border-zinc-800 p-4 bg-gray-50 dark:bg-zinc-900 border-l-4 border-l-black dark:border-l-white">
                                                <p className="opacity-60 text-xs font-bold uppercase mb-1.5">Duration</p>
                                                <p className="font-black text-xl">{diffDays} Day{diffDays > 1 ? 's' : ''} Off</p>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div>
                                                    <span className="opacity-60 text-xs uppercase font-bold">Starts: </span>
                                                    <div className="font-bold">{startStr}</div>
                                                </div>
                                                {diffDays > 1 && (
                                                    <div>
                                                        <span className="opacity-60 text-xs uppercase font-bold">Ends: </span>
                                                        <div className="font-bold">{endStr}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
    
{showSettings && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-black border-2 border-black dark:border-white w-full max-w-sm overflow-hidden shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] dark:shadow-[16px_16px_0px_0px_rgba(255,255,255,1)] animate-in fade-in zoom-in duration-200">
                            <div className="bg-black text-white dark:bg-white dark:text-black p-4 flex justify-between items-center">
                                <h3 className="font-bold uppercase tracking-widest flex items-center gap-2"><Settings className="w-5 h-5"/> Alerts</h3>
                                <button onClick={() => setShowSettings(false)} className="hover:opacity-70 transition-opacity"><X className="w-5 h-5"/></button>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 pb-4">
                                    <div className="flex-1">
                                        <label className="font-black uppercase text-sm">Enable Holiday Alerts</label>
                                        <p className="text-[10px] font-mono opacity-60">Get notified about upcoming holidays.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                                        <input type="checkbox" className="sr-only peer" checked={notifEnabled} onChange={e => setNotifEnabled(e.target.checked)} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                
                                {notifEnabled && (
                                    <div className="space-y-5 animate-in slide-in-from-top-2">
                                    
                                        <div>
                                            <label className="block text-xs font-bold uppercase mb-2">Notification Engine</label>
                                            {isNativeApp ? (
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setNotifEngine('offline')}
                                                    className={`flex-1 p-3 border-2 font-black uppercase text-[10px] flex flex-col items-center gap-1 transition-colors ${notifEngine === 'offline' ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white' : 'bg-transparent text-gray-400 border-gray-200 dark:border-zinc-800'}`}
                                                >
                                                    <Smartphone className="w-5 h-5 mb-1" />
                                                    Device Native
                                                    <span className="font-mono text-[8px] opacity-70 normal-case block font-normal text-center mt-1">(Custom limits, delayed on low-end hardware)</span>
                                                </button>
                                                <button 
                                                    onClick={() => setNotifEngine('cloud')}
                                                    className={`flex-1 p-3 border-2 font-black uppercase text-[10px] flex flex-col items-center gap-1 transition-colors ${notifEngine === 'cloud' ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-gray-400 border-gray-200 dark:border-zinc-800'}`}
                                                >
                                                    <Cloud className="w-5 h-5 mb-1" />
                                                    Vercel Cloud
                                                    <span className="font-mono text-[8px] opacity-70 normal-case block font-normal text-center mt-1">(Instant FCM push, choose 8AM or 8PM)</span>
                                                </button>
                                            </div>
                                            ) : (
                                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-600 flex items-center gap-3">
                                                <Cloud className="w-5 h-5 text-blue-600 shrink-0" />
                                                <div>
                                                    <p className="font-black uppercase text-[11px] text-blue-600">Vercel Cloud Engine</p>
                                                    <p className="font-mono text-[9px] opacity-70">Instant push via FCM. Device Native is only available on the Android app.</p>
                                                </div>
                                            </div>
                                            )}                                        </div>

                                        {(notifEngine === 'cloud' || !isNativeApp) && (
                                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600">
                                                <label className="block text-xs font-bold uppercase mb-3">Daily Alert Time</label>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => setCloudTimeSlot('8am')}
                                                        className={`flex-1 p-3 border-2 font-black uppercase text-[10px] flex flex-col items-center gap-1 transition-colors ${cloudTimeSlot === '8am' ? 'bg-amber-500 text-white border-amber-500' : 'bg-transparent text-gray-400 border-gray-200 dark:border-zinc-800'}`}
                                                    >
                                                        <Sun className="w-5 h-5 mb-1" />
                                                        Morning
                                                        <span className="font-mono text-[9px] opacity-80 normal-case block font-normal">8:00 AM</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => setCloudTimeSlot('8pm')}
                                                        className={`flex-1 p-3 border-2 font-black uppercase text-[10px] flex flex-col items-center gap-1 transition-colors ${cloudTimeSlot === '8pm' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent text-gray-400 border-gray-200 dark:border-zinc-800'}`}
                                                    >
                                                        <Moon className="w-5 h-5 mb-1" />
                                                        Evening
                                                        <span className="font-mono text-[9px] opacity-80 normal-case block font-normal">8:00 PM</span>
                                                    </button>
                                                </div>
                                                <p className="text-[9px] font-mono mt-2 opacity-50">* Bangladesh Standard Time (UTC+6)</p>
                                            </div>
                                        )}

                                        {notifEngine === 'offline' && (
                                            <div className="p-3 bg-gray-100 dark:bg-zinc-900 border-l-4 border-l-black dark:border-l-white space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase mb-2">When to notify</label>
                                            <select 
                                                value={notifOffset}
                                                onChange={e => setNotifOffset(Number(e.target.value))}
                                                className="w-full p-3 bg-gray-50 dark:bg-zinc-900 border-2 border-black dark:border-white font-mono text-sm outline-none cursor-pointer"
                                            >
                                                <option value={0}>On the day of the holiday</option>
                                                <option value={1}>1 Day before</option>
                                                <option value={2}>2 Days before</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase mb-2">At what time</label>
                                            <div className="flex gap-2">
                                                <div className="flex-1 flex items-center border-2 border-black dark:border-white bg-gray-50 dark:bg-zinc-900 px-3">
                                                    <Clock className="w-4 h-4 opacity-50 mr-2 shrink-0" />
                                                    <input 
                                                        type="number" 
                                                        min="1" max="12" 
                                                        value={notifHour < 10 ? `0${notifHour}` : notifHour}
                                                        onChange={e => setNotifHour(Number(e.target.value))}
                                                        className="w-full bg-transparent p-2 outline-none font-mono text-sm text-center"
                                                    />
                                                </div>
                                                <div className="flex items-center font-bold text-xl">:</div>
                                                <div className="flex-1 flex items-center border-2 border-black dark:border-white bg-gray-50 dark:bg-zinc-900 px-3">
                                                    <input 
                                                        type="number" 
                                                        min="0" max="59" 
                                                        value={notifMinute < 10 ? `0${notifMinute}` : notifMinute}
                                                        onChange={e => setNotifMinute(Number(e.target.value))}
                                                        className="w-full bg-transparent p-2 outline-none font-mono text-sm text-center"
                                                    />
                                                </div>
                                                <div className="flex-[0.8] flex items-center border-2 border-black dark:border-white bg-gray-50 dark:bg-zinc-900">
                                                    <select 
                                                        value={notifAmpm}
                                                        onChange={e => setNotifAmpm(e.target.value)}
                                                        className="w-full h-full bg-transparent p-2 outline-none font-mono text-sm font-bold text-center cursor-pointer appearance-none"
                                                    >
                                                        <option value="AM">AM</option>
                                                        <option value="PM">PM</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <p className="text-[10px] font-mono mt-2 opacity-60">* Standard 12-hour AM/PM format</p>
                                        </div>
                                        </div>
                                        )}
                                    </div>
                                )}

                                <button 
                                    onClick={handleSaveSettings}
                                    disabled={isSaving}
                                    className="w-full py-4 mt-6 bg-black text-white dark:bg-white dark:text-black font-black uppercase text-sm tracking-widest hover:opacity-80 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50"
                                >
                                    <Save className="w-5 h-5 flex-shrink-0" /> {isSaving ? 'Saving...' : 'Update Config'}
                                </button>
                                
                                
                                {notifEnabled && notifEngine === 'offline' && isNativeApp ? (
                                <button 
                                    onClick={async () => {
                                        try {
                                            const { LocalNotifications } = await import('@capacitor/local-notifications');
                                            
                                            // Explicitly create an Android 8+ Notification Channel
                                            try {
                                                await LocalNotifications.createChannel({
                                                    id: 'test_channel',
                                                    name: 'Test Alerts',
                                                    description: 'Diagnostic channel for testing',
                                                    importance: 5,
                                                    visibility: 1
                                                });
                                            } catch (e) {
                                                console.log("Channel exists", e);
                                            }

                                            const testDate = new Date(new Date().getTime() + 5000); // 5 seconds from now
                                            await LocalNotifications.schedule({
                                                notifications: [{
                                                    id: Math.floor(Math.random() * 100000),
                                                    title: "Test Successful!",
                                                    body: "Your offline notifications are working perfectly.",
                                                    schedule: { at: testDate },
                                                    sound: 'default',
                                                    channelId: 'test_channel'
                                                }]
                                            });
                                            alert("Scheduled! Minimize the app and wait 5 seconds.");
                                        } catch (e) {
                                            alert("Native Error: " + (e as any).message);
                                        }
                                    }}
                                    className="w-full py-3 border-2 border-black text-black dark:border-white dark:text-white font-bold uppercase text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    Test Local Offline Alarm (wait 5s)
                                </button>
                                ) : notifEnabled && (notifEngine === 'cloud' || !isNativeApp) && (
                                    <button 
                                        disabled={isTestingCloud}
                                        onClick={textCloudSystem}
                                        className="w-full py-3 border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 font-bold uppercase text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                        {isTestingCloud ? 'Sending...' : 'Test Vercel Cloud Push (Instant)'}
                                    </button>
                                )}

                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
