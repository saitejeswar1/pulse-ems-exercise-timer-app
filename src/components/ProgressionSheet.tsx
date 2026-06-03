import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Target, Check, Trophy, Plus, HeartPulse } from 'lucide-react';
import { SessionCheckIn, WorkoutLogEntry } from '../types';
import { PROGRESSION_GATES, gateForLevel, latestMatchingLog, ProgressionCriterion } from '../lib/progression';

export interface ProgressionState {
  // criterionId → { checked, checkedAt ISO string or null }
  [criterionId: string]: { checked: boolean; checkedAt: string | null };
}

interface ProgressionSheetProps {
  open: boolean;
  level: number | null; // null = no focus level set
  state: ProgressionState;
  checkIns: SessionCheckIn[];
  logs: WorkoutLogEntry[];
  bodyweightKg?: number | null;
  onClose: () => void;
  onToggle: (criterionId: string) => void;
  onAdvanceLevel: (toLevel: number) => void;
  onOpenCheckIn: () => void;
}

function CriterionHint({ criterion, logs, bodyweightKg }: {
  criterion: ProgressionCriterion;
  logs: WorkoutLogEntry[];
  bodyweightKg?: number | null;
}) {
  if (!criterion.exerciseKeyword) return null;
  const last = latestMatchingLog(criterion.exerciseKeyword, logs);
  if (!last) {
    return (
      <span className="text-[10px] text-[#8B8B80] italic mt-1">
        No matching log yet — finish a session of "{criterion.exerciseKeyword}".
      </span>
    );
  }
  const weight = typeof last.weightKg === 'number' ? last.weightKg : 0;
  const reps = last.repsPerSetUsed;
  const bw = typeof bodyweightKg === 'number' && bodyweightKg > 0 ? bodyweightKg : null;
  const ratio = bw ? weight / bw : null;
  const targetBW = criterion.targetBW;

  const isOnTarget =
    targetBW != null && ratio != null && ratio >= targetBW &&
    (criterion.targetReps == null || (typeof reps === 'number' && reps >= criterion.targetReps));

  return (
    <span className={`text-[10px] mt-1 font-mono ${
      isOnTarget ? 'text-natural-moss font-bold' : 'text-[#70706B]'
    }`}>
      Last: {weight > 0 ? `${weight} kg` : 'BW'}{typeof reps === 'number' ? ` × ${reps}` : ''}
      {ratio != null && weight > 0 && (
        <>{' '}({ratio.toFixed(2)}× BW{targetBW != null ? `, target ${targetBW}×` : ''})</>
      )}
      {!bw && targetBW != null && (
        <span className="italic text-[#8B8B80]"> · set bodyweight in Settings for × BW math</span>
      )}
    </span>
  );
}

function formatRelativeDate(date: string): string {
  const today = new Date();
  const target = new Date(date + 'T00:00:00');
  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return date;
}

