import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Clock, Dumbbell, TrendingUp, Settings as SettingsIcon, Check, Trophy, Heart, PlusCircle } from 'lucide-react';
import { WorkoutSettings, WorkoutPhase, PhysioExercise, WorkoutLogEntry } from './types';
import { audio } from './lib/audio';
import SettingsPanel from './components/SettingsPanel';
import Waveform from './components/Waveform';
import InstallPrompt from './components/InstallPrompt';
import PhysioSchedule from './components/PhysioSchedule';
import AnalyticsPanel from './components/AnalyticsPanel';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULTS: WorkoutSettings = {
  activeDur: 15,
  restDur: 15,
  targetCycles: 0, // 0 = unlimited
  sound: 'beep',
  volume: 60,
  vibrate: false,
  wakelock: true,
};

const INITIAL_EXERCISES: PhysioExercise[] = [
  {
    id: 'ex-1',
    name: 'EMS Core Iso-Hold',
    activeDur: 10,
    restDur: 10,
    targetCycles: 15,
    notes: 'Focus on drawing belly button inward during stimulation'
  },
  {
    id: 'ex-2',
    name: 'EMS Glute Activation',
    activeDur: 15,
    restDur: 8,
    targetCycles: 12,
    notes: 'Squeeze glutes at top of bridge during the active burst'
  },
  {
    id: 'ex-3',
    name: 'Physio Quad Strengthening',
    activeDur: 8,
    restDur: 12,
    targetCycles: 10,
    notes: 'Fully extend knee with electrical impulse'
  }
];

