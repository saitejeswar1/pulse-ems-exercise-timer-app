import { WorkoutSettings, SoundMode, ContinuousSound } from '../types';
import { audio } from '../lib/audio';
import { 
  Volume2, 
  Clock, 
  Repeat, 
  VolumeX, 
  Music, 
  Zap, 
  BellRing, 
  Activity, 
  Eye, 
  Smartphone,
} from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsPanelProps {
  settings: WorkoutSettings;
  onChange: (settings: WorkoutSettings) => void;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  
  const handleTimingChange = (key: keyof WorkoutSettings, val: number | boolean | string) => {
    const updated = { ...settings, [key]: val };
    onChange(updated);
  };

  const handleSoundModeChange = (mode: SoundMode) => {
    const updated = { ...settings, sound: mode };
    onChange(updated);
    // Instant premium audio feedback when changing modes
    audio.setVolume(settings.volume);
    audio.testSound(mode);
  };

  const handleContinuousSoundChange = (cs: ContinuousSound) => {
    onChange({ ...settings, continuousSound: cs });
    audio.setVolume(settings.volume);
    audio.setContinuousSound(cs);
    audio.testSound('continuous');
  };

  const continuousSoundOptions: { value: ContinuousSound; label: string }[] = [
    { value: 'drum-loop', label: 'Drum Loop — driving 120 BPM beat' },
    { value: 'ambient-pad', label: 'Ambient Pad — warm sustained drone' },
    { value: 'heartbeat', label: 'Heartbeat — rhythmic 60 BPM thumps' },
  ];

  const handleTestSound = () => {
    audio.setVolume(settings.volume);
    audio.testSound(settings.sound);
    if (settings.vibrate && navigator.vibrate) {
      navigator.vibrate([60, 40, 60]);
    }
  };

  const soundModesList: { value: SoundMode; title: string; desc: string; icon: any }[] = [
    { 
      value: 'off', 
      title: 'Silent Mode', 
      desc: 'No acoustic triggers or audio alarms during training',
      icon: VolumeX
    },
    { 
      value: 'beep', 
      title: 'Beep on Switch', 
      desc: 'High beep starts active burst; low beep starts recovery',
      icon: BellRing
    },
    { 
      value: 'countdown', 
      title: 'Countdown Beeps', 
      desc: 'Bleeping ticks for the final 3s, then transition chime',
      icon: Clock
    },
    { 
      value: 'metronome', 
      title: 'Active Metronome', 
      desc: 'Steady 1Hz reference ticks only during exercise bursts',
      icon: Activity
    },
    { 
      value: 'continuous', 
      title: 'Continuous Hum', 
      desc: 'Deep 220Hz EMS continuous muscle simulation pulse hum',
      icon: Zap
    }
  ];

  return (
    <div className="w-full flex flex-col gap-6 text-natural-dark">
      
      {/* 1. Timing Configuration Frame */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border flex flex-col gap-5 shadow-sm">
        <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
          <Clock className="w-4 h-4 text-natural-moss" />
          Timing Constraints
        </h3>

        {/* Active interval */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-natural-dark font-medium">Active Burst Duration</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold font-mono text-natural-moss bg-natural-moss/10 rounded-full border border-natural-moss/20">
              {settings.activeDur}s
            </span>
          </div>
          <input 
            type="range" 
            min="5" 
            max="120" 
            step="1" 
            value={settings.activeDur}
            onChange={(e) => handleTimingChange('activeDur', parseInt(e.target.value))}
            className="w-full h-1.5 bg-natural-bg rounded-lg appearance-none cursor-pointer accent-natural-moss focus:outline-none"
          />
        </div>

        {/* Recovery interval */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-natural-dark font-medium">Recovery Rest Duration</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold font-mono text-natural-terracotta bg-natural-terracotta/10 rounded-full border border-natural-terracotta/20">
              {settings.restDur}s
            </span>
          </div>
          <input 
            type="range" 
            min="5" 
            max="120" 
            step="1" 
            value={settings.restDur}
            onChange={(e) => handleTimingChange('restDur', parseInt(e.target.value))}
            className="w-full h-1.5 bg-natural-bg rounded-lg appearance-none cursor-pointer accent-natural-terracotta focus:outline-none"
          />
        </div>

        {/* Target limit */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-natural-dark font-medium">Workout Set Limit (Cycles)</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold font-mono text-natural-moss bg-natural-moss/10 rounded-full border border-natural-moss/20">
              {settings.targetCycles === 0 ? '∞ (Infinite)' : `${settings.targetCycles} Cycles`}
            </span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="30" 
            step="1" 
            value={settings.targetCycles}
            onChange={(e) => handleTimingChange('targetCycles', parseInt(e.target.value))}
            className="w-full h-1.5 bg-natural-bg rounded-lg appearance-none cursor-pointer accent-natural-moss focus:outline-none"
          />
          <p className="text-[11px] text-[#70706B] leading-relaxed">
            0 means unlimited sets. Setting a target stops and sings a workout complete fanfare.
          </p>
        </div>
      </div>

      {/* 2. Acoustics & Volume Profiles */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border flex flex-col gap-4 shadow-sm">
        <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
          <Music className="w-4 h-4 text-natural-moss" />
          Acoustic Training Profile
        </h3>

        <div className="flex flex-col gap-3">
          {soundModesList.map((m) => {
            const isSelected = settings.sound === m.value;
            const IconComponent = m.icon;
            return (
              <button
                key={m.value}
                id={`sound-btn-${m.value}`}
                onClick={() => handleSoundModeChange(m.value)}
                className={`w-full flex text-left p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                  isSelected 
                    ? 'bg-natural-moss/10 border-natural-moss/40 text-natural-moss' 
                    : 'bg-natural-bg/60 hover:bg-natural-bg border-natural-border text-natural-dark'
                }`}
              >
                <div className="mr-3.5 flex items-center justify-center">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-natural-moss/15 text-natural-moss' : 'bg-white border border-natural-border text-natural-moss/60'}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-center animate-[scaleIn_0.15s_ease-out]">
                  <div className="text-sm font-semibold tracking-tight text-natural-dark">{m.title}</div>
                  <div className="text-xs text-[#757570] mt-0.5">{m.desc}</div>
                </div>
                <div className="flex items-center ml-2">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-natural-moss' : 'border-natural-border'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-natural-moss" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Continuous-sound picker, only when Continuous Hum is selected */}
        {settings.sound === 'continuous' && (
          <div className="flex flex-col gap-2 mt-1 border-t border-natural-border pt-4">
            <label htmlFor="continuous-sound-select" className="text-sm font-medium text-natural-dark">
              Continuous Sound
            </label>
            <select
              id="continuous-sound-select"
              value={settings.continuousSound || 'drum-loop'}
              onChange={(e) => handleContinuousSoundChange(e.target.value as ContinuousSound)}
              className="w-full px-3 py-2.5 bg-natural-bg border border-natural-border rounded-xl text-sm text-natural-dark focus:outline-none focus:border-natural-moss cursor-pointer"
            >
              {continuousSoundOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-[#70706B] leading-relaxed">
              Plays during the active phase. Three warning beeps fire in the last 3 seconds of both active and rest.
            </p>
          </div>
        )}

        {/* Volume setting */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-natural-dark font-medium">Acoustic Signal Volume</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold font-mono text-natural-moss bg-natural-moss/10 rounded-full">
              {settings.volume}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Volume2 className="w-4.5 h-4.5 text-natural-moss/70" />
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="5" 
              value={settings.volume}
              onChange={(e) => handleTimingChange('volume', parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-natural-bg rounded-lg appearance-none cursor-pointer accent-natural-moss focus:outline-none"
            />
          </div>
        </div>

        <button
          id="btn-test-acoustic"
          onClick={handleTestSound}
          className="mt-2 w-full py-3.5 bg-natural-moss hover:bg-[#4E4E36] text-white rounded-xl text-xs font-bold tracking-wider transition duration-150 uppercase cursor-pointer shadow-sm"
        >
          Verify Acoustics & Haptics
        </button>
      </div>

      {/* 3. Physical Devices (Android integrations: Vibrate, Wake Lock) */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border flex flex-col gap-4 shadow-sm">
        <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-natural-moss" />
          Android Device Sync
        </h3>

        {/* Tactile haptic toggle */}
        <div className="flex justify-between items-center p-3.5 bg-natural-bg rounded-xl border border-natural-border">
          <div className="flex-1">
            <div className="text-sm font-semibold text-natural-dark">Vibrate on Phase Transition</div>
            <div className="text-[11px] text-[#70706B] mt-0.5">Dual vibration bursts when moving between active & recovery</div>
          </div>
          <button
            id="vibrate-toggle"
            onClick={() => handleTimingChange('vibrate', !settings.vibrate)}
            className={`w-12 h-6 rounded-full relative transition-colors duration-200 focus:outline-none ${
              settings.vibrate ? 'bg-natural-moss' : 'bg-[#E5E5E0]'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform duration-200 shadow-sm ${
              settings.vibrate ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* Wake Lock Screen Awake toggle */}
        <div className="flex justify-between items-center p-3.5 bg-natural-bg rounded-xl border border-natural-border">
          <div className="flex-1">
            <div className="text-sm font-semibold text-natural-dark">Prevent Screen Sleep Lock</div>
            <div className="text-[11px] text-[#70706B] mt-0.5">Keeps Android screen dynamic during workouts to reference clocks</div>
          </div>
          <button
            id="wakelock-toggle"
            onClick={() => handleTimingChange('wakelock', !settings.wakelock)}
            className={`w-12 h-6 rounded-full relative transition-colors duration-200 focus:outline-none ${
              settings.wakelock ? 'bg-natural-moss' : 'bg-[#E5E5E0]'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform duration-200 shadow-sm ${
              settings.wakelock ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

    </div>
  );
}