export default function ProgressionSheet({
  open, level, state, checkIns, logs, bodyweightKg, onClose, onToggle, onAdvanceLevel, onOpenCheckIn,
}: ProgressionSheetProps) {
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

  const gate = level == null ? undefined : gateForLevel(level);
  const isTerminal = level === 9;
  const recentCheckIns = useMemo(
    () => [...checkIns].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
    [checkIns],
  );

  const checked = gate ? gate.criteria.filter(c => state[c.id]?.checked).length : 0;
  const total = gate?.criteria.length ?? 0;
  const allDone = total > 0 && checked === total;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="prog-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
          />
          <motion.div
            key="prog-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl border-t border-natural-border max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-natural-terracotta" />
                <h3 className="text-sm font-bold text-natural-dark tracking-tight">
                  {level == null
                    ? 'Pick a focus level first'
                    : isTerminal
                    ? 'Level 9 — Return to Sport'
                    : `Level ${level} → Level ${level! + 1}`}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#70706B] hover:bg-natural-bg cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {level == null && (
              <p className="px-5 pb-5 text-[12px] text-[#70706B] leading-relaxed">
                Set a Focus Level in Settings or on the Schedule view to see the criteria you need to pass to advance.
              </p>
            )}

            {level != null && !gate && !isTerminal && (
              <p className="px-5 pb-5 text-[12px] text-[#70706B] leading-relaxed">
                No progression gate defined for Level {level}.
              </p>
            )}

            {isTerminal && (
              <div className="px-5 pb-5 flex flex-col gap-2">
                <p className="text-[12px] text-[#70706B] leading-relaxed">
                  Final stage — return-to-sport testing. From here, progression is therapist-driven (cutting/turning, sport-specific load). Keep maintaining your strength benchmarks.
                </p>
                <div className="flex items-center gap-1.5 text-natural-moss">
                  <Trophy className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">You made it</span>
                </div>
              </div>
            )}

            {gate && (
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-natural-moss">
                    {gate.headline}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-natural-terracotta">
                    {checked} / {total}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-natural-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-natural-terracotta transition-all duration-200"
                    style={{ width: `${total === 0 ? 0 : (checked / total) * 100}%` }}
                  />
                </div>

                {/* Criteria list */}
                <div className="flex flex-col gap-1.5">
                  {gate.criteria.map(c => {
                    const isChecked = !!state[c.id]?.checked;
                    return (
                      <button
                        key={c.id}
                        onClick={() => onToggle(c.id)}
                        className={`flex items-start gap-3 text-left p-3 rounded-xl border transition cursor-pointer ${
                          isChecked
                            ? 'bg-natural-moss/5 border-natural-moss/40'
                            : 'bg-natural-bg border-natural-border'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isChecked
                            ? 'bg-natural-moss border-natural-moss'
                            : 'bg-white border-natural-border'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                        <span className="flex flex-col flex-1 min-w-0">
                          <span className={`text-[12px] leading-snug font-medium ${
                            isChecked ? 'text-natural-moss' : 'text-natural-dark'
                          }`}>
                            {c.label}
                          </span>
                          <CriterionHint criterion={c} logs={logs} bodyweightKg={bodyweightKg} />
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={!allDone}
                  onClick={() => onAdvanceLevel(gate.toLevel)}
                  className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                    allDone
                      ? 'bg-natural-terracotta hover:bg-[#C27A62] text-white cursor-pointer shadow-sm'
                      : 'bg-natural-bg text-[#8B8B80] cursor-not-allowed border border-natural-border'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  {allDone ? `Advance to Level ${gate.toLevel}` : `${total - checked} criteria remaining`}
                </button>
              </div>
            )}

            {/* Recent recovery check-ins */}
            <div className="px-5 pb-6 flex flex-col gap-2 border-t border-natural-border pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-natural-moss flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5" />
                  Recent knee check-ins
                </span>
                <button
                  onClick={onOpenCheckIn}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-natural-terracotta hover:text-[#C27A62] cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
              {recentCheckIns.length === 0 ? (
                <p className="text-[11px] text-[#8B8B80] italic">No check-ins yet — finish a workout or tap Add.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {recentCheckIns.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 bg-natural-bg rounded-lg border border-natural-border text-[11px]">
                      <span className="text-[#70706B] font-mono">{formatRelativeDate(c.date)}</span>
                      <div className="flex items-center gap-2 font-bold">
                        <span className={`px-1.5 py-0.5 rounded ${
                          c.painRating <= 2
                            ? 'text-natural-moss bg-natural-moss/10'
                            : c.painRating <= 5
                            ? 'text-amber-700 bg-amber-100'
                            : 'text-natural-terracotta bg-natural-terracotta/10'
                        }`}>
                          Pain {c.painRating}/10
                        </span>
                        <span className="text-[#70706B] capitalize">{c.swelling}</span>
                        {typeof c.kneeFlexionDegrees === 'number' && (
                          <span className="text-natural-moss">{c.kneeFlexionDegrees}°</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
