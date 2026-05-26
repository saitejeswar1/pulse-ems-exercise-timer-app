import { PhysioExercise, ExerciseCategory, ExerciseMode } from '../types';

export type ImportedExercise = Omit<PhysioExercise, 'id'>;

const VALID_CATEGORIES: ExerciseCategory[] = ['ems', 'strength', 'cardio', 'mobility', 'other'];
const VALID_MODES: ExerciseMode[] = ['time', 'reps', 'hold'];
const VALID_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CSV_COLUMNS = [
  'name', 'category', 'mode',
  'activeDur', 'restDur', 'targetCycles', 'repsPerSet',
  'weekdays', 'weeklyTarget', 'notes',
] as const;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeWeekdays(raw: unknown): string[] | undefined {
  if (!raw) return undefined;
  const list = Array.isArray(raw)
    ? raw
    : String(raw).split(/[|,]/);
  const cleaned = list
    .map(d => String(d).trim())
    .map(d => d.charAt(0).toUpperCase() + d.slice(1, 3).toLowerCase())
    .filter(d => VALID_WEEKDAYS.includes(d));
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : undefined;
}

function normalizeOne(raw: any): ImportedExercise | null {
  const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;

  const category: ExerciseCategory = VALID_CATEGORIES.includes(raw?.category)
    ? raw.category
    : 'other';
  const mode: ExerciseMode = VALID_MODES.includes(raw?.mode) ? raw.mode : 'time';

  const ex: ImportedExercise = {
    name,
    category,
    mode,
    activeDur: clampInt(raw?.activeDur, 0, 600, (mode === 'reps' || mode === 'hold') ? 0 : 15),
    restDur: clampInt(raw?.restDur, 0, 600, 15),
    targetCycles: clampInt(raw?.targetCycles, 0, 100, 1),
  };

  if (raw?.repsPerSet !== undefined && raw?.repsPerSet !== '') {
    ex.repsPerSet = clampInt(raw.repsPerSet, 1, 200, 10);
  }
  const wd = normalizeWeekdays(raw?.weekdays);
  if (wd) ex.weekdays = wd;
  if (raw?.weeklyTarget !== undefined && raw?.weeklyTarget !== '') {
    ex.weeklyTarget = clampInt(raw.weeklyTarget, 1, 7, 3);
  }
  const notes = typeof raw?.notes === 'string' ? raw.notes.trim() : '';
  if (notes) ex.notes = notes;

  return ex;
}

export function parseJSONPlan(text: string): ImportedExercise[] {
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.exercises) ? parsed.exercises : null;
  if (!arr) throw new Error('JSON must be an array, or an object with an "exercises" array.');
  const out: ImportedExercise[] = [];
  for (const item of arr) {
    const ex = normalizeOne(item);
    if (ex) out.push(ex);
  }
  if (out.length === 0) throw new Error('No valid exercises found in the file.');
  return out;
}

// Minimal RFC4180-ish CSV parser supporting quoted fields with embedded commas / quotes / newlines.
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        cur.push(field); field = '';
        if (cur.some(v => v !== '')) rows.push(cur);
        cur = [];
      } else { field += c; }
    }
  }
  if (field !== '' || cur.length > 0) {
    cur.push(field);
    if (cur.some(v => v !== '')) rows.push(cur);
  }
  return rows;
}

export function parseCSVPlan(text: string): ImportedExercise[] {
  const rows = parseCSVRows(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('CSV must include a header row and at least one exercise row.');
  const header = rows[0].map(h => h.trim());
  const nameIdx = header.findIndex(h => h.toLowerCase() === 'name');
  if (nameIdx === -1) throw new Error('CSV header must include a "name" column.');
  const out: ImportedExercise[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const raw: Record<string, string> = {};
    header.forEach((h, i) => { raw[h] = (row[i] ?? '').trim(); });
    const ex = normalizeOne(raw);
    if (ex) out.push(ex);
  }
  if (out.length === 0) throw new Error('No valid exercises found in the file.');
  return out;
}

function csvEscape(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function exportJSON(exercises: PhysioExercise[]): string {
  const stripped = exercises.map(({ id, ...rest }) => rest);
  return JSON.stringify(stripped, null, 2);
}

export function exportCSV(exercises: PhysioExercise[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const ex of exercises) {
    const cells = CSV_COLUMNS.map(col => {
      const v = (ex as any)[col];
      if (v === undefined || v === null) return '';
      if (col === 'weekdays' && Array.isArray(v)) return v.join('|');
      return csvEscape(String(v));
    });
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

export const TEMPLATE_JSON = `[
  {
    "name": "Push-Ups",
    "category": "strength",
    "mode": "reps",
    "activeDur": 0,
    "restDur": 30,
    "targetCycles": 4,
    "repsPerSet": 12,
    "weekdays": ["Mon", "Wed", "Fri"],
    "weeklyTarget": 3,
    "notes": "Keep core tight, full range of motion"
  },
  {
    "name": "EMS Core Iso-Hold",
    "category": "ems",
    "mode": "time",
    "activeDur": 10,
    "restDur": 10,
    "targetCycles": 15,
    "weekdays": ["Tue", "Thu"],
    "weeklyTarget": 2,
    "notes": "Draw belly button inward during stimulation"
  }
]
`;

export const TEMPLATE_CSV = `name,category,mode,activeDur,restDur,targetCycles,repsPerSet,weekdays,weeklyTarget,notes
Push-Ups,strength,reps,0,30,4,12,Mon|Wed|Fri,3,"Keep core tight, full range of motion"
EMS Core Iso-Hold,ems,time,10,10,15,,Tue|Thu,2,Draw belly button inward during stimulation
Hip Mobility Flow,mobility,time,30,15,3,,Sun,1,Slow controlled circles
`;

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