export default function App() {
  // --------- States ---------
  const [settings, setSettings] = useState<WorkoutSettings>(() => {
    try {
      const saved = localStorage.getItem('pulse-settings');
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Fail loading settings:', e);
    }
    return DEFAULTS;
  });

  const [phase, setPhase] = useState<WorkoutPhase>('idle');
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [currentView, setCurrentView] = useState<'timer' | 'schedule' | 'analytics' | 'settings'>('timer');

  // Physio Custom Program State
  const [exercises, setExercises] = useState<PhysioExercise[]>(() => {
    try {
      const saved = localStorage.getItem('pulse-exercises');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_EXERCISES;
  });

  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('pulse-active-ex');
    } catch (e) {}
    return null;
  });

  // Analytics Logs State
  const [logs, setLogs] = useState<WorkoutLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('pulse-logs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Timer precise continuous float trackers (seconds)
  const [remainingSec, setRemainingSec] = useState<number>(settings.activeDur);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Wake lock ref to resist garbage collection
  const wakeLockRef = useRef<any>(null);

  // Timekeepers for requestAnimationFrame delta tracking
  const phaseStartRef = useRef<number>(0);
  const phaseElapsedBeforePauseRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // Sound event trackers
  const lastCountdownTickRef = useRef<number>(-1);
  const metronomeLastSecRef = useRef<number>(-1);

  // Save states helper
  useEffect(() => {
    try {
      localStorage.setItem('pulse-exercises', JSON.stringify(exercises));
    } catch (e) {}
  }, [exercises]);

  useEffect(() => {
    try {
      if (activeExerciseId) {
        localStorage.setItem('pulse-active-ex', activeExerciseId);
      } else {
        localStorage.removeItem('pulse-active-ex');
      }
    } catch (e) {}
  }, [activeExerciseId]);

  useEffect(() => {
    try {
      localStorage.setItem('pulse-logs', JSON.stringify(logs));
    } catch (e) {}
  }, [logs]);

  // --------- Volume update ---------
  useEffect(() => {
    audio.setVolume(settings.volume);
  }, [settings.volume]);

  // --------- Wake Lock managers ---------
  const requestWakeLockState = async () => {
    if (!settings.wakelock || !('wakeLock' in navigator)) return;
    try {
      if (wakeLockRef.current) return;
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch (err) {
      // Ignored - system block or unsupported
    }
  };

  const releaseWakeLockState = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (e) {}
    }
  };

  // Re-acquire lock if page becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && running) {
        requestWakeLockState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [running]);

  // --------- Sync settings changes on start ---------
  useEffect(() => {
    if (phase === 'idle') {
      setRemainingSec(settings.activeDur);
      setProgressPercent(0);
    }
  }, [settings.activeDur, phase]);

  // Save settings in LocalStorage
  const handleSettingsChange = (newSettings: WorkoutSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('pulse-settings', JSON.stringify(newSettings));
    } catch (e) {}
  };

  // --------- Haptics helper ---------
  const triggerVibe = (pattern: number[]) => {
    if (settings.vibrate && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  };

  // Helper log workout function
  const logWorkoutSession = (cyclesVal: number) => {
    if (cyclesVal <= 0) return;
    let exerciseName = 'General EMS Training';
    if (activeExerciseId) {
      const activeObj = exercises.find(e => e.id === activeExerciseId);
      if (activeObj) {
        exerciseName = activeObj.name;
      }
    }
    const totalActiveSeconds = cyclesVal * settings.activeDur;
    const newEntry: WorkoutLogEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      exerciseName,
      cyclesCompleted: cyclesVal,
      totalActiveSeconds,
    };
    setLogs(prev => [...prev, newEntry]);
  };

  // --------- Main delta precision loop ---------
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    phaseStartRef.current = performance.now() / 1000;

    const tick = () => {
      const activeDuration = settings.activeDur;
      const restDuration = settings.restDur;

      const now = performance.now() / 1000;
      const elapsed = (now - phaseStartRef.current) + phaseElapsedBeforePauseRef.current;
      const currentLimit = phase === 'active' ? activeDuration : restDuration;

      const remaining = Math.max(0, currentLimit - elapsed);
      setRemainingSec(Math.ceil(remaining));
      setProgressPercent(Math.min(elapsed / currentLimit, 1) * 100);

      // Acoustic live ticks checker
      const remainingCeil = Math.ceil(remaining);
      if (settings.sound === 'countdown') {
        if (remainingCeil <= 3 && remainingCeil > 0 && remainingCeil !== lastCountdownTickRef.current) {
          lastCountdownTickRef.current = remainingCeil;
          audio.beep(660, 0.08, 'sine');
        }
      } else if (settings.sound === 'metronome') {
        if (phase === 'active') {
          const wholeSec = Math.floor(elapsed);
          if (wholeSec !== metronomeLastSecRef.current && wholeSec > 0) {
            metronomeLastSecRef.current = wholeSec;
            audio.beep(1000, 0.04, 'square');
          }
        }
      }

      // Check phase end trigger
      if (elapsed >= currentLimit) {
        // Transition state
        if (phase === 'active') {
          // Switch to recovery
          setPhase('rest');
          lastCountdownTickRef.current = -1;
          metronomeLastSecRef.current = -1;
          audio.playPhaseStart('rest', settings.sound);
          triggerVibe([60, 40, 60]);
          
          phaseStartRef.current = performance.now() / 1000;
          phaseElapsedBeforePauseRef.current = 0;
        } else {
          // Recovery complete: increment cycles set size
          const newCyclesCount = cycles + 1;
          setCycles(newCyclesCount);

          if (settings.targetCycles > 0 && newCyclesCount >= settings.targetCycles) {
            // Target satisfied: trigger workout complete
            setRunning(false);
            setPhase('done');
            audio.playWorkoutComplete();
            triggerVibe([100, 60, 100, 60, 200]);
            setProgressPercent(100);
            releaseWakeLockState();
            
            // Auto log the completed routine to performance tracker!
            logWorkoutSession(newCyclesCount);
            return;
          }

          // Continue inside active exercise burst
          setPhase('active');
          lastCountdownTickRef.current = -1;
          metronomeLastSecRef.current = -1;
          audio.playPhaseStart('active', settings.sound);
          triggerVibe([60, 40, 60]);
          
          phaseStartRef.current = performance.now() / 1000;
          phaseElapsedBeforePauseRef.current = 0;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, phase, settings.activeDur, settings.restDur, settings.sound, settings.targetCycles, cycles]);

  // --------- Action Triggers ---------
  const handlePlayPause = () => {
    if (running) {
      // Pause
      setRunning(false);
      const currentTime = performance.now() / 1000;
      phaseElapsedBeforePauseRef.current += currentTime - phaseStartRef.current;
      audio.stopContinuousTone();
      releaseWakeLockState();
    } else {
      // Start/Resume
      setRunning(true);
      requestWakeLockState();

      if (phase === 'idle' || phase === 'done') {
        setCycles(0);
        setPhase('active');
        audio.playPhaseStart('active', settings.sound);
        triggerVibe([60, 40, 60]);
        phaseElapsedBeforePauseRef.current = 0;
      } else if (phase === 'active' && settings.sound === 'continuous') {
        audio.startContinuousTone();
      }
    }
  };

  const handleReset = () => {
    // If user done some cycles and presses reset, let's offer logging completion
    if (cycles > 0 && phase !== 'done') {
      logWorkoutSession(cycles);
    }
    
    setRunning(false);
    audio.stopContinuousTone();
    releaseWakeLockState();
    
    setPhase('idle');
    setCycles(0);
    setRemainingSec(settings.activeDur);
    setProgressPercent(0);
    phaseElapsedBeforePauseRef.current = 0;

    lastCountdownTickRef.current = -1;
    metronomeLastSecRef.current = -1;
  };

  // Safe visual clean labels
  const getPhaseName = () => {
    if (phase === 'idle') return 'Standing By';
    if (phase === 'active') return 'Exercise Burst';
    if (phase === 'rest') return 'Rest Period';
    if (phase === 'done') return 'Completed';
    return 'Ready';
  };

  // Handlers for exercises schedule
  const handleAddExercise = (newEx: Omit<PhysioExercise, 'id'>) => {
    const ex: PhysioExercise = {
      ...newEx,
      id: `ex-${Date.now()}`
    };
    setExercises(prev => [...prev, ex]);
  };

  const handleRemoveExercise = (id: string) => {
    setExercises(prev => prev.filter(e => e.id !== id));
    if (activeExerciseId === id) {
      setActiveExerciseId(null);
    }
  };

  const handleSelectExercise = (ex: PhysioExercise) => {
    setActiveExerciseId(ex.id);
    handleSettingsChange({
      ...settings,
      activeDur: ex.activeDur,
      restDur: ex.restDur,
      targetCycles: ex.targetCycles,
    });
    // Triggers reset to apply new loaded values instantly
    handleReset();
    setCurrentView('timer');
  };

  return (
    <div className="w-full min-h-screen bg-[#F7F5F2] text-natural-dark font-sans flex flex-col items-center">
      <div className="w-full max-w-md min-h-screen flex flex-col justify-between p-4 md:p-6 pb-safe md:border-x border-natural-border bg-white shadow-md relative overflow-hidden">
        
        {/* Header Block */}
        <header className="flex flex-col gap-3 py-3 border-b border-natural-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-natural-terracotta shadow-[0_0_6px_#D98C72] animate-pulse" />
              <h1 className="text-xs font-black tracking-[0.22em] uppercase text-natural-dark font-display">
                PULSE • EMS TIMER
              </h1>
            </div>
            {activeExerciseId && (
              <span className="text-[10px] font-bold tracking-tight text-white bg-natural-moss px-2 py-0.5 rounded-full uppercase">
                Physio Routine Loaded
              </span>
            )}
          </div>

          {/* New Segmented Tab Menu navigation panel */}
          <div className="flex p-1 bg-natural-bg border border-natural-border rounded-xl">
            <button
              onClick={() => setCurrentView('timer')}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold tracking-wide uppercase transition duration-150 cursor-pointer ${
                currentView === 'timer'
                  ? 'bg-white border border-natural-border text-natural-moss shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                  : 'text-[#757570] hover:text-natural-dark'
              }`}
            >
              <Clock className="w-4 h-4" />
              Timer
            </button>
            <button
              id="tab-schedule"
              onClick={() => {
                if (running) handlePlayPause();
                setCurrentView('schedule');
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold tracking-wide uppercase transition duration-150 cursor-pointer ${
                currentView === 'schedule'
                  ? 'bg-white border border-natural-border text-natural-moss shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                  : 'text-[#757570] hover:text-natural-dark'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              Program
            </button>
            <button
              id="tab-analytics"
              onClick={() => {
                if (running) handlePlayPause();
                setCurrentView('analytics');
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold tracking-wide uppercase transition duration-150 cursor-pointer ${
                currentView === 'analytics'
                  ? 'bg-white border border-natural-border text-natural-moss shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                  : 'text-[#757570] hover:text-natural-dark'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Progress
            </button>
            <button
              id="tab-settings"
              onClick={() => {
                if (running) handlePlayPause();
                setCurrentView('settings');
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold tracking-wide uppercase transition duration-150 cursor-pointer ${
                currentView === 'settings'
                  ? 'bg-white border border-natural-border text-natural-moss shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                  : 'text-[#757570] hover:text-natural-dark'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              Acoustic
            </button>
          </div>
        </header>

        {/* View Slide Container */}
        <main className="flex-1 py-4 flex flex-col justify-center gap-5">
          <AnimatePresence mode="wait">
            {currentView === 'timer' && (
              <motion.div
                key="timer-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-6"
              >
                {/* Meta Summary Row */}
                <div className="flex justify-between items-center bg-natural-bg/70 p-3.5 rounded-xl border border-natural-border shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      phase === 'active' 
                        ? 'bg-natural-moss shadow-[0_0_6px_#5A5A40]' 
                        : phase === 'rest' 
                        ? 'bg-natural-terracotta shadow-[0_0_6px_#D98C72]' 
                        : phase === 'done' 
                        ? 'bg-natural-dark animate-pulse' 
                        : 'bg-[#70706B]'
                    }`} />
                    <span className="text-sm font-bold tracking-tight text-natural-dark">
                      {getPhaseName()}
                    </span>
                  </div>

                  <div className="text-xs text-[#70706B] font-semibold">
                    Set Completed:{' '}
                    <span className="font-bold text-natural-moss font-mono text-sm">
                      {cycles}
                    </span>
                    {settings.targetCycles > 0 && (
                      <span className="text-[#8B8B80]"> / {settings.targetCycles}</span>
                    )}
                  </div>
                </div>

                {/* Oscilloscope Container */}
                <div className="relative w-full">
                  <Waveform phase={phase} />

                  {/* Superimposed Huge Counter */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <h2 className="text-8xl font-black font-display text-natural-dark tracking-tighter drop-shadow-sm select-none opacity-95">
                      {phase === 'done' ? (
                        <Check className="w-20 h-20 text-natural-moss animate-[scaleIn_0.35s_ease-out]" />
                      ) : (
                        remainingSec
                      )}
                    </h2>
                  </div>
                </div>

                {/* Scope Frame Line Progress Bar */}
                <div className="w-full h-1.5 bg-natural-border rounded-full overflow-hidden shadow-inner">
                  <div
                    style={{ width: `${progressPercent}%` }}
                    className={`h-full transition-all duration-75 ease-linear ${
                      phase === 'active' 
                        ? 'bg-natural-moss' 
                        : phase === 'rest' 
                        ? 'bg-natural-terracotta' 
                        : 'bg-natural-dark'
                    }`}
                  />
                </div>

                {/* Big Core Interactive Control Pads */}
                <div className="flex gap-4">
                  <motion.button
                    id="btn-play-pause"
                    onClick={handlePlayPause}
                    whileTap={{ scale: 0.96 }}
                    className={`flex-1 h-16 rounded-xl flex items-center justify-center gap-2.5 font-bold tracking-wider text-sm transition duration-150 uppercase cursor-pointer shadow-sm ${
                      running 
                        ? 'bg-natural-terracotta/10 hover:bg-natural-terracotta/15 text-natural-terracotta border border-natural-terracotta/35' 
                        : 'bg-natural-moss hover:bg-[#4E4E36] text-white'
                    }`}
                  >
                    {running ? (
                      <>
                        <Pause className="w-5 h-5 fill-current" />
                        Pause Workout
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 fill-current" />
                        {phase === 'idle' ? 'Start Exercise' : 'Resume Burst'}
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    id="btn-trigger-reset"
                    onClick={handleReset}
                    whileTap={{ scale: 0.94 }}
                    className="w-16 h-16 rounded-xl bg-natural-bg hover:bg-natural-border border border-natural-border flex items-center justify-center text-natural-moss transition duration-150 cursor-pointer shadow-sm"
                    aria-label="Reset Timer"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Manual completion save indicator if they paused inside a workout */}
                {cycles > 0 && !running && phase !== 'done' && (
                  <motion.button
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      logWorkoutSession(cycles);
                      handleReset();
                    }}
                    className="w-full py-3 bg-natural-moss/10 border border-natural-moss/20 hover:bg-natural-moss/15 text-natural-moss rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Log Current {cycles} Cycles and Reset
                  </motion.button>
                )}

                {/* Mini Meta Info Indicators list */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-natural-bg/70 rounded-xl border border-natural-border shadow-sm flex flex-col items-center">
                    <span className="text-[10px] text-[#70706B] uppercase font-bold tracking-wider">
                      Active
                    </span>
                    <span className="text-xs font-bold text-natural-dark mt-1 font-mono">
                      {settings.activeDur}s
                    </span>
                  </div>
                  <div className="p-3 bg-natural-bg/70 rounded-xl border border-natural-border shadow-sm flex flex-col items-center">
                    <span className="text-[10px] text-[#70706B] uppercase font-bold tracking-wider">
                      Rest
                    </span>
                    <span className="text-xs font-bold text-natural-dark mt-1 font-mono">
                      {settings.restDur}s
                    </span>
                  </div>
                  <div className="p-3 bg-natural-bg/70 rounded-xl border border-natural-border shadow-sm flex flex-col items-center">
                    <span className="text-[10px] text-[#70706B] uppercase font-bold tracking-wider">
                      Bleep Mode
                    </span>
                    <span className="text-xs font-bold text-natural-dark mt-1 uppercase text-ellipsis overflow-hidden max-w-full font-mono">
                      {settings.sound === 'continuous' ? 'Hum' : settings.sound}
                    </span>
                  </div>
                </div>

                {/* PWA Direct Installation module */}
                <InstallPrompt />
              </motion.div>
            )}

            {currentView === 'schedule' && (
              <motion.div
                key="schedule-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="max-h-[72vh] overflow-y-auto px-1 scroll-smooth"
              >
                <PhysioSchedule
                  exercises={exercises}
                  activeExerciseId={activeExerciseId}
                  onAddExercise={handleAddExercise}
                  onRemoveExercise={handleRemoveExercise}
                  onSelectExercise={handleSelectExercise}
                />
              </motion.div>
            )}

            {currentView === 'analytics' && (
              <motion.div
                key="analytics-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="max-h-[72vh] overflow-y-auto px-1 scroll-smooth"
              >
                <AnalyticsPanel
                  logs={logs}
                  onClearLogs={() => setLogs([])}
                />
              </motion.div>
            )}

            {currentView === 'settings' && (
              <motion.div
                key="settings-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="max-h-[72vh] overflow-y-auto px-1 scroll-smooth"
              >
                <SettingsPanel
                  settings={settings}
                  onChange={handleSettingsChange}
                  onClose={() => setCurrentView('timer')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer/Aesthetic row (Humble, clean, avoiding slop terminal text) */}
        <footer className="pt-3 border-t border-natural-border flex justify-between text-[11px] text-[#757570] font-sans">
          <div className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-natural-moss/70" />
            <span>EMS Pulse Sync Active</span>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <Heart className="w-3.5 h-3.5 text-natural-terracotta/75" />
            <span>Healthy Exercise Timer</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
