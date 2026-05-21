import React, { useState } from 'react';
import { PhysioExercise } from '../types';
import { Plus, Trash2, Play, Dumbbell, Sparkles, AlertCircle, Calendar, CheckSquare, ListTodo } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PhysioScheduleProps {
  exercises: PhysioExercise[];
  activeExerciseId: string | null;
  onAddExercise: (ex: Omit<PhysioExercise, 'id'>) => void;
  onRemoveExercise: (id: string) => void;
  onSelectExercise: (ex: PhysioExercise) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PRESEEDS: Omit<PhysioExercise, 'id'>[] = [
  { 
    name: 'EMS Core Iso-Hold', 
    activeDur: 10, 
    restDur: 10, 
    targetCycles: 15, 
    repsPerSet: 10, 
    weekdays: ['Mon', 'Wed', 'Fri'], 
    weeklyTarget: 3, 
    notes: 'Focus on drawing belly button inward during stimulation' 
  },
  { 
    name: 'EMS Glute Activation', 
    activeDur: 15, 
    restDur: 8, 
    targetCycles: 12, 
    repsPerSet: 8, 
    weekdays: ['Tue', 'Thu'], 
    weeklyTarget: 2, 
    notes: 'Squeeze glutes at top of bridge during the active burst' 
  },
  { 
    name: 'Physio Quad Strengthening', 
    activeDur: 8, 
    restDur: 12, 
    targetCycles: 10, 
    repsPerSet: 12, 
    weekdays: ['Mon', 'Thu', 'Sat'], 
    weeklyTarget: 3, 
    notes: 'Fully extend knee with electrical impulse' 
  },
];

export default function PhysioSchedule({
  exercises,
  activeExerciseId,
  onAddExercise,
  onRemoveExercise,
  onSelectExercise,
}: PhysioScheduleProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form states
  const [name, setName] = useState('');
  const [activeDur, setActiveDur] = useState(15);
  const [restDur, setRestDur] = useState(15);
  const [targetCycles, setTargetCycles] = useState(10);
  const [repsPerSet, setRepsPerSet] = useState(10);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);
  const [weeklyTarget, setWeeklyTarget] = useState(3);
  const [notes, setNotes] = useState('');

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddExercise({
      name: name.trim(),
      activeDur,
      restDur,
      targetCycles,
      repsPerSet,
      weekdays: selectedDays.length > 0 ? selectedDays : undefined,
      weeklyTarget,
      notes: notes.trim() || undefined,
    });
    setName('');
    setNotes('');
    setSelectedDays(['Mon', 'Wed', 'Fri']);
    setShowAddForm(false);
  };

  const handlePreseedClick = (pre: Omit<PhysioExercise, 'id'>) => {
    onAddExercise(pre);
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
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 font-mono text-xs text-natural-moss font-semibold">
                      <span>Active: {currentObj.activeDur}s</span>
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
                        <span>Weekly Physio Goal: <strong className="text-natural-dark">{currentObj.weeklyTarget} sessions</strong> per week</span>
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
      <div className="flex justify-between items-center mt-2">
        <h3 className="text-sm font-bold text-natural-moss tracking-wider uppercase">
          Physio Program List
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-natural-moss text-white rounded-xl text-xs font-bold tracking-wide hover:bg-[#4E4E36] transition cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Custom Program
        </button>
      </div>

      {/* Interactive Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="p-5 bg-white rounded-2xl border border-natural-border flex flex-col gap-4 overflow-hidden shadow-sm"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-natural-moss">Exercise Name</label>
              <input
                type="text"
                placeholder="e.g. Quadricep Stimulation Contractions"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-natural-bg border border-natural-border rounded-xl text-natural-dark focus:outline-none focus:border-natural-moss"
              />
            </div>

            {/* Core Timings & Sets */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-natural-moss">EMS Active Stim (s)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={activeDur}
                  onChange={e => setActiveDur(Math.max(5, parseInt(e.target.value) || 0))}
                  required
                  className="w-full px-3 py-2 text-sm bg-natural-bg border border-natural-border rounded-xl text-natural-dark font-mono text-center focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-natural-moss">EMS Rest Rest (s)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={restDur}
                  onChange={e => setRestDur(Math.max(5, parseInt(e.target.value) || 0))}
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
              <label className="text-xs font-bold text-natural-moss">Therapy Notes & Physio Advice</label>
              <textarea
                placeholder="Specific guidance from your physical therapist..."
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
              Save to Program List
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Routine list */}
      <div className="flex flex-col gap-3">
        {exercises.length === 0 ? (
          <div className="text-center py-6 bg-white rounded-2xl border border-natural-border">
            <p className="text-sm text-[#70706B] font-medium">Your program list is currently empty.</p>
            <div className="mt-4 px-4">
              <span className="text-xs text-[#8B8B80] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-natural-terracotta" /> Quick Therapy Preseeds
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
          exercises.map((item) => {
            const isActive = item.id === activeExerciseId;
            return (
              <motion.div
                key={item.id}
                layout
                id={`ex-card-${item.id}`}
                className={`p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-3 ${
                  isActive 
                    ? 'bg-natural-moss/5 border-natural-moss' 
                    : 'bg-white border-natural-border'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-natural-dark text-sm leading-tight truncate">{item.name}</h4>
                    
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 font-mono text-[11px] text-[#70706B] font-semibold">
                      <span className="text-natural-moss">Active: {item.activeDur}s</span>
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

                  <button
                    id={`btn-del-${item.id}`}
                    onClick={() => onRemoveExercise(item.id)}
                    className="p-1.5 hover:bg-natural-bg text-gray-400 hover:text-red-500 rounded-lg transition ml-2 cursor-pointer flex-shrink-0"
                    aria-label="Remove routine"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
          })
        )}
      </div>

    </div>
  );
}
