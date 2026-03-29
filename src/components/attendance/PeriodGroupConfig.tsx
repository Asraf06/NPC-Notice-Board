'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Link2, Unlink, Settings2, X, Save, Sparkles, ChevronRight, Layers, Check } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

interface RoutinePeriod {
    time: string;
    subject: string;
    teacher?: string;
}

export interface PeriodGroup {
    groupId: string;
    subject: string;
    periods: string[];           // Array of raw time strings
    displayLabel: string;        // e.g., "Mathematics (Period 1-2)"
}

export interface PeriodGroupsConfig {
    [dayKey: string]: PeriodGroup[];   // "MON", "TUE", etc.
}

interface PeriodGroupConfigProps {
    isOpen: boolean;
    onClose: () => void;
    routineData: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    existingGroups: PeriodGroupsConfig;
    onSave: (groups: PeriodGroupsConfig) => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
    SUN: 'Sunday', MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday',
    THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday',
};

const ORDERED_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function autoDetectGroups(periodsForDay: RoutinePeriod[], dayKey: string): PeriodGroup[] {
    if (!periodsForDay || periodsForDay.length === 0) return [];

    const groups: PeriodGroup[] = [];
    let i = 0;

    while (i < periodsForDay.length) {
        const startIdx = i;
        const subject = periodsForDay[i].subject?.trim().toLowerCase() || '';

        // Walk forward while same subject
        while (
            i + 1 < periodsForDay.length &&
            (periodsForDay[i + 1].subject?.trim().toLowerCase() || '') === subject
        ) {
            i++;
        }

        // Only create a group if 2+ consecutive
        if (i > startIdx) {
            const groupPeriods = periodsForDay.slice(startIdx, i + 1);
            groups.push({
                groupId: `${dayKey}_block_${startIdx}`,
                subject: periodsForDay[startIdx].subject,
                periods: groupPeriods.map(p => p.time),
                displayLabel: `${periodsForDay[startIdx].subject} (Period ${startIdx + 1}-${i + 1})`,
            });
        }
        i++;
    }

    return groups;
}

function isTimeInGroup(time: string, groups: PeriodGroup[]): PeriodGroup | null {
    for (const g of groups) {
        if (g.periods.includes(time)) return g;
    }
    return null;
}

// ── Component ──────────────────────────────────────────────────

