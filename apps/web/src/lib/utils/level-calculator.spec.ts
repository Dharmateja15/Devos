import { calculateLevelFromXp } from './level-calculator';

describe('level-calculator', () => {
  it('1. Calculates Level 1 for 0 XP', () => {
    const res = calculateLevelFromXp(0);
    expect(res.level).toBe(1);
    expect(res.title).toBe('Newcomer');
    expect(res.progressPercent).toBe(0);
  });

  it('2. Calculates Level 2 at 100 XP', () => {
    const res = calculateLevelFromXp(100);
    expect(res.level).toBe(2);
    expect(res.title).toBe('Apprentice');
    expect(res.progressPercent).toBe(0);
  });

  it('3. Calculates progress percentage halfway between Level 2 and Level 3', () => {
    // Level 2 = 100 XP, Level 3 = 250 XP (150 XP diff). Halfway = 175 XP.
    const res = calculateLevelFromXp(175);
    expect(res.level).toBe(2);
    expect(res.title).toBe('Apprentice');
    expect(res.progressPercent).toBe(50);
  });

  it('4. Calculates Level 10 Senior Learner at 9000 XP', () => {
    const res = calculateLevelFromXp(9000);
    expect(res.level).toBe(10);
    expect(res.title).toBe('Senior Learner');
  });
});
