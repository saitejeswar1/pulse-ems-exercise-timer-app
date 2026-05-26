import React, { useState, useRef } from 'react';
import { PhysioExercise, ExerciseMode, ExerciseCategory } from '../types';
import { Plus, Trash2, Play, Dumbbell, Sparkles, AlertCircle, Calendar, Pencil, X, Timer, Repeat, Zap, HeartPulse, Move, Tag, Upload, Download, FileText, ChevronUp, ChevronDown, Hourglass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  parseJSONPlan, parseCSVPlan, exportJSON, exportCSV,
  TEMPLATE_JSON, TEMPLATE_CSV, downloadFile, ImportedExercise,
} from '../lib/planIO';

interface PhysioScheduleProps {
  exercises: PhysioExercise[];
  activeExerciseId: string | null;
  onAddExercise: (ex: Omit<PhysioExercise, 'id'>) => void;
  onUpdateExercise: (id: string, ex: Omit<PhysioExercise, 'id'>) => void;
  onRemoveExercise: (id: string) => void;
  onSelectExercise: (ex: PhysioExercise) => void;
  onImportExercises: (exs: ImportedExercise[], mode: 'append' | 'replace') => void;
  onReorderExercise: (id: string, direction: 'up' | 'down') => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CATEGORIES: { value: ExerciseCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'ems', label: 'EMS', icon: Zap },
  { value: 'strength', label: 'Strength', icon: Dumbbell },
  { value: 'cardio', label: 'Cardio', icon: HeartPulse },
  { value: 'mobility', label: 'Mobility', icon: Move },
  { value: 'other', label: 'Other', icon: Tag },
];

const CATEGORY_STYLES: Record<ExerciseCategory, string> = {
  ems: 'bg-natural-terracotta/10 text-natural-terracotta',
  strength: 'bg-natural-moss/10 text-natural-moss',
  cardio: 'bg-rose-100 text-rose-700',
  mobility: 'bg-sky-100 text-sky-700',
  other: 'bg-slate-100 text-slate-600',
};

const PRESEEDS: Omit<PhysioExercise, 'id'>[] = [
  {
    name: 'EMS Core Iso-Hold',
    category: 'ems',
    mode: 'time',
    activeDur: 10,
    restDur: 10,
    targetCycles: 15,
    repsPerSet: 10,
    weekdays: ['Mon', 'Wed', 'Fri'],
    weeklyTarget: 3,
    notes: 'Focus on drawing belly button inward during stimulation'
  },
  {
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
    name: 'Hip Mobility Flow',
    category: 'mobility',
    mode: 'time',
    activeDur: 30,
    restDur: 15,
    targetCycles: 3,
    weekdays: ['Tue', 'Thu', 'Sun'],
    weeklyTarget: 3,
    notes: 'Slow controlled circles, both directions'
  },
];

const EMPTY_FORM = {
  name: '',
  category: 'ems' as ExerciseCategory,
  mode: 'time' as ExerciseMode,
  activeDur: 15,
  restDur: 15,
  targetCycles: 10,
  repsPerSet: 10,
  selectedDays: ['Mon', 'Wed', 'Fri'] as string[],
  weeklyTarget: 3,
  notes: '',
};

