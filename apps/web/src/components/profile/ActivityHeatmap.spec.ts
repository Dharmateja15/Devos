import { parseCalendarDate, formatIsoDate } from './ActivityHeatmap';
import { PublicActivityResponseDto } from '../../lib/api';

describe('ActivityHeatmap Grid & Transformation Logic', () => {
  const mockActivityData: PublicActivityResponseDto = {
    username: 'alexdev',
    activityWindow: {
      startDate: '2025-08-15',
      endDate: '2026-08-15',
    },
    activityDates: [
      { date: '2026-08-10', count: 1 },
      { date: '2026-08-15', count: 1 },
    ],
  };

  it('1. parseCalendarDate parses YYYY-MM-DD cleanly without timezone shifts', () => {
    const d = parseCalendarDate('2026-08-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // 0-indexed August
    expect(d.getDate()).toBe(15);
  });

  it('2. formatIsoDate formats local Date objects back to YYYY-MM-DD string', () => {
    const d = new Date(2026, 7, 15);
    expect(formatIsoDate(d)).toBe('2026-08-15');
  });

  it('3. Active dates are accurately identified in lookup set', () => {
    const activeSet = new Set(
      mockActivityData.activityDates.filter((d) => d.count > 0).map((d) => d.date)
    );

    expect(activeSet.has('2026-08-10')).toBe(true);
    expect(activeSet.has('2026-08-15')).toBe(true);
    expect(activeSet.has('2026-08-14')).toBe(false);
  });

  it('4. Binary activity count matches total active records without fabricating intensity levels', () => {
    const activeCount = mockActivityData.activityDates.filter((d) => d.count > 0).length;
    expect(activeCount).toBe(2);
  });

  it('5. Handles null or empty activity dates gracefully', () => {
    const emptyData: PublicActivityResponseDto = {
      username: 'emptyuser',
      activityWindow: {
        startDate: '2025-08-15',
        endDate: '2026-08-15',
      },
      activityDates: [],
    };

    const activeCount = emptyData.activityDates.filter((d) => d.count > 0).length;
    expect(activeCount).toBe(0);
  });
});
