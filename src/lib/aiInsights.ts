import { WorkoutLogEntry, PhysioExercise, ExerciseMode } from '../types';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CACHE_KEY = 'pulse-ai-insights';
const DISMISS_KEY = 'pulse-ai-dismissed';
const USAGE_KEY = 'pulse-ai-usage';

export const MANUAL_COOLDOWN_MS = 30 * 60 * 1000;
export const MANUAL_MAX_PER_DAY = 2;

// ---- Public types ----

export type Trend = 'up' | 'down' | 'flat' | 'insufficient';
export type InsightTone = 'positive' | 'neutral' | 'nudge';

export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
}

export interface StatsBlob {
  schemaVersion: 1;
  generatedAt: string;        // YYYY-MM-DD only (no exact timestamps leave the device)
  timezone: string;
  window: { days: 30 };
  totals: {
    sessions: number;
    activeSeconds: number;
    sets: number;
    distinctExercises: number;
  };
  thisWeek: {
    sessions: number;
    activeSeconds: number;
    scheduledSessions: number;
    completedScheduled: number;
    adherencePercent: number;
  };
  lastWeek: {
    sessions: number;
    activeSeconds: number;
    adherencePercent: number;
  };
  streakDays: number;
  categoryMixThisWeek: { category: string; activeSeconds: number; percent: number }[];
  topExercises: {
    name: string;
    category: string;
    mode: ExerciseMode;
    sessions30d: number;
    activeSeconds30d: number;
    trend: Trend;
    pb: number;
  }[];
  scheduledButMissedThisWeek: string[];
}

// ---- Date helpers ----

const todayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dayKeyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// ---- Stats blob builder (pure: deterministic for given inputs + current date) ----