export default function PhysioSchedule({
  exercises,
  activeExerciseId,
  onAddExercise,
  onUpdateExercise,
  onRemoveExercise,
  onSelectExercise,
  onImportExercises,
  onReorderExercise,
}: PhysioScheduleProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showIO, setShowIO] = useState(false);
  const [importStatus, setImportStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [name, setName] = useState(EMPTY_FORM.name);
  const [category, setCategory] = useState<ExerciseCategory>(EMPTY_FORM.category);
  const [mode, setMode] = useState<ExerciseMode>(EMPTY_FORM.mode);
  const [filterCategory, setFilterCategory] = useState<ExerciseCategory | 'all'>('all');
  const [filterDay, setFilterDay] = useState<string | 'all'>('all');
  const [activeDur, setActiveDur] = useState(EMPTY_FORM.activeDur);
  const [restDur, setRestDur] = useState(EMPTY_FORM.restDur);
  const [targetCycles, setTargetCycles] = useState(EMPTY_FORM.targetCycles);
  const [repsPerSet, setRepsPerSet] = useState(EMPTY_FORM.repsPerSet);
  const [selectedDays, setSelectedDays] = useState<string[]>(EMPTY_FORM.selectedDays);
  const [weeklyTarget, setWeeklyTarget] = useState(EMPTY_FORM.weeklyTarget);
  const [notes, setNotes] = useState(EMPTY_FORM.notes);

  const resetForm = () => {
    setName(EMPTY_FORM.name);
    setCategory(EMPTY_FORM.category);
    setMode(EMPTY_FORM.mode);
    setActiveDur(EMPTY_FORM.activeDur);
    setRestDur(EMPTY_FORM.restDur);
    setTargetCycles(EMPTY_FORM.targetCycles);
    setRepsPerSet(EMPTY_FORM.repsPerSet);
    setSelectedDays(EMPTY_FORM.selectedDays);
    setWeeklyTarget(EMPTY_FORM.weeklyTarget);
    setNotes(EMPTY_FORM.notes);
    setEditingId(null);
  };

  const startEdit = (ex: PhysioExercise) => {
    setEditingId(ex.id);
    setName(ex.name);
    setCategory(ex.category ?? 'other');
    setMode(ex.mode ?? 'time');
    setActiveDur(ex.activeDur);
    setRestDur(ex.restDur);
    setTargetCycles(ex.targetCycles);
    setRepsPerSet(ex.repsPerSet ?? 10);
    setSelectedDays(ex.weekdays ?? []);
    setWeeklyTarget(ex.weeklyTarget ?? 3);
    setNotes(ex.notes ?? '');
    setShowForm(true);
  };

  const toggleAddForm = () => {
    if (showForm) {
      setShowForm(false);
      resetForm();
    } else {
      resetForm();
      setShowForm(true);
    }
  };

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: Omit<PhysioExercise, 'id'> = {
      name: name.trim(),
      category,
      mode,
      activeDur: (mode === 'reps' || mode === 'hold') ? 0 : activeDur,
      restDur,
      targetCycles,
      repsPerSet,
      weekdays: selectedDays.length > 0 ? selectedDays : undefined,
      weeklyTarget,
      notes: notes.trim() || undefined,
    };
    if (editingId) {
      onUpdateExercise(editingId, payload);
    } else {
      onAddExercise(payload);
    }
    resetForm();
    setShowForm(false);
  };

  const handlePreseedClick = (pre: Omit<PhysioExercise, 'id'>) => {
    onAddExercise(pre);
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing same file later
    if (!file) return;
    try {
      const text = await file.text();
      const isCSV = /\.csv$/i.test(file.name) || (!/\.json$/i.test(file.name) && text.trim().startsWith('name'));
      const parsed = isCSV ? parseCSVPlan(text) : parseJSONPlan(text);
      const replace = exercises.length > 0
        ? window.confirm(
            `Import ${parsed.length} exercise${parsed.length === 1 ? '' : 's'}.\n\n` +
            `OK = Replace your current ${exercises.length} exercise${exercises.length === 1 ? '' : 's'}.\n` +
            `Cancel = Append to your existing list.`
          )
        : false;
      onImportExercises(parsed, replace ? 'replace' : 'append');
      setImportStatus({ kind: 'ok', msg: `Imported ${parsed.length} exercise${parsed.length === 1 ? '' : 's'} (${replace ? 'replaced' : 'appended'}).` });
    } catch (err: any) {
      setImportStatus({ kind: 'err', msg: err?.message ?? 'Import failed.' });
    }
  };

  const handleExport = (fmt: 'json' | 'csv') => {
    if (exercises.length === 0) {
      setImportStatus({ kind: 'err', msg: 'Nothing to export — your program list is empty.' });
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (fmt === 'json') {
      downloadFile(`pulse-plan-${stamp}.json`, exportJSON(exercises), 'application/json');
    } else {
      downloadFile(`pulse-plan-${stamp}.csv`, exportCSV(exercises), 'text/csv');
    }
  };

  const handleDownloadTemplate = (fmt: 'json' | 'csv') => {
    if (fmt === 'json') {
      downloadFile('pulse-plan-template.json', TEMPLATE_JSON, 'application/json');
    } else {
      downloadFile('pulse-plan-template.csv', TEMPLATE_CSV, 'text/csv');
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 text-natural-dark">

      {/* Active Selection Block */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-3">
        <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-natural-moss" />
          Current Focus Routine
        </h3>

        {activeExerciseId ? (
          (() => {
            const currentObj = exercises.find(e => e.id === activeExerciseId);
            if (!currentObj) return <p className="text-xs text-slate-400">No active schedule loaded</p>;
            return (
              <div className="p-4 bg-natural-moss/5 border border-natural-moss/20 rounded-xl flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-natural-dark text-base">{currentObj.name}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 font-mono text-xs text-natural-moss font-semibold">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        (currentObj.mode ?? 'time') === 'reps'
                          ? 'bg-natural-terracotta/10 text-natural-terracotta'
                          : 'bg-natural-moss/10 text-natural-moss'
                      }`}>
                        {(currentObj.mode ?? 'time') === 'reps' ? 'Reps' : 'Time'}
                      </span>
                      {(currentObj.mode ?? 'time') === 'time' && (
                        <span>Active: {currentObj.activeDur}s</span>
                      )}
                      <span>Rest: {currentObj.restDur}s</span>
                      <span>Sets: {currentObj.targetCycles || '∞'}</span>
                      {currentObj.repsPerSet && (
                        <span>Reps/Set: {currentObj.repsPerSet}</span>
                      )}
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-natural-moss/10 text-natural-moss rounded text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">
                    ACTIVE TIMER
                  </span>
                </div>

                {/* Day-Wise Plan Display */}
                {(currentObj.weekdays || currentObj.weeklyTarget) && (
                  <div className="border-t border-natural-moss/10 pt-2.5 flex flex-col gap-2">
                    {currentObj.weekdays && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#70706B] font-medium">Scheduled Days:</span>
                        <div className="flex gap-1">
                          {WEEKDAYS.map(day => {
                            const isScheduled = currentObj.weekdays?.includes(day);
                            return (
                              <span
                                key={day}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  isScheduled
                                    ? 'bg-natural-moss text-white'
                                    : 'bg-natural-bg text-slate-400'
                                }`}
                              >
                                {day}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {currentObj.weeklyTarget && (
                      <div className="text-[11px] text-[#70706B] flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-natural-terracotta" />
                        <span>Weekly Goal: <strong className="text-natural-dark">{currentObj.weeklyTarget} sessions</strong> per week</span>
                      </div>
                    )}
                  </div>
                )}

                {currentObj.notes && (
                  <p className="text-[11px] text-[#70706B] mt-1 italic flex items-start gap-1 p-2 bg-white rounded-lg border border-natural-border">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-natural-terracotta flex-shrink-0" />
                    {currentObj.notes}
                  </p>
                )}
              </div>
            );
          })()
        ) : (
          <div className="p-4 bg-natural-bg/50 border border-dashed border-natural-border rounded-xl text-center">
            <p className="text-xs text-[#70706B]">No custom exercise routine loaded. Choose one below to configure target times.</p>
          </div>
        )}
      </div>

      {/* Exercises List Header & Actions */}
      <div className="flex justify-between items-center mt-2 gap-2">
        <h3 className="text-sm font-bold text-natural-moss tracking-wider uppercase">
          Program List
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setShowIO(v => !v); setImportStatus(null); }}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              showIO
                ? 'bg-natural-moss text-white border-natural-moss'
                : 'bg-natural-bg text-natural-moss border-natural-border hover:bg-natural-border/60'
            }`}
            aria-label="Import / Export"
            title="Import / Export"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleAddForm}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-natural-moss text-white rounded-xl text-xs font-bold tracking-wide hover:bg-[#4E4E36] transition cursor-pointer shadow-sm"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'Cancel' : 'Add Exercise'}
          </button>
        </div>
      </div>

      {/* Import / Export panel */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        className="hidden"
        onChange={handleFilePicked}
      />
      <AnimatePresence>
        {showIO && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-white rounded-2xl border border-natural-border flex flex-col gap-3 overflow-hidden shadow-sm"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-natural-moss" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-natural-moss">
                Import / Export Plan
              </span>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 bg-natural-moss hover:bg-[#4E4E36] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import from JSON / CSV
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleExport('json')}
                className="py-2 bg-natural-bg hover:bg-natural-border/60 border border-natural-border text-natural-moss rounded-xl text-[11px] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="py-2 bg-natural-bg hover:bg-natural-border/60 border border-natural-border text-natural-moss rounded-xl text-[11px] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDownloadTemplate('json')}
                className="py-1.5 text-[10px] font-bold uppercase tracking-wide text-natural-terracotta hover:text-[#C27A62] cursor-pointer flex items-center justify-center gap-1"
              >
                <FileText className="w-3 h-3" /> JSON Template
              </button>
              <button
                onClick={() => handleDownloadTemplate('csv')}
                className="py-1.5 text-[10px] font-bold uppercase tracking-wide text-natural-terracotta hover:text-[#C27A62] cursor-pointer flex items-center justify-center gap-1"
              >
                <FileText className="w-3 h-3" /> CSV Template
              </button>
            </div>

            <p className="text-[10px] text-[#8B8B80] leading-relaxed">
              Download a template to see the expected structure. In CSV files, weekdays are pipe-separated (e.g. <code className="font-mono">Mon|Wed|Fri</code>).
            </p>

            {importStatus && (
              <div
                className={`text-[11px] font-semibold px-3 py-2 rounded-lg border ${
                  importStatus.kind === 'ok'
                    ? 'bg-natural-moss/10 text-natural-moss border-natural-moss/30'
                    : 'bg-natural-terracotta/10 text-natural-terracotta border-natural-terracotta/30'
                }`}
              >
                {importStatus.msg}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Form (Add / Edit) */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="p-5 bg-white rounded-2xl border border-natural-border flex flex-col gap-4 overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-natural-terracotta">
                {editingId ? 'Editing Exercise' : 'New Exercise'}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={() => { resetForm(); setShowForm(false); }}
                  className="text-[11px] text-[#70706B] hover:text-natural-dark font-bold"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-natural-moss">Exercise Name</label>
              <input
                type="text"
                placeholder="e.g. Push-Ups, Quad Stim, Hip Mobility"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-natural-bg border border-natural-border rounded-xl text-natural-dark focus:outline-none focus:border-natural-moss"
              />
            </div>

            {/* Category Picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-natural-moss">Category</label>
              <div className="grid grid-cols-5 gap-1.5">
                {CATEGORIES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition cursor-pointer ${
                      category === value
                        ? `${CATEGORY_STYLES[value]} border-current shadow-sm`
                        : 'bg-natural-bg border-natural-border text-[#757570]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-natural-moss">Exercise Type</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-natural-bg border border-natural-border rounded-xl">
                <button
                  type="button"
                  onClick={() => setMode('time')}
                  className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition cursor-pointer ${
                    mode === 'time'
                      ? 'bg-white border border-natural-border text-natural-moss shadow-sm'
                      : 'text-[#757570]'
                  }`}
                >
                  <Timer className="w-3.5 h-3.5" /> Time
                </button>
                <button
                  type="button"
                  onClick={() => setMode('reps')}
                  className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition cursor-pointer ${
                    mode === 'reps'
                      ? 'bg-white border border-natural-border text-natural-moss shadow-sm'
                      : 'text-[#757570]'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" /> Reps
                </button>
                <button
                  type="button"
                  onClick={() => setMode('hold')}
                  className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition cursor-pointer ${
                    mode === 'hold'
                      ? 'bg-white border border-natural-border text-natural-moss shadow-sm'
                      : 'text-[#757570]'
                  }`}
                >
                  <Hourglass className="w-3.5 h-3.5" /> Hold
                </button>
              </div>
              <p className="text-[10px] text-[#8B8B80] italic">
                {mode === 'time'
                  ? 'Each set runs for a fixed active duration.'
                  : mode === 'reps'
                  ? 'Each set ends when you tap "Done Set" — no active countdown.'
                  : 'Stopwatch counts up. Tap "Stop Hold" when you can\'t hold any longer (planks, wall sits, etc).'}
              </p>
            </div>

            {/* Core Timings & Sets */}
            <div className="grid grid-cols-2 gap-3">
              {mode === 'time' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-natural-moss">Active Duration (s)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={activeDur}
                    onChange={e => setActiveDur(Math.max(0, parseInt(e.target.value) || 0))}
                    required
                    className="w-full px-3 py-2 text-sm bg-natural-bg border border-natural-border rounded-xl text-natural-dark font-mono text-center focus:outline-none"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-natural-moss">Rest Duration (s)</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={restDur}
                  onChange={e => setRestDur(Math.max(0, parseInt(e.target.value) || 0))}
                  required
                  className="w-full px-3 py-2 text-sm bg-natural-bg border border-natural-border rounded-xl text-natural-dark font-mono text-center focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-natural-moss">Sets (Target Cycles)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={targetCycles}
                  onChange={e => setTargetCycles(Math.max(1, parseInt(e.target.value) || 0))}
                  required
                  className="w-full px-3 py-2 text-sm bg-natural-bg border border-natural-border rounded-xl text-natural-dark font-mono text-center focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-natural-moss">Reps per Set (Contractions)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={repsPerSet}
                  onChange={e => setRepsPerSet(Math.max(1, parseInt(e.target.value) || 0))}
                  required
                  className="w-full px-3 py-2 text-sm bg-natural-bg border border-natural-border rounded-xl text-natural-dark font-mono text-center focus:outline-none"
                />
              </div>
            </div>

            {/* Day Wise Plan Scheduling */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-natural-moss">Day-Wise Plan (Schedule Days)</label>
              <div className="flex justify-between gap-1">
                {WEEKDAYS.map(day => {
                  const isSelected = selectedDays.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => handleDayToggle(day)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        isSelected
                          ? 'bg-natural-moss text-white border border-natural-moss shadow-sm'
                          : 'bg-natural-bg text-[#70706B] border border-natural-border'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weekly Goal target frequency */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-bold text-natural-moss">
                <span>Weekly Goal Frequency</span>
                <span className="font-mono text-natural-terracotta">{weeklyTarget} Days / Week</span>
              </div>
              <input
                type="range"
                min="1"
                max="7"
                value={weeklyTarget}
                onChange={e => setWeeklyTarget(parseInt(e.target.value))}
                className="w-full h-1.5 bg-natural-border rounded-lg appearance-none cursor-pointer accent-natural-moss"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-natural-moss">Notes</label>
              <textarea
                placeholder="Cues, form tips, or therapist guidance..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm bg-natural-bg border border-natural-border rounded-xl text-natural-dark focus:outline-none focus:border-natural-moss resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-natural-terracotta hover:bg-[#C27A62] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              {editingId ? 'Update Exercise' : 'Save to Program List'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Category + Day Filter Chips */}
      {exercises.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition cursor-pointer ${
                filterCategory === 'all'
                  ? 'bg-natural-dark text-white border-natural-dark'
                  : 'bg-natural-bg text-[#757570] border-natural-border'
              }`}
            >
              All
            </button>
            {CATEGORIES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setFilterCategory(value)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition cursor-pointer ${
                  filterCategory === value
                    ? `${CATEGORY_STYLES[value]} border-current`
                    : 'bg-natural-bg text-[#757570] border-natural-border'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterDay('all')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition cursor-pointer ${
                filterDay === 'all'
                  ? 'bg-natural-dark text-white border-natural-dark'
                  : 'bg-natural-bg text-[#757570] border-natural-border'
              }`}
            >
              Any Day
            </button>
            {WEEKDAYS.map(day => (
              <button
                key={day}
                onClick={() => setFilterDay(day)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition cursor-pointer ${
                  filterDay === day
                    ? 'bg-natural-moss text-white border-natural-moss'
                    : 'bg-natural-bg text-[#757570] border-natural-border'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Routine list */}
      <div className="flex flex-col gap-3">
        {exercises.length === 0 ? (
          <div className="text-center py-6 bg-white rounded-2xl border border-natural-border">
            <p className="text-sm text-[#70706B] font-medium">Your program list is currently empty.</p>
            <div className="mt-4 px-4">
              <span className="text-xs text-[#8B8B80] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-natural-terracotta" /> Quick-Start Exercises
              </span>
              <div className="grid grid-cols-1 gap-2.5 mt-3">
                {PRESEEDS.map((pre, index) => (
                  <button
                    key={index}
                    onClick={() => handlePreseedClick(pre)}
                    className="p-3.5 bg-natural-bg hover:bg-natural-border/60 border border-natural-border text-left rounded-xl text-xs flex justify-between items-center transition cursor-pointer font-medium"
                  >
                    <div>
                      <div className="font-bold text-natural-dark">{pre.name}</div>
                      <div className="text-[#70706B] mt-1 text-[10px]">
                        Active {pre.activeDur}s • Rest {pre.restDur}s • Sets: {pre.targetCycles} • Reps: {pre.repsPerSet}
                      </div>
                      {pre.weekdays && (
                        <div className="flex gap-1 mt-1">
                          {pre.weekdays.map(d => (
                            <span key={d} className="text-[8px] bg-natural-moss/10 text-natural-moss font-bold px-1 rounded">{d}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Plus className="w-4 h-4 text-natural-moss flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          (() => {
            const visible = exercises.filter(e => {
              const catOk = filterCategory === 'all' || (e.category ?? 'other') === filterCategory;
              const dayOk = filterDay === 'all' || (e.weekdays?.includes(filterDay) ?? false);
              return catOk && dayOk;
            });
            if (visible.length === 0) {
              return (
                <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-natural-border">
                  <p className="text-xs text-[#70706B]">No exercises in this category.</p>
                </div>
              );
            }
            return visible.map((item) => {
            const isActive = item.id === activeExerciseId;
            const isEditingThis = editingId === item.id;
            const itemCategory = item.category ?? 'other';
            const catMeta = CATEGORIES.find(c => c.value === itemCategory);
            const CatIcon = catMeta?.icon ?? Tag;
            return (
              <motion.div
                key={item.id}
                layout
                id={`ex-card-${item.id}`}
                className={`p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-3 ${
                  isEditingThis
                    ? 'bg-natural-terracotta/5 border-natural-terracotta'
                    : isActive
                      ? 'bg-natural-moss/5 border-natural-moss'
                      : 'bg-white border-natural-border'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${CATEGORY_STYLES[itemCategory]}`}>
                        <CatIcon className="w-3 h-3" />
                        {catMeta?.label ?? 'Other'}
                      </span>
                      <h4 className="font-bold text-natural-dark text-sm leading-tight truncate">{item.name}</h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 font-mono text-[11px] text-[#70706B] font-semibold">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        (item.mode ?? 'time') === 'reps'
                          ? 'bg-natural-terracotta/10 text-natural-terracotta'
                          : (item.mode ?? 'time') === 'hold'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-natural-moss/10 text-natural-moss'
                      }`}>
                        {(item.mode ?? 'time') === 'reps' ? 'Reps' : (item.mode ?? 'time') === 'hold' ? 'Hold' : 'Time'}
                      </span>
                      {(item.mode ?? 'time') === 'time' && (
                        <span className="text-natural-moss">Active: {item.activeDur}s</span>
                      )}
                      <span className="text-natural-terracotta">Rest: {item.restDur}s</span>
                      <span>Sets: {item.targetCycles}</span>
                      {item.repsPerSet && (
                        <span>Reps: {item.repsPerSet}</span>
                      )}
                    </div>

                    {/* Weekday calendar overview badges */}
                    {item.weekdays && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Days:</span>
                        <div className="flex gap-0.5">
                          {WEEKDAYS.map(d => {
                            const onDay = item.weekdays?.includes(d);
                            return (
                              <span
                                key={d}
                                className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                                  onDay
                                    ? 'bg-natural-moss/10 text-natural-moss'
                                    : 'text-slate-300'
                                }`}
                              >
                                {d}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {item.weeklyTarget && (
                      <div className="text-[10px] font-medium text-slate-500 mt-1">
                        Weekly goal: {item.weeklyTarget} days per week
                      </div>
                    )}

                    {item.notes && (
                      <p className="text-[11px] text-[#757570] mt-2 italic line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-0.5 ml-2 flex-shrink-0">
                    <div className="flex flex-col">
                      <button
                        onClick={() => onReorderExercise(item.id, 'up')}
                        className="p-0.5 hover:bg-natural-bg text-gray-400 hover:text-natural-moss rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move up"
                        disabled={exercises.findIndex(e => e.id === item.id) === 0}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onReorderExercise(item.id, 'down')}
                        className="p-0.5 hover:bg-natural-bg text-gray-400 hover:text-natural-moss rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move down"
                        disabled={exercises.findIndex(e => e.id === item.id) === exercises.length - 1}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        id={`btn-edit-${item.id}`}
                        onClick={() => startEdit(item)}
                        className="p-1.5 hover:bg-natural-bg text-gray-400 hover:text-natural-moss rounded-lg transition cursor-pointer"
                        aria-label="Edit routine"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        id={`btn-del-${item.id}`}
                        onClick={() => onRemoveExercise(item.id)}
                        className="p-1.5 hover:bg-natural-bg text-gray-400 hover:text-red-500 rounded-lg transition cursor-pointer"
                        aria-label="Remove routine"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-natural-bg/55 pt-3 mt-1 flex justify-end">
                  <button
                    id={`btn-load-${item.id}`}
                    onClick={() => onSelectExercise(item)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-natural-moss text-white shadow-sm'
                        : 'bg-natural-bg text-natural-moss hover:bg-natural-border'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {isActive ? 'Loaded' : 'Load into Timer'}
                  </button>
                </div>
              </motion.div>
            );
            });
          })()
        )}
      </div>

    </div>
  );
}
