import { WorkoutLogEntry } from '../types';

const CSV_COLUMNS = [
  'date', 'time', 'exerciseName', 'mode', 'category',
  'cyclesCompleted', 'totalActiveSeconds', 'bestHoldSeconds', 'timestamp',
] as const;

function csvEscape(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function exportLogsJSON(logs: WorkoutLogEntry[]): string {
  // Strip the internal id so re-imports don't collide; everything else is preserved.
  const stripped = logs.map(({ id, ...rest }) => rest);
  return JSON.stringify(stripped, null, 2);
}

export function exportLogsCSV(logs: WorkoutLogEntry[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const l of logs) {
    const dt = new Date(l.timestamp);
    const date = dt.toISOString().slice(0, 10);
    const time = dt.toISOString().slice(11, 19);
    const row: Record<typeof CSV_COLUMNS[number], string> = {
      date,
      time,
      exerciseName: l.exerciseName,
      mode: l.mode ?? '',
      category: l.category ?? '',
      cyclesCompleted: String(l.cyclesCompleted),
      totalActiveSeconds: String(l.totalActiveSeconds),
      bestHoldSeconds: l.bestHoldSeconds != null ? String(l.bestHoldSeconds) : '',
      timestamp: String(l.timestamp),
    };
    lines.push(CSV_COLUMNS.map(c => csvEscape(row[c])).join(','));
  }
  return lines.join('\n');
}
