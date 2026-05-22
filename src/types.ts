export type SoundMode = 'off' | 'beep' | 'countdown' | 'metronome' | 'continuous';
export type SoundTheme = 'digital' | 'ems' | 'synth' | 'zen' | 'arcade';
export type ContinuousSound = 'drum-loop' | 'ambient-pad' | 'heartbeat';

export interface WorkoutSettings {
  activeDur: number; // 5 - 120
  restDur: number;   // 5 - 120
  targetCycles: number; // 0 = unlimited, or physical limit
  sound: SoundMode;
  soundTheme: SoundTheme;
  continuousSound: ContinuousSound;
  volume: number;    // 0 - 100
  vibrate: boolean;
  wakelock: boolean;
}

export type WorkoutPhase = 'idle' | 'active' | 'rest' | 'done';

export interface WorkoutState {
  running: boolean;
  phase: WorkoutPhase;
  cycles: number;
}

export interface PhysioExercise {
  id: string;
  name: string;
  activeDur: number;
  restDur: number;
  targetCycles: number; // Sets / cycles
  repsPerSet?: number; // Repetitions within a set
  weekdays?: string[]; // e.g. ['Mon', 'Wed', 'Fri'] for Day-wise scheduling
  weeklyTarget?: number; // e.g. 3 times per week
  notes?: string;
}

export interface WorkoutLogEntry {
  id: string;
  timestamp: number; // Unix timestamp ms
  exerciseName: string;
  cyclesCompleted: number;
  totalActiveSeconds: number;
}
