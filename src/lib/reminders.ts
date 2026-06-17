import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { WorkoutSettings, WorkoutLogEntry } from '../types';

// Adherence nudge: a daily "you haven't trained today" reminder fired by the OS at a
// user-chosen deadline. We never poll — instead we pre-schedule one nudge per upcoming day
// and rely on reconcile() (run on app open + after each logged session) to drop days that
// already have a session. So training any time before the deadline silently cancels the nudge.
//
// All notifications live in a fixed ID block so reconcile can cancel + rebuild cleanly
// without disturbing anything else. IDs are relative to the call day, which is fine because
// every reconcile cancels the whole block and reschedules the next HORIZON_DAYS from scratch.
const NUDGE_ID_BASE = 4200;
const HORIZON_DAYS = 14; // how far ahead we keep nudges scheduled; the app tops this up on open

const localDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const hasSessionOn = (logs: WorkoutLogEntry[], dateStr: string) =>
  logs.some(l => localDateString(new Date(l.timestamp)) === dateStr);

const parseHHMM = (t: string | undefined): { h: number; m: number } => {
  const [hs, ms] = (t || '20:00').split(':');
  const h = Math.min(23, Math.max(0, parseInt(hs, 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(ms, 10) || 0));
  return { h, m };
};

// Ensure notification permission; returns true if we can post. No-op (false) off native.
export async function ensureReminderPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch {
    return false;
  }
}

// Cancel every nudge in our managed ID block.
async function cancelAllNudges(): Promise<void> {
  const notifications = Array.from({ length: HORIZON_DAYS }, (_, i) => ({ id: NUDGE_ID_BASE + i }));
  try {
    await LocalNotifications.cancel({ notifications });
  } catch {
    /* nothing scheduled yet — ignore */
  }
}

// Recompute the adherence nudges from current settings + logs. Safe to call often.
// No-op off native (web preview).
export async function reconcileReminders(settings: WorkoutSettings, logs: WorkoutLogEntry[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // Disabled → clear everything we own and stop.
  if (!settings.reminderEnabled) {
    await cancelAllNudges();
    return;
  }

  const granted = await ensureReminderPermission();
  if (!granted) return;

  // Rebuild from scratch.
  await cancelAllNudges();

  const { h, m } = parseHHMM(settings.reminderTime);
  const now = new Date();
  const notifications: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];

  for (let i = 0; i < HORIZON_DAYS; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0);
    // Skip days already satisfied by a logged session (covers "trained this morning").
    if (hasSessionOn(logs, localDateString(day))) continue;
    // Skip deadlines already in the past (e.g. today's time already elapsed).
    if (day.getTime() <= now.getTime()) continue;

    notifications.push({
      id: NUDGE_ID_BASE + i,
      title: 'Pulse — today’s session',
      body: 'You haven’t logged a session today. A few minutes still counts. 💪',
      schedule: { at: day, allowWhileIdle: true },
    });
  }

  if (notifications.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications });
    } catch {
      /* permission revoked mid-flight, etc. — silently skip */
    }
  }
}
