import React, { useMemo } from 'react';
import { PublicActivityResponseDto } from '../../lib/api';

interface ActivityHeatmapProps {
  data: PublicActivityResponseDto | null;
}

/**
 * Parses YYYY-MM-DD date string safely into local midnight Date to prevent timezone shifts.
 */
export function parseCalendarDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return new Date();
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Formats a Date object as a YYYY-MM-DD calendar string.
 */
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateLabel(dateStr: string): string {
  try {
    const d = parseCalendarDate(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

interface HeatmapDay {
  dateStr: string;
  isActive: boolean;
  dayOfWeek: number;
}

export default function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const activeCount = useMemo(() => {
    if (!data || !Array.isArray(data.activityDates)) return 0;
    return data.activityDates.filter((d) => d.count > 0).length;
  }, [data]);

  const { weeks, monthLabels } = useMemo(() => {
    if (!data || !data.activityWindow || !data.activityWindow.startDate || !data.activityWindow.endDate) {
      return { weeks: [], monthLabels: [] };
    }

    const activeSet = new Set(
      (data.activityDates || [])
        .filter((d) => d.count > 0)
        .map((d) => d.date)
    );

    const start = parseCalendarDate(data.activityWindow.startDate);
    const end = parseCalendarDate(data.activityWindow.endDate);

    // Adjust start to preceding Sunday to align 7-row columns
    const gridStart = new Date(start);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    const days: HeatmapDay[] = [];
    const curr = new Date(gridStart);

    while (curr <= end || days.length % 7 !== 0) {
      const dateStr = formatIsoDate(curr);
      days.push({
        dateStr,
        isActive: activeSet.has(dateStr),
        dayOfWeek: curr.getDay(),
      });

      curr.setDate(curr.getDate() + 1);

      // Safety guard against infinite loops (max 400 days)
      if (days.length > 400) break;
    }

    // Chunk into 7-day weeks (columns)
    const weeksList: HeatmapDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeksList.push(days.slice(i, i + 7));
    }

    // Generate Month Labels
    const labels: Array<{ name: string; colIndex: number }> = [];
    let lastMonth = -1;

    weeksList.forEach((week, colIdx) => {
      const firstDayInWeek = parseCalendarDate(week[0].dateStr);
      const monthIdx = firstDayInWeek.getMonth();
      if (monthIdx !== lastMonth) {
        lastMonth = monthIdx;
        const name = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(firstDayInWeek);
        labels.push({ name, colIndex: colIdx });
      }
    });

    return { weeks: weeksList, monthLabels: labels };
  }, [data]);

  // Graceful empty / error state fallback
  if (!data || weeks.length === 0) {
    return (
      <div className="bg-[#161B22] p-6 rounded-2xl border border-[#30363D] shadow-xl space-y-3">
        <h2 className="text-base font-bold text-white">52-Week Activity History</h2>
        <div className="p-6 text-center bg-[#1C2128] rounded-xl border border-[#30363D]">
          <p className="text-xs text-[#8B949E]">Activity history data is currently unavailable.</p>
        </div>
      </div>
    );
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-[#161B22] p-6 rounded-2xl border border-[#30363D] shadow-xl space-y-4">
      {/* Header & Active Count Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#30363D] pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            52-Week Activity History
          </h2>
          <p className="text-xs text-[#8B949E] mt-0.5">
            Daily activity records logged across journeys, tasks, and streaks.
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/80 self-start sm:self-auto">
          {activeCount} active days in the last year
        </span>
      </div>

      {/* Overflow Container for Mobile Widths */}
      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
        <div className="min-w-[680px] space-y-2">
          {/* Month Labels Row */}
          <div className="flex text-[10px] font-mono text-[#8B949E] pl-8 space-x-1">
            {weeks.map((_, colIdx) => {
              const label = monthLabels.find((l) => l.colIndex === colIdx);
              return (
                <div key={colIdx} className="w-3 text-left overflow-visible shrink-0">
                  {label ? label.name : ''}
                </div>
              );
            })}
          </div>

          {/* Heatmap Grid: Weekday Labels + Week Columns */}
          <div className="flex gap-1">
            {/* Weekday Labels Column */}
            <div className="flex flex-col gap-1 pr-2 text-[9px] font-mono text-[#8B949E] select-none shrink-0">
              {weekdays.map((day, idx) => (
                <div key={day} className="h-3 flex items-center">
                  {idx % 2 === 1 ? day : ''}
                </div>
              ))}
            </div>

            {/* Grid Columns (Weeks) */}
            <div className="flex gap-1">
              {weeks.map((week, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-1 shrink-0">
                  {week.map((day) => {
                    const formattedDate = formatDateLabel(day.dateStr);
                    const labelText = day.isActive
                      ? `${formattedDate}: Active streak day recorded`
                      : `${formattedDate}: No activity recorded`;

                    return (
                      <div
                        key={day.dateStr}
                        tabIndex={0}
                        role="img"
                        aria-label={labelText}
                        title={labelText}
                        className={`w-3 h-3 rounded-[3px] border transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-purple-400 ${
                          day.isActive
                            ? 'bg-purple-600 border-purple-400 shadow-sm shadow-purple-950'
                            : 'bg-[#1C2128] border-[#30363D]/80 hover:border-slate-600'
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between text-[11px] text-[#8B949E] pt-2 border-t border-[#30363D]/60 font-mono">
        <span>Binary activity representation</span>
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="w-3 h-3 rounded-[3px] bg-[#1C2128] border border-[#30363D]" aria-hidden="true" />
          <div className="w-3 h-3 rounded-[3px] bg-purple-600 border border-purple-400 shadow-sm" aria-hidden="true" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
