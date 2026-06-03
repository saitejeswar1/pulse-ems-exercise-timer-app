// ACL recovery progression gates — verbatim from the Complete ACL Recovery Guide,
// trimmed for phone display. Each level lists the criteria you must pass before
// advancing to the next. All ticks are manual — the app doesn't auto-evaluate.

export interface ProgressionCriterion {
  id: string;
  label: string;
  // Optional structured metadata for live hints. If `exerciseKeyword` is set,
  // the sheet looks for the user's most recent matching log entry and shows
  // how close it is to the target. If `targetBW` is set AND the user has a
  // bodyweight in settings, the hint also shows the × BW ratio.
  exerciseKeyword?: string; // case-insensitive substring; matched against log entry names
  targetBW?: number;        // target as multiple of bodyweight, e.g. 0.5
  targetReps?: number;      // target rep count for the criterion
}

export interface ProgressionGate {
  fromLevel: number;
  toLevel: number;
  headline: string; // short context shown above the checklist
  criteria: ProgressionCriterion[];
}

export const PROGRESSION_GATES: ProgressionGate[] = [
  {
    fromLevel: 1,
    toLevel: 2,
    headline: 'Acute → Early Strength',
    criteria: [
      { id: 'l1-pain',     label: 'No more than 5/10 pain' },
      { id: 'l1-flex90',   label: 'Knee flexion ≥ 90°' },
      { id: 'l1-swelling', label: 'Minimal swelling' },
      { id: 'l1-walk',     label: 'Walk without a limp' },
    ],
  },
  {
    fromLevel: 2,
    toLevel: 3,
    headline: 'Early Strength → Mobility Bridge',
    criteria: [
      { id: 'l2-pain',     label: 'No more than 3/10 pain' },
      { id: 'l2-extend',   label: 'Full knee extension (straightening)' },
      { id: 'l2-flex125',  label: 'Knee flexion ≥ 125°' },
      { id: 'l2-swelling', label: 'No swelling' },
    ],
  },
  {
    fromLevel: 3,
    toLevel: 4,
    headline: 'Mobility Bridge → Gym Loading',
    criteria: [
      { id: 'l3-pain',       label: '0/10 pain' },
      { id: 'l3-extend',     label: 'Full knee extension' },
      { id: 'l3-flex-full',  label: 'Full knee flexion' },
      { id: 'l3-no-swell',   label: 'No swelling after exercise' },
      { id: 'l3-8weeks',     label: 'At least 8 weeks post-surgery' },
    ],
  },
  {
    fromLevel: 4,
    toLevel: 5,
    headline: 'Gym Loading → Compound Strength',
    criteria: [
      { id: 'l4-leg-press',  label: 'DL Leg Press 0.5× BW × 15 reps',         exerciseKeyword: 'leg press',       targetBW: 0.5, targetReps: 15 },
      { id: 'l4-knee-ext',   label: 'DL Knee Extension 0.5× BW × 15 reps',    exerciseKeyword: 'knee extension',  targetBW: 0.5, targetReps: 15 },
      { id: 'l4-hs-curl',    label: 'DL Hamstring Curl 0.5× BW × 15 reps',    exerciseKeyword: 'hamstring curl',  targetBW: 0.5, targetReps: 15 },
      { id: 'l4-hs-bridge',  label: 'DL Hamstring Bridges × 20 reps',         exerciseKeyword: 'hamstring bridge', targetReps: 20 },
      { id: 'l4-sl-calf',    label: 'SL Calf Raises × 25 reps',               exerciseKeyword: 'sl calf rais',     targetReps: 25 },
    ],
  },
  {
    fromLevel: 5,
    toLevel: 6,
    headline: 'Compound Strength → Plyo / Pre-Running',
    criteria: [
      { id: 'l5-leg-press',    label: 'Leg Press 1.25× BW (10-rep max; target 1.5× for RTS)', exerciseKeyword: 'leg press',     targetBW: 1.25 },
      { id: 'l5-knee-ext',     label: 'Leg Extension 0.5× BW',                                exerciseKeyword: 'knee extension',targetBW: 0.5 },
      { id: 'l5-hs-curl',      label: 'Hamstring Curl 0.5× BW',                               exerciseKeyword: 'hamstring curl',targetBW: 0.5 },
      { id: 'l5-calf-smith',   label: 'Calf Raise (Smith) 1.1× BW',                           exerciseKeyword: 'calf raise',    targetBW: 1.1 },
      { id: 'l5-side-plank',   label: 'Side Plank 90 seconds each side' },
      { id: 'l5-sl-sts',       label: 'Single Leg Sit-to-Stand × 25 reps' },
      { id: 'l5-sl-elev-hsb',  label: 'SL Elevated HS Bridge × 25+ reps',                     exerciseKeyword: 'elev. hs bridge', targetReps: 25 },
      { id: 'l5-sl-hip-thrust',label: 'SL Hip Thrust (bench) 0.5× BW × 10 reps',              exerciseKeyword: 'hip thrust',    targetBW: 0.5, targetReps: 10 },
    ],
  },
  {
    fromLevel: 6,
    toLevel: 7,
    headline: 'Plyo → Linear Running',
    criteria: [
      { id: 'l6-plate-jumps', label: 'SL Plate Jumps × 25 unbroken reps' },
      { id: 'l6-pogos',       label: 'SL Pogos × 25 unbroken reps each side' },
      { id: 'l6-snap-downs',  label: 'SL Snap Downs × 5 reps per side, good form' },
      { id: 'l6-cross-train', label: 'Cross trainer 25 min continuous — no pain/swelling' },
    ],
  },
  {
    fromLevel: 7,
    toLevel: 8,
    headline: 'Linear Running → Multi-Direction',
    criteria: [
      { id: 'l7-run30',       label: 'Run continuously 30 min — no pain / swelling / adverse reaction' },
      { id: 'l7-sl-landing',  label: 'SL landing control + knee mechanics stable under running' },
      { id: 'l7-leg-press15', label: 'Leg Press 1.5× BW (10-rep max) for RTS', exerciseKeyword: 'leg press', targetBW: 1.5 },
      { id: 'l7-therapist',   label: 'Therapist sign-off received' },
    ],
  },
  {
    fromLevel: 8,
    toLevel: 9,
    headline: 'Multi-Direction → Cutting / RTS',
    criteria: [
      { id: 'l8-no-reaction', label: 'Knee not reacting to current runs' },
      { id: 'l8-sl-landing',  label: 'SL landing maintained under load' },
      { id: 'l8-body-strong', label: 'Rest of body coping with new demands' },
      { id: 'l8-strength',    label: 'Strength numbers still pass prior level' },
      { id: 'l8-leg-press',   label: 'Leg Press progressed from 1.25× → 1.5× BW', exerciseKeyword: 'leg press', targetBW: 1.5 },
    ],
  },
];

// Helper: find the user's latest log entry that matches a criterion's exerciseKeyword.
// Used by the progression sheet to render "Your last X: Y kg × N reps = 0.36× BW" hints.
export function latestMatchingLog(
  keyword: string,
  logs: { exerciseName: string; timestamp: number; weightKg?: number; cyclesCompleted: number; repsPerSetUsed?: number }[],
): typeof logs[number] | undefined {
  if (!keyword) return undefined;
  const kw = keyword.toLowerCase();
  let best: typeof logs[number] | undefined;
  for (const entry of logs) {
    if (!entry.exerciseName.toLowerCase().includes(kw)) continue;
    if (!best || entry.timestamp > best.timestamp) best = entry;
  }
  return best;
}

export function gateForLevel(fromLevel: number): ProgressionGate | undefined {
  return PROGRESSION_GATES.find(g => g.fromLevel === fromLevel);
}
