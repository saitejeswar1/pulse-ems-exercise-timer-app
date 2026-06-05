import { Reorder, useDragControls } from 'motion/react';
import { GripVertical, Check, Trash2 } from 'lucide-react';
import { PhysioExercise } from '../types';

// `key` is declared explicitly because this project has no @types/react, so there's no
// JSX.IntrinsicAttributes to supply `key` automatically when this is rendered in a list.
interface PlanRowProps {
  key?: string | number | null;
  id: string;
  ex: PhysioExercise;
  index: number;
  done: boolean;
  current: boolean;
  running: boolean;
  onRemove: (id: string) => void;
}

// One row in Today's Plan. Drag is handle-initiated (dragListener disabled) so the
// row only moves when grabbed by the grip, never on an accidental swipe over the name.
// The grip and trash button are hidden while running — the plan is locked once started.
export default function PlanRow({ id, ex, index, done, current, running, onRemove }: PlanRowProps) {
  const controls = useDragControls();
  const metric = (ex.mode ?? 'time') === 'reps'
    ? `${ex.repsPerSet ?? '?'} reps`
    : `${ex.activeDur}s`;

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] ${
        current
          ? 'bg-white border-natural-moss'
          : done
            ? 'bg-natural-moss/5 border-natural-moss/20'
            : 'bg-white border-natural-border'
      }`}
    >
      {!running && (
        <button
          onPointerDown={(e) => controls.start(e)}
          className="touch-none p-0.5 -ml-1 text-gray-300 hover:text-natural-moss cursor-grab active:cursor-grabbing flex-shrink-0"
          aria-label={`Drag to reorder ${ex.name}`}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      <span className={`w-4 h-4 rounded-full font-bold text-[9px] flex items-center justify-center flex-shrink-0 ${
        done ? 'bg-natural-moss/20 text-natural-moss' : 'bg-natural-moss text-white'
      }`}>
        {done ? <Check className="w-2.5 h-2.5" /> : index + 1}
      </span>
      <span className={`font-semibold truncate ${done ? 'text-[#9a9a90] line-through' : 'text-natural-dark'}`}>
        {ex.name}
      </span>
      <span className="font-mono text-[10px] text-[#757570] ml-auto whitespace-nowrap">
        {metric} × {ex.targetCycles}
      </span>
      {!running && (
        <button
          onClick={() => onRemove(id)}
          className="p-0.5 text-gray-400 hover:text-natural-terracotta rounded transition cursor-pointer flex-shrink-0"
          aria-label={`Remove ${ex.name} from plan`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </Reorder.Item>
  );
}