export function buildStatsBlob(
  logs: WorkoutLogEntry[],
  exercises: PhysioExercise[],
): StatsBlob {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tz = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch { return 'UTC'; }
  })();

  const since30 = startOfToday - 30 * 86400000;
  const since7  = startOfToday - 7  * 86400000;
  const since14 = startOfToday - 14 * 86400000;

  const logs30   = logs.filter(l => l.timestamp >= since30);
  const logs7    = logs.filter(l => l.timestamp >= since7);
  const logs14_7 = logs.filter(l => l.timestamp >= since14 && l.timestamp < since7);

  const totals = {
    sessions: logs30.length,
    activeSeconds: logs30.reduce((a, l) => a + l.totalActiveSeconds, 0),
    sets: logs30.reduce((a, l) => a + l.cyclesCompleted, 0),
    distinctExercises: new Set(logs30.map(l => l.exerciseName)).size,
  };

  // Adherence over a 7-day window starting `daysBack` ago.
  const adherenceFor = (daysBack: number): { scheduled: number; completed: number } => {
    let scheduled = 0;
    let completed = 0;
    for (let i = daysBack; i < daysBack + 7; i++) {
      const d = new Date(startOfToday - i * 86400000);
      const dayShort = WEEKDAY_SHORT[d.getDay()];
      const dayStart = d.getTime();
      const dayEnd = dayStart + 86400000;
      const sched = exercises.filter(e => e.weekdays?.includes(dayShort));
      scheduled += sched.length;
      const dayLogs = logs.filter(l => l.timestamp >= dayStart && l.timestamp < dayEnd);
      completed += sched.filter(ex =>
        dayLogs.some(l => l.exerciseId === ex.id || l.exerciseName === ex.name),
      ).length;
    }
    return { scheduled, completed };
  };

  const thisAd = adherenceFor(0);
  const lastAd = adherenceFor(7);

  const thisWeek = {
    sessions: logs7.length,
    activeSeconds: logs7.reduce((a, l) => a + l.totalActiveSeconds, 0),
    scheduledSessions: thisAd.scheduled,
    completedScheduled: thisAd.completed,
    adherencePercent: thisAd.scheduled > 0
      ? Math.round((thisAd.completed / thisAd.scheduled) * 100)
      : 0,
  };
  const lastWeek = {
    sessions: logs14_7.length,
    activeSeconds: logs14_7.reduce((a, l) => a + l.totalActiveSeconds, 0),
    adherencePercent: lastAd.scheduled > 0
      ? Math.round((lastAd.completed / lastAd.scheduled) * 100)
      : 0,
  };

  // Streak: consecutive days with at least one logged session.
  const dayKeys = new Set(logs.map(l => dayKeyOf(new Date(l.timestamp))));
  let streakDays = 0;
  {
    const d = new Date();
    if (!dayKeys.has(dayKeyOf(d))) d.setDate(d.getDate() - 1);
    let safety = 0;
    while (safety++ < 365 && dayKeys.has(dayKeyOf(d))) {
      streakDays++;
      d.setDate(d.getDate() - 1);
    }
  }

  // Category mix (this week)
  const catTotals = new Map<string, number>();
  logs7.forEach(l => {
    const c = l.category ?? 'other';
    catTotals.set(c, (catTotals.get(c) ?? 0) + l.totalActiveSeconds);
  });
  const catTotal = [...catTotals.values()].reduce((a, b) => a + b, 0);
  const categoryMixThisWeek = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, activeSeconds]) => ({
      category,
      activeSeconds,
      percent: catTotal > 0 ? Math.round((activeSeconds / catTotal) * 100) : 0,
    }));

  // Top exercises (last 30d) with simple slope-based trend
  const byEx = new Map<string, WorkoutLogEntry[]>();
  logs30.forEach(l => {
    const arr = byEx.get(l.exerciseName) ?? [];
    arr.push(l);
    byEx.set(l.exerciseName, arr);
  });

  const topExercises = [...byEx.entries()]
    .map(([name, lgs]) => {
      const exDef = exercises.find(e => e.name === name);
      const latest = lgs[lgs.length - 1];
      const mode: ExerciseMode = exDef?.mode ?? latest?.mode ?? 'time';
      const category = exDef?.category ?? latest?.category ?? 'other';
      const activeSeconds30d = lgs.reduce((a, l) => a + l.totalActiveSeconds, 0);
      const sessions30d = lgs.length;

      const pb =
        mode === 'hold' ? lgs.reduce((m, l) => Math.max(m, l.bestHoldSeconds ?? 0), 0) :
        mode === 'reps' ? lgs.reduce((m, l) => Math.max(m, l.cyclesCompleted), 0) :
                          lgs.reduce((m, l) => Math.max(m, l.totalActiveSeconds), 0);

      let trend: Trend = 'insufficient';
      if (lgs.length >= 4) {
        const sorted = [...lgs].sort((a, b) => a.timestamp - b.timestamp);
        const mid = Math.floor(sorted.length / 2);
        const metric = (l: WorkoutLogEntry) =>
          mode === 'hold' ? (l.bestHoldSeconds ?? 0) :
          mode === 'reps' ? l.cyclesCompleted :
                            l.totalActiveSeconds;
        const firstAvg = sorted.slice(0, mid).reduce((a, l) => a + metric(l), 0) / mid;
        const secondAvg = sorted.slice(mid).reduce((a, l) => a + metric(l), 0) / (sorted.length - mid);
        const ratio = firstAvg === 0 ? (secondAvg > 0 ? 2 : 1) : secondAvg / firstAvg;
        trend = ratio > 1.1 ? 'up' : ratio < 0.9 ? 'down' : 'flat';
      }

      return { name, category, mode, sessions30d, activeSeconds30d, trend, pb };
    })
    .sort((a, b) => b.sessions30d - a.sessions30d)
    .slice(0, 5);

  // Scheduled but missed this week
  const scheduledNames = new Set<string>();
  const completedNames = new Set(logs7.map(l => l.exerciseName));
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfToday - i * 86400000);
    const dayShort = WEEKDAY_SHORT[d.getDay()];
    exercises
      .filter(e => e.weekdays?.includes(dayShort))
      .forEach(e => scheduledNames.add(e.name));
  }
  const scheduledButMissedThisWeek = [...scheduledNames].filter(n => !completedNames.has(n));

  return {
    schemaVersion: 1,
    generatedAt: todayDateString(),
    timezone: tz,
    window: { days: 30 },
    totals,
    thisWeek,
    lastWeek,
    streakDays,
    categoryMixThisWeek,
    topExercises,
    scheduledButMissedThisWeek,
  };
}

// ---- Hash for cache invalidation when inputs change mid-day ----

function hashStats(stats: StatsBlob): string {
  const key = JSON.stringify({
    s: stats.totals.sessions,
    a: stats.totals.activeSeconds,
    ap: stats.thisWeek.adherencePercent,
    cs: stats.thisWeek.completedScheduled,
    ss: stats.thisWeek.scheduledSessions,
    sd: stats.streakDays,
    tx: stats.topExercises.map(e => `${e.name}:${e.sessions30d}:${e.trend}`).join('|'),
  });
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return String(h);
}

// ---- Cache ----

interface CachedPayload {
  date: string;
  hash: string;
  insights: Insight[];
}

export interface CachedInsightsView {
  insights: Insight[];
  generatedAt: string; // YYYY-MM-DD
}

// Cache no longer auto-invalidates daily — insights are intentionally weekly.
// Hash mismatch (significant new logged activity) still busts the cache so a
// burst of new sessions doesn't go un-noticed until the next auto-refresh day.
export function loadCachedInsights(stats: StatsBlob): CachedInsightsView | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (parsed.hash !== hashStats(stats)) return null;
    return { insights: parsed.insights, generatedAt: parsed.date };
  } catch {
    return null;
  }
}

