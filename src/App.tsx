import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Clock, Dumbbell, TrendingUp, Settings as SettingsIcon, Check, Heart, PlusCircle, CheckCircle2, CalendarCheck, SkipForward, X, Hourglass, Square } from 'lucide-react';
import { WorkoutSettings, WorkoutPhase, PhysioExercise, WorkoutLogEntry, ExerciseMode } from './types';
import { audio } from './lib/audio';
import { App as CapacitorApp } from '@capacitor/app';
import SettingsPanel from './components/SettingsPanel';
import Waveform from './components/Waveform';
import PhysioSchedule from './components/PhysioSchedule';
import AnalyticsPanel from './components/AnalyticsPanel';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULTS: WorkoutSettings = {
  activeDur: 15,
  restDur: 15,
  targetCycles: 0, // 0 = unlimited
  interExerciseRest: 30,
  sound: 'beep',
  soundTheme: 'digital',
  continuousSound: 'drum-loop',
  volume: 60,
  vibrate: false,
  wakelock: true,
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const INITIAL_EXERCISES: PhysioExercise[] = [
  {
    id: 'ex-1',
    name: 'EMS Core Iso-Hold',
    category: 'ems',
    mode: 'time',
    activeDur: 10,
    restDur: 10,
    targetCycles: 15,
    weekdays: ['Mon', 'Wed', 'Fri'],
    weeklyTarget: 3,
    notes: 'Focus on drawing belly button inward during stimulation'
  },
  {
    id: 'ex-2',
    name: 'Push-Ups',
    category: 'strength',
    mode: 'reps',
    activeDur: 0,
    restDur: 30,
    targetCycles: 4,
    repsPerSet: 12,
    weekdays: ['Mon', 'Wed', 'Fri'],
    weeklyTarget: 3,
    notes: 'Keep core tight, full range of motion'
  },
  {
    id: 'ex-3',
    name: 'Hip Mobility Flow',
    category: 'mobility',
    mode: 'time',
    activeDur: 30,
    restDur: 15,
    targetCycles: 3,
    weekdays: ['Tue', 'Thu', 'Sun'],
    weeklyTarget: 3,
    notes: 'Slow controlled circles, both directions'
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

  // Queue = ordered list of exercise IDs to run as a superset. Single-item queue = legacy single-exercise mode.
  const [queue, setQueue] = useState<string[]>(() => {
    try {
      const savedQueue = localStorage.getItem('pulse-queue');
      if (savedQueue) return JSON.parse(savedQueue);
      // Migrate from legacy single-active-exercise key
      const legacy = localStorage.getItem('pulse-active-ex');
      if (legacy) return [legacy];
    } catch (e) {}
    return [];
  });
  const [queueIndex, setQueueIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pulse-queue-index');
      if (saved) return Math.max(0, parseInt(saved) || 0);
    } catch (e) {}
    return 0;
  });

  const activeExerciseId = queue[queueIndex] ?? null;

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

  // Hold-mode: per-set elapsed seconds recorded when the user taps Stop
  const holdSecondsRef = useRef<number[]>([]);

  // Derived current exercise & mode
  const currentExercise = activeExerciseId
    ? exercises.find(e => e.id === activeExerciseId)
    : undefined;
  const currentMode: ExerciseMode = currentExercise?.mode ?? 'time';
  const currentReps = currentExercise?.repsPerSet;

  // Save states helper
  useEffect(() => {
    try {
      localStorage.setItem('pulse-exercises', JSON.stringify(exercises));
    } catch (e) {}
  }, [exercises]);

  useEffect(() => {
    try {
      localStorage.setItem('pulse-queue', JSON.stringify(queue));
      localStorage.setItem('pulse-queue-index', String(queueIndex));
      localStorage.removeItem('pulse-active-ex');
    } catch (e) {}
  }, [queue, queueIndex]);

  useEffect(() => {
    try {
      localStorage.setItem('pulse-logs', JSON.stringify(logs));
    } catch (e) {}
  }, [logs]);

  // --------- Volume and Theme update ---------
  useEffect(() => {
    audio.setVolume(settings.volume);
    audio.setTheme(settings.soundTheme || 'digital');
    audio.setContinuousSound(settings.continuousSound || 'drum-loop');
  }, [settings.volume, settings.soundTheme, settings.continuousSound]);

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

  // Android hardware back button: route to timer view first, only exit from timer.
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (currentView !== 'timer') {
        setCurrentView('timer');
      } else if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    }).then(h => { handle = h; }).catch(() => {});
    return () => { handle?.remove(); };
  }, [currentView]);

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
    const exerciseObj = activeExerciseId ? exercises.find(e => e.id === activeExerciseId) : undefined;
    const mode = exerciseObj?.mode ?? 'time';
    const category = exerciseObj?.category;
    const exerciseId = exerciseObj?.id;
    const bestHoldSeconds = mode === 'hold' && holdSecondsRef.current.length > 0
      ? Math.max(...holdSecondsRef.current)
      : undefined;
    const exerciseName = exerciseObj?.name ?? 'Quick Workout';
    const totalActiveSeconds = mode === 'hold'
      ? holdSecondsRef.current.reduce((a, b) => a + b, 0)
      : cyclesVal * settings.activeDur;
    // Reset hold tracker for the next exercise / next workout
    holdSecondsRef.current = [];
    const newEntry: WorkoutLogEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      exerciseName,
      exerciseId,
      mode,
      category,
      cyclesCompleted: cyclesVal,
      totalActiveSeconds,
      bestHoldSeconds,
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
      // Prefer the loaded exercise's own params over the global settings.
      const activeDuration = currentExercise?.activeDur ?? settings.activeDur;
      const restDuration = currentExercise?.restDur ?? settings.restDur;
      const targetCyc = currentExercise?.targetCycles ?? settings.targetCycles;
      const interRest = settings.interExerciseRest;

      const now = performance.now() / 1000;
      const elapsed = (now - phaseStartRef.current) + phaseElapsedBeforePauseRef.current;
      const isRepActive = phase === 'active' && currentMode === 'reps';
      const isHoldActive = phase === 'active' && currentMode === 'hold';
      const currentLimit =
        phase === 'active' ? activeDuration :
        phase === 'rest' ? restDuration :
        phase === 'transition' ? interRest : 0;

      if (isHoldActive) {
        // Stopwatch counts UP in hold mode
        setRemainingSec(Math.floor(elapsed));
        setProgressPercent(0);
      } else if (!isRepActive) {
        const remaining = Math.max(0, currentLimit - elapsed);
        setRemainingSec(Math.ceil(remaining));
        setProgressPercent(currentLimit > 0 ? Math.min(elapsed / currentLimit, 1) * 100 : 100);
      }

      // Acoustic live ticks checker
      if (!isRepActive) {
        const remaining = Math.max(0, currentLimit - elapsed);
        const remainingCeil = Math.ceil(remaining);
        if (settings.sound === 'countdown' || settings.sound === 'continuous') {
          if (remainingCeil <= 3 && remainingCeil > 0 && remainingCeil !== lastCountdownTickRef.current) {
            lastCountdownTickRef.current = remainingCeil;
            audio.playThemedTick();
          }
        } else if (settings.sound === 'metronome') {
          if (phase === 'active') {
            const wholeSec = Math.floor(elapsed);
            if (wholeSec !== metronomeLastSecRef.current && wholeSec > 0) {
              metronomeLastSecRef.current = wholeSec;
              audio.playThemedTick();
            }
          }
        }
      } else if (settings.sound === 'metronome') {
        // Rep/hold mode metronome: keep ticking to pace
        const wholeSec = Math.floor(elapsed);
        if (wholeSec !== metronomeLastSecRef.current && wholeSec > 0) {
          metronomeLastSecRef.current = wholeSec;
          audio.playThemedTick();
        }
      }

      // In rep and hold modes, the active phase never auto-ends — only the rest phase does.
      if (!isRepActive && !isHoldActive && elapsed >= currentLimit) {
        if (phase === 'active') {
          // Active → Rest
          setPhase('rest');
          lastCountdownTickRef.current = -1;
          metronomeLastSecRef.current = -1;
          audio.playPhaseStart('rest', settings.sound);
          triggerVibe([60, 40, 60]);
          phaseStartRef.current = performance.now() / 1000;
          phaseElapsedBeforePauseRef.current = 0;
        } else if (phase === 'rest') {
          // Rest done → cycle complete
          const newCyclesCount = cycles + 1;
          setCycles(newCyclesCount);

          if (targetCyc > 0 && newCyclesCount >= targetCyc) {
            // This exercise is done. Log it.
            logWorkoutSession(newCyclesCount);

            const hasNext = queueIndex < queue.length - 1;
            if (hasNext) {
              // Switch to inter-exercise transition
              setPhase('transition');
              lastCountdownTickRef.current = -1;
              metronomeLastSecRef.current = -1;
              audio.playPhaseStart('rest', settings.sound);
              triggerVibe([60, 40, 60]);
              phaseStartRef.current = performance.now() / 1000;
              phaseElapsedBeforePauseRef.current = 0;
              return;
            }

            // No more exercises — workout fully complete
            setRunning(false);
            setPhase('done');
            audio.playWorkoutComplete();
            triggerVibe([100, 60, 100, 60, 200]);
            setProgressPercent(100);
            releaseWakeLockState();
            return;
          }

          // Same exercise, next cycle
          setPhase('active');
          lastCountdownTickRef.current = -1;
          metronomeLastSecRef.current = -1;
          audio.playPhaseStart('active', settings.sound);
          triggerVibe([60, 40, 60]);
          phaseStartRef.current = performance.now() / 1000;
          phaseElapsedBeforePauseRef.current = 0;
        } else if (phase === 'transition') {
          // Inter-exercise rest done → advance to next exercise
          const nextIndex = queueIndex + 1;
          const nextEx = exercises.find(e => e.id === queue[nextIndex]);
          setQueueIndex(nextIndex);
          if (nextEx) loadExerciseIntoSettings(nextEx);
          setCycles(0);
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
  }, [running, phase, settings.activeDur, settings.restDur, settings.sound, settings.targetCycles, settings.interExerciseRest, cycles, currentMode, activeExerciseId, queueIndex, queue, exercises]);

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
        // Fresh start — if there's a multi-exercise queue, restart from the first one
        if (queue.length > 0) {
          setQueueIndex(0);
          const firstEx = exercises.find(e => e.id === queue[0]);
          if (firstEx) loadExerciseIntoSettings(firstEx);
        }
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

  // Skip the inter-exercise rest and jump straight to the next exercise.
  const handleSkipTransition = () => {
    if (!running || phase !== 'transition') return;
    const nextIndex = queueIndex + 1;
    const nextEx = exercises.find(e => e.id === queue[nextIndex]);
    setQueueIndex(nextIndex);
    if (nextEx) loadExerciseIntoSettings(nextEx);
    setCycles(0);
    setPhase('active');
    lastCountdownTickRef.current = -1;
    metronomeLastSecRef.current = -1;
    audio.playPhaseStart('active', settings.sound);
    triggerVibe([60, 40, 60]);
    phaseStartRef.current = performance.now() / 1000;
    phaseElapsedBeforePauseRef.current = 0;
  };

  // Rep/Hold-mode: user taps to end the active set; mirrors the auto-transition in the tick.
  const handleCompleteSet = () => {
    if (!running || phase !== 'active' || (currentMode !== 'reps' && currentMode !== 'hold')) return;
    if (currentMode === 'hold') {
      const now = performance.now() / 1000;
      const elapsed = (now - phaseStartRef.current) + phaseElapsedBeforePauseRef.current;
      holdSecondsRef.current.push(Math.max(0, Math.round(elapsed)));
    }
    setPhase('rest');
    lastCountdownTickRef.current = -1;
    metronomeLastSecRef.current = -1;
    audio.playPhaseStart('rest', settings.sound);
    triggerVibe([60, 40, 60]);
    phaseStartRef.current = performance.now() / 1000;
    phaseElapsedBeforePauseRef.current = 0;
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
    holdSecondsRef.current = [];
    // Reset queue position too so a fresh Start replays from the first exercise
    if (queue.length > 0) setQueueIndex(0);
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
    if (phase === 'transition') return 'Up Next';
    if (phase === 'done') return 'Completed';
    return 'Ready';
  };

  const upNextExercise = phase === 'transition'
    ? exercises.find(e => e.id === queue[queueIndex + 1])
    : undefined;

  // Handlers for exercises schedule
  const handleAddExercise = (newEx: Omit<PhysioExercise, 'id'>) => {
    const ex: PhysioExercise = {
      ...newEx,
      id: `ex-${Date.now()}`
    };
    setExercises(prev => [...prev, ex]);
  };

  const handleUpdateExercise = (id: string, updated: Omit<PhysioExercise, 'id'>) => {
    setExercises(prev => prev.map(e => (e.id === id ? { ...updated, id } : e)));
    if (activeExerciseId === id) {
      handleSettingsChange({
        ...settings,
        activeDur: updated.activeDur,
        restDur: updated.restDur,
        targetCycles: updated.targetCycles,
      });
    }
  };

  const handleImportExercises = (imported: Omit<PhysioExercise, 'id'>[], mode: 'append' | 'replace') => {
    const withIds: PhysioExercise[] = imported.map((ex, i) => ({
      ...ex,
      id: `ex-${Date.now()}-${i}`,
    }));
    if (mode === 'replace') {
      setExercises(withIds);
      setQueue([]);
      setQueueIndex(0);
    } else {
      setExercises(prev => [...prev, ...withIds]);
    }
  };

  const handleReorderExercise = (id: string, direction: 'up' | 'down') => {
    setExercises(prev => {
      const idx = prev.findIndex(e => e.id === id);
      const swapWith = direction === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  };

  const handleRemoveExercise = (id: string) => {
    setExercises(prev => prev.filter(e => e.id !== id));
    setQueue(prev => {
      const filtered = prev.filter(qid => qid !== id);
      if (filtered.length !== prev.length) {
        setQueueIndex(0);
      }
      return filtered;
    });
  };

  const loadExerciseIntoSettings = (ex: PhysioExercise) => {
    handleSettingsChange({
      ...settings,
      activeDur: ex.activeDur,
      restDur: ex.restDur,
      targetCycles: ex.targetCycles,
    });
  };

  const handleSelectExercise = (ex: PhysioExercise) => {
    setQueue([ex.id]);
    setQueueIndex(0);
    loadExerciseIntoSettings(ex);
    handleReset();
    setCurrentView('timer');
  };

  // Today's auto-loaded program (based on device timezone weekday)
  const todayShort = WEEKDAY_SHORT[new Date().getDay()];
  const todaysExercises = exercises.filter(e => e.weekdays?.includes(todayShort));

  const handleStartTodaysProgram = () => {
    if (todaysExercises.length === 0) return;
    const ids = todaysExercises.map(e => e.id);
    setQueue(ids);
    setQueueIndex(0);
    loadExerciseIntoSettings(todaysExercises[0]);
    handleReset();
    setCurrentView('timer');
  };

  const handleClearQueue = () => {
    setQueue([]);
    setQueueIndex(0);
    handleReset();
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
                PULSE • TIMER
              </h1>
            </div>
            {activeExerciseId && (
              <span className="text-[10px] font-bold tracking-tight text-white bg-natural-moss px-2 py-0.5 rounded-full uppercase">
                Routine Loaded
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
                {/* Today's Program / Queue panel */}
                {queue.length === 0 ? (
                  todaysExercises.length > 0 ? (
                    <div className="p-4 bg-natural-moss/5 border border-natural-moss/25 rounded-xl flex flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-natural-moss" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-natural-moss">
                          {todayShort}'s Program — {todaysExercises.length} exercise{todaysExercises.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {todaysExercises.map((ex, i) => (
                          <div key={ex.id} className="flex items-center gap-2 text-[11px]">
                            <span className="w-4 h-4 rounded-full bg-natural-moss text-white font-bold text-[9px] flex items-center justify-center flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="font-semibold text-natural-dark truncate">{ex.name}</span>
                            <span className="font-mono text-[10px] text-[#757570] ml-auto whitespace-nowrap">
                              {(ex.mode ?? 'time') === 'reps' ? `${ex.repsPerSet ?? '?'} reps` : `${ex.activeDur}s`} × {ex.targetCycles}
                            </span>
                          </div>
                        ))}
                      </div>
                      <motion.button
                        onClick={handleStartTodaysProgram}
                        whileTap={{ scale: 0.97 }}
                        className="mt-1 w-full py-2.5 bg-natural-moss hover:bg-[#4E4E36] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Load Today's Program
                      </motion.button>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-natural-bg/70 border border-dashed border-natural-border rounded-xl text-center">
                      <p className="text-[11px] text-[#70706B]">
                        No exercises scheduled for {todayShort}. Pick one from the <strong className="text-natural-moss">Program</strong> tab.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="p-3.5 bg-natural-moss/5 border border-natural-moss/25 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Dumbbell className="w-4 h-4 text-natural-moss flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-natural-moss/80">
                            {queue.length > 1 ? `Now — ${queueIndex + 1} / ${queue.length}` : 'Loaded'}
                          </span>
                          <span className="text-sm font-bold text-natural-dark truncate">
                            {currentExercise?.name ?? 'Exercise'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleClearQueue}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-[#70706B] hover:text-natural-terracotta hover:bg-natural-terracotta/10 font-bold uppercase tracking-wider transition cursor-pointer flex-shrink-0"
                        aria-label="Unload routine"
                      >
                        <X className="w-3 h-3" />
                        {queue.length > 1 ? 'Clear' : 'Unload'}
                      </button>
                    </div>
                    {queue.length > 1 && (
                      <div className="flex gap-1 overflow-x-auto">
                        {queue.map((qid, i) => {
                          const ex = exercises.find(e => e.id === qid);
                          if (!ex) return null;
                          const done = i < queueIndex || phase === 'done';
                          const current = i === queueIndex && phase !== 'done';
                          return (
                            <div
                              key={qid}
                              className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                current
                                  ? 'bg-natural-moss text-white border-natural-moss'
                                  : done
                                    ? 'bg-natural-moss/10 text-natural-moss border-natural-moss/30 line-through'
                                    : 'bg-white text-[#70706B] border-natural-border'
                              }`}
                            >
                              {i + 1}. {ex.name}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Meta Summary Row */}
                <div className="flex justify-between items-center bg-natural-bg/70 p-3.5 rounded-xl border border-natural-border shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      phase === 'active'
                        ? 'bg-natural-moss shadow-[0_0_6px_#5A5A40]'
                        : phase === 'rest'
                        ? 'bg-natural-terracotta shadow-[0_0_6px_#D98C72]'
                        : phase === 'transition'
                        ? 'bg-natural-terracotta animate-pulse shadow-[0_0_6px_#D98C72]'
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                    {phase === 'done' ? (
                      <Check className="w-20 h-20 text-natural-moss animate-[scaleIn_0.35s_ease-out]" />
                    ) : phase === 'transition' ? (
                      <>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-natural-terracotta">
                          Up Next
                        </span>
                        <span className="text-sm font-bold text-natural-dark mt-0.5 max-w-[80%] text-center truncate px-2">
                          {upNextExercise?.name ?? '—'}
                        </span>
                        <h2 className="text-6xl font-black font-display text-natural-dark tracking-tighter drop-shadow-sm opacity-95 mt-1">
                          {remainingSec}
                        </h2>
                      </>
                    ) : (phase === 'idle' || phase === 'active') && currentMode === 'reps' ? (
                      <>
                        <h2 className="text-7xl font-black font-display text-natural-dark tracking-tighter drop-shadow-sm opacity-95">
                          {currentReps ?? '—'}
                        </h2>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-natural-terracotta mt-1">
                          {phase === 'idle' ? 'reps per set' : 'reps to do'}
                        </span>
                      </>
                    ) : phase === 'active' && currentMode === 'hold' ? (
                      <>
                        <h2 className="text-7xl font-black font-display text-natural-dark tracking-tighter drop-shadow-sm opacity-95 font-mono">
                          {String(Math.floor(remainingSec / 60)).padStart(2, '0')}:{String(remainingSec % 60).padStart(2, '0')}
                        </h2>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 mt-1">
                          hold time
                        </span>
                      </>
                    ) : phase === 'idle' && currentMode === 'hold' ? (
                      <>
                        <Hourglass className="w-16 h-16 text-amber-600 opacity-80" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 mt-2">
                          hold as long as you can
                        </span>
                      </>
                    ) : (
                      <h2 className="text-8xl font-black font-display text-natural-dark tracking-tighter drop-shadow-sm opacity-95">
                        {remainingSec}
                      </h2>
                    )}
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

                {/* Skip transition button */}
                {running && phase === 'transition' && (
                  <motion.button
                    onClick={handleSkipTransition}
                    whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full h-14 rounded-xl bg-natural-terracotta hover:bg-[#C27A62] text-white font-bold tracking-wider text-sm uppercase flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <SkipForward className="w-5 h-5" />
                    Skip Rest — Start Next
                  </motion.button>
                )}

                {/* Done Set / Stop Hold button (rep & hold modes) */}
                {running && phase === 'active' && (currentMode === 'reps' || currentMode === 'hold') && (
                  <motion.button
                    id="btn-done-set"
                    onClick={handleCompleteSet}
                    whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full h-14 rounded-xl bg-natural-terracotta hover:bg-[#C27A62] text-white font-bold tracking-wider text-sm uppercase flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    {currentMode === 'hold' ? <Square className="w-5 h-5 fill-current" /> : <CheckCircle2 className="w-5 h-5" />}
                    {currentMode === 'hold' ? 'Stop Hold — Start Rest' : 'Done Set — Start Rest'}
                  </motion.button>
                )}

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
                      {currentMode === 'reps' ? 'Reps' : currentMode === 'hold' ? 'Hold' : 'Active'}
                    </span>
                    <span className="text-xs font-bold text-natural-dark mt-1 font-mono">
                      {currentMode === 'reps' ? (currentReps ?? '—')
                        : currentMode === 'hold' ? 'AMAP'
                        : `${settings.activeDur}s`}
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
                  onUpdateExercise={handleUpdateExercise}
                  onRemoveExercise={handleRemoveExercise}
                  onImportExercises={handleImportExercises}
                  onReorderExercise={handleReorderExercise}
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
                  exercises={exercises}
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
          <div className="flex items-center gap-1 font-mono">
            <Heart className="w-3.5 h-3.5 text-natural-terracotta/75" />
            <span>Healthy Exercise Timer</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
