import { RoadmapStatus, RoadmapPriority, RoadmapSourceType } from '@prisma/client';

export interface LegacySnapshotFixture {
  id: string;
  userId: string;
  sourceType: RoadmapSourceType;
  sourceUrl: string | null;
  sourceName: string;
  importedAt: Date;
}

export interface MigratedRoadmap {
  id: string;
  userId: string;
  title: string;
  status: RoadmapStatus;
  priority: RoadmapPriority;
}

export interface MigratedSnapshot extends LegacySnapshotFixture {
  roadmapId: string;
}

export function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().replace(/\/+$/, '');
}

/**
 * Deterministic Simulation of migration.sql algorithm for in-memory / unit verification.
 */
export function simulateMigration(legacySnapshots: LegacySnapshotFixture[]) {
  const roadmaps: MigratedRoadmap[] = [];
  const snapshotLinks = new Map<string, string>(); // snapshotId -> roadmapId

  // Step 2A (Case 1 & Case 2): Group by userId + normalized sourceUrl
  const urlGroups = new Map<string, LegacySnapshotFixture[]>();
  for (const s of legacySnapshots) {
    const norm = normalizeUrl(s.sourceUrl);
    if (norm) {
      const key = `${s.userId}:::${norm}`;
      if (!urlGroups.has(key)) urlGroups.set(key, []);
      urlGroups.get(key)!.push(s);
    }
  }

  for (const [key, group] of urlGroups.entries()) {
    const userId = group[0].userId;
    const title = group[0].sourceName;
    const roadmapId = `rm-url-${roadmaps.length + 1}`;
    roadmaps.push({ id: roadmapId, userId, title, status: RoadmapStatus.ACTIVE, priority: RoadmapPriority.PRIMARY });
    for (const s of group) {
      snapshotLinks.set(s.id, roadmapId);
    }
  }

  // Step 2B (Case 3): Unambiguous no-URL snapshots (single snapshot for user + type + name)
  const unlinkedNoUrl = legacySnapshots.filter(s => !normalizeUrl(s.sourceUrl) && !snapshotLinks.has(s.id));
  const noUrlGroups = new Map<string, LegacySnapshotFixture[]>();

  for (const s of unlinkedNoUrl) {
    const key = `${s.userId}:::${s.sourceType}:::${s.sourceName.trim().toLowerCase()}`;
    if (!noUrlGroups.has(key)) noUrlGroups.set(key, []);
    noUrlGroups.get(key)!.push(s);
  }

  for (const [key, group] of noUrlGroups.entries()) {
    if (group.length === 1) {
      const s = group[0];
      const roadmapId = `rm-no-url-${roadmaps.length + 1}`;
      roadmaps.push({ id: roadmapId, userId: s.userId, title: s.sourceName, status: RoadmapStatus.ACTIVE, priority: RoadmapPriority.PRIMARY });
      snapshotLinks.set(s.id, roadmapId);
    }
  }

  // Step 2C (Case 4): Ambiguous historical identity (multiple no-URL snapshots) -> Separate Roadmap per snapshot
  const remaining = legacySnapshots.filter(s => !snapshotLinks.has(s.id));
  for (const s of remaining) {
    const roadmapId = `rm-ambig-${roadmaps.length + 1}`;
    roadmaps.push({ id: roadmapId, userId: s.userId, title: s.sourceName, status: RoadmapStatus.ACTIVE, priority: RoadmapPriority.PRIMARY });
    snapshotLinks.set(s.id, roadmapId);
  }

  const migratedSnapshots: MigratedSnapshot[] = legacySnapshots.map(s => ({
    ...s,
    roadmapId: snapshotLinks.get(s.id)!,
  }));

  return { roadmaps, migratedSnapshots };
}

