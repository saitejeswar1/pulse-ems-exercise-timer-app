import { useState, useEffect } from 'react';
import { WorkoutLogEntry, PhysioExercise } from '../types';
import {
  Award, Calendar, Clock, TrendingUp, CheckCircle, Trash2,
  CheckCircle2, Flame, Hourglass, Trophy, ListChecks, Coffee, Target,
  SlidersHorizontal, Download, Sparkles, X, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ExerciseDetailSheet from './ExerciseDetailSheet';
import { exportLogsJSON, exportLogsCSV } from '../lib/logIO';
import { downloadFile } from '../lib/planIO';
import {
  buildStatsBlob, generateInsights, loadCachedInsights, saveCachedInsights,
  isDismissedToday, dismissForToday, Insight,
  getManualRefreshState, recordManualTrigger, shouldAutoRefresh, recordAutoFired,
  ManualRefreshState,
} from '../lib/aiInsights';

type FilterRange = 'all' | '7d' | '30d' | '90d';
const CATEGORY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'ems',      label: 'EMS' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio',   label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'other',    label: 'Other' },
];

interface AnalyticsPanelProps {
  logs: WorkoutLogEntry[];
  exercises: PhysioExercise[];
  aiEnabled?: boolean;
  aiAutoDay?: number | null;
  onClearLogs: () => void;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_BAR_COLORS: Record<string, { fill: string; dot: string; label: string }> = {
  ems:      { fill: 'bg-natural-terracotta', dot: 'bg-natural-terracotta', label: 'EMS' },
  strength: { fill: 'bg-natural-moss',       dot: 'bg-natural-moss',       label: 'Strength' },
  cardio:   { fill: 'bg-rose-500',           dot: 'bg-rose-500',           label: 'Cardio' },
  mobility: { fill: 'bg-sky-500',            dot: 'bg-sky-500',            label: 'Mobility' },
  other:    { fill: 'bg-slate-400',          dot: 'bg-slate-400',          label: 'Other' },
};

const dayKey = (d: Date | number) => {
  const dt = typeof d === 'number' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const formatDuration = (totalSecs: number) => {
  if (totalSecs < 60) return `${totalSecs}s`;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

const formatHold = (s: number) => {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function AnalyticsPanel({ logs, exercises, aiEnabled, aiAutoDay, onClearLogs }: AnalyticsPanelProps) {
  const [detailExerciseName, setDetailExerciseName] = useState<string | null>(null);
  const openDetail = (name: string) => setDetailExerciseName(name);

  // History-log filter / export panel
  const [showFilters, setShowFilters] = useState(false);
  const [filterRange, setFilterRange] = useState<FilterRange>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterExercise, setFilterExercise] = useState<string>('all');

  // AI Coach card state
  const [aiInsights, setAiInsights] = useState<Insight[] | null>(null);
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAttempted, setAiAttempted] = useState(false); // distinguishes "never tried" from "tried + got nothing"
  const [aiDismissed, setAiDismissed] = useState<boolean>(() => isDismissedToday());
  const [refreshState, setRefreshState] = useState<ManualRefreshState>(() => getManualRefreshState());

  const minSessionsForAI = 3;
  const aiEligible = (aiEnabled ?? false) && logs.length >= minSessionsForAI && !aiDismissed;

  // Load cache + optionally fire the weekly auto-refresh on the user's chosen day.
  useEffect(() => {
    if (!aiEligible) {
      setAiInsights(null);
      setAiGeneratedAt(null);
      setAiAttempted(false);
      return;
    }
    const stats = buildStatsBlob(logs, exercises);
    const cached = loadCachedInsights(stats);
    if (cached) {
      setAiInsights(cached.insights);
      setAiGeneratedAt(cached.generatedAt);
      setAiAttempted(true);
    } else {
      setAiInsights(null);
      setAiGeneratedAt(null);
      setAiAttempted(false);
    }

    if (shouldAutoRefresh(aiAutoDay)) {
      triggerGenerate('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiEligible, aiAutoDay, logs, exercises]);

  // Tick the refresh-state every 30s so the cooldown countdown stays current.
  useEffect(() => {
    if (refreshState.allowed || refreshState.reason !== 'cooldown') return;
    const id = setInterval(() => setRefreshState(getManualRefreshState()), 30_000);
    return () => clearInterval(id);
  }, [refreshState]);

  const triggerGenerate = async (source: 'manual' | 'auto') => {
    if (source === 'manual' && !refreshState.allowed) return;
    if (aiLoading) return;
    setAiLoading(true);
    // Auto-refresh: mark "attempted today" up front so a transient failure
    // doesn't cause the effect to re-fire on the next log change. Manual
    // triggers, by contrast, only count on success — so users aren't punished
    // for network blips.
    if (source === 'auto') recordAutoFired();
    try {
      const stats = buildStatsBlob(logs, exercises);
      const insights = await generateInsights(stats);
      setAiAttempted(true);
      setAiInsights(insights);
      if (insights.length > 0) {
        saveCachedInsights(stats, insights);
        setAiGeneratedAt(new Date().toISOString().slice(0, 10));
        if (source === 'manual') recordManualTrigger();
      }
    } finally {
      setAiLoading(false);
      setRefreshState(getManualRefreshState());
    }
  };

  const handleAiDismiss = () => {
    dismissForToday();
    setAiDismissed(true);
  };

  const refreshLabel = (() => {
    if (refreshState.allowed) {
      const left = refreshState.triggersRemainingToday;
      return left >= 2 ? 'Refresh' : `Refresh (${left} left today)`;
    }
    if (refreshState.reason === 'max-reached') return 'Daily limit reached';
    if (refreshState.reason === 'cooldown' && refreshState.cooldownEndsAt) {
      const mins = Math.max(1, Math.ceil((refreshState.cooldownEndsAt - Date.now()) / 60_000));
      return `Available in ${mins}m`;
    }
    return 'Refresh';
  })();

  const formatGeneratedAt = (iso: string) => {
    // iso is YYYY-MM-DD; render as "May 28" — concise, glanceable.
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const now = new Date();
  const todayShort = WEEKDAY_SHORT[now.getDay()];
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // --- Precompute date → log count (and total seconds) ---
  const countByDate = new Map<string, number>();
  const secondsByDate = new Map<string, number>();
  logs.forEach(l => {
    const k = dayKey(l.timestamp);
    countByDate.set(k, (countByDate.get(k) ?? 0) + 1);
    secondsByDate.set(k, (secondsByDate.get(k) ?? 0) + l.totalActiveSeconds);
  });

  // --- Streak (consecutive days with at least one workout, today optional) ---
  const computeStreak = () => {
    let streak = 0;
    const d = new Date();
    if (!countByDate.has(dayKey(d))) {
      // No workout today yet — count from yesterday so the streak doesn't reset mid-day
      d.setDate(d.getDate() - 1);
    }
    while (countByDate.has(dayKey(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };
  const streak = computeStreak();
  const workedOutToday = countByDate.has(dayKey(now));

  // --- Today's Status ---
  const todaysScheduled = exercises.filter(e => e.weekdays?.includes(todayShort));
  const todaysLogs = logs.filter(l => l.timestamp >= startOfToday);
  const todaysCompletedNames = new Set(todaysLogs.map(l => l.exerciseName));
  const todaysDoneCount = todaysScheduled.filter(e => todaysCompletedNames.has(e.name)).length;
  const allTodayDone = todaysScheduled.length > 0 && todaysDoneCount === todaysScheduled.length;
  const restDay = todaysScheduled.length === 0;

  // --- Top-line stats ---
  const totalCompleted = logs.length;
  const totalSeconds = logs.reduce((acc, l) => acc + l.totalActiveSeconds, 0);
  const totalSets = logs.reduce((acc, l) => acc + l.cyclesCompleted, 0);

  // --- Week-over-week delta ---
  const weekAgo = startOfToday - 7 * 86400000;
  const twoWeeksAgo = startOfToday - 14 * 86400000;
  const thisWeekCount = logs.filter(l => l.timestamp >= weekAgo).length;
  const lastWeekCount = logs.filter(l => l.timestamp >= twoWeeksAgo && l.timestamp < weekAgo).length;
  const weekDelta = thisWeekCount - lastWeekCount;

  // Sessions in the last 7 / 30 days
  const sessionsLast7 = thisWeekCount;
  const last30Logs = logs.filter(l => l.timestamp >= startOfToday - 30 * 86400000);
  const sessionsLast30 = last30Logs.length;
  const secondsLast30 = last30Logs.reduce((a, l) => a + l.totalActiveSeconds, 0);

  // --- Plan Adherence: of the sessions scheduled in the last 7 days, how many were done? ---
  let scheduledSessions7 = 0;
  let completedSessions7 = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfToday - i * 86400000);
    const dayShort = WEEKDAY_SHORT[d.getDay()];
    const dayStart = d.getTime();
    const dayEnd = dayStart + 86400000;
    const scheduled = exercises.filter(e => e.weekdays?.includes(dayShort));
    scheduledSessions7 += scheduled.length;
    const dayLogs = logs.filter(l => l.timestamp >= dayStart && l.timestamp < dayEnd);
    const completedOnDay = scheduled.filter(ex =>
      dayLogs.some(l => l.exerciseId === ex.id || l.exerciseName === ex.name)
    ).length;
    completedSessions7 += completedOnDay;
  }
  const hasSchedule = scheduledSessions7 > 0;
  const adherencePercent = hasSchedule
    ? Math.round((completedSessions7 / scheduledSessions7) * 100)
    : 0;
  const extraSessions7 = Math.max(0, sessionsLast7 - completedSessions7);

  // --- Category mix (last 7 days, by active seconds) ---
  const last7Logs = logs.filter(l => l.timestamp >= weekAgo);
  const categoryTotalsMap = new Map<string, number>();
  last7Logs.forEach(l => {
    const cat = l.category ?? 'other';
    categoryTotalsMap.set(cat, (categoryTotalsMap.get(cat) ?? 0) + l.totalActiveSeconds);
  });
  const totalSeconds7 = [...categoryTotalsMap.values()].reduce((a, b) => a + b, 0);
  const categoryBreakdown = [...categoryTotalsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, seconds]) => ({
      category,
      seconds,
      percent: totalSeconds7 > 0 ? (seconds / totalSeconds7) * 100 : 0,
    }));

  // --- Heatmap: last 12 weeks (84 days) ---
  const HEATMAP_WEEKS = 12;
  const heatmapStart = new Date(now);
  // Align to start of the week containing 11 weeks ago (Sunday)
  heatmapStart.setDate(heatmapStart.getDate() - (HEATMAP_WEEKS - 1) * 7 - heatmapStart.getDay());
  const heatmapCells: { date: Date; key: string; count: number }[] = [];
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(heatmapStart);
      d.setDate(d.getDate() + w * 7 + dow);
      const k = dayKey(d);
      heatmapCells.push({ date: d, key: k, count: countByDate.get(k) ?? 0 });
    }
  }
  const intensityClass = (c: number) => {
    if (c === 0) return 'bg-natural-bg border border-natural-border';
    if (c === 1) return 'bg-natural-moss/25';
    if (c === 2) return 'bg-natural-moss/50';
    if (c === 3) return 'bg-natural-moss/75';
    return 'bg-natural-moss';
  };

  // --- Per-exercise top ---
  const byExercise = new Map<string, { count: number; seconds: number }>();
  logs.forEach(l => {
    const cur = byExercise.get(l.exerciseName) ?? { count: 0, seconds: 0 };
    cur.count += 1;
    cur.seconds += l.totalActiveSeconds;
    byExercise.set(l.exerciseName, cur);
  });
  const topByFreq = [...byExercise.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
  const topByTime = [...byExercise.entries()]
    .filter(([, v]) => v.seconds > 0)
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .slice(0, 5);
  const maxFreq = topByFreq[0]?.[1].count ?? 1;
  const maxTime = topByTime[0]?.[1].seconds ?? 1;

  // --- Hold personal bests ---
  const holdPBs = new Map<string, number>();
  logs.forEach(l => {
    if (l.mode === 'hold' && typeof l.bestHoldSeconds === 'number') {
      const cur = holdPBs.get(l.exerciseName) ?? 0;
      if (l.bestHoldSeconds > cur) holdPBs.set(l.exerciseName, l.bestHoldSeconds);
    }
  });
  const holdPBList = [...holdPBs.entries()].sort((a, b) => b[1] - a[1]);

  // --- History log filtering ---
  const rangeStart =
    filterRange === '7d'  ? startOfToday - 7  * 86400000 :
    filterRange === '30d' ? startOfToday - 30 * 86400000 :
    filterRange === '90d' ? startOfToday - 90 * 86400000 :
    0;
  const filteredLogs = logs.filter(l => {
    if (l.timestamp < rangeStart) return false;
    if (filterCategory !== 'all' && (l.category ?? 'other') !== filterCategory) return false;
    if (filterExercise !== 'all' && l.exerciseName !== filterExercise) return false;
    return true;
  });
  const uniqueExerciseNames = Array.from(new Set(logs.map(l => l.exerciseName))).sort();
  const hasActiveFilter = filterRange !== 'all' || filterCategory !== 'all' || filterExercise !== 'all';

  const handleExportLogs = (fmt: 'json' | 'csv') => {
    if (filteredLogs.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const tag = hasActiveFilter ? '-filtered' : '';
    if (fmt === 'json') {
      downloadFile(`pulse-history${tag}-${stamp}.json`, exportLogsJSON(filteredLogs), 'application/json');
    } else {
      downloadFile(`pulse-history${tag}-${stamp}.csv`, exportLogsCSV(filteredLogs), 'text/csv');
    }
  };

  const resetFilters = () => {
    setFilterRange('all');
    setFilterCategory('all');
    setFilterExercise('all');
  };

  return (
    <div className="w-full flex flex-col gap-6 text-natural-dark">

      {/* Coach's Note (opt-in AI insights) */}
      <AnimatePresence>
        {aiEligible && (
          <motion.div
            key="coach-note"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-4 bg-gradient-to-br from-natural-moss/5 to-natural-terracotta/5 border border-natural-moss/25 rounded-2xl shadow-sm flex flex-col gap-3"
          >
            <div className="flex justify-between items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-natural-moss flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Coach's Note{aiGeneratedAt ? ` · ${formatGeneratedAt(aiGeneratedAt)}` : ` · ${todayShort}`}
              </span>
              <button
                onClick={handleAiDismiss}
                aria-label="Dismiss today's note"
                title="Dismiss for today"
                className="p-1 -mr-1 rounded text-[#70706B] hover:text-natural-dark hover:bg-white/60 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {aiLoading ? (
              <div className="flex flex-col gap-2">
                <div className="h-3 bg-natural-bg/80 rounded animate-pulse" />
                <div className="h-3 bg-natural-bg/80 rounded animate-pulse w-3/4" />
              </div>
            ) : aiInsights && aiInsights.length > 0 ? (
              <>
                <div className="flex flex-col gap-2.5">
                  {aiInsights.map(ins => (
                    <div key={ins.id} className="flex gap-2.5 text-xs leading-relaxed">
                      <span className={`w-0.5 self-stretch rounded-full flex-shrink-0 ${
                        ins.tone === 'positive' ? 'bg-natural-moss' :
                        ins.tone === 'nudge'    ? 'bg-natural-terracotta' :
                                                  'bg-[#8B8B80]'
                      }`} />
                      <p className="text-natural-dark">{ins.text}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => triggerGenerate('manual')}
                    disabled={!refreshState.allowed}
                    className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                      refreshState.allowed
                        ? 'text-natural-moss hover:bg-natural-moss/10 cursor-pointer'
                        : 'text-[#A8A89F] cursor-not-allowed'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    {refreshLabel}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-start gap-2">
                <p className="text-xs text-[#70706B] leading-relaxed">
                  {aiAttempted
                    ? "Couldn't generate insights just now. Tap to try again."
                    : 'Get a short, AI-written coach note based on your last 30 days.'}
                </p>
                <button
                  onClick={() => triggerGenerate('manual')}
                  disabled={!refreshState.allowed}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    refreshState.allowed
                      ? 'bg-natural-moss text-white hover:bg-natural-moss/90 cursor-pointer'
                      : 'bg-[#E5E5E0] text-[#8B8B80] cursor-not-allowed'
                  }`}
                >
                  {refreshState.allowed ? 'Get insights' : refreshLabel}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 0. Today's Status */}
      <div
        className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 ${
          restDay
            ? 'bg-white border-natural-border'
            : allTodayDone
              ? 'bg-natural-moss/10 border-natural-moss/40'
              : 'bg-natural-terracotta/5 border-natural-terracotta/30'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            restDay
              ? 'bg-natural-bg text-natural-dark'
              : allTodayDone
                ? 'bg-natural-moss text-white'
                : 'bg-natural-terracotta text-white'
          }`}
        >
          {restDay ? <Coffee className="w-5 h-5" /> : allTodayDone ? <CheckCircle2 className="w-5 h-5" /> : <ListChecks className="w-5 h-5" />}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#70706B]">
            Today — {todayShort}
          </span>
          <span className="text-sm font-bold text-natural-dark">
            {restDay
              ? 'Rest day — nothing scheduled.'
              : allTodayDone
                ? `All ${todaysScheduled.length} exercise${todaysScheduled.length === 1 ? '' : 's'} complete.`
                : `${todaysDoneCount} of ${todaysScheduled.length} exercise${todaysScheduled.length === 1 ? '' : 's'} done.`}
          </span>
          {!restDay && !allTodayDone && (
            <span className="text-[10px] text-[#8B8B80] mt-0.5 truncate">
              Remaining: {todaysScheduled.filter(e => !todaysCompletedNames.has(e.name)).map(e => e.name).join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* 1. Streak + Top Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-1">
          <div className="flex items-center gap-1 text-[#70706B] font-semibold text-[10px] uppercase tracking-wider">
            <Flame className={`w-3.5 h-3.5 ${streak > 0 ? 'text-natural-terracotta' : 'text-[#8B8B80]'}`} />
            Streak
          </div>
          <span className="text-2xl font-black font-display text-natural-dark">{streak}</span>
          <span className="text-[10px] text-[#8B8B80]">
            {streak === 0 ? 'start today' : `day${streak === 1 ? '' : 's'}${workedOutToday ? '' : ' (yesterday)'}`}
          </span>
        </div>
        <div className="p-3 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-1">
          <div className="flex items-center gap-1 text-[#70706B] font-semibold text-[10px] uppercase tracking-wider">
            <Award className="w-3.5 h-3.5 text-natural-moss" />
            Sessions
          </div>
          <span className="text-2xl font-black font-display text-natural-dark">{totalCompleted}</span>
          <span className="text-[10px] text-[#8B8B80]">{totalSets} sets total</span>
        </div>
        <div className="p-3 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-1">
          <div className="flex items-center gap-1 text-[#70706B] font-semibold text-[10px] uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-natural-moss" />
            Active
          </div>
          <span className="text-xl font-black font-display text-natural-dark">{formatDuration(totalSeconds)}</span>
          <span className="text-[10px] text-[#8B8B80]">under tension</span>
        </div>
      </div>

      {/* 2. This Week — Adherence + Category Mix */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-natural-moss" />
            This Week
          </h3>
          {logs.length > 0 && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                weekDelta > 0
                  ? 'bg-natural-moss/10 text-natural-moss'
                  : weekDelta < 0
                    ? 'bg-natural-terracotta/10 text-natural-terracotta'
                    : 'bg-natural-bg text-[#70706B]'
              }`}
            >
              {weekDelta > 0 ? `+${weekDelta} vs last` : weekDelta < 0 ? `${weekDelta} vs last` : 'same as last'}
            </span>
          )}
        </div>

        {/* Plan Adherence */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#70706B] flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-natural-moss" />
              Plan Adherence
            </span>
            <span className="font-mono text-[11px] text-[#70706B] font-semibold">
              {hasSchedule
                ? `${completedSessions7} of ${scheduledSessions7} scheduled`
                : `${sessionsLast7} session${sessionsLast7 === 1 ? '' : 's'}`}
            </span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-black font-display text-natural-dark leading-none">
              {hasSchedule ? `${adherencePercent}%` : '—'}
            </span>
            <span className="text-[10px] text-[#8B8B80] pb-1 leading-tight">
              {hasSchedule
                ? extraSessions7 > 0
                  ? `of plan done · +${extraSessions7} extra session${extraSessions7 === 1 ? '' : 's'}`
                  : 'of plan done'
                : 'set weekday schedules in Program to track adherence'}
            </span>
          </div>
          {hasSchedule && (
            <div className="w-full h-2 bg-natural-border rounded-full overflow-hidden shadow-inner">
              <div
                style={{ width: `${adherencePercent}%` }}
                className="h-full bg-natural-moss rounded-full transition-all duration-500"
              />
            </div>
          )}
        </div>

        {/* Category Mix */}
        {totalSeconds7 > 0 && (
          <div className="flex flex-col gap-2 pt-3 border-t border-natural-border">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#70706B]">
                Time by Category
              </span>
              <span className="font-mono text-[11px] text-[#70706B] font-semibold">
                {formatDuration(totalSeconds7)}
              </span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden flex shadow-inner bg-natural-border">
              {categoryBreakdown.map(b => (
                <div
                  key={b.category}
                  style={{ width: `${b.percent}%` }}
                  className={`h-full ${CATEGORY_BAR_COLORS[b.category]?.fill ?? 'bg-slate-400'} transition-all duration-500`}
                  title={`${CATEGORY_BAR_COLORS[b.category]?.label ?? b.category}: ${formatDuration(b.seconds)}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
              {categoryBreakdown.map(b => (
                <div key={b.category} className="flex items-center gap-1.5 text-[10px]">
                  <span className={`w-2 h-2 rounded-full ${CATEGORY_BAR_COLORS[b.category]?.dot ?? 'bg-slate-400'}`} />
                  <span className="font-semibold text-natural-dark">
                    {CATEGORY_BAR_COLORS[b.category]?.label ?? b.category}
                  </span>
                  <span className="text-[#8B8B80] font-mono">{formatDuration(b.seconds)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 30-day footer */}
        <div className="pt-2 border-t border-natural-border flex justify-between items-center text-[10px] text-[#8B8B80]">
          <span className="font-bold uppercase tracking-wider">Last 30 Days</span>
          <span className="font-mono font-semibold text-natural-dark">
            {sessionsLast30} session{sessionsLast30 === 1 ? '' : 's'}
            {sessionsLast30 > 0 && ` · ${formatDuration(secondsLast30)}`}
          </span>
        </div>
      </div>

      {/* 3. Activity Heatmap */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-3">
        <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
          <Calendar className="w-4 h-4 text-natural-moss" />
          Activity — Last {HEATMAP_WEEKS} Weeks
        </h3>
        <div className="flex gap-2">
          {/* Day-of-week labels */}
          <div className="flex flex-col justify-between text-[8px] text-[#8B8B80] font-bold uppercase tracking-wider pt-0.5 pb-0.5">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
          </div>
          {/* Heatmap grid */}
          <div className="flex-1 grid grid-cols-12 gap-1">
            {Array.from({ length: HEATMAP_WEEKS }).map((_, w) => (
              <div key={w} className="flex flex-col gap-1">
                {Array.from({ length: 7 }).map((_, dow) => {
                  const cell = heatmapCells[w * 7 + dow];
                  const future = cell.date.getTime() > now.getTime();
                  return (
                    <div
                      key={dow}
                      className={`aspect-square rounded-sm ${future ? 'bg-transparent' : intensityClass(cell.count)}`}
                      title={future ? '' : `${cell.date.toLocaleDateString()} — ${cell.count} session${cell.count === 1 ? '' : 's'}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between text-[9px] text-[#8B8B80] font-medium">
          <span>{heatmapCells[0].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          <div className="flex items-center gap-1">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map(n => (
              <div key={n} className={`w-2 h-2 rounded-sm ${intensityClass(n)}`} />
            ))}
            <span>More</span>
          </div>
          <span>Today</span>
        </div>
      </div>

      {/* 4. Top Exercises */}
      {(topByFreq.length > 0 || topByTime.length > 0) && (
        <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-4">
          <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
            <Trophy className="w-4 h-4 text-natural-moss" />
            Top Exercises
          </h3>

          {topByFreq.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#70706B]">By frequency</span>
              {topByFreq.map(([name, stats], i) => (
                <button
                  key={name}
                  onClick={() => openDetail(name)}
                  className="flex items-center gap-2 text-xs text-left w-full p-1 -m-1 rounded-lg hover:bg-natural-bg/60 transition cursor-pointer"
                >
                  <span className="w-4 h-4 rounded-full bg-natural-moss/10 text-natural-moss font-bold text-[9px] flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-natural-dark truncate flex-1 min-w-0">{name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-16 h-1.5 bg-natural-border rounded-full overflow-hidden">
                      <div
                        style={{ width: `${(stats.count / maxFreq) * 100}%` }}
                        className="h-full bg-natural-moss rounded-full"
                      />
                    </div>
                    <span className="font-mono font-bold text-natural-moss text-[11px] w-7 text-right">{stats.count}×</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {topByTime.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-natural-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#70706B]">By time under tension</span>
              {topByTime.map(([name, stats], i) => (
                <button
                  key={name}
                  onClick={() => openDetail(name)}
                  className="flex items-center gap-2 text-xs text-left w-full p-1 -m-1 rounded-lg hover:bg-natural-bg/60 transition cursor-pointer"
                >
                  <span className="w-4 h-4 rounded-full bg-natural-terracotta/10 text-natural-terracotta font-bold text-[9px] flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-natural-dark truncate flex-1 min-w-0">{name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-16 h-1.5 bg-natural-border rounded-full overflow-hidden">
                      <div
                        style={{ width: `${(stats.seconds / maxTime) * 100}%` }}
                        className="h-full bg-natural-terracotta rounded-full"
                      />
                    </div>
                    <span className="font-mono font-bold text-natural-terracotta text-[11px] w-12 text-right">{formatDuration(stats.seconds)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Hold Personal Bests */}
      {holdPBList.length > 0 && (
        <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-3">
          <h3 className="text-xs font-bold tracking-wider uppercase flex items-center gap-2 text-amber-700">
            <Hourglass className="w-4 h-4" />
            Hold Personal Bests
          </h3>
          <div className="flex flex-col gap-2">
            {holdPBList.map(([name, secs]) => (
              <button
                key={name}
                onClick={() => openDetail(name)}
                className="flex items-center justify-between gap-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100/70 transition cursor-pointer text-left"
              >
                <span className="font-semibold text-natural-dark text-xs truncate">{name}</span>
                <span className="font-mono font-black text-amber-700 text-sm whitespace-nowrap">
                  {formatHold(secs)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ExerciseDetailSheet
        exerciseName={detailExerciseName}
        logs={logs}
        exercises={exercises}
        onClose={() => setDetailExerciseName(null)}
      />

      {/* 6. Program History Log */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center gap-2">
          <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-natural-moss" />
            History Log
            {logs.length > 0 && (
              <span className="text-[10px] text-[#8B8B80] font-normal normal-case tracking-normal">
                · {hasActiveFilter
                    ? `${filteredLogs.length} of ${logs.length}`
                    : `${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}`}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {logs.length > 0 && (
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  showFilters || hasActiveFilter
                    ? 'bg-natural-moss/10 text-natural-moss'
                    : 'text-[#70706B] hover:bg-natural-bg hover:text-natural-dark'
                }`}
                aria-label="Filter and export"
                title="Filter & export"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
            {logs.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Clear your entire workout history?')) onClearLogs();
                }}
                className="text-[10px] tracking-wide font-bold text-red-500 hover:text-red-700 transition flex items-center gap-0.5 cursor-pointer px-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                CLEAR ALL
              </button>
            )}
          </div>
        </div>

        {/* Filter + Export panel */}
        <AnimatePresence>
          {showFilters && logs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3 p-3 bg-natural-bg/60 border border-natural-border rounded-xl">
                {/* Date range */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#70706B]">Date range</span>
                  <div className="flex gap-1.5">
                    {(['all', '7d', '30d', '90d'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setFilterRange(r)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition cursor-pointer ${
                          filterRange === r
                            ? 'bg-natural-moss text-white'
                            : 'bg-white border border-natural-border text-[#70706B] hover:border-natural-moss/40'
                        }`}
                      >
                        {r === 'all' ? 'All' : r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#70706B]">Category</span>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORY_FILTER_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFilterCategory(opt.value)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition cursor-pointer ${
                          filterCategory === opt.value
                            ? 'bg-natural-dark text-white border-natural-dark'
                            : 'bg-white text-[#70706B] border-natural-border hover:border-natural-dark/30'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exercise dropdown — only useful when there are multiple distinct names */}
                {uniqueExerciseNames.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#70706B]">Exercise</span>
                    <select
                      value={filterExercise}
                      onChange={e => setFilterExercise(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-natural-border rounded-lg text-xs text-natural-dark focus:outline-none focus:border-natural-moss cursor-pointer"
                    >
                      <option value="all">All exercises</option>
                      {uniqueExerciseNames.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Export */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-natural-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#70706B]">
                    Export {hasActiveFilter ? `${filteredLogs.length} filtered` : `all ${logs.length}`}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleExportLogs('json')}
                      disabled={filteredLogs.length === 0}
                      className="flex items-center justify-center gap-1.5 py-2 bg-white border border-natural-border text-natural-moss rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-natural-border/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> JSON
                    </button>
                    <button
                      onClick={() => handleExportLogs('csv')}
                      disabled={filteredLogs.length === 0}
                      className="flex items-center justify-center gap-1.5 py-2 bg-white border border-natural-border text-natural-moss rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-natural-border/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  </div>
                </div>

                {hasActiveFilter && (
                  <button
                    onClick={resetFilters}
                    className="text-[10px] font-bold text-natural-terracotta hover:text-[#C27A62] tracking-wide uppercase cursor-pointer self-start"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <div className="text-center py-8 bg-natural-bg/50 border border-dashed border-natural-border rounded-xl">
              <p className="text-xs text-slate-500">Every completed exercise writes a local log. Start training to fill this up.</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-6 bg-natural-bg/40 border border-dashed border-natural-border rounded-xl">
              <p className="text-xs text-[#70706B]">No sessions match your filters.</p>
              <button
                onClick={resetFilters}
                className="text-[10px] font-bold text-natural-moss hover:text-[#4E4E36] uppercase tracking-wide mt-2 cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            [...filteredLogs].reverse().map((log) => {
              const dt = new Date(log.timestamp);
              const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
              const isHold = log.mode === 'hold';

              return (
                <button
                  key={log.id}
                  onClick={() => openDetail(log.exerciseName)}
                  className="w-full text-left p-3 bg-natural-bg rounded-xl border border-natural-border hover:bg-natural-bg/60 hover:border-natural-moss/30 transition flex items-center justify-between gap-3 text-xs cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {isHold ? (
                      <Hourglass className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mt-0.5 text-natural-moss flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-natural-dark truncate">{log.exerciseName}</div>
                      <div className="text-slate-400 mt-0.5 text-[10px] flex items-center gap-2 flex-wrap">
                        <span>{dateStr} • {timeStr}</span>
                        <span>•</span>
                        <span>{log.cyclesCompleted} sets</span>
                        {isHold && log.bestHoldSeconds && (
                          <>
                            <span>•</span>
                            <span className="text-amber-700 font-semibold">best {formatHold(log.bestHoldSeconds)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold font-mono shrink-0 whitespace-nowrap ${isHold ? 'text-amber-700' : 'text-natural-moss'}`}>
                    +{formatDuration(log.totalActiveSeconds)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
