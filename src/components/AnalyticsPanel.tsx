import { WorkoutLogEntry } from '../types';
import { Award, Calendar, Clock, BarChart3, TrendingUp, CheckCircle, Trash2, CalendarDays, CheckCircle2 } from 'lucide-react';

interface AnalyticsPanelProps {
  logs: WorkoutLogEntry[];
  onClearLogs: () => void;
}

export default function AnalyticsPanel({ logs, onClearLogs }: AnalyticsPanelProps) {
  // Calculations
  const totalCompleted = logs.length;
  const totalSeconds = logs.reduce((acc, curr) => acc + curr.totalActiveSeconds, 0);
  const totalSets = logs.reduce((acc, curr) => acc + curr.cyclesCompleted, 0);
  
  const formatDuration = (totalSecs: number) => {
    if (totalSecs < 60) return `${totalSecs}s`;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Group by day of week (last 7 days helper)
  const getWeeklyProgress = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      return {
        dayLabel: days[d.getDay()],
        dateStr: d.toLocaleDateString(),
        count: 0,
      };
    });

    logs.forEach(log => {
      const logDate = new Date(log.timestamp).toLocaleDateString();
      const found = result.find(r => r.dateStr === logDate);
      if (found) {
        found.count += 1;
      }
    });

    return result;
  };

  // Monthly logic (completed in last 30 days)
  const getMonthlyProgress = () => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const monthlySessions = logs.filter(log => log.timestamp >= thirtyDaysAgo.getTime());
    return {
      completedCount: monthlySessions.length,
      activeSeconds: monthlySessions.reduce((acc, curr) => acc + curr.totalActiveSeconds, 0),
    };
  };

  const weeklyData = getWeeklyProgress();
  const maxDailyCount = Math.max(...weeklyData.map(d => d.count), 1);

  // Weekly compliance (Target: 4 sessions/week)
  const daysWithWorkoutsThisWeek = weeklyData.filter(d => d.count > 0).length;
  const targetWeeklyWorkouts = 4;
  const weeklyCompliancePercent = Math.min(100, Math.round((daysWithWorkoutsThisWeek / targetWeeklyWorkouts) * 100));

  // Monthly compliance (Target: 16 sessions/month)
  const monthlyData = getMonthlyProgress();
  const targetMonthlyWorkouts = 16;
  const monthlyCompliancePercent = Math.min(100, Math.round((monthlyData.completedCount / targetMonthlyWorkouts) * 100));

  return (
    <div className="w-full flex flex-col gap-6 text-natural-dark">
      
      {/* 1. Key Metrics Blocks */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[#70706B] font-semibold text-[11px] uppercase tracking-wider">
            <Award className="w-3.5 h-3.5 text-natural-terracotta" />
            Total Completed
          </div>
          <span className="text-2xl font-black font-display text-natural-dark">{totalCompleted} Sessions</span>
          <span className="text-[10px] text-[#8B8B80]">{totalSets} sets simulated</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[#70706B] font-semibold text-[11px] uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-natural-moss" />
            Active Time
          </div>
          <span className="text-2xl font-black font-display text-natural-dark">{formatDuration(totalSeconds)}</span>
          <span className="text-[10px] text-[#8B8B80]">Constant stimulation</span>
        </div>
      </div>

      {/* 2. Goal Comparison Panel: Weekly vs Monthly */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-4">
        <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-natural-moss" />
          Physio Progress Goals
        </h3>

        <div className="flex flex-col gap-4">
          {/* Weekly Goal progress */}
          <div className="flex flex-col gap-2 p-3 bg-natural-bg/50 border border-natural-border rounded-xl">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-natural-dark flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-natural-moss" />
                Weekly Goal
              </span>
              <span className="font-mono font-bold text-natural-moss">
                {daysWithWorkoutsThisWeek} / {targetWeeklyWorkouts} Days
              </span>
            </div>
            
            <div className="w-full h-2.5 bg-natural-border rounded-full overflow-hidden shadow-inner relative">
              <div
                style={{ width: `${weeklyCompliancePercent}%` }}
                className="h-full bg-natural-moss rounded-full transition-all duration-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>{weeklyCompliancePercent}% Goal Met</span>
              <span>Target: {targetWeeklyWorkouts} sessions/week</span>
            </div>
          </div>

          {/* Monthly Goal progress */}
          <div className="flex flex-col gap-2 p-3 bg-natural-bg/50 border border-natural-border rounded-xl">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-natural-dark flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-natural-terracotta" />
                Monthly Goal (L-30 Days)
              </span>
              <span className="font-mono font-bold text-natural-terracotta">
                {monthlyData.completedCount} / {targetMonthlyWorkouts} Days
              </span>
            </div>
            
            <div className="w-full h-2.5 bg-natural-border rounded-full overflow-hidden shadow-inner relative">
              <div
                style={{ width: `${monthlyCompliancePercent}%` }}
                className="h-full bg-natural-terracotta rounded-full transition-all duration-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>{monthlyCompliancePercent}% Goal Met</span>
              <span>Target: {targetMonthlyWorkouts} sessions/month</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. L-7 Days Frequency Tracker */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-4 font-sans">
        <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-natural-moss" />
          Weekly Frequency Calendar
        </h3>

        {/* Custom bar chart with pure JSX */}
        <div className="flex justify-between items-end h-28 pt-4 pb-1 border-b border-natural-border px-2">
          {weeklyData.map((d, i) => {
            const heightPercent = maxDailyCount > 0 ? (d.count / maxDailyCount) * 100 : 0;
            const hasData = d.count > 0;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 w-8">
                <div className="w-full flex justify-center h-20 items-end">
                  <div
                    style={{ height: hasData ? `${Math.max(15, heightPercent)}%` : '4px' }}
                    className={`w-3.5 rounded-t-full transition-all duration-300 ${
                      hasData ? 'bg-natural-moss' : 'bg-natural-border hover:bg-[#C2C2B8]'
                    }`}
                  />
                </div>
                {hasData && (
                  <span className="text-[9px] font-bold font-mono text-natural-moss bg-natural-moss/10 px-1 rounded">
                    {d.count}
                  </span>
                )}
                <span className={`text-[10px] font-bold tracking-tight ${hasData ? 'text-natural-dark font-semibold' : 'text-slate-400'}`}>
                  {d.dayLabel}
                </span>
              </div>
            );
          })}
        </div>
        
        <p className="text-[11px] text-[#70706B] leading-relaxed flex items-center gap-1.5 px-1 bg-natural-bg p-2 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-natural-moss flex-shrink-0" />
          You completed workouts on <strong className="text-natural-dark">{daysWithWorkoutsThisWeek} of 7</strong> days this week. Goal is 4 separate days.
        </p>
      </div>

      {/* 4. Detailed Program History Logs */}
      <div className="p-5 bg-white rounded-2xl border border-natural-border shadow-sm flex flex-col gap-4 font-sans">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-natural-moss tracking-wider uppercase flex items-center gap-2">
            <Calendar className="w-4 h-4 text-natural-moss" />
            Program History Log
          </h3>
          {logs.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear your local therapy history log?')) {
                  onClearLogs();
                }
              }}
              className="text-[10px] tracking-wide font-bold text-red-500 hover:text-red-700 font-sans transition flex items-center gap-0.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              CLEAR ALL
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <div className="text-center py-8 bg-natural-bg/50 border border-dashed border-natural-border rounded-xl">
              <p className="text-xs text-slate-500">Every completion writes a local log. Start training to write historical traces.</p>
            </div>
          ) : (
            [...logs].reverse().map((log) => {
              const dt = new Date(log.timestamp);
              const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

              return (
                <div
                  key={log.id}
                  className="p-3 bg-natural-bg rounded-xl border border-natural-border flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-natural-moss flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-natural-dark truncate">{log.exerciseName}</div>
                      <div className="text-slate-400 mt-0.5 text-[10px] flex items-center gap-2 flex-wrap">
                        <span>{dateStr} • {timeStr}</span>
                        <span>•</span>
                        <span>{log.cyclesCompleted} sets</span>
                      </div>
                    </div>
                  </div>
                  <div className="font-bold font-mono text-natural-moss shrink-0 whitespace-nowrap">
                    +{log.totalActiveSeconds}s
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
