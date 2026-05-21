import { SoundMode } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private continuousOsc: OscillatorNode | null = null;
  private continuousGain: GainNode | null = null;
  private volume: number = 60; // default 60%

  private ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      this.ctx = new AudioContextClass();
    } catch (e) {
      console.error('Failed to create AudioContext:', e);
    }
    return this.ctx;
  }

  public setVolume(volume: number) {
    this.volume = volume;
    // Update live volume if continuous hum is currently playing
    if (this.continuousGain && this.ctx) {
      const peak = 0.18 * (this.volume / 100);
      this.continuousGain.gain.setValueAtTime(peak, this.ctx.currentTime);
    }
  }

  private getMasterGainMultiplier(): number {
    return this.volume / 100;
  }

  public beep(freq: number, duration: number, type: OscillatorType = 'sine') {
    const context = this.ensureContext();
    if (!context) return;

    try {
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }

      const osc = context.createOscillator();
      const gainNode = context.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      const peakVolume = 0.4 * this.getMasterGainMultiplier();
      const now = context.currentTime;

      // Clean ramp to prevent clicking
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(peakVolume, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gainNode);
      gainNode.connect(context.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  public startContinuousTone() {
    const context = this.ensureContext();
    if (!context) return;

    this.stopContinuousTone();

    try {
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }

      const osc = context.createOscillator();
      const gainNode = context.createGain();

      osc.type = 'sine';
      osc.frequency.value = 220; // 220Hz pleasant deep low EMS stimulation hum

      const peakVolume = 0.18 * this.getMasterGainMultiplier();
      const now = context.currentTime;

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(peakVolume, now + 0.08);

      osc.connect(gainNode);
      gainNode.connect(context.destination);

      osc.start();

      this.continuousOsc = osc;
      this.continuousGain = gainNode;
    } catch (e) {
      console.error('Failed to start continuous tone:', e);
    }
  }

  public stopContinuousTone() {
    if (!this.continuousOsc || !this.ctx) return;

    const context = this.ctx;
    const now = context.currentTime;

    try {
      if (this.continuousGain) {
        this.continuousGain.gain.cancelScheduledValues(now);
        this.continuousGain.gain.setValueAtTime(this.continuousGain.gain.value, now);
        this.continuousGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      }
      this.continuousOsc.stop(now + 0.12);
    } catch (e) {
      // Ignored
    } finally {
      this.continuousOsc = null;
      this.continuousGain = null;
    }
  }

  public playPhaseStart(phase: 'active' | 'rest', mode: SoundMode) {
    if (mode === 'off') return;

    if (mode === 'beep') {
      if (phase === 'active') {
        this.beep(880, 0.18, 'sine');
      } else {
        this.beep(440, 0.18, 'sine');
      }
    } else if (mode === 'countdown') {
      if (phase === 'active') {
        this.beep(880, 0.25, 'sine');
      } else {
        this.beep(523, 0.25, 'sine');
      }
    } else if (mode === 'continuous') {
      if (phase === 'active') {
        this.startContinuousTone();
      } else {
        this.stopContinuousTone();
      }
    } else if (mode === 'metronome') {
      if (phase === 'active') {
        this.beep(880, 0.15, 'square');
      } else {
        this.beep(440, 0.15, 'square');
      }
    }
  }

  public playTick(remaining: number, elapsed: number, phase: 'active' | 'rest', mode: SoundMode) {
    if (mode === 'countdown') {
      // Beep in last 3 seconds of a cycle
      const ceiling = Math.ceil(remaining);
      if (ceiling <= 3 && ceiling > 0) {
        // Simple tick on transition
        this.beep(660, 0.08, 'sine');
      }
    } else if (mode === 'metronome') {
      // Play a steady tick every whole second of training (only active)
      if (phase === 'active' && elapsed > 0) {
        this.beep(1000, 0.04, 'square');
      }
    }
  }

  public testSound(mode: SoundMode) {
    this.ensureContext();
    if (mode === 'off') return;

    if (mode === 'beep') {
      this.beep(880, 0.18, 'sine');
    } else if (mode === 'countdown') {
      this.beep(660, 0.08, 'sine');
      setTimeout(() => this.beep(660, 0.08, 'sine'), 350);
      setTimeout(() => this.beep(660, 0.08, 'sine'), 700);
      setTimeout(() => this.beep(880, 0.25, 'sine'), 1050);
    } else if (mode === 'continuous') {
      this.startContinuousTone();
      setTimeout(() => this.stopContinuousTone(), 1200);
    } else if (mode === 'metronome') {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => this.beep(1000, 0.04, 'square'), i * 250);
      }
    }
  }

  public playWorkoutComplete() {
    this.ensureContext();
    this.beep(523, 0.15, 'sine'); // C5
    setTimeout(() => this.beep(659, 0.15, 'sine'), 180); // E5
    setTimeout(() => this.beep(784, 0.3, 'sine'), 360); // G5
  }
}

export const audio = new AudioEngine();
