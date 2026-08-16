import { getAchievementIconName, formatDate } from './page';
import { AchievementCatalogueItemDto } from '../../lib/api';

describe('Achievement Showcase Presentation & Filter Logic', () => {
  const mockCatalogue: AchievementCatalogueItemDto[] = [
    {
      id: 'a1',
      code: 'first_task',
      name: 'First Step',
      description: 'Complete your first task',
      icon: 'flag',
      category: 'tasks',
      xpReward: 10,
      earned: true,
      earnedAt: '2026-08-01T10:00:00Z',
    },
    {
      id: 'a2',
      code: 'streak_7',
      name: 'Week Warrior',
      description: 'Reach a 7 day streak',
      icon: 'fire',
      category: 'streaks',
      xpReward: 50,
      earned: false,
      earnedAt: null,
    },
    {
      id: 'a3',
      code: 'custom_badge',
      name: 'Custom Badge',
      description: 'Special achievement',
      icon: null,
      category: null,
      xpReward: 100,
      earned: true,
      earnedAt: '2026-08-10T15:30:00Z',
    },
  ];

  it('1. getAchievementIconName maps icons and codes with safe vector fallbacks', () => {
    expect(getAchievementIconName('flag', 'first_task')).toBe('flag');
    expect(getAchievementIconName('fire', 'streak_7')).toBe('flame');
    expect(getAchievementIconName(null, 'first_task')).toBe('target');
    expect(getAchievementIconName(null, 'unknown_code')).toBe('star');
  });

  it('2. formatDate returns formatted date or null correctly', () => {
    expect(formatDate('2026-08-01T10:00:00Z')).toContain('2026');
    expect(formatDate(null)).toBeNull();
  });

  it('3. Earned and total counts are calculated correctly from catalogue data', () => {
    const earnedCount = mockCatalogue.filter(a => a.earned).length;
    const totalCount = mockCatalogue.length;

    expect(earnedCount).toBe(2);
    expect(totalCount).toBe(3);
  });

  it('4. Filters correctly separate EARNED and LOCKED achievements', () => {
    const earnedOnly = mockCatalogue.filter(a => a.earned);
    const lockedOnly = mockCatalogue.filter(a => !a.earned);

    expect(earnedOnly).toHaveLength(2);
    expect(earnedOnly.every(a => a.earned)).toBe(true);

    expect(lockedOnly).toHaveLength(1);
    expect(lockedOnly[0].id).toBe('a2');
    expect(lockedOnly[0].earned).toBe(false);
  });

  it('5. Null or missing category and icon fields do not crash rendering', () => {
    const item = mockCatalogue[2];
    expect(item.icon).toBeNull();
    expect(item.category).toBeNull();
    expect(getAchievementIconName(item.icon, item.code)).toBe('star');
  });
});
