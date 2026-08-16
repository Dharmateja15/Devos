import { formatSourceType, formatDate } from './page';
import { calculateLevelFromXp } from '../../lib/utils/level-calculator';

describe('XP Page Presentation Logic', () => {
  it('1. formatSourceType correctly maps known sourceType strings', () => {
    expect(formatSourceType('TASK_COMPLETION')).toBe('Task Completed');
    expect(formatSourceType('MILESTONE_COMPLETION')).toBe('Milestone Completed');
    expect(formatSourceType('JOURNEY_COMPLETION')).toBe('Journey Completed');
    expect(formatSourceType('EVIDENCE_SUBMISSION')).toBe('Evidence Verified');
    expect(formatSourceType('ACHIEVEMENT_UNLOCKED')).toBe('Achievement Unlocked');
  });

  it('2. formatSourceType safely formats unknown source types without crashing', () => {
    expect(formatSourceType('CUSTOM_BONUS_REWARD')).toBe('Custom Bonus Reward');
    expect(formatSourceType('')).toBe('Activity Record');
  });

  it('3. formatDate handles valid ISO timestamps and fallbacks safely', () => {
    const formatted = formatDate('2026-08-15T12:00:00Z');
    expect(formatted).toContain('2026');
    expect(formatDate('')).toBe('Recent');
  });

  it('4. Level progress presentation derives correctly from totalXp', () => {
    const mockTotalXp = 250;
    const levelInfo = calculateLevelFromXp(mockTotalXp);

    expect(levelInfo.level).toBe(3);
    expect(levelInfo.title).toBe('Practitioner');
    expect(levelInfo.progressPercent).toBe(0);
  });
});
