import { WorkoutLogEntry, PhysioExercise } from '../types';
import {
  Award, Calendar, Clock, TrendingUp, CheckCircle, Trash2, CalendarDays,
  CheckCircle2, Flame, Hourglass, Trophy, ListChecks, Coffee,
} from 'lucide-react';

interface AnalyticsPanelProps {
  logs: WorkoutLogEntry[];
  exercises: PhysioExercise[];
  onClearLogs: () => void;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export default function AnalyticsPanel({ logs, exercises, onClearLogs }: AnalyticsPanelProps) {
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

  // --- Weekly + monthly goals (real targets from program) ---
  const sumWeeklyTargets = exercises.reduce((sum, e) => sum + (e.weeklyTarget ?? 0), 0);
  const targetWeeklyWorkouts = sumWeeklyTargets > 0 ? sumWeeklyTargets : 4;
  const targetMonthlyWorkouts = targetWeeklyWorkouts * 4;

  // Sessions in the last 7 / 30 days
  const sessionsLast7 = thisWeekCount;
  const sessionsLast30 = logs.filter(l => l.timestamp >= startOfToday - 30 * 86400000).length;
  const weeklyCompliancePercent = Math.min(100, Math.round((sessionsLast7 / targetWeeklyWorkouts) * 100));
  const monthlyCompliancePercent = Math.min(100, Math.round((sessionsLast30 / targetMonthlyWorkouts) * 100));

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

  return (
    <div className="w-full flex flex-col gap-6 text-natural-dark">

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

      {/* 2. Weekly + Monthly Goals (real targets) */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-natural-moss" />
            Progress Goals
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
              {weekDelta > 0 ? `+${weekDelta} vs last week` : weekDelta < 0 ? `${weekDelta} vs last week` : 'same as last week'}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 p-3 bg-natural-bg/50 border border-natural-border rounded-xl">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-natural-dark flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-natural-moss" />
                Weekly Goal
              </span>
              <span className="font-mono font-bold text-natural-moss">
                {sessionsLast7} / {targetWeeklyWorkouts} sessions
              </span>
            </div>
            <div className="w-full h-2.5 bg-natural-border rounded-full overflow-hidden shadow-inner">
              <div
                style={{ width: `${weeklyCompliancePercent}%` }}
                className="h-full bg-natural-moss rounded-full transition-all duration-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>{weeklyCompliancePercent}% of goal</span>
              <span>{sumWeeklyTargets > 0 ? 'derived from your program' : 'default — set weekly targets in Program tab'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 p-3 bg-natural-bg/50 border border-natural-border rounded-xl">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-natural-dark flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-natural-terracotta" />
                Monthly Goal (L-30 Days)
              </span>
              <span className="font-mono font-bold text-natural-terracotta">
                {sessionsLast30} / {targetMonthlyWorkouts} sessions
              </span>
            </div>
            <div className="w-full h-2.5 bg-natural-border rounded-full overflow-hidden shadow-inner">
              <div
                style={{ width: `${monthlyCompliancePercent}%` }}
                className="h-full bg-natural-terracotta rounded-full transition-all duration-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>{monthlyCompliancePercent}% of goal</span>
              <span>Target: {targetMonthlyWorkouts} sessions / month</span>
            </div>
          </div>
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
                <div key={name} className="flex items-center gap-2 text-xs">
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
                </div>
              ))}
            </div>
          )}

          {topByTime.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-natural-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#70706B]">By time under tension</span>
              {topByTime.map(([name, stats], i) => (
                <div key={name} className="flex items-center gap-2 text-xs">
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
                </div>
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
              <div key={name} className="flex items-center justify-between gap-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="font-semibold text-natural-dark text-xs truncate">{name}</span>
                <span className="font-mono font-black text-amber-700 text-sm whitespace-nowrap">
                  {formatHold(secs)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Program History Log */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
            <Calendar className="w-4 h-4 text-natural-moss" />
            History Log
          </h3>
          {logs.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear your entire workout history?')) onClearLogs();
              }}
              className="text-[10px] tracking-wide font-bold text-red-500 hover:text-red-700 transition flex items-center gap-0.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              CLEAR ALL
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <div className="text-center py-8 bg-natural-bg/50 border border-dashed border-natural-border rounded-xl">
              <p className="text-xs text-slate-500">Every completed exercise writes a local log. Start training to fill this up.</p>
            </div>
          ) : (
            [...logs].reverse().map((log) => {
              const dt = new Date(log.timestamp);
              const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
              const isHold = log.mode === 'hold';

              return (
                <div
                  key={log.id}
                  className="p-3 bg-natural-bg rounded-xl border border-natural-border flex items-center justify-between gap-3 text-xs"
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
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
