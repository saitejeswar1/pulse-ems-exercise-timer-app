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
}

export type WorkoutPhase = 'idle' | 'active' | 'rest' | 'transition' | 'done';

export interface WorkoutState {
  running: boolean;
  phase: WorkoutPhase;
  cycles: number;
}

export type ExerciseMode = 'time' | 'reps' | 'hold';
export type ExerciseCategory = 'ems' | 'strength' | 'cardio' | 'mobility' | 'other';

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
}
