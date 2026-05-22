import { SoundMode, SoundTheme, ContinuousSound } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private theme: SoundTheme = 'digital';
  private continuousSound: ContinuousSound = 'drum-loop';
  private volume: number = 60; // default 60%

  // Continuous sound active nodes
  private continuousOsc1: OscillatorNode | null = null;
  private continuousOsc2: OscillatorNode | null = null;
  private continuousOsc3: OscillatorNode | null = null;
  private continuousLfo: OscillatorNode | null = null;
  private continuousLfoGain: GainNode | null = null;
  private continuousFilter: BiquadFilterNode | null = null;
  private continuousGain: GainNode | null = null;
  private continuousIntervalId: any = null;

  // Synth sequencer beat variables
  private synthIntervalId: any = null;
  private synthStep: number = 0;

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
    // Update live volume if continuous hum/drone is currently playing
    if (this.continuousGain && this.ctx) {
      const now = this.ctx.currentTime;
      let peakVolume = 0.15 * this.getMasterGainMultiplier();
      if (this.theme === 'zen') peakVolume = 0.22 * this.getMasterGainMultiplier();
      if (this.theme === 'arcade') peakVolume = 0.08 * this.getMasterGainMultiplier();
      
      try {
        this.continuousGain.gain.setValueAtTime(peakVolume, now);
      } catch (e) {}
    }
  }

  public setTheme(theme: SoundTheme) {
    this.theme = theme;
  }

  public setContinuousSound(sound: ContinuousSound) {
    const wasRunning = this.continuousGain !== null;
    this.continuousSound = sound;
    if (wasRunning) {
      this.stopContinuousTone();
      this.startContinuousTone();
    }
  }

  private getMasterGainMultiplier(): number {
    return this.volume / 100;
  }

  // ----------------------------------------------------
  // Dynamic Synthesizer Helper Methods
  // ----------------------------------------------------

  /**
   * Play a simple oscillator beep with smooth envelope
   */
  public beep(freq: number, duration: number, type: OscillatorType = 'sine') {
    const context = this.ensureContext();
    if (!context) return;

    try {
      const osc = context.createOscillator();
      const gainNode = context.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);

      const peakVolume = 0.35 * this.getMasterGainMultiplier();
      const now = context.currentTime;

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(peakVolume, now + 0.008);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gainNode);
      gainNode.connect(context.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (e) {
      console.warn('Beep error:', e);
    }
  }

  /**
   * Synthesize a frequency sweep / chirp sound
   */
  private playChirp(startFreq: number, endFreq: number, duration: number, type: OscillatorType = 'sine') {
    const context = this.ensureContext();
    if (!context) return;

    try {
      const osc = context.createOscillator();
      const gainNode = context.createGain();
      osc.type = type;

      const now = context.currentTime;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

      const peakVolume = 0.3 * this.getMasterGainMultiplier();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(peakVolume, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gainNode);
      gainNode.connect(context.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (e) {
      console.warn('Chirp error:', e);
    }
  }

  /**
   * Synthesize a white noise burst (rimshots, snare hits, sweeps)
   */
  private playNoiseBurst(duration: number, volume: number, highpassFreq: number = 800) {
    const context = this.ensureContext();
    if (!context) return;

    try {
      const bufferSize = context.sampleRate * duration;
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Fill random samples
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = context.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(highpassFreq, context.currentTime);

      const gainNode = context.createGain();
      const peak = volume * this.getMasterGainMultiplier();
      
      gainNode.gain.setValueAtTime(peak, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

      noiseNode.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(context.destination);

      noiseNode.start();
    } catch (e) {
      console.warn('Noise burst error:', e);
    }
  }

  /**
   * Synthesize harmonically rich singing bowl / chime sounds
   */
  private playSingingBowl(freqs: number[], duration: number, volume: number = 0.2) {
    const context = this.ensureContext();
    if (!context) return;

    try {
      const now = context.currentTime;
      freqs.forEach((freq, idx) => {
        const osc = context.createOscillator();
        const gainNode = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Fundamental is louder; upper harmonics are softer
        const noteVolume = volume * (idx === 0 ? 1 : 0.35) * this.getMasterGainMultiplier();
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(noteVolume, now + 0.08); // soft attack
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gainNode);
        gainNode.connect(context.destination);

        osc.start(now);
        osc.stop(now + duration + 0.1);
      });
    } catch (e) {
      console.warn('Singing bowl error:', e);
    }
  }

  /**
   * Synthesize a warm synthesizer chord with filter envelope
   */
  private playSynthChord(notes: number[], startTime: number, duration: number) {
    const context = this.ensureContext();
    if (!context) return;

    try {
      notes.forEach((freq) => {
        const osc = context.createOscillator();
        const gainNode = context.createGain();
        const filter = context.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, startTime);
        filter.frequency.exponentialRampToValueAtTime(1400, startTime + 0.06); // snappy filter env
        filter.frequency.exponentialRampToValueAtTime(450, startTime + duration);

        const peak = 0.06 * this.getMasterGainMultiplier();
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(peak, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(context.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
      });
    } catch (e) {}
  }

  // ----------------------------------------------------
  // Continuous Tones & Sequencers
  // ----------------------------------------------------

  public startContinuousTone() {
    const context = this.ensureContext();
    if (!context) return;

    this.stopContinuousTone();

    try {
      const now = context.currentTime;
      const masterGain = context.createGain();
      this.continuousGain = masterGain;
      masterGain.connect(context.destination);

      const vol = this.getMasterGainMultiplier();

      if (this.continuousSound === 'drum-loop') {
        // HIIT-style 120 bpm drum loop: four-on-the-floor kick + offbeat hi-hats.
        masterGain.gain.setValueAtTime(0.9 * vol, now);
        let step = 0;
        const stepMs = 250; // 120 BPM eighth-notes (8 steps per bar)
        const fire = () => {
          if (!this.ctx || !this.continuousGain) return;
          const t = this.ctx.currentTime + 0.02;
          // Kick on beats 0,4
          if (step === 0 || step === 4) {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.frequency.setValueAtTime(150, t);
            o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
            g.gain.setValueAtTime(0.6, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
            o.connect(g); g.connect(masterGain);
            o.start(t); o.stop(t + 0.22);
          }
          // Hi-hat on offbeats 2,6
          if (step === 2 || step === 6) {
            const bufSize = this.ctx.sampleRate * 0.05;
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const hp = this.ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.setValueAtTime(7000, t);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.25, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
            src.connect(hp); hp.connect(g); g.connect(masterGain);
            src.start(t); src.stop(t + 0.06);
          }
          // Snare-ish clap on 4
          if (step === 4) {
            const bufSize = this.ctx.sampleRate * 0.1;
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(1800, t);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.35, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
            src.connect(bp); bp.connect(g); g.connect(masterGain);
            src.start(t); src.stop(t + 0.13);
          }
          step = (step + 1) % 8;
        };
        fire();
        this.continuousIntervalId = setInterval(fire, stepMs);

      } else if (this.continuousSound === 'ambient-pad') {
        // Warm sustained pad: A2 + E3 + A3 sine chord, slow filter LFO breathing.
        const o1 = context.createOscillator();
        const o2 = context.createOscillator();
        const o3 = context.createOscillator();
        const filter = context.createBiquadFilter();
        const lfo = context.createOscillator();
        const lfoGain = context.createGain();

        o1.type = 'sine'; o1.frequency.setValueAtTime(110, now);
        o2.type = 'sine'; o2.frequency.setValueAtTime(164.81, now); // E3
        o3.type = 'triangle'; o3.frequency.setValueAtTime(220, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, now);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.2, now); // 5s breathing cycle
        lfoGain.gain.setValueAtTime(250, now); // sweep cutoff ±250Hz

        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(0.5 * vol, now + 0.3);

        o1.connect(filter); o2.connect(filter); o3.connect(filter);
        filter.connect(masterGain);
        lfo.connect(lfoGain); lfoGain.connect(filter.frequency);

        o1.start(); o2.start(); o3.start(); lfo.start();
        this.continuousOsc1 = o1;
        this.continuousOsc2 = o2;
        this.continuousOsc3 = o3;
        this.continuousLfo = lfo;
        this.continuousLfoGain = lfoGain;
        this.continuousFilter = filter;

      } else if (this.continuousSound === 'heartbeat') {
        // Lub-dub thumps at 60 bpm. Loud sine bass thumps audible on phone speakers.
        masterGain.gain.setValueAtTime(1.0 * vol, now);
        const thump = (when: number, strength: number, startHz: number) => {
          if (!this.ctx || !this.continuousGain) return;
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(startHz, when);
          o.frequency.exponentialRampToValueAtTime(28, when + 0.22);
          g.gain.setValueAtTime(0, when);
          g.gain.linearRampToValueAtTime(strength, when + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
          o.connect(g); g.connect(masterGain);
          o.start(when); o.stop(when + 0.3);
        };
        const fire = () => {
          if (!this.ctx) return;
          const t = this.ctx.currentTime + 0.02;
          thump(t, 0.9, 75);          // lub
          thump(t + 0.22, 0.65, 65);  // dub
        };
        fire();
        this.continuousIntervalId = setInterval(fire, 1000); // 60 bpm

      } else if (this.theme === 'digital') {
        // Crisp warm hum: 330Hz triangle wave + 660Hz sine octave harmonic
        const osc1 = context.createOscillator();
        const osc2 = context.createOscillator();

        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(330, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(660, now);

        const peakVolume = 0.15 * this.getMasterGainMultiplier();
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(peakVolume, now + 0.1);

        osc1.connect(masterGain);
        osc2.connect(masterGain);
        masterGain.connect(context.destination);

        osc1.start();
        osc2.start();

        this.continuousOsc1 = osc1;
        this.continuousOsc2 = osc2;

      } else if (this.theme === 'ems') {
        // Realistic EMS buzzer: 180Hz triangle + 360Hz sine modulated by 4Hz LFO ("wub-wub-wub")
        const osc1 = context.createOscillator();
        const osc2 = context.createOscillator();
        const lfo = context.createOscillator();
        const lfoGain = context.createGain();

        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(180, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(360, now);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(4, now); // 4Hz modulation speed

        const baseVolume = 0.15 * this.getMasterGainMultiplier();
        masterGain.gain.setValueAtTime(baseVolume, now);

        // LFO modulates the masterGain gain node directly
        lfoGain.gain.setValueAtTime(baseVolume * 0.7, now); // Depth of vibrato

        osc1.connect(masterGain);
        osc2.connect(masterGain);
        lfo.connect(lfoGain);
        lfoGain.connect(masterGain.gain); // direct modulation!
        masterGain.connect(context.destination);

        osc1.start();
        osc2.start();
        lfo.start();

        this.continuousOsc1 = osc1;
        this.continuousOsc2 = osc2;
        this.continuousLfo = lfo;
        this.continuousLfoGain = lfoGain;

      } else if (this.theme === 'synth') {
        // Launch dynamic 120 BPM synth beat sequencer!
        this.startSynthBeat();

      } else if (this.theme === 'zen') {
        // Meditation drone: 110Hz triangle (A2) + 165Hz sine (E3 fifth) + 220Hz sine (A3 octave)
        // Modulated by an LFO running at 0.15Hz sweeping a lowpass filter (breathing wash)
        const osc1 = context.createOscillator();
        const osc2 = context.createOscillator();
        const osc3 = context.createOscillator();
        const filter = context.createBiquadFilter();
        const lfo = context.createOscillator();
        const lfoGain = context.createGain();

        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(110, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(165, now);

        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(220, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.15, now); // Slow 0.15Hz breathing

        lfoGain.gain.setValueAtTime(160, now); // Sweeps cutoff filter +/- 160Hz

        const peakVolume = 0.22 * this.getMasterGainMultiplier();
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(peakVolume, now + 0.2);

        osc1.connect(filter);
        osc2.connect(filter);
        osc3.connect(filter);
        filter.connect(masterGain);
        
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency); // Modulates lowpass cutoff frequency!

        masterGain.connect(context.destination);

        osc1.start();
        osc2.start();
        osc3.start();
        lfo.start();

        this.continuousOsc1 = osc1;
        this.continuousOsc2 = osc2;
        this.continuousOsc3 = osc3;
        this.continuousLfo = lfo;
        this.continuousLfoGain = lfoGain;
        this.continuousFilter = filter;

      } else if (this.theme === 'arcade') {
        // Arcade 8-bit vibrato laser hum: 220Hz square wave with 8Hz vibrato LFO
        const osc = context.createOscillator();
        const lfo = context.createOscillator();
        const lfoGain = context.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(220, now);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(8, now); // 8Hz vibrato
        lfoGain.gain.setValueAtTime(12, now); // +/- 12Hz swing

        const peakVolume = 0.07 * this.getMasterGainMultiplier(); // square wave is loud
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(peakVolume, now + 0.08);

        osc.connect(masterGain);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency); // pitch modulation!

        masterGain.connect(context.destination);

        osc.start();
        lfo.start();

        this.continuousOsc1 = osc;
        this.continuousLfo = lfo;
        this.continuousLfoGain = lfoGain;
      }

    } catch (e) {
      console.error('Failed to start continuous tone:', e);
    }
  }

  public stopContinuousTone() {
    this.stopSynthBeat();

    if (this.continuousIntervalId) {
      clearInterval(this.continuousIntervalId);
      this.continuousIntervalId = null;
    }

    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    try {
      // Fade out master gain smoothly to prevent pops
      if (this.continuousGain) {
        this.continuousGain.gain.cancelScheduledValues(now);
        this.continuousGain.gain.setValueAtTime(this.continuousGain.gain.value, now);
        this.continuousGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      }

      // Stop and clean up all oscillators
      const oscs = [this.continuousOsc1, this.continuousOsc2, this.continuousOsc3, this.continuousLfo];
      oscs.forEach((osc) => {
        if (osc) {
          try {
            osc.stop(now + 0.15);
          } catch (err) {}
        }
      });
    } catch (e) {
      // Ignored
    } finally {
      this.continuousOsc1 = null;
      this.continuousOsc2 = null;
      this.continuousOsc3 = null;
      this.continuousLfo = null;
      this.continuousLfoGain = null;
      this.continuousFilter = null;
      this.continuousGain = null;
    }
  }

  // ----------------------------------------------------
  // Synth Sequencer Beat Engine
  // ----------------------------------------------------

  private startSynthBeat() {
    this.stopSynthBeat();
    const context = this.ensureContext();
    if (!context) return;

    this.synthStep = 0;
    const stepTimeMs = 250; // 120 BPM (500ms per beat, so 250ms per eighth note)

    // Interval with a slight look-ahead of 50ms to ensure perfect latency-free scheduling
    this.synthIntervalId = setInterval(() => {
      const now = context.currentTime;
      this.playSynthStep(this.synthStep, now + 0.05);
      this.synthStep = (this.synthStep + 1) % 8; // 8 step bar
    }, stepTimeMs);
  }

  private stopSynthBeat() {
    if (this.synthIntervalId) {
      clearInterval(this.synthIntervalId);
      this.synthIntervalId = null;
    }
  }

  private playSynthStep(step: number, time: number) {
    const context = this.ensureContext();
    if (!context) return;

    try {
      // 1. Kick Drum: steps 0 and 4 (four-on-the-floor)
      if (step === 0 || step === 4) {
        const osc = context.createOscillator();
        const gainNode = context.createGain();
        osc.connect(gainNode);
        gainNode.connect(context.destination);

        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.16);

        const peak = 0.24 * this.getMasterGainMultiplier();
        gainNode.gain.setValueAtTime(peak, time);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);

        osc.start(time);
        osc.stop(time + 0.18);
      }

      // 2. Hi-Hat Ticks: off-beats 2 and 6
      if (step === 2 || step === 6) {
        const osc = context.createOscillator();
        const gainNode = context.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(9500, time);
        osc.connect(gainNode);
        gainNode.connect(context.destination);

        const peak = 0.07 * this.getMasterGainMultiplier();
        gainNode.gain.setValueAtTime(peak, time);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

        osc.start(time);
        osc.stop(time + 0.06);
      }

      // 3. Synth Minor Bassline: driving upbeat groove
      // Melody: C2 (65.4Hz) -> C2 -> Eb2 (77.8Hz) -> C2 -> G2 (98.0Hz) -> G2 -> Bb2 (116.5Hz) -> G2
      const notes = [65.4, 65.4, 77.8, 65.4, 98.0, 98.0, 116.5, 98.0];
      const freq = notes[step];

      const osc = context.createOscillator();
      const gainNode = context.createGain();
      const filter = context.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, time); // warm bass cutoff

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(context.destination);

      const peak = 0.12 * this.getMasterGainMultiplier();
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(peak, time + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

      osc.start(time);
      osc.stop(time + 0.24);

    } catch (e) {
      // Ignored
    }
  }

  // ----------------------------------------------------
  // High-End Transitions & Ticks
  // ----------------------------------------------------

  public playPhaseStart(phase: 'active' | 'rest', mode: SoundMode) {
    if (mode === 'off') return;

    if (mode === 'continuous') {
      if (phase === 'active') {
        this.startContinuousTone();
      } else {
        this.stopContinuousTone();
      }
      return;
    }

    // Play themed phase start chime
    if (this.theme === 'digital') {
      if (phase === 'active') {
        // High double-beep C6-G6
        this.beep(1046.50, 0.1);
        setTimeout(() => this.beep(1567.98, 0.12), 80);
      } else {
        // Low double-beep G5-C5
        this.beep(783.99, 0.12);
        setTimeout(() => this.beep(523.25, 0.14), 100);
      }

    } else if (this.theme === 'ems') {
      if (phase === 'active') {
        // Energy chirp ascending
        this.playChirp(100, 1200, 0.2, 'triangle');
      } else {
        // Cool down chirp descending
        this.playChirp(800, 80, 0.2, 'sine');
      }

    } else if (this.theme === 'synth') {
      if (phase === 'active') {
        // White noise drum clap + horn note
        this.playNoiseBurst(0.18, 0.22, 1000);
        this.beep(329.63, 0.18, 'triangle'); // E4 synth horn
      } else {
        // Reversed noise gate sweep
        this.playNoiseBurst(0.24, 0.15, 600);
      }

    } else if (this.theme === 'zen') {
      if (phase === 'active') {
        // Rich singing bowl resonant strike
        this.playSingingBowl([523.25, 783.99, 1046.50], 1.5, 0.25);
      } else {
        // Meditation temple chime gong
        this.playSingingBowl([329.63, 659.25], 1.2, 0.2);
      }

    } else if (this.theme === 'arcade') {
      const context = this.ensureContext();
      if (!context) return;
      const now = context.currentTime;

      if (phase === 'active') {
        // 8-bit coin-up sound arpeggio
        const arpeggio = [523.25, 659.25, 783.99, 1046.50];
        arpeggio.forEach((note, index) => {
          setTimeout(() => this.beep(note, 0.08, 'square'), index * 60);
        });
      } else {
        // Retro slide down
        this.playChirp(880, 220, 0.2, 'square');
      }
    }
  }

  public playTick(remaining: number, elapsed: number, phase: 'active' | 'rest', mode: SoundMode) {
    if (mode === 'countdown') {
      const ceiling = Math.ceil(remaining);
      if (ceiling <= 3 && ceiling > 0) {
        this.playThemedTick();
      }
    } else if (mode === 'metronome') {
      if (phase === 'active' && elapsed > 0) {
        this.playThemedTick();
      }
    }
  }

  public playThemedTick() {
    if (this.theme === 'digital') {
      // Standard dry chime
      this.beep(659.25, 0.05, 'sine');

    } else if (this.theme === 'ems') {
      // Snappy electrical crackle tick
      this.beep(1600, 0.015, 'square');

    } else if (this.theme === 'synth') {
      // Filtered electronic woodblock rimshot click
      this.playNoiseBurst(0.02, 0.15, 1800);

    } else if (this.theme === 'zen') {
      // Soft wood bamboo tick block
      this.beep(1200, 0.03, 'triangle');

    } else if (this.theme === 'arcade') {
      // Retro chiptune drop-pitch blip
      this.playChirp(800, 400, 0.04, 'square');
    }
  }

  // ----------------------------------------------------
  // Dynamic Workout Complete Fanfares
  // ----------------------------------------------------

  public playWorkoutComplete() {
    const context = this.ensureContext();
    if (!context) return;
    const now = context.currentTime;

    if (this.theme === 'digital') {
      // Classic triumphant chime
      this.beep(523.25, 0.12, 'sine'); // C5
      setTimeout(() => this.beep(659.25, 0.12, 'sine'), 120); // E5
      setTimeout(() => this.beep(783.99, 0.12, 'sine'), 240); // G5
      setTimeout(() => this.beep(1046.50, 0.35, 'sine'), 360); // C6

    } else if (this.theme === 'ems') {
      // Sci-fi rising buzz chime
      this.playChirp(120, 1600, 0.6, 'triangle');
      setTimeout(() => this.beep(1046.50, 0.25, 'sine'), 450);

    } else if (this.theme === 'synth') {
      // Warm, epic synth chord sequence!
      // Chords: C major (261Hz) -> F major (349Hz) -> G major (392Hz) -> C major high (523Hz)
      const chordC = [261.63, 329.63, 392.00, 523.25];
      const chordF = [349.23, 440.00, 523.25, 698.46];
      const chordG = [392.00, 493.88, 587.33, 783.99];
      const chordC2 = [523.25, 659.25, 783.99, 1046.50];

      this.playSynthChord(chordC, now, 0.3);
      this.playSynthChord(chordF, now + 0.3, 0.3);
      this.playSynthChord(chordG, now + 0.6, 0.3);
      this.playSynthChord(chordC2, now + 0.9, 0.6);

    } else if (this.theme === 'zen') {
      // Resonant, majestic deep singing bowl gong chord
      const lowGong = [130.81, 261.63, 392.00, 523.25, 659.25];
      this.playSingingBowl(lowGong, 4.0, 0.25);

    } else if (this.theme === 'arcade') {
      // Fun retro victory melody!
      this.playRetroVictoryMelody();
    }
  }

  private playRetroVictoryMelody() {
    const context = this.ensureContext();
    if (!context) return;
    const now = context.currentTime;
    
    // Melodic notes in eighths
    const notes = [
      { f: 523.25, d: 0.1 }, // C5
      { f: 659.25, d: 0.1 }, // E5
      { f: 783.99, d: 0.1 }, // G5
      { f: 1046.50, d: 0.15 }, // C6
      { f: 783.99, d: 0.1 }, // G5
      { f: 1046.50, d: 0.4 }, // C6
    ];

    notes.forEach((item, index) => {
      const scheduleTime = now + (index * 110) / 1000;
      try {
        const osc = context.createOscillator();
        const gainNode = context.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(item.f, scheduleTime);

        const peak = 0.08 * this.getMasterGainMultiplier();
        gainNode.gain.setValueAtTime(0, scheduleTime);
        gainNode.gain.linearRampToValueAtTime(peak, scheduleTime + 0.008);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + item.d);

        osc.connect(gainNode);
        gainNode.connect(context.destination);

        osc.start(scheduleTime);
        osc.stop(scheduleTime + item.d + 0.02);
      } catch (err) {}
    });
  }

  // ----------------------------------------------------
  // Interactive Live Acoustics Preview
  // ----------------------------------------------------

  public testSound(mode: SoundMode) {
    this.ensureContext();
    if (mode === 'off') return;

    if (mode === 'beep') {
      this.playPhaseStart('active', 'beep');
    } else if (mode === 'countdown') {
      // Play 3 quick step-down ticks and transition
      this.playThemedTick();
      setTimeout(() => this.playThemedTick(), 250);
      setTimeout(() => this.playThemedTick(), 500);
      setTimeout(() => this.playPhaseStart('active', 'beep'), 750);
    } else if (mode === 'continuous') {
      this.startContinuousTone();
      setTimeout(() => this.stopContinuousTone(), 1400);
    } else if (mode === 'metronome') {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => this.playThemedTick(), i * 250);
      }
    }
  }
}

export const audio = new AudioEngine();