describe('Roadmap Migration Integrity & Deterministic Grouping', () => {
  it('Case 1: Same user + same URL -> assigned to SAME Roadmap', () => {
    const legacySnapshots: LegacySnapshotFixture[] = [
      { id: 's1', userId: 'u1', sourceType: RoadmapSourceType.ROADMAP_SH, sourceUrl: 'https://roadmap.sh/ai', sourceName: 'AI Engineer v1', importedAt: new Date('2026-01-01') },
      { id: 's2', userId: 'u1', sourceType: RoadmapSourceType.ROADMAP_SH, sourceUrl: 'https://roadmap.sh/ai', sourceName: 'AI Engineer v2', importedAt: new Date('2026-02-01') },
    ];

    const { roadmaps, migratedSnapshots } = simulateMigration(legacySnapshots);

    expect(roadmaps.length).toBe(1);
    expect(migratedSnapshots[0].roadmapId).toBe(migratedSnapshots[1].roadmapId);
  });

  it('Case 1b: URL normalization handles trailing slashes, whitespace, and case differences', () => {
    const legacySnapshots: LegacySnapshotFixture[] = [
      { id: 's1', userId: 'u1', sourceType: RoadmapSourceType.ROADMAP_SH, sourceUrl: 'https://ROADMAP.SH/ai/', sourceName: 'AI Engineer v1', importedAt: new Date('2026-01-01') },
      { id: 's2', userId: 'u1', sourceType: RoadmapSourceType.ROADMAP_SH, sourceUrl: '  https://roadmap.sh/ai  ', sourceName: 'AI Engineer v2', importedAt: new Date('2026-02-01') },
    ];

    const { roadmaps, migratedSnapshots } = simulateMigration(legacySnapshots);

    expect(roadmaps.length).toBe(1);
    expect(migratedSnapshots[0].roadmapId).toBe(migratedSnapshots[1].roadmapId);
  });

  it('Case 2: Same user + same title + different URL -> assigned to SEPARATE Roadmaps', () => {
    const legacySnapshots: LegacySnapshotFixture[] = [
      { id: 's1', userId: 'u1', sourceType: RoadmapSourceType.ROADMAP_SH, sourceUrl: 'https://roadmap.sh/ai', sourceName: 'AI Engineer', importedAt: new Date('2026-01-01') },
      { id: 's2', userId: 'u1', sourceType: RoadmapSourceType.DOCUMENT_FALLBACK, sourceUrl: 'https://custom.example/ai', sourceName: 'AI Engineer', importedAt: new Date('2026-02-01') },
    ];

    const { roadmaps, migratedSnapshots } = simulateMigration(legacySnapshots);

    expect(roadmaps.length).toBe(2);
    expect(migratedSnapshots[0].roadmapId).not.toBe(migratedSnapshots[1].roadmapId);
  });

  it('Case 3: Same user + no URL + same sourceType/name + unambiguous (single series) -> assigned to SAME Roadmap', () => {
    const legacySnapshots: LegacySnapshotFixture[] = [
      { id: 's1', userId: 'u1', sourceType: RoadmapSourceType.CSV, sourceUrl: null, sourceName: 'Backend Roadmap', importedAt: new Date('2026-01-01') },
    ];

    const { roadmaps, migratedSnapshots } = simulateMigration(legacySnapshots);

    expect(roadmaps.length).toBe(1);
    expect(migratedSnapshots[0].roadmapId).toBe(roadmaps[0].id);
  });

  it('Case 4: Ambiguous historical identity (multiple no-URL snapshots with same title) -> assigned to SEPARATE Roadmaps', () => {
    const legacySnapshots: LegacySnapshotFixture[] = [
      { id: 's1', userId: 'u1', sourceType: RoadmapSourceType.MARKDOWN, sourceUrl: null, sourceName: 'Python Mastery', importedAt: new Date('2026-01-01') },
      { id: 's2', userId: 'u1', sourceType: RoadmapSourceType.MARKDOWN, sourceUrl: null, sourceName: 'Python Mastery', importedAt: new Date('2026-02-01') },
    ];

    const { roadmaps, migratedSnapshots } = simulateMigration(legacySnapshots);

    expect(roadmaps.length).toBe(2);
    expect(migratedSnapshots[0].roadmapId).not.toBe(migratedSnapshots[1].roadmapId);
  });

  it('Case 5: Different users + same source -> assigned to SEPARATE Roadmaps', () => {
    const legacySnapshots: LegacySnapshotFixture[] = [
      { id: 's1', userId: 'user-A', sourceType: RoadmapSourceType.ROADMAP_SH, sourceUrl: 'https://roadmap.sh/ai', sourceName: 'AI Engineer', importedAt: new Date('2026-01-01') },
      { id: 's2', userId: 'user-B', sourceType: RoadmapSourceType.ROADMAP_SH, sourceUrl: 'https://roadmap.sh/ai', sourceName: 'AI Engineer', importedAt: new Date('2026-01-01') },
    ];

    const { roadmaps, migratedSnapshots } = simulateMigration(legacySnapshots);

    expect(roadmaps.length).toBe(2);
    expect(migratedSnapshots[0].roadmapId).not.toBe(migratedSnapshots[1].roadmapId);
    expect(roadmaps[0].userId).toBe('user-A');
    expect(roadmaps[1].userId).toBe('user-B');
  });

  it('Guarantees 0 orphaned snapshots and 100% relational integrity', () => {
    const legacySnapshots: LegacySnapshotFixture[] = [
      { id: 's1', userId: 'u1', sourceType: RoadmapSourceType.ROADMAP_SH, sourceUrl: 'https://roadmap.sh/ai', sourceName: 'AI', importedAt: new Date() },
      { id: 's2', userId: 'u1', sourceType: RoadmapSourceType.ROADMAP_SH, sourceUrl: 'https://roadmap.sh/ai', sourceName: 'AI', importedAt: new Date() },
      { id: 's3', userId: 'u2', sourceType: RoadmapSourceType.CSV, sourceUrl: null, sourceName: 'Data', importedAt: new Date() },
    ];

    const { roadmaps, migratedSnapshots } = simulateMigration(legacySnapshots);

    expect(migratedSnapshots.every(s => s.roadmapId && s.roadmapId.length > 0)).toBe(true);
    expect(migratedSnapshots.length).toBe(legacySnapshots.length);
  });
});
