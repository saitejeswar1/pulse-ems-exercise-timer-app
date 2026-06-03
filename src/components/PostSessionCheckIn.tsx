import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HeartPulse } from 'lucide-react';
import { SwellingLevel, SessionCheckIn } from '../types';

interface PostSessionCheckInProps {
  open: boolean;
  onClose: () => void;
  onSave: (checkIn: Omit<SessionCheckIn, 'id' | 'timestamp' | 'date'>) => void;
}

const SWELLING_OPTIONS: { value: SwellingLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
];

export default function PostSessionCheckIn({ open, onClose, onSave }: PostSessionCheckInProps) {
  const [pain, setPain] = useState<number>(0);
  const [swelling, setSwelling] = useState<SwellingLevel>('none');
  const [flexionStr, setFlexionStr] = useState<string>('');
  const [noteStr, setNoteStr] = useState<string>('');

  useEffect(() => {
    if (open) {
      setPain(0);
      setSwelling('none');
      setFlexionStr('');
      setNoteStr('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const handleSave = () => {
    const flexion = parseInt(flexionStr, 10);
    const payload: Omit<SessionCheckIn, 'id' | 'timestamp' | 'date'> = {
      painRating: pain,
      swelling,
      kneeFlexionDegrees: Number.isFinite(flexion) ? Math.max(0, Math.min(180, flexion)) : undefined,
      notes: noteStr.trim() || undefined,
    };
    onSave(payload);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="checkin-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
          />
          <motion.div
            key="checkin-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl border-t border-natural-border max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-natural-terracotta" />
                <h3 className="text-sm font-bold text-natural-dark tracking-tight">Knee check-in</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#70706B] hover:bg-natural-bg cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="px-5 text-[11px] text-[#70706B] leading-relaxed">
              How's the knee feeling right now? Takes 10 seconds. Used to track recovery progression — skip if you'd rather log later.
            </p>

            <div className="p-5 flex flex-col gap-5">
              {/* Pain */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-natural-dark font-medium">Pain</span>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold font-mono rounded-full border ${
                    pain <= 2
                      ? 'text-natural-moss bg-natural-moss/10 border-natural-moss/20'
                      : pain <= 5
                      ? 'text-amber-700 bg-amber-100 border-amber-200'
                      : 'text-natural-terracotta bg-natural-terracotta/10 border-natural-terracotta/30'
                  }`}>
                    {pain}/10
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={pain}
                  onChange={e => setPain(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-natural-bg rounded-lg appearance-none cursor-pointer accent-natural-terracotta"
                />
                <div className="flex justify-between text-[9px] uppercase tracking-wider text-[#8B8B80] font-bold">
                  <span>None</span>
                  <span>Worst</span>
                </div>
              </div>

              {/* Swelling */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-natural-moss">Swelling</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {SWELLING_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSwelling(opt.value)}
                      className={`py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wide cursor-pointer ${
                        swelling === opt.value
                          ? opt.value === 'none'
                            ? 'bg-natural-moss/10 text-natural-moss border-natural-moss'
                            : opt.value === 'severe'
                            ? 'bg-natural-terracotta/10 text-natural-terracotta border-natural-terracotta'
                            : 'bg-amber-100 text-amber-700 border-amber-300'
                          : 'bg-natural-bg text-[#757570] border-natural-border'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Knee flexion */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-natural-moss">Knee flexion <span className="text-[#8B8B80] font-medium">(optional, degrees)</span></span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={180}
                  placeholder="e.g. 125"
                  value={flexionStr}
                  onChange={e => setFlexionStr(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-natural-bg border border-natural-border rounded-xl text-natural-dark font-mono focus:outline-none focus:border-natural-moss"
                />
              </div>

              {/* Note */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-natural-moss">Note <span className="text-[#8B8B80] font-medium">(optional)</span></span>
                <input
                  type="text"
                  placeholder="e.g. 'sharp twinge during step-ups'"
                  value={noteStr}
                  onChange={e => setNoteStr(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-natural-bg border border-natural-border rounded-xl text-natural-dark focus:outline-none focus:border-natural-moss"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="py-3 bg-natural-bg hover:bg-natural-border/60 border border-natural-border text-natural-dark rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Skip
                </button>
                <button
                  onClick={handleSave}
                  className="py-3 bg-natural-terracotta hover:bg-[#C27A62] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Save check-in
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