export function saveCachedInsights(stats: StatsBlob, insights: Insight[]): void {
  try {
    const payload: CachedPayload = {
      date: todayDateString(),
      hash: hashStats(stats),
      insights,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

export function clearAIArtifacts(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(DISMISS_KEY);
    localStorage.removeItem(USAGE_KEY);
  } catch {}
}

// ---- Usage tracking: 2 manual triggers/day with 30-min cooldown, weekly auto on chosen day ----

interface UsageRecord {
  date: string;             // YYYY-MM-DD; manual counters reset when this changes
  manualCount: number;
  lastManualAt: number;     // epoch ms; 0 if no manual today
  autoFiredOnDate: string | null; // last date the weekly auto-refresh successfully fired
}

function loadUsage(): UsageRecord {
  const empty: UsageRecord = { date: todayDateString(), manualCount: 0, lastManualAt: 0, autoFiredOnDate: null };
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<UsageRecord>;
    return {
      date: parsed.date ?? empty.date,
      manualCount: parsed.manualCount ?? 0,
      lastManualAt: parsed.lastManualAt ?? 0,
      autoFiredOnDate: parsed.autoFiredOnDate ?? null,
    };
  } catch {
    return empty;
  }
}

function saveUsage(u: UsageRecord): void {
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch {}
}

export type ManualRefreshBlockReason = 'cooldown' | 'max-reached';

export interface ManualRefreshState {
  allowed: boolean;
  reason?: ManualRefreshBlockReason;
  cooldownEndsAt?: number;  // epoch ms (only when reason === 'cooldown')
  triggersUsedToday: number;
  triggersRemainingToday: number;
}

export function getManualRefreshState(now: number = Date.now()): ManualRefreshState {
  const today = todayDateString();
  const u = loadUsage();
  const usedToday = u.date === today ? u.manualCount : 0;
  const lastAt    = u.date === today ? u.lastManualAt : 0;
  const remaining = Math.max(0, MANUAL_MAX_PER_DAY - usedToday);

  if (usedToday >= MANUAL_MAX_PER_DAY) {
    return { allowed: false, reason: 'max-reached', triggersUsedToday: usedToday, triggersRemainingToday: 0 };
  }
  const cooldownEndsAt = lastAt + MANUAL_COOLDOWN_MS;
  if (lastAt > 0 && now < cooldownEndsAt) {
    return { allowed: false, reason: 'cooldown', cooldownEndsAt, triggersUsedToday: usedToday, triggersRemainingToday: remaining };
  }
  return { allowed: true, triggersUsedToday: usedToday, triggersRemainingToday: remaining };
}

// Counted only on successful generation so a failed call doesn't burn the user's quota.
export function recordManualTrigger(now: number = Date.now()): void {
  const today = todayDateString();
  const u = loadUsage();
  if (u.date !== today) {
    saveUsage({ date: today, manualCount: 1, lastManualAt: now, autoFiredOnDate: u.autoFiredOnDate });
  } else {
    saveUsage({ ...u, manualCount: u.manualCount + 1, lastManualAt: now });
  }
}

export function shouldAutoRefresh(autoDay: number | null | undefined, now: Date = new Date()): boolean {
  if (autoDay == null) return false;
  if (now.getDay() !== autoDay) return false;
  const u = loadUsage();
  return u.autoFiredOnDate !== todayDateString();
}

export function recordAutoFired(): void {
  const today = todayDateString();
  const u = loadUsage();
  // Reset daily counters if the date rolled while we held a stale record.
  if (u.date !== today) {
    saveUsage({ date: today, manualCount: 0, lastManualAt: 0, autoFiredOnDate: today });
  } else {
    saveUsage({ ...u, autoFiredOnDate: today });
  }
}

// ---- Dismiss (per-day) ----

export function isDismissedToday(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayDateString();
  } catch {
    return false;
  }
}

export function dismissForToday(): void {
  try {
    localStorage.setItem(DISMISS_KEY, todayDateString());
  } catch {}
}

const INSIGHTS_API_URL = 'https://pulse-ai-backend-five.vercel.app/api/insights';
const INSIGHTS_TIMEOUT_MS = 12_000;

// Soft-failure on every error path: the card is a nice-to-have, never block the UI.
export async function generateInsights(stats: StatsBlob): Promise<Insight[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INSIGHTS_TIMEOUT_MS);
  try {
    const res = await fetch(INSIGHTS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stats),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { insights?: Insight[] };
    return Array.isArray(data.insights) ? data.insights.slice(0, 2) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
