import { useEffect, ComponentType } from 'react';
import { WorkoutLogEntry, PhysioExercise, ExerciseMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, Award, Flame, Clock, Calendar, TrendingUp, Repeat, CheckCircle } from 'lucide-react';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_META: Record<string, { label: string; chipBg: string; chipText: string; sparkColor: string }> = {
  ems:      { label: 'EMS',      chipBg: 'bg-natural-terracotta/10', chipText: 'text-natural-terracotta', sparkColor: '#D98C72' },
  strength: { label: 'Strength', chipBg: 'bg-natural-moss/10',       chipText: 'text-natural-moss',       sparkColor: '#5A5A40' },
  cardio:   { label: 'Cardio',   chipBg: 'bg-rose-100',              chipText: 'text-rose-700',           sparkColor: '#f43f5e' },
  mobility: { label: 'Mobility', chipBg: 'bg-sky-100',               chipText: 'text-sky-700',            sparkColor: '#0ea5e9' },
  other:    { label: 'Other',    chipBg: 'bg-slate-100',             chipText: 'text-slate-600',          sparkColor: '#94a3b8' },
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

const formatHold = (s: number) =>
  s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface ExerciseDetailSheetProps {
  exerciseName: string | null;
  logs: WorkoutLogEntry[];
  exercises: PhysioExercise[];
  onClose: () => void;
}

export default function ExerciseDetailSheet({
  exerciseName, logs, exercises, onClose,
}: ExerciseDetailSheetProps) {
  useEffect(() => {
    if (!exerciseName) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [exerciseName, onClose]);

  return (
    <AnimatePresence>
      {exerciseName && (
        <DetailContent
          exerciseName={exerciseName}
          logs={logs}
          exercises={exercises}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}

function DetailContent({
  exerciseName, logs, exercises, onClose,
}: {
  exerciseName: string;
  logs: WorkoutLogEntry[];
  exercises: PhysioExercise[];
  onClose: () => void;
}) {
  const matchingLogs = logs
    .filter(l => l.exerciseName === exerciseName)
    .sort((a, b) => a.timestamp - b.timestamp);

  const exDef = exercises.find(e => e.name === exerciseName);
  const latestLog = matchingLogs[matchingLogs.length - 1];
  const mode: ExerciseMode = exDef?.mode ?? latestLog?.mode ?? 'time';
  const category = exDef?.category ?? latestLog?.category ?? 'other';
  const catMeta = CATEGORY_META[category] ?? CATEGORY_META.other;

  // ---- Stats ----
  const sessions = matchingLogs.length;
  const totalSeconds = matchingLogs.reduce((a, l) => a + l.totalActiveSeconds, 0);
  const totalSets = matchingLogs.reduce((a, l) => a + l.cyclesCompleted, 0);

  // PB depends on mode
  let pbValue = 0;
  let pbLabel = '';
  if (mode === 'hold') {
    pbValue = matchingLogs.reduce((m, l) => Math.max(m, l.bestHoldSeconds ?? 0), 0);
    pbLabel = 'Best hold';
  } else if (mode === 'reps') {
    pbValue = matchingLogs.reduce((m, l) => Math.max(m, l.cyclesCompleted), 0);
    pbLabel = 'Most sets';
  } else {
    pbValue = matchingLogs.reduce((m, l) => Math.max(m, l.totalActiveSeconds), 0);
    pbLabel = 'Longest set';
  }

  // Streak: walk back through scheduled days if exercise has a schedule;
  // otherwise show "days since last session".
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let streakDays = 0;
  let streakLabel = '';
  if (exDef?.weekdays && exDef.weekdays.length > 0) {
    const completedDays = new Set(matchingLogs.map(l => dayKey(l.timestamp)));
    const d = new Date(startOfToday);
    const todayScheduled = exDef.weekdays.includes(WEEKDAY_SHORT[d.getDay()]);
    if (todayScheduled && !completedDays.has(dayKey(d))) {
      d.setDate(d.getDate() - 1);
    }
    let safety = 0;
    while (safety++ < 120) {
      const dayShort = WEEKDAY_SHORT[d.getDay()];
      if (exDef.weekdays.includes(dayShort)) {
        if (completedDays.has(dayKey(d))) {
          streakDays++;
        } else {
          break;
        }
      }
      d.setDate(d.getDate() - 1);
    }
    streakLabel = streakDays === 0 ? 'no streak' : `scheduled day${streakDays === 1 ? '' : 's'}`;
  } else if (latestLog) {
    const lastMidnight = new Date(latestLog.timestamp);
    lastMidnight.setHours(0, 0, 0, 0);
    const daysAgo = Math.floor((startOfToday - lastMidnight.getTime()) / 86400000);
    streakDays = daysAgo;
    streakLabel = daysAgo === 0 ? 'today' : `day${daysAgo === 1 ? '' : 's'} ago`;
  } else {
    streakLabel = 'never';
  }

  // Sparkline metric per session
  const metric = (l: WorkoutLogEntry) =>
    mode === 'hold'  ? (l.bestHoldSeconds ?? 0) :
    mode === 'reps'  ? l.cyclesCompleted :
                       l.totalActiveSeconds;
  const metricLabel = mode === 'hold' ? 'best hold' : mode === 'reps' ? 'sets' : 'active time';

  const since = startOfToday - 84 * 86400000;
  const sparkPoints = matchingLogs
    .filter(l => l.timestamp >= since)
    .map(l => ({ ts: l.timestamp, value: metric(l) }));

  const last30Count = matchingLogs.filter(l => l.timestamp >= startOfToday - 30 * 86400000).length;

  const formatMetric = (v: number) =>
    mode === 'hold' ? formatHold(v) : mode === 'reps' ? `${v}` : formatDuration(v);

  const recentFirst = [...matchingLogs].reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 bg-natural-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 flex items-start justify-between gap-3 border-b border-natural-border">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${catMeta.chipBg} ${catMeta.chipText} self-start`}>
              {catMeta.label} · {mode === 'reps' ? 'Reps' : mode === 'hold' ? 'Hold' : 'Time'}
            </span>
            <h2 className="text-lg font-bold text-natural-dark leading-tight truncate">
              {exerciseName}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -mr-1 -mt-1 rounded-lg hover:bg-natural-bg text-[#70706B] hover:text-natural-dark cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {sessions === 0 ? (
            <p className="text-sm text-[#70706B] text-center py-8">
              No sessions logged for this exercise yet.
            </p>
          ) : (
            <>
              {/* Trend */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#70706B] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Last 12 Weeks
                  </span>
                  <span className="text-[10px] text-[#8B8B80] font-mono">{metricLabel}</span>
                </div>
                {sparkPoints.length >= 2 ? (
                  <Sparkline points={sparkPoints} color={catMeta.sparkColor} formatValue={formatMetric} />
                ) : (
                  <div className="h-[80px] bg-natural-bg/50 border border-dashed border-natural-border rounded-xl flex items-center justify-center text-[11px] text-[#8B8B80] px-4 text-center">
                    Log at least 2 sessions in the last 12 weeks to chart a trend.
                  </div>
                )}
              </div>

              {/* Stat grid */}
              <div className="grid grid-cols-3 gap-2">
                <StatCell icon={Award}        label={pbLabel}        value={formatMetric(pbValue)} accent="moss" />
                <StatCell icon={Flame}        label={streakLabel}    value={String(streakDays)}    accent="terracotta" />
                <StatCell icon={Clock}        label="Total time"     value={formatDuration(totalSeconds)} accent="moss" />
                <StatCell icon={CheckCircle}  label="Sessions"       value={String(sessions)}      accent="moss" />
                <StatCell icon={Repeat}       label="Sets done"      value={String(totalSets)}     accent="moss" />
                <StatCell icon={Calendar}     label="Last 30 days"   value={String(last30Count)}   accent="terracotta" />
              </div>

              {/* Recent sessions */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#70706B]">
                  Recent sessions
                </span>
                <div className="flex flex-col gap-1.5">
                  {recentFirst.slice(0, 8).map(log => {
                    const dt = new Date(log.timestamp);
                    const dateStr = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                    const primary = mode === 'hold' && log.bestHoldSeconds
                      ? formatHold(log.bestHoldSeconds)
                      : formatDuration(log.totalActiveSeconds);
                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between px-3 py-2 bg-natural-bg rounded-lg text-[11px]"
                      >
                        <span className="font-semibold text-natural-dark">{dateStr}</span>
                        <div className="flex items-center gap-3 text-[#70706B] font-mono">
                          <span>{log.cyclesCompleted} sets</span>
                          <span className="font-bold text-natural-moss">{primary}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function StatCell({
  icon: Icon, label, value, accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: 'moss' | 'terracotta';
}) {
  const iconColor = accent === 'moss' ? 'text-natural-moss' : 'text-natural-terracotta';
  return (
    <div className="p-2.5 bg-natural-bg/60 rounded-xl border border-natural-border flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider text-[#70706B]">
        <Icon className={`w-3 h-3 ${iconColor}`} />
        <span className="truncate">{label}</span>
      </div>
      <span className="text-base font-black font-display text-natural-dark">
        {value}
      </span>
    </div>
  );
}

function Sparkline({
  points, color, formatValue,
}: {
  points: { ts: number; value: number }[];
  color: string;
  formatValue: (v: number) => string;
}) {
  const W = 320;
  const H = 80;
  const PAD_X = 6;
  const PAD_Y = 10;

  const tsValues = points.map(p => p.ts);
  const minTs = Math.min(...tsValues);
  const maxTs = Math.max(...tsValues);
  const tsRange = Math.max(1, maxTs - minTs);
  const yMax = Math.max(1, ...points.map(p => p.value));

  const xScale = (ts: number) =>
    minTs === maxTs ? W / 2 : PAD_X + ((ts - minTs) / tsRange) * (W - PAD_X * 2);
  const yScale = (v: number) =>
    H - PAD_Y - (v / yMax) * (H - PAD_Y * 2);

  const linePts = points.map(p => `${xScale(p.ts).toFixed(1)},${yScale(p.value).toFixed(1)}`).join(' ');
  const xFirst = xScale(points[0].ts).toFixed(1);
  const xLast = xScale(points[points.length - 1].ts).toFixed(1);
  const areaPath = `M${xFirst},${H} L${linePts.split(' ').join(' L')} L${xLast},${H} Z`;
  const lastPt = points[points.length - 1];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[80px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.25" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#spark-fill)" stroke="none" />
        <polyline
          points={linePts}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xScale(p.ts)}
            cy={yScale(p.value)}
            r={i === points.length - 1 ? 3 : 1.5}
            fill={color}
          />
        ))}
      </svg>
      <div className="flex justify-between mt-1 text-[9px] text-[#8B8B80] font-mono">
        <span>{new Date(minTs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        <span className="font-bold" style={{ color }}>latest: {formatValue(lastPt.value)}</span>
        <span>{new Date(maxTs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
}