export default function PeriodGroupConfig({
    isOpen,
    onClose,
    routineData,
    existingGroups,
    onSave,
}: PeriodGroupConfigProps) {
    const [activeDay, setActiveDay] = useState('MON');
    const [localGroups, setLocalGroups] = useState<PeriodGroupsConfig>({});
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Dynamically get the days present in the routine, sorted by logical order
    const currentDays = useMemo(() => {
        if (!routineData?.schedule) return [];
        return Object.keys(routineData.schedule)
            .filter(day => routineData.schedule[day].length > 0)
            .sort((a, b) => ORDERED_DAYS.indexOf(a) - ORDERED_DAYS.indexOf(b));
    }, [routineData]);

    // Initialize with existing groups
    useEffect(() => {
        if (isOpen) {
            setLocalGroups(existingGroups ? { ...existingGroups } : {});
            setHasChanges(false);
        }
    }, [isOpen, existingGroups]);

    // Set active day to first day that has periods
    useEffect(() => {
        if (!isOpen || currentDays.length === 0) return;
        if (!currentDays.includes(activeDay)) {
            setActiveDay(currentDays[0]);
        }
    }, [isOpen, currentDays, activeDay]);

    const periodsForActiveDay: RoutinePeriod[] = useMemo(() => {
        if (!routineData?.schedule) return [];
        return routineData.schedule[activeDay] || [];
    }, [routineData, activeDay]);

    const suggestedGroups = useMemo(() => {
        return autoDetectGroups(periodsForActiveDay, activeDay);
    }, [periodsForActiveDay, activeDay]);

    const currentDayGroups = localGroups[activeDay] || [];

    const hasSuggestions = suggestedGroups.length > 0 &&
        suggestedGroups.some(sg => !currentDayGroups.some(cg => cg.groupId === sg.groupId));

    // ── Actions ────────────────────────────────────────────────

    const handleApplySuggestions = () => {
        setLocalGroups(prev => ({
            ...prev,
            [activeDay]: [...suggestedGroups],
        }));
        setHasChanges(true);
    };

    const handleApplyAllSuggestions = () => {
        if (!routineData?.schedule) return;
        const newGroups: PeriodGroupsConfig = {};
        for (const day of currentDays) {
            const periods = routineData.schedule[day] || [];
            const detected = autoDetectGroups(periods, day);
            if (detected.length > 0) {
                newGroups[day] = detected;
            }
        }
        setLocalGroups(newGroups);
        setHasChanges(true);
    };

    const handleToggleGroup = (startIdx: number, endIdx: number) => {
        const periodsToGroup = periodsForActiveDay.slice(startIdx, endIdx + 1);
        const groupId = `${activeDay}_block_${startIdx}`;

        // Check if this exact group already exists
        const existingIdx = currentDayGroups.findIndex(g => g.groupId === groupId);

        if (existingIdx >= 0) {
            // **Ungroup** — remove it
            const newDayGroups = currentDayGroups.filter((_, i) => i !== existingIdx);
            setLocalGroups(prev => ({
                ...prev,
                [activeDay]: newDayGroups,
            }));
        } else {
            // **Group** — first remove any overlapping groups
            const newTimesSet = new Set(periodsToGroup.map(p => p.time));
            const filteredGroups = currentDayGroups.filter(
                g => !g.periods.some(pt => newTimesSet.has(pt))
            );

            filteredGroups.push({
                groupId,
                subject: periodsToGroup[0].subject,
                periods: periodsToGroup.map(p => p.time),
                displayLabel: `${periodsToGroup[0].subject} (Period ${startIdx + 1}-${endIdx + 1})`,
            });

            setLocalGroups(prev => ({
                ...prev,
                [activeDay]: filteredGroups,
            }));
        }
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(localGroups);
            setHasChanges(false);
        } finally {
            setSaving(false);
        }
    };

    // ── Visual state for each period row ───────────────────────

    type PeriodRowState = {
        period: RoutinePeriod;
        index: number;
        group: PeriodGroup | null;
        isFirst: boolean;
        isLast: boolean;
        canGroupWithNext: boolean;
    };

    const periodRows: PeriodRowState[] = periodsForActiveDay.map((p, i) => {
        const group = isTimeInGroup(p.time, currentDayGroups);
        const isFirst = group ? group.periods[0] === p.time : true;
        const isLast = group ? group.periods[group.periods.length - 1] === p.time : true;

        const nextP = periodsForActiveDay[i + 1];
        const canGroupWithNext =
            nextP !== undefined &&
            nextP.subject?.trim().toLowerCase() === p.subject?.trim().toLowerCase();

        return { period: p, index: i, group, isFirst, isLast, canGroupWithNext };
    });

    if (!isOpen) return null;

    // Count total groups across all days
    const totalGroups = Object.values(localGroups).reduce((sum, g) => sum + g.length, 0);

    return (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
            <div
                className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-600 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-[8px_8px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_rgba(255,255,255,0.1)]"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="border-b-2 border-black dark:border-zinc-700 bg-indigo-400 dark:bg-indigo-600 px-5 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-black p-2 border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.3)]">
                            <Layers className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black font-mono uppercase tracking-tight text-black dark:text-white leading-none">
                                Period Groups
                            </h2>
                            <p className="text-[10px] font-mono font-bold uppercase text-black/60 dark:text-white/60 mt-0.5">
                                Link consecutive same-subject periods
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 border-2 border-black dark:border-zinc-500 bg-white dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Day Tabs ── */}
                <div className="border-b-2 border-black dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-3 py-2 flex gap-1 overflow-x-auto shrink-0">
                    {currentDays.length === 0 ? (
                         <div className="px-3 py-2 text-xs font-mono font-bold text-gray-500 uppercase">
                             No schedule available
                         </div>
                    ) : (
                        currentDays.map(day => {
                            const dayPeriods = routineData?.schedule?.[day] || [];
                            const dayGroups = localGroups[day] || [];
                        const isEmpty = dayPeriods.length === 0;
                        const isActive = activeDay === day;

                        return (
                            <button
                                key={day}
                                onClick={() => !isEmpty && setActiveDay(day)}
                                disabled={isEmpty}
                                className={`relative px-3 py-2 font-mono text-xs font-black uppercase border-2 transition-all shrink-0
                                    ${isActive
                                        ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-[2px_2px_0px_rgba(0,0,0,0.3)]'
                                        : isEmpty
                                            ? 'bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-zinc-600 border-gray-200 dark:border-zinc-700 cursor-not-allowed'
                                            : 'bg-white dark:bg-zinc-800 text-black dark:text-white border-black dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.05)]'
                                    }`}
                            >
                                {day}
                                {dayGroups.length > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-black">
                                        {dayGroups.length}
                                    </span>
                                )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                    {/* Auto-detect suggestion banner */}
                    {hasSuggestions && (
                        <div className="border-2 border-dashed border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <div className="flex items-center gap-2 flex-1">
                                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span className="text-xs font-mono font-bold text-indigo-800 dark:text-indigo-300">
                                    We detected {suggestedGroups.length} consecutive same-subject block{suggestedGroups.length > 1 ? 's' : ''} for {DAY_LABELS[activeDay]}.
                                </span>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={handleApplySuggestions}
                                    className="px-3 py-1.5 border-2 border-indigo-600 dark:border-indigo-400 bg-indigo-500 text-white font-mono text-[10px] font-black uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                                >
                                    Apply for {activeDay}
                                </button>
                                <button
                                    onClick={handleApplyAllSuggestions}
                                    className="px-3 py-1.5 border-2 border-black dark:border-zinc-500 bg-white dark:bg-zinc-800 text-black dark:text-white font-mono text-[10px] font-black uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                                >
                                    Apply All Days
                                </button>
                            </div>
                        </div>
                    )}

                    {/* How-to hint */}
                    <p className="text-[10px] font-mono font-medium opacity-50 uppercase tracking-wider">
                        Tap the <Link2 className="w-3 h-3 inline -mt-0.5" /> link icon between two same-subject periods to group/ungroup them.
                    </p>

                    {/* Period list with linkable connectors */}
                    {periodsForActiveDay.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 opacity-30">
                            <Settings2 className="w-10 h-10 mb-3" />
                            <span className="font-mono text-sm font-bold uppercase">No classes on {DAY_LABELS[activeDay]}</span>
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {periodRows.map((row, idx) => {
                                const { period, index, group, isFirst, isLast, canGroupWithNext } = row;
                                const nextRow = periodRows[idx + 1];

                                // Determine visual style
                                const isGrouped = !!group;
                                const groupColor = isGrouped
                                    ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
                                    : 'border-black dark:border-zinc-700 bg-white dark:bg-zinc-900';

                                return (
                                    <React.Fragment key={period.time}>
                                        {/* Period Row */}
                                        <div
                                            className={`border-2 px-4 py-3 flex items-center gap-3 transition-all
                                                ${groupColor}
                                                ${isGrouped && !isFirst ? 'border-t-0' : ''}
                                                ${isGrouped && isFirst ? 'shadow-[3px_3px_0px_rgba(0,0,0,0.15)]' : ''}
                                                ${!isGrouped ? 'shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.05)] mb-1' : ''}
                                                ${isGrouped && isLast ? 'shadow-[3px_3px_0px_rgba(0,0,0,0.15)] mb-1' : ''}`}
                                        >
                                            {/* Period number badge */}
                                            <div className={`w-7 h-7 flex items-center justify-center border-2 font-mono text-xs font-black shrink-0
                                                ${isGrouped
                                                    ? 'bg-indigo-400 dark:bg-indigo-600 text-white border-indigo-600 dark:border-indigo-400'
                                                    : 'bg-gray-100 dark:bg-zinc-800 border-black dark:border-zinc-600'
                                                }`}>
                                                {index + 1}
                                            </div>

                                            {/* Subject & time */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-mono text-sm font-bold truncate">{period.subject}</div>
                                                <div className="font-mono text-[10px] opacity-50">{period.time}</div>
                                            </div>

                                            {/* Group indicator */}
                                            {isGrouped && isFirst && group && (
                                                <span className="shrink-0 px-2 py-1 bg-indigo-500 text-white font-mono text-[9px] font-black uppercase border border-indigo-700 flex items-center gap-1">
                                                    <Link2 className="w-3 h-3" />
                                                    {group.periods.length} merged
                                                </span>
                                            )}
                                        </div>

                                        {/* Connector/Link button between this and next period */}
                                        {canGroupWithNext && nextRow && (
                                            <div className="flex items-center justify-center py-0.5">
                                                <button
                                                    onClick={() => {
                                                        // Find the full range of same-subject consecutive periods starting from current
                                                        let groupStart = index;
                                                        let groupEnd = index;
                                                        const subj = period.subject?.trim().toLowerCase() || '';

                                                        // Walk backwards
                                                        while (groupStart > 0 && (periodsForActiveDay[groupStart - 1].subject?.trim().toLowerCase() || '') === subj) {
                                                            groupStart--;
                                                        }
                                                        // Walk forwards
                                                        while (groupEnd + 1 < periodsForActiveDay.length && (periodsForActiveDay[groupEnd + 1].subject?.trim().toLowerCase() || '') === subj) {
                                                            groupEnd++;
                                                        }

                                                        handleToggleGroup(groupStart, groupEnd);
                                                    }}
                                                    className={`group flex items-center gap-1.5 px-3 py-1 border-2 transition-all font-mono text-[10px] font-black uppercase
                                                        ${isGrouped && nextRow.group && nextRow.group.groupId === group?.groupId
                                                            ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 hover:border-red-400'
                                                            : 'border-dashed border-gray-300 dark:border-zinc-600 bg-transparent text-gray-400 dark:text-zinc-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 dark:hover:border-indigo-500'
                                                        }`}
                                                    title={isGrouped && nextRow.group?.groupId === group?.groupId ? 'Click to unlink' : 'Click to link as one class'}
                                                >
                                                    {isGrouped && nextRow.group?.groupId === group?.groupId ? (
                                                        <>
                                                            <Unlink className="w-3 h-3 hidden group-hover:block" />
                                                            <Link2 className="w-3 h-3 group-hover:hidden" />
                                                            <span className="group-hover:hidden">Linked</span>
                                                            <span className="hidden group-hover:inline">Unlink</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Link2 className="w-3 h-3" />
                                                            <span>Link as 1 class</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}

                                        {/* Arrow connector for different subjects - just visual spacing */}
                                        {!canGroupWithNext && nextRow && (
                                            <div className="flex items-center justify-center py-1 opacity-20">
                                                <ChevronRight className="w-3 h-3 rotate-90" />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="border-t-2 border-black dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-5 py-3 flex items-center justify-between shrink-0">
                    <div className="font-mono text-[10px] font-bold uppercase opacity-50">
                        {totalGroups} group{totalGroups !== 1 ? 's' : ''} configured
                        {hasChanges && <span className="text-orange-500 ml-2">• unsaved changes</span>}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border-2 border-black dark:border-zinc-600 bg-white dark:bg-zinc-800 font-mono text-xs font-bold uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.05)] hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className="px-5 py-2 border-2 border-black dark:border-white bg-[#a3e635] text-black font-mono text-xs font-black uppercase flex items-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <><Settings2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                            ) : (
                                <><Save className="w-3.5 h-3.5" /> Save Groups</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
