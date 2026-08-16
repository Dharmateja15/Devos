import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IndependenceSignal, TaskStatus } from '@prisma/client';

export type SignalStrength = 'STRONG' | 'MEDIUM' | 'WEAK';

export interface DiscoveredCapabilityDto {
  capabilityId: string;
  capabilityTitle: string;
  isCanonical: boolean;
  canonicalConceptId?: string;
  canonicalSkillId?: string;
  signalStrength: SignalStrength;
  sourceSignals: string[];
  evidenceCount: number;
  firstObservedAt?: Date;
  lastObservedAt?: Date;
  whyReason: string;
}

export interface CapabilityDiscoveryResponseDto {
  userId: string;
  totalDiscovered: number;
  capabilities: DiscoveredCapabilityDto[];
}

@Injectable()
export class CapabilityDiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Requirement K: Pure Read-Only Derived Capability Discovery
   */
  async getDiscoveredCapabilities(
    userId: string,
  ): Promise<CapabilityDiscoveryResponseDto> {
    // Fetch canonical data strictly scoped to userId
    const evidenceItems = await this.prisma.evidenceItem.findMany({
      where: { userId, deletedAt: null },
    });

    const userProjects = await this.prisma.project.findMany({
      where: { journey: { userId }, deletedAt: null },
      include: { evidence: true },
    });

    const userTasks = await this.prisma.task.findMany({
      where: { journey: { userId }, status: TaskStatus.DONE, deletedAt: null },
      include: {
        skills: { include: { skill: true } },
        evidence: true,
      },
    });

    const learnerStates = await this.prisma.learnerConceptState.findMany({
      where: { userId },
      include: { concept: true },
    });

    const userMappings = await this.prisma.roadmapMapping.findMany({
      where: { userId },
      include: { roadmapNode: true },
    });

    const canonicalConcepts = await this.prisma.concept.findMany();
    const canonicalSkills = await this.prisma.skill.findMany();

    // Grouping map for aggregated capabilities
    const capabilityMap = new Map<
      string,
      {
        title: string;
        canonicalConceptId?: string;
        canonicalSkillId?: string;
        signals: Set<string>;
        strengths: SignalStrength[];
        timestamps: Date[];
        evidenceIds: Set<string>;
      }
    >();

    const getOrCreateGroup = (rawTitle: string) => {
      const normalizedKey = rawTitle.toLowerCase().trim();
      if (!capabilityMap.has(normalizedKey)) {
        // Resolve canonical Concept / Skill ID
        const matchedConcept = canonicalConcepts.find(
          (c) => c.title.toLowerCase() === normalizedKey,
        );
        const matchedSkill = canonicalSkills.find(
          (s) => s.name.toLowerCase() === normalizedKey,
        );

        capabilityMap.set(normalizedKey, {
          title: matchedConcept?.title || matchedSkill?.name || rawTitle,
          canonicalConceptId: matchedConcept?.id,
          canonicalSkillId: matchedSkill?.id,
          signals: new Set<string>(),
          strengths: [],
          timestamps: [],
          evidenceIds: new Set<string>(),
        });
      }
      return capabilityMap.get(normalizedKey)!;
    };

    // 1. Process Evidence Items (6B integration)
    for (const ev of evidenceItems) {
      const meta = (ev.metadata as Record<string, any>) || {};
      const detectedTech: string[] = Array.isArray(meta.detectedTechnologies)
        ? meta.detectedTechnologies
        : [];
      const verificationStatus = meta.verificationStatus || 'UNVERIFIED';
      const eventDate = ev.githubEventAt || ev.verifiedAt || ev.createdAt;

      for (const tech of detectedTech) {
        const group = getOrCreateGroup(tech);
        group.evidenceIds.add(ev.id);
        if (eventDate) group.timestamps.push(eventDate);

        if (
          ev.verified &&
          (verificationStatus === 'REPOSITORY_OWNER_VERIFIED' ||
            verificationStatus === 'CONNECTED_ACCOUNT_ASSOCIATION')
        ) {
          group.signals.add('VERIFIED_GITHUB_REPOSITORY');
          group.strengths.push('MEDIUM');
        } else if (
          ev.verified &&
          verificationStatus === 'COMMIT_AUTHOR_MATCH'
        ) {
          group.signals.add('VERIFIED_GITHUB_COMMIT');
          group.strengths.push('MEDIUM');
        } else {
          group.signals.add('STATIC_MANIFEST_DETECTION');
          group.strengths.push('WEAK');
        }
      }
    }

    // 2. Process Projects & Tech Stack
    for (const proj of userProjects) {
      const hasVerifiedEv = proj.evidence.some((e) => e.verified);
      const isCompleted = proj.status === 'COMPLETED';

      for (const tech of proj.techStack) {
        const group = getOrCreateGroup(tech);
        if (proj.completedAt) group.timestamps.push(proj.completedAt);
        else if (proj.updatedAt) group.timestamps.push(proj.updatedAt);

        if (isCompleted && hasVerifiedEv) {
          group.signals.add('COMPLETED_PROJECT_WITH_EVIDENCE');
          group.strengths.push('MEDIUM');
        } else {
          group.signals.add('PROJECT_TECH_STACK');
          group.strengths.push('WEAK');
        }
      }
    }

    // 3. Process Tasks & TaskSkills
    for (const task of userTasks) {
      const isIndependent =
        task.independenceSignal === IndependenceSignal.INDEPENDENT;
      const hasVerifiedEv = task.evidence.some((e) => e.verified);
      const taskDate = task.completedAt || task.updatedAt;

      for (const ts of task.skills) {
        const skillName = ts.skill.name;
        const group = getOrCreateGroup(skillName);
        if (taskDate) group.timestamps.push(taskDate);

        if (isIndependent) {
          group.signals.add('INDEPENDENT_TASK_COMPLETION');
          group.strengths.push('STRONG');
        } else if (hasVerifiedEv) {
          group.signals.add('VERIFIED_TASK_EVIDENCE');
          group.strengths.push('MEDIUM');
        } else {
          group.signals.add('GUIDED_TASK_COMPLETION');
          group.strengths.push('WEAK');
        }
      }
    }

    // 4. Process Learner Concept States
    for (const ls of learnerStates) {
      const group = getOrCreateGroup(ls.concept.title);
      if (ls.lastEvaluatedAt) group.timestamps.push(ls.lastEvaluatedAt);

      if (ls.state === 'MASTERED') {
        group.signals.add('MASTERED_LEARNER_STATE');
        group.strengths.push('STRONG');
      } else if (ls.state === 'ASSESSED') {
        group.signals.add('ASSESSED_LEARNER_STATE');
        group.strengths.push('STRONG');
      } else if (ls.state === 'SELF_REPORTED') {
        group.signals.add('SELF_REPORTED_CONCEPT');
        group.strengths.push('WEAK');
      }
    }

    // 5. Process Roadmap Mappings
    for (const map of userMappings) {
      if (map.userConfirmation) {
        const group = getOrCreateGroup(map.roadmapNode.title);
        group.signals.add('USER_CONFIRMED_ROADMAP_MAPPING');
        group.strengths.push('STRONG');
      }
    }

    // Build final DTO list
    const capabilities: DiscoveredCapabilityDto[] = [];

    for (const [_, data] of capabilityMap.entries()) {
      // Determine overall highest signal strength
      let signalStrength: SignalStrength = 'WEAK';
      if (data.strengths.includes('STRONG')) signalStrength = 'STRONG';
      else if (data.strengths.includes('MEDIUM')) signalStrength = 'MEDIUM';

      // Sort timestamps
      const validDates = data.timestamps
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      const firstObservedAt = validDates[0];
      const lastObservedAt = validDates[validDates.length - 1];

      const isCanonical = Boolean(
        data.canonicalConceptId || data.canonicalSkillId,
      );
      const signalList = Array.from(data.signals);

      const whyReason = `Capability "${data.title}" discovered via ${signalList.join(', ')} (Signal Strength: ${signalStrength}, Evidence items: ${data.evidenceIds.size}).`;

      capabilities.push({
        capabilityId:
          data.canonicalConceptId ||
          data.canonicalSkillId ||
          `tech-${data.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        capabilityTitle: data.title,
        isCanonical,
        canonicalConceptId: data.canonicalConceptId,
        canonicalSkillId: data.canonicalSkillId,
        signalStrength,
        sourceSignals: signalList,
        evidenceCount: data.evidenceIds.size,
        firstObservedAt,
        lastObservedAt,
        whyReason,
      });
    }

    return {
      userId,
      totalDiscovered: capabilities.length,
      capabilities,
    };
  }
}
