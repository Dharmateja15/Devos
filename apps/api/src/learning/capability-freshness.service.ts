import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LearnerState, IndependenceSignal, TaskStatus } from '@prisma/client';

export type FreshnessState = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_FRESHNESS';

export interface CapabilityFreshnessItemDto {
  capabilityId: string;
  capabilityTitle: string;
  learnerState: LearnerState;
  freshnessState: FreshnessState;
  recencyScore: number | null;
  daysSinceLastDemonstration: number | null;
  lastDemonstratedAt?: Date;
  whyReason: string;
}

export interface CapabilityFreshnessResponseDto {
  userId: string;
  evaluatedAt: Date;
  summary: {
    freshCount: number;
    agingCount: number;
    staleCount: number;
    unknownCount: number;
  };
  freshnessList: CapabilityFreshnessItemDto[];
}

@Injectable()
export class CapabilityFreshnessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Requirement L: Pure Read-Only Derived Capability Freshness Evaluation
   */
  async getCapabilityFreshness(
    userId: string,
  ): Promise<CapabilityFreshnessResponseDto> {
    const now = new Date();

    // Fetch canonical data strictly for userId
    const evidenceItems = await this.prisma.evidenceItem.findMany({
      where: { userId, deletedAt: null },
    });

    const userProjects = await this.prisma.project.findMany({
      where: { journey: { userId }, status: 'COMPLETED', deletedAt: null },
      include: { evidence: true },
    });

    const userTasks = await this.prisma.task.findMany({
      where: { journey: { userId }, status: TaskStatus.DONE, deletedAt: null },
      include: { skills: { include: { skill: true } }, evidence: true },
    });

    const learnerStates = await this.prisma.learnerConceptState.findMany({
      where: { userId },
      include: { concept: true },
    });

    const canonicalConcepts = await this.prisma.concept.findMany();
    const canonicalSkills = await this.prisma.skill.findMany();

    // Capability map storing weighted evidence timestamps
    const capabilityFreshnessMap = new Map<
      string,
      {
        title: string;
        learnerState: LearnerState;
        weightedTimestamps: { date: Date; weight: number; source: string }[];
      }
    >();

    const getOrCreateEntry = (rawTitle: string) => {
      const normalizedKey = rawTitle.toLowerCase().trim();
      if (!capabilityFreshnessMap.has(normalizedKey)) {
        const matchedConcept = canonicalConcepts.find(
          (c) => c.title.toLowerCase() === normalizedKey,
        );
        const matchedSkill = canonicalSkills.find(
          (s) => s.name.toLowerCase() === normalizedKey,
        );

        const ls = learnerStates.find(
          (l) => l.concept.title.toLowerCase() === normalizedKey,
        );
        const lState = ls?.state || LearnerState.UNKNOWN;

        capabilityFreshnessMap.set(normalizedKey, {
          title: matchedConcept?.title || matchedSkill?.name || rawTitle,
          learnerState: lState,
          weightedTimestamps: [],
        });
      }
      return capabilityFreshnessMap.get(normalizedKey)!;
    };

    // Populate timestamps with evidence source weights
    // 1. Evidence items
    for (const ev of evidenceItems) {
      const meta = (ev.metadata as Record<string, any>) || {};
      const detectedTech: string[] = Array.isArray(meta.detectedTechnologies)
        ? meta.detectedTechnologies
        : [];
      const evDate = ev.githubEventAt || ev.verifiedAt || ev.createdAt;
      const isVerified = ev.verified;

      for (const tech of detectedTech) {
        const entry = getOrCreateEntry(tech);
        if (evDate) {
          const weight = isVerified ? 0.75 : 0.4;
          entry.weightedTimestamps.push({
            date: new Date(evDate),
            weight,
            source: 'EVIDENCE_ITEM',
          });
        }
      }
    }

    // 2. Completed Projects (completedAt date only, NOT updatedAt)
    for (const proj of userProjects) {
      if (!proj.completedAt) continue;
      const hasVerifiedEv = proj.evidence.some((e) => e.verified);
      const weight = hasVerifiedEv ? 0.85 : 0.6;

      for (const tech of proj.techStack) {
        const entry = getOrCreateEntry(tech);
        entry.weightedTimestamps.push({
          date: new Date(proj.completedAt),
          weight,
          source: 'COMPLETED_PROJECT',
        });
      }
    }

    // 3. Completed Tasks
    for (const task of userTasks) {
      if (!task.completedAt) continue;
      const isIndependent =
        task.independenceSignal === IndependenceSignal.INDEPENDENT;
      const weight = isIndependent ? 1.0 : 0.6;

      for (const ts of task.skills) {
        const entry = getOrCreateEntry(ts.skill.name);
        entry.weightedTimestamps.push({
          date: new Date(task.completedAt),
          weight,
          source: 'TASK_COMPLETION',
        });
      }
    }

    // 4. Learner concept states (lastEvaluatedAt)
    for (const ls of learnerStates) {
      const entry = getOrCreateEntry(ls.concept.title);
      entry.learnerState = ls.state;

      if (ls.lastEvaluatedAt) {
        const weight = ls.state === LearnerState.MASTERED ? 1.0 : 0.6;
        entry.weightedTimestamps.push({
          date: new Date(ls.lastEvaluatedAt),
          weight,
          source: 'LEARNER_STATE_EVAL',
        });
      }
    }

    // Evaluate freshness list
    const freshnessList: CapabilityFreshnessItemDto[] = [];
    let freshCount = 0;
    let agingCount = 0;
    let staleCount = 0;
    let unknownCount = 0;

    for (const [key, data] of capabilityFreshnessMap.entries()) {
      // Filter timestamps with weight >= 0.60 (Weak 0.40 signals cannot displace older strong historical evidence!)
      const meaningfulTimestamps = data.weightedTimestamps
        .filter((t) => t.weight >= 0.6 && !isNaN(t.date.getTime()))
        .sort((a, b) => b.date.getTime() - a.date.getTime()); // Descending order

      const fallbackTimestamps = data.weightedTimestamps
        .filter((t) => !isNaN(t.date.getTime()))
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      const latestDemo = meaningfulTimestamps[0] || fallbackTimestamps[0];

      let freshnessState: FreshnessState = 'UNKNOWN_FRESHNESS';
      let recencyScore: number | null = null;
      let daysSinceLastDemonstration: number | null = null;
      let lastDemonstratedAt: Date | undefined = undefined;
      let whyReason = '';

      if (latestDemo && latestDemo.date) {
        lastDemonstratedAt = latestDemo.date;
        const diffMs = Math.max(0, now.getTime() - latestDemo.date.getTime());
        daysSinceLastDemonstration = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Initial DevOS Product Defaults:
        // 0–30 days => FRESH
        // 31–60 days => AGING
        // 61+ days => STALE
        if (daysSinceLastDemonstration <= 30) {
          freshnessState = 'FRESH';
          freshCount++;
        } else if (daysSinceLastDemonstration <= 60) {
          freshnessState = 'AGING';
          agingCount++;
        } else {
          freshnessState = 'STALE';
          staleCount++;
        }

        // Bounded Recency Score [0.0, 1.0]
        const rawScore = 1.0 - daysSinceLastDemonstration / 90;
        recencyScore = Math.max(
          0.0,
          Math.min(1.0, Math.round(rawScore * 100) / 100),
        );

        whyReason = `Capability "${data.title}" last demonstrated ${daysSinceLastDemonstration} days ago (${latestDemo.source}). Classified as ${freshnessState} (Recency score: ${recencyScore.toFixed(2)}).`;
      } else {
        freshnessState = 'UNKNOWN_FRESHNESS';
        unknownCount++;
        whyReason = `No timestamped demonstration found for "${data.title}". Classified as UNKNOWN_FRESHNESS.`;
      }

      const matchedConcept = canonicalConcepts.find(
        (c) => c.title.toLowerCase() === key,
      );
      const matchedSkill = canonicalSkills.find(
        (s) => s.name.toLowerCase() === key,
      );

      freshnessList.push({
        capabilityId:
          matchedConcept?.id ||
          matchedSkill?.id ||
          `tech-${key.replace(/[^a-z0-9]/g, '-')}`,
        capabilityTitle: data.title,
        learnerState: data.learnerState,
        freshnessState,
        recencyScore,
        daysSinceLastDemonstration,
        lastDemonstratedAt,
        whyReason,
      });
    }

    return {
      userId,
      evaluatedAt: now,
      summary: {
        freshCount,
        agingCount,
        staleCount,
        unknownCount,
      },
      freshnessList,
    };
  }
}
