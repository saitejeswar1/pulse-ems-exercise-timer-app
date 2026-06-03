export type SoundMode = 'off' | 'beep' | 'countdown' | 'metronome' | 'continuous';
export type SoundTheme = 'digital' | 'ems' | 'synth' | 'zen' | 'arcade';
export type ContinuousSound = 'drum-loop' | 'ambient-pad' | 'heartbeat';

export interface WorkoutSettings {
  activeDur: number; // 0 - 120
  restDur: number;   // 0 - 120
  targetCycles: number; // 0 = unlimited, or physical limit
  interExerciseRest: number; // seconds of rest between exercises in a superset queue
  sound: SoundMode;
  soundTheme: SoundTheme;
  continuousSound: ContinuousSound;
  volume: number;    // 0 - 100
  vibrate: boolean;
  wakelock: boolean;
  aiInsightsEnabled?: boolean; // opt-in; default false
  aiInsightsAutoDay?: number | null; // 0=Sun..6=Sat for weekly auto-refresh, null=manual only
  currentLevel?: number | null; // optional recovery-level focus, 1..9; null = no focus filter
  bodyweightKg?: number | null; // user's bodyweight in kilograms; powers x BW criteria hints
}

export type WorkoutPhase = 'idle' | 'active' | 'rest' | 'transition' | 'done';

export interface WorkoutState {
  running: boolean;
  phase: WorkoutPhase;
  cycles: number;
}

export type ExerciseMode = 'time' | 'reps' | 'hold';
export type ExerciseCategory = 'ems' | 'strength' | 'cardio' | 'mobility' | 'other';
export type ExerciseLocation = 'home' | 'gym';

export interface PhysioExercise {
  id: string;
  name: string;
  category?: ExerciseCategory; // default 'other' for backward compatibility
  mode?: ExerciseMode; // default 'time' for backward compatibility
  activeDur: number;   // used when mode='time'; ignored when mode='reps'
  restDur: number;
  targetCycles: number; // Sets / cycles
  repsPerSet?: number;  // used when mode='reps' (also informational for time mode)
  weekdays?: string[]; // e.g. ['Mon', 'Wed', 'Fri'] for Day-wise scheduling
  weeklyTarget?: number; // e.g. 3 times per week
  locations?: ExerciseLocation[]; // where this can be performed; omitted = unspecified
  level?: number; // optional recovery-level tag, 1..9
  defaultWeightKg?: number; // last/typical load in kilograms; 0 or undefined = bodyweight
  notes?: string;
}

export type SwellingLevel = 'none' | 'mild' | 'moderate' | 'severe';

export interface SessionCheckIn {
  id: string;
  timestamp: number; // Unix ms
  date: string; // YYYY-MM-DD (local)
  painRating: number; // 0-10
  swelling: SwellingLevel;
  kneeFlexionDegrees?: number;
  notes?: string;
}

export interface WorkoutLogEntry {
  id: string;
  timestamp: number; // Unix timestamp ms
  exerciseName: string;
  exerciseId?: string;
  mode?: ExerciseMode;
  category?: ExerciseCategory;
  cyclesCompleted: number;
  totalActiveSeconds: number;
  bestHoldSeconds?: number; // hold-mode only: longest single hold in the session
  weightKg?: number; // load used (0 or undefined = bodyweight)
  repsPerSetUsed?: number; // copy of the exercise's repsPerSet at time of logging (for trend display)
}
