import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, BookOpen, Award, Calendar, BarChart3, TrendingUp, CheckCircle, Flame, Star, Percent } from 'lucide-react';
import { Course, UserStats, Video, StudyHistoryItem } from '../types';

interface FocusDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
  activeCourse: Course | null;
  courses: Course[];
}

export default function FocusDetailModal({
  isOpen,
  onClose,
  stats,
  activeCourse,
  courses,
}: FocusDetailModalProps) {
  const [timeRange, setTimeRange] = useState<'7days' | 'all'>('7days');

  // Helper: Format focus seconds into human-readable hours and mins
  const formatTime = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds <= 0) return '0m';
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Helper: Format focus seconds into decimal hours (for charts)
  const formatTimeDecimal = (totalSeconds: number) => {
    return parseFloat((totalSeconds / 3600).toFixed(2));
  };

  // Helper: Get past dates
  const getLast7Days = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      dates.push({
        dateStr,
        label: weekdays[d.getDay()],
        dayNum: d.getDate(),
      });
    }
    return dates;
  };

  // Aggregation 1: Focus seconds spent per course
  const statsPerCourse = useMemo(() => {
    const map: Record<string, { seconds: number; xp: number; name: string }> = {};
    
    // Seed all known courses with 0 seconds
    courses.forEach(c => {
      map[c.id] = { seconds: 0, xp: 0, name: c.name };
    });

    if (stats.history) {
      stats.history.forEach(item => {
        if (!map[item.courseId]) {
          map[item.courseId] = { seconds: 0, xp: 0, name: item.courseName || 'Deleted Course' };
        }
        map[item.courseId].seconds += item.focusSeconds || 0;
        map[item.courseId].xp += item.xpEarned || 0;
      });
    }

    return Object.entries(map).map(([courseId, data]) => ({
      courseId,
      ...data,
    })).sort((a, b) => b.seconds - a.seconds);
  }, [stats.history, courses]);

  // Aggregation 2: Daily focus minutes for the last 7 days (all courses vs active course)
  const dailyFocusData = useMemo(() => {
    const past7 = getLast7Days();
    return past7.map(day => {
      let activeCourseSeconds = 0;
      let totalSeconds = 0;

      if (stats.history) {
        stats.history.forEach(item => {
          if (item.date === day.dateStr) {
            totalSeconds += item.focusSeconds || 0;
            if (activeCourse && item.courseId === activeCourse.id) {
              activeCourseSeconds += item.focusSeconds || 0;
            }
          }
        });
      }

      return {
        ...day,
        activeMins: Math.round(activeCourseSeconds / 60),
        totalMins: Math.round(totalSeconds / 60),
      };
    });
  }, [stats.history, activeCourse]);

  // Aggregation 3: Focus minutes spent on each lesson of the current active course
  const activeCourseLessonsData = useMemo(() => {
    if (!activeCourse) return [];

    return activeCourse.videos.map((video, index) => {
      let secondsSpent = 0;
      let completionsCount = 0;
      let xpEarned = 0;

      if (stats.history) {
        stats.history.forEach(item => {
          if (item.courseId === activeCourse.id && item.videoId === video.id) {
            secondsSpent += item.focusSeconds || 0;
            xpEarned += item.xpEarned || 0;
          }
        });
      }

      return {
        id: video.id,
        title: video.title,
        completed: video.completed,
        secondsSpent,
        xpEarned,
        lessonNumber: index + 1,
        completionFootagesCount: video.completionFootages?.length || (video.completionFootageUrl ? 1 : 0),
      };
    });
  }, [stats.history, activeCourse]);

  // Aggregate and group clocked-in unique days chronologically
  const uniqueClockedInDays = useMemo(() => {
    if (!stats.history) return [];
    const datesSet = new Set<string>();
    stats.history.forEach(item => {
      if (item.date) datesSet.add(item.date);
    });
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a)); // Descending
  }, [stats.history]);

  // Group study history items by date for quick calendar popovers/tooltips
  const historyByDate = useMemo(() => {
    const map: Record<string, StudyHistoryItem[]> = {};
    if (stats.history) {
      stats.history.forEach(item => {
        if (!item.date) return;
        if (!map[item.date]) {
          map[item.date] = [];
        }
        map[item.date].push(item);
      });
    }
    return map;
  }, [stats.history]);

  // Extract all Year-Month buckets representation for visual calendar blocks
  const monthlyCalendars = useMemo(() => {
    const list: { year: number; month: number; monthName: string; key: string; activeDates: Set<string> }[] = [];
    const keysSet = new Set<string>();

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    if (stats.history) {
      stats.history.forEach(item => {
        if (!item.date) return;
        const [yStr, mStr] = item.date.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10) - 1; // 0-indexed
        if (isNaN(y) || isNaN(m)) return;
        
        const key = `${y}-${m}`;
        if (!keysSet.has(key)) {
          keysSet.add(key);
          list.push({
            year: y,
            month: m,
            monthName: monthNames[m],
            key,
            activeDates: new Set<string>()
          });
        }
      });
    }

    // Sort descending by Year and Month
    list.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    // Populate activeDates set for quick checks
    if (stats.history) {
      stats.history.forEach(item => {
        if (!item.date) return;
        const [yStr, mStr] = item.date.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10) - 1;
        const key = `${y}-${m}`;
        const found = list.find(l => l.key === key);
        if (found) {
          found.activeDates.add(item.date);
        }
      });
    }

    return list;
  }, [stats.history]);

  // Helper utility to make a grid representing days of a specific year and month (Monday - Sunday standard layout)
  const getDaysInMonthArray = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday, etc.
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const days = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      const paddedDay = String(i).padStart(2, '0');
      const paddedMonth = String(month + 1).padStart(2, '0');
      const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
      days.push({
        dayNum: i,
        dateStr,
      });
    }
    return days;
  };

  // General course specific stats
  const activeCourseStats = useMemo(() => {
    if (!activeCourse) return null;

    let secondsOnActive = 0;
    let xpOnActive = 0;
    if (stats.history) {
      stats.history.forEach(item => {
        if (item.courseId === activeCourse.id) {
          secondsOnActive += item.focusSeconds || 0;
          xpOnActive += item.xpEarned || 0;
        }
      });
    }

    const totalLessons = activeCourse.videos.length;
    const completedLessons = activeCourse.videos.filter(v => v.completed).length;
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      name: activeCourse.name,
      secondsSpent: secondsOnActive,
      xpEarned: xpOnActive,
      totalLessons,
      completedLessons,
      progressPercent,
    };
  }, [stats.history, activeCourse]);

  // Render variables for SVG Charts
  const maxDailyMins = Math.max(...dailyFocusData.map(d => d.totalMins), 10);
  const chartHeight = 160;
  const chartWidth = 500;
  const paddingX = 40;
  const paddingY = 20;

  // Compute SVG Points for 7-day Line Chart
  const linePoints = useMemo(() => {
    const points: string[] = [];
    const stepX = (chartWidth - paddingX * 2) / 6;
    
    dailyFocusData.forEach((d, idx) => {
      const x = paddingX + idx * stepX;
      // Map minutes to height (invert Y because 0 is top)
      const y = chartHeight - paddingY - (d.totalMins / maxDailyMins) * (chartHeight - paddingY * 2);
      points.push(`${x},${y}`);
    });

    return points.join(' ');
  }, [dailyFocusData, maxDailyMins]);

  // Compute SVG Points for Active Course (secondary line if applicable)
  const activeLinePoints = useMemo(() => {
    if (!activeCourse) return '';
    const points: string[] = [];
    const stepX = (chartWidth - paddingX * 2) / 6;
    
    dailyFocusData.forEach((d, idx) => {
      const x = paddingX + idx * stepX;
      const y = chartHeight - paddingY - (d.activeMins / maxDailyMins) * (chartHeight - paddingY * 2);
      points.push(`${x},${y}`);
    });

    return points.join(' ');
  }, [dailyFocusData, maxDailyMins, activeCourse]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="focus-stats-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/85 backdrop-blur-sm p-4 font-sans select-none overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          id="focus-stats-modal-card"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-[#131f24] border-2 border-neutral-200 dark:border-[#202f36] rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6 md:space-y-8 relative scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-750"
        >
          {/* Close button */}
          <button
            id="close-focus-modal-btn"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-[#1c2a30] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-2xl transition-all cursor-pointer"
            title="Close focus dynamics dashboard"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Header block */}
          <div className="space-y-1 text-left">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-sky-500/10 dark:bg-sky-500/15 rounded-2xl text-sky-500 shrink-0">
                <BarChart3 className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-2xl font-black text-neutral-800 dark:text-neutral-105 tracking-tight leading-none">Focus Dynamics</h2>
                <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 tracking-widest uppercase mt-1 leading-none">
                  Nitty-Gritty Study Metrics & Analytics
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top Stat Pills */}
            <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center space-x-3.5 text-left">
              <div className="p-2.5 bg-sky-500 rounded-xl text-white">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-extrabold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Total Focused</p>
                <h4 className="text-lg font-black text-neutral-800 dark:text-white leading-none mt-1">
                  {formatTime(stats.totalFocusSeconds)}
                </h4>
                <p className="text-[9px] text-sky-650 dark:text-sky-400 font-bold mt-1">Across all training tracks</p>
              </div>
            </div>

            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center space-x-3.5 text-left">
              <div className="p-2.5 bg-orange-500 rounded-xl text-white">
                <Flame className="w-5 h-5 fill-white" />
              </div>
              <div>
                <p className="text-[9px] font-extrabold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Day Streak</p>
                <h4 className="text-lg font-black text-neutral-800 dark:text-white leading-none mt-1">
                  {stats.streak} Days
                </h4>
                <p className="text-[9px] text-orange-650 dark:text-orange-400 font-bold mt-1">Keep the lockpost burning!</p>
              </div>
            </div>

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center space-x-3.5 text-left">
              <div className="p-2.5 bg-emerald-500 rounded-xl text-white">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-extrabold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Total Experience</p>
                <h4 className="text-lg font-black text-neutral-800 dark:text-white leading-none mt-1">
                  {stats.xp} XP
                </h4>
                <p className="text-[9px] text-emerald-650 dark:text-emerald-400 font-bold mt-1">Level {stats.level} achieved</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            {/* LEFT Panel (8 Cols): 7-Day Chart & Active Course Breakdown */}
            <div className="lg:col-span-8 space-y-6 text-left">
              
              {/* SVG 7-Day Trend Chart */}
              <div className="bg-white dark:bg-[#131f24] border border-neutral-200 dark:border-[#202f36] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-neutral-800 dark:text-slate-200 tracking-tight">Weekly Focus Progress</h3>
                    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wide mt-0.5 uppercase">
                      Minutes study time tracked per day
                    </p>
                  </div>
                  <div className="flex items-center space-x-3 text-[10px] font-bold uppercase shrink-0">
                    <span className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                      <span className="text-neutral-500 dark:text-neutral-450">Total Time</span>
                    </span>
                    {activeCourse && (
                      <span className="flex items-center space-x-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                        <span className="text-neutral-500 dark:text-neutral-450">Active Course</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* SVG Graph Drawing */}
                <div className="w-full relative min-h-[160px]">
                  <svg 
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                    className="w-full h-40 overflow-visible text-neutral-300 dark:text-neutral-850"
                  >
                    {/* Definitions for gradients */}
                    <defs>
                      <linearGradient id="totalColorGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="activeColorGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb923c" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#fb923c" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>

                    {/* Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((val, i) => {
                      const y = paddingY + val * (chartHeight - paddingY * 2);
                      const gridMins = Math.round(maxDailyMins * (1 - val));
                      return (
                        <g key={i} className="opacity-45 dark:opacity-20">
                          <line 
                            x1={paddingX} 
                            y1={y} 
                            x2={chartWidth - paddingX} 
                            y2={y} 
                            stroke="currentColor" 
                            strokeWidth="1.2" 
                            strokeDasharray="4 4" 
                          />
                          <text 
                            x={paddingX - 8} 
                            y={y + 3} 
                            textAnchor="end" 
                            className="font-mono text-[9px] font-extrabold fill-neutral-400 dark:fill-neutral-500"
                          >
                            {gridMins}m
                          </text>
                        </g>
                      );
                    })}

                    {/* Filled Area Gradients */}
                    {linePoints && (
                      <path 
                        d={`M ${paddingX},${chartHeight - paddingY} L ${linePoints} L ${chartWidth - paddingX},${chartHeight - paddingY} Z`} 
                        fill="url(#totalColorGrad)" 
                      />
                    )}
                    {activeLinePoints && (
                      <path 
                        d={`M ${paddingX},${chartHeight - paddingY} L ${activeLinePoints} L ${chartWidth - paddingX},${chartHeight - paddingY} Z`} 
                        fill="url(#activeColorGrad)" 
                      />
                    )}

                    {/* Line plots */}
                    <polyline 
                      fill="none" 
                      stroke="#0ea5e9" 
                      strokeWidth="2.5" 
                      points={linePoints} 
                      className="drop-shadow-[0_2px_4px_rgba(14,165,233,0.3)]"
                    />

                    {activeCourse && activeLinePoints && (
                      <polyline 
                        fill="none" 
                        stroke="#fb923c" 
                        strokeWidth="2.5" 
                        points={activeLinePoints} 
                        className="drop-shadow-[0_2px_4px_rgba(251,146,60,0.3)]"
                      />
                    )}

                    {/* Data circle points on chart */}
                    {dailyFocusData.map((d, idx) => {
                      const stepX = (chartWidth - paddingX * 2) / 6;
                      const x = paddingX + idx * stepX;
                      const yTotal = chartHeight - paddingY - (d.totalMins / maxDailyMins) * (chartHeight - paddingY * 2);
                      const yActive = chartHeight - paddingY - (d.activeMins / maxDailyMins) * (chartHeight - paddingY * 2);
                      
                      return (
                        <g key={idx}>
                          {/* Inner / outer circles */}
                          <circle cx={x} cy={yTotal} r="3.5" className="fill-sky-500 stroke-white dark:stroke-[#131f24] stroke-2" />
                          {activeCourse && d.activeMins > 0 && (
                            <circle cx={x} cy={yActive} r="3.5" className="fill-orange-400 stroke-white dark:stroke-[#131f24] stroke-2" />
                          )}
                          
                          {/* Date X labels */}
                          <text 
                            x={x} 
                            y={chartHeight - paddingY + 16} 
                            textAnchor="middle" 
                            className="font-bold text-[10px] fill-neutral-500 dark:fill-neutral-400"
                          >
                            {d.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Active Course Details Breakdown */}
              <div className="bg-white dark:bg-[#131f24] border border-neutral-200 dark:border-[#202f36] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-[#202f36] pb-3">
                  <div>
                    <h3 className="text-sm font-black text-neutral-800 dark:text-slate-200 tracking-tight">Active Course: {activeCourse?.name || 'No Selected Course'}</h3>
                    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wide uppercase mt-0.5">
                      Focus seconds logged per lesson
                    </p>
                  </div>
                  {activeCourseStats && (
                    <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {activeCourseStats.progressPercent}% DONE
                    </span>
                  )}
                </div>

                {!activeCourse ? (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 py-6 text-center font-bold">
                    No active course layout selected. Please choose a course to review its breakdowns.
                  </p>
                ) : activeCourseLessonsData.length === 0 ? (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 py-6 text-center font-bold">
                    This course does not have any lessons scheduled.
                  </p>
                ) : (
                  <div className="space-y-4 max-h-72 overflow-y-auto pr-1.5 scrollbar-thin">
                    {activeCourseLessonsData.map((lesson) => {
                      const maxLessonSeconds = Math.max(...activeCourseLessonsData.map(l => l.secondsSpent), 1);
                      const relativeWidth = Math.max(2, Math.round((lesson.secondsSpent / maxLessonSeconds) * 100));
                      
                      return (
                        <div key={lesson.id} className="space-y-1.5 border-b border-neutral-50/50 dark:border-neutral-800/20 pb-3 last:border-0 last:pb-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <h4 className="text-[11px] font-extrabold text-neutral-700 dark:text-slate-300 leading-tight flex items-center gap-1.5">
                                <span className="bg-neutral-100 dark:bg-[#18252d] text-neutral-500 px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0">
                                  #{lesson.lessonNumber}
                                </span>
                                <span className="truncate">{lesson.title}</span>
                              </h4>
                              <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase flex items-center gap-2">
                                <span>XP Earned: {lesson.xpEarned} XP</span>
                                <span>•</span>
                                <span>Footages: {lesson.completionFootagesCount}</span>
                              </p>
                            </div>
                            
                            <div className="text-right shrink-0">
                              <div className="text-[10px] font-black font-mono text-neutral-800 dark:text-neutral-200">
                                {formatTime(lesson.secondsSpent)}
                              </div>
                              <div className="text-[8px] font-black uppercase mt-0.5">
                                {lesson.completed ? (
                                  <span className="text-emerald-500 flex items-center gap-0.5 justify-end">
                                    <CheckCircle className="w-2.5 h-2.5" /> Checked
                                  </span>
                                ) : (
                                  <span className="text-neutral-401 dark:text-slate-500">Incomplete</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Horizontal mini bar visualizer for focus duration */}
                          <div className="w-full bg-gray-100 dark:bg-neutral-[#18252d]/60 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${lesson.completed ? 'bg-emerald-500' : 'bg-orange-400'}`} 
                              style={{ width: `${relativeWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Annual & Monthly Clock-In Registry (Aesthetic Calendar Grid) */}
              <div id="attendance-calendar-registry" className="bg-white dark:bg-[#131f24] border border-neutral-200 dark:border-[#202f36] rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-100 dark:border-[#202f36] pb-3 gap-2">
                  <div>
                    <h3 className="text-sm font-black text-neutral-800 dark:text-slate-200 tracking-tight flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[var(--theme-primary)]" />
                      <span>Clocked-In Calendar Registry</span>
                    </h3>
                    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mt-0.5">
                      Daily focus check-ins over months and years
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-sky-500 bg-sky-500/10 px-3 py-1 rounded-full uppercase tracking-wider w-fit">
                    Checked In: {uniqueClockedInDays.length} {uniqueClockedInDays.length === 1 ? 'Day' : 'Days'}
                  </span>
                </div>

                {monthlyCalendars.length === 0 ? (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 py-6 text-center font-bold">
                    No focus sessions logged over any year or month yet. Get to study classes to paint your custom calendar!
                  </p>
                ) : (
                  <div className="space-y-6">
                    {monthlyCalendars.map((cal) => {
                      const days = getDaysInMonthArray(cal.year, cal.month);
                      const weekdaysAbbr = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

                      return (
                        <div key={cal.key} className="space-y-3 p-4 bg-neutral-50/45 dark:bg-[#18252d]/20 border border-neutral-100/50 dark:border-[#202f36]/40 rounded-xl">
                          {/* Calendar month/year name title banner */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-neutral-700 dark:text-slate-200 tracking-tight flex items-center gap-1">
                              <span>{cal.monthName} {cal.year}</span>
                            </span>
                            <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                              {cal.activeDates.size} days active
                            </span>
                          </div>

                          {/* Grid for days of the week header */}
                          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] font-black text-neutral-400 dark:text-slate-500 select-none pb-1.5 border-b border-neutral-100/35 dark:border-neutral-800/15">
                            {weekdaysAbbr.map((day, idx) => (
                              <div key={idx} className="w-full text-center">{day}</div>
                            ))}
                          </div>

                          {/* Calendar days grid cells (7 cols) */}
                          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                            {days.map((day, idx) => {
                              if (!day) return <div key={idx} className="aspect-square bg-transparent rounded-lg" />;

                              const isActive = cal.activeDates.has(day.dateStr);
                              const details = historyByDate[day.dateStr] || [];
                              const totalSecsOnDay = details.reduce((acc, current) => acc + (current.focusSeconds || 0), 0);
                              const xpOnDay = details.reduce((acc, current) => acc + (current.xpEarned || 0), 0);

                              return (
                                <div 
                                  key={idx} 
                                  className="relative group aspect-square flex flex-col items-center justify-center"
                                >
                                  {/* Calendar Day Button/Cell with interactive tooltips */}
                                  <div 
                                    className={`w-full h-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-black font-mono transition-all border ${
                                      isActive 
                                        ? 'bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/85 text-white shadow-sm border-[var(--theme-primary)] scale-105 cursor-pointer' 
                                        : 'bg-white dark:bg-[#131f24] hover:bg-neutral-100 dark:hover:bg-[#18252d] text-neutral-500 dark:text-neutral-350 border-neutral-200/55 dark:border-[#202f36]/40'
                                    }`}
                                  >
                                    {day.dayNum}
                                  </div>

                                  {/* Tooltip content box displaying on hovered dates */}
                                  <div className="absolute bottom-[115%] hidden group-hover:flex flex-col bg-neutral-900 text-white rounded-lg p-2.5 shadow-xl text-[9px] font-sans border border-neutral-750/50 w-44 z-50 pointer-events-none transition-all leading-relaxed left-1/2 -translate-x-1/2">
                                    <div className="font-extrabold pb-1 border-b border-neutral-800 text-slate-100 uppercase tracking-widest flex items-center justify-between">
                                      <span>{day.dateStr}</span>
                                      {isActive && (
                                        <span className="text-emerald-400 font-extrabold text-[8px]">CLOCKED IN</span>
                                      )}
                                    </div>
                                    {isActive ? (
                                      <div className="space-y-1 mt-1 text-left">
                                        <p className="text-neutral-300 font-extrabold truncate">
                                          Lessons: {details.length}
                                        </p>
                                        <p className="text-neutral-400 font-bold">
                                          Session Focus: <span className="font-mono text-amber-400">{formatTime(totalSecsOnDay)}</span>
                                        </p>
                                        <p className="text-neutral-400 font-bold">
                                          XP Collected: <span className="font-mono text-emerald-400">+{xpOnDay} XP</span>
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-neutral-400 mt-1 dark:text-neutral-450 italic font-bold">No sessions logged for this date.</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT Panel (4 Cols): Course Breakdown Summary & Comparison */}
            <div className="lg:col-span-4 space-y-6 text-left">
              
              <div className="bg-white dark:bg-[#131f24] border border-neutral-200 dark:border-[#202f36] rounded-2xl p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-neutral-800 dark:text-slate-200 tracking-tight">Syllabus Breakdown</h3>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none mt-0.5">
                    Time logged per subject course
                  </p>
                </div>

                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                  {statsPerCourse.map((item) => {
                    const totalAcrossAll = Math.max(...statsPerCourse.map(s => s.seconds), 1);
                    const percentTotal = Math.round((item.seconds / totalAcrossAll) * 100);
                    const isActive = activeCourse && item.courseId === activeCourse.id;

                    return (
                      <div 
                        key={item.courseId} 
                        className={`p-3 rounded-xl border transition-all ${
                          isActive 
                            ? 'bg-orange-500/5 border-orange-500/25 ring-1 ring-orange-500/10' 
                            : 'bg-neutral-50/50 dark:bg-[#18252d]/25 border-neutral-100 dark:border-neutral-850/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-extrabold text-neutral-750 dark:text-slate-350 truncate flex-1 leading-snug">
                            {item.name}
                          </span>
                          <span className="font-mono font-black text-neutral-800 dark:text-neutral-205 shrink-0 pl-1">
                            {formatTime(item.seconds)}
                          </span>
                        </div>

                        {/* Bar chart indicator */}
                        <div className="w-full bg-neutral-100 dark:bg-neutral-[#18252d]/40 rounded-full h-1.5 overflow-hidden mt-2">
                          <div 
                            className={`h-full rounded-full ${isActive ? 'bg-orange-400' : 'bg-sky-500'}`} 
                            style={{ width: `${Math.max(2, percentTotal)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[9px] font-bold text-neutral-400 dark:text-neutral-500 mt-1 uppercase">
                          <span>{item.xp} XP collected</span>
                          {isActive && <span className="text-orange-500 font-extrabold">Active Target</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Nitty Gritty Stats Card */}
              <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900/40 dark:to-neutral-900/15 border border-neutral-200 dark:border-[#202f36] rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none">
                  Analytics Insights
                </h3>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-slate-400 font-bold">Study sessions logged:</span>
                    <span className="font-black font-mono text-neutral-850 dark:text-white">
                      {stats.history ? stats.history.length : 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-200/45 dark:border-neutral-800/45 pt-2.5">
                    <span className="text-neutral-500 dark:text-slate-400 font-bold">Total courses enrolled:</span>
                    <span className="font-black font-mono text-neutral-850 dark:text-white">
                      {courses.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-200/45 dark:border-neutral-800/45 pt-2.5">
                    <span className="text-neutral-500 dark:text-slate-400 font-bold">Avg focus per session:</span>
                    <span className="font-black font-mono text-neutral-850 dark:text-white">
                      {stats.history && stats.history.length > 0 
                        ? formatTime(Math.round(stats.history.reduce((acc, h) => acc + (h.focusSeconds || 0), 0) / stats.history.length))
                        : '0s'
                      }
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-200/45 dark:border-neutral-800/45 pt-2.5">
                    <span className="text-neutral-500 dark:text-slate-400 font-bold">Max session duration:</span>
                    <span className="font-black font-mono text-neutral-850 dark:text-white">
                      {stats.history && stats.history.length > 0
                        ? formatTime(Math.max(...stats.history.map(h => h.focusSeconds || 0)))
                        : '0s'
                      }
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
