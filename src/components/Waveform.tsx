import { useEffect, useRef, useState } from 'react';
import { WorkoutPhase } from '../types';

interface WaveformProps {
  phase: WorkoutPhase;
}

export default function Waveform({ phase }: WaveformProps) {
  const [paths, setPaths] = useState<{ stroke: string; fill: string }>({
    stroke: 'M0,110 L600,110',
    fill: 'M0,110 L600,110 Z',
  });

  const animRef = useRef<number | null>(null);

  const buildActiveWave = (t: number) => {
    // EMS-style biphasic medical burst pattern, scrolling left dynamically
    const W = 600;
    const mid = 110;
    const samples = 140; // optimized resolution for high performance
    const burstHz = 2; // frequency of entire burst groups
    const pulsesPerBurst = 4;
    const burstDuration = 0.35;
    const burstPeriod = 1 / burstHz;
    const amp = 75;
    const pts: string[] = [];
    const fillPts: string[] = [];

    for (let i = 0; i <= samples; i++) {
      const x = (i / samples) * W;
      // Scroll wave coordinate based on scale
      const localT = t + (i / samples) * 1.0;
      const phaseInBurst = ((localT % burstPeriod) + burstPeriod) % burstPeriod;
      let y = mid;

      if (phaseInBurst < burstDuration) {
        const pulseFreq = pulsesPerBurst / burstDuration;
        const envelope = Math.sin(Math.PI * (phaseInBurst / burstDuration));
        y = mid - Math.sin(2 * Math.PI * pulseFreq * phaseInBurst) * amp * envelope;
      }

      const xStr = x.toFixed(1);
      const yStr = y.toFixed(1);
      pts.push(`${xStr},${yStr}`);
      fillPts.push(`${xStr},${yStr}`);
    }

    const stroke = 'M' + pts.join(' L');
    const fill = `M0,${mid} L${fillPts.join(' L')} L${W},${mid} Z`;
    return { stroke, fill };
  };

  useEffect(() => {
    if (phase === 'active') {
      const tick = () => {
        const elapsed = performance.now() / 1000;
        // Speeds up horizontal scroll rate slightly (1.2 multiplier)
        const wave = buildActiveWave(elapsed * 1.25);
        setPaths(wave);
        animRef.current = requestAnimationFrame(tick);
      };

      animRef.current = requestAnimationFrame(tick);
    } else {
      // Draw straight idle/rest baseline
      setPaths({
        stroke: 'M0,110 L600,110',
        fill: 'M0,110 L600,110 Z',
      });
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    }

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [phase]);

  const activeColorClass = 
    phase === 'active' 
      ? 'text-natural-moss' 
      : phase === 'rest' 
      ? 'text-natural-terracotta' 
      : 'text-slate-400';

  return (
    <div className="relative w-full h-[220px] bg-white rounded-2xl border border-natural-border overflow-hidden flex items-center justify-center shadow-sm">
      {/* Scope Calibration Grid Lines */}
      <svg
        id="wave"
        viewBox="0 0 600 220"
        preserveAspectRatio="none"
        aria-hidden="true"
        className={`absolute inset-0 w-full h-full ${activeColorClass} transition-colors duration-300`}
      >
        <defs>
          <linearGradient id="wave-glow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Oscilloscope Background Grid lines */}
        <g stroke="#E5E5E0" strokeWidth="0.75" strokeDasharray="4 4" className="opacity-80">
          <line x1="0" y1="55" x2="600" y2="55" />
          <line x1="0" y1="110" x2="600" y2="110" />
          <line x1="0" y1="165" x2="600" y2="165" />
          <line x1="150" y1="0" x2="150" y2="220" />
          <line x1="300" y1="0" x2="300" y2="220" />
          <line x1="450" y1="0" x2="450" y2="220" />
        </g>

        {/* Filled Wave Accent Area */}
        <path d={paths.fill} fill="url(#wave-glow)" stroke="none" className="transition-all duration-75" />
        
        {/* Core Electric Wave Signal Path */}
        <path
          d={paths.stroke}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-all duration-75 text-glow"
        />
      </svg>
    </div>
  );
}
