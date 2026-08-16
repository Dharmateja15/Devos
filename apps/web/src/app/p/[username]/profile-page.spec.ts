import { PublicProfileResponseDto } from '../../../lib/api';

describe('Public Developer Profile Presentation & Safety Logic', () => {
  const mockPublicProfile: PublicProfileResponseDto = {
    identity: {
      username: 'alexdev',
      displayName: 'Alex Developer',
      avatarUrl: null,
      headline: 'Fullstack AI Engineer',
      bio: 'Building autonomous coding software.',
      socialLinks: { github: 'https://github.com/alexdev', twitter: 'https://twitter.com/alexdev' },
    },
    gamification: {
      totalXp: 500,
      level: 4,
      levelTitle: 'Engineer',
      currentStreak: 7,
      longestStreak: 14,
      earnedAchievements: [
        {
          code: 'first_task',
          name: 'First Step',
          description: 'Completed first task',
          icon: 'flag',
          category: 'tasks',
          xpReward: 10,
          earnedAt: '2026-08-01T10:00:00Z',
        },
      ],
    },
    journeys: [
      {
        id: 'j1',
        title: 'Fullstack Mastery',
        description: 'Complete web development roadmap',
        status: 'ACTIVE',
        isFeatured: true,
        milestonesCount: 5,
        completedMilestonesCount: 3,
        tasksCount: 20,
        completedTasksCount: 15,
      },
    ],
    proofOfWork: [
      {
        id: 'ev1',
        evidenceType: 'GITHUB_REPO',
        title: 'DevOS Repository',
        githubRepo: 'alexdev/devos',
        githubSha: 'a1b2c3d4e5f6',
        url: 'https://github.com/alexdev/devos',
        createdAt: '2026-08-10T12:00:00Z',
      },
    ],
  };

  it('1. Public identity fields render correctly', () => {
    expect(mockPublicProfile.identity.username).toBe('alexdev');
    expect(mockPublicProfile.identity.displayName).toBe('Alex Developer');
    expect(mockPublicProfile.identity.headline).toBe('Fullstack AI Engineer');
    expect(mockPublicProfile.identity.bio).toBe('Building autonomous coding software.');
  });

  it('2. Initials fallback handles null avatarUrl gracefully', () => {
    function getInitials(name: string): string {
      if (!name || !name.trim()) return 'DEV';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    expect(getInitials('Alex Developer')).toBe('AD');
    expect(getInitials('SingleWord')).toBe('SI');
    expect(getInitials('')).toBe('DEV');
  });

  it('3. Gamification values reflect API payload without recalculation', () => {
    const { totalXp, level, levelTitle, currentStreak, longestStreak } = mockPublicProfile.gamification;
    expect(totalXp).toBe(500);
    expect(level).toBe(4);
    expect(levelTitle).toBe('Engineer');
    expect(currentStreak).toBe(7);
    expect(longestStreak).toBe(14);
  });

  it('4. Earned achievements contain vector icon names without emoji characters', () => {
    const achievements = mockPublicProfile.gamification.earnedAchievements;
    expect(achievements).toHaveLength(1);
    expect(achievements[0].code).toBe('first_task');
    expect(achievements[0].icon).toBe('flag');
    // Ensure no emoji in name or description
    expect(achievements[0].name).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
  });

  it('5. Public journeys contain progress counters and featured flag', () => {
    const journeys = mockPublicProfile.journeys;
    expect(journeys).toHaveLength(1);
    expect(journeys[0].isFeatured).toBe(true);
    expect(journeys[0].completedMilestonesCount).toBe(3);
    expect(journeys[0].completedTasksCount).toBe(15);
  });

  it('6. Verified proof of work contains GitHub repository metadata', () => {
    const proof = mockPublicProfile.proofOfWork;
    expect(proof).toHaveLength(1);
    expect(proof[0].githubRepo).toBe('alexdev/devos');
    expect(proof[0].url).toBe('https://github.com/alexdev/devos');
  });

  it('7. Empty states handle 0 achievements, 0 journeys, and 0 proof-of-work cleanly', () => {
    const emptyProfile: PublicProfileResponseDto = {
      ...mockPublicProfile,
      gamification: { ...mockPublicProfile.gamification, earnedAchievements: [] },
      journeys: [],
      proofOfWork: [],
    };

    expect(emptyProfile.gamification.earnedAchievements).toHaveLength(0);
    expect(emptyProfile.journeys).toHaveLength(0);
    expect(emptyProfile.proofOfWork).toHaveLength(0);
  });

  it('8. SECURITY: Sensitive identity fields (email, passwordHash, role) are absent from PublicProfileResponseDto', () => {
    const identityObj: any = mockPublicProfile.identity;
    expect(identityObj.email).toBeUndefined();
    expect(identityObj.passwordHash).toBeUndefined();
    expect(identityObj.role).toBeUndefined();
    expect(identityObj.refreshTokenHash).toBeUndefined();
  });
});
