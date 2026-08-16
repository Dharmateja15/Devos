import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LearnerState, TaskStatus, IndependenceSignal } from '@prisma/client';

export type ConflictType =
  | 'USER_CONFIRMATION_VS_EVIDENCE'
  | 'PROJECT_VS_EXTERNAL_EVIDENCE'
  | 'STATE_VS_EVIDENCE_CONTRADICTION';

export interface ConflictSignalInfo {
  source: string;
  precedenceRank: number;
  description: string;
}

export interface ConflictAnalysisDto {
  conceptId: string;
  conceptTitle: string;
  conflictType: ConflictType;
  winningSignal: ConflictSignalInfo;
  conflictingSignal: ConflictSignalInfo;
  suggestedAction:
    'KEEP_USER_STATE' | 'FLAG_FOR_REVIEW' | 'RECOMMEND_ASSESSMENT';
  whyReason: string;
  requiresUserReview: boolean;
}

@Injectable()
export class ConflictResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Requirement P: Pure Read-Only Evidence Conflict Resolution
   * Strict Semantic Invariant: Absence of evidence is NOT negative evidence.
   * Unverified evidence is NOT contradictory evidence.
   * Conflicts are generated ONLY when contemporary signals explicitly contradict each other.
   */
  async getConflicts(userId: string): Promise<ConflictAnalysisDto[]> {
    const learnerStates = await this.prisma.learnerConceptState.findMany({
      where: { userId },
      include: { concept: true },
    });

    const evidenceItems = await this.prisma.evidenceItem.findMany({
      where: { userId, deletedAt: null },
    });

    const userProjects = await this.prisma.project.findMany({
      where: { journey: { userId }, status: 'COMPLETED', deletedAt: null },
      include: { evidence: true },
    });

    const conflicts: ConflictAnalysisDto[] = [];

    // Check for explicit negative/rejected evidence assertions
    for (const ev of evidenceItems) {
      const meta = (ev.metadata as Record<string, any>) || {};
      const isExplicitlyRejected =
        meta.verificationStatus === 'REJECTED' ||
        meta.negativeAssertion === true;

      if (isExplicitlyRejected) {
        const techs: string[] = Array.isArray(meta.detectedTechnologies)
          ? meta.detectedTechnologies
          : [];

        for (const tech of techs) {
          const techLower = tech.toLowerCase().trim();
          const stateRec = learnerStates.find(
            (l) => l.concept.title.toLowerCase().trim() === techLower,
          );

          if (
            stateRec &&
            (stateRec.userIntent === 'CONFIRM' ||
              stateRec.state === LearnerState.MASTERED)
          ) {
            conflicts.push({
              conceptId: stateRec.conceptId,
              conceptTitle: stateRec.concept.title,
              conflictType: 'USER_CONFIRMATION_VS_EVIDENCE',
              winningSignal: {
                source: 'USER_EXPLICIT_CONFIRMATION',
                precedenceRank: 1,
                description: `User confirmed/mastered concept "${stateRec.concept.title}".`,
              },
              conflictingSignal: {
                source: 'AUTHORITATIVE_NEGATIVE_EVIDENCE',
                precedenceRank: 3,
                description: `Explicit negative verification assertion recorded for evidence item "${ev.title}".`,
              },
              suggestedAction: 'FLAG_FOR_REVIEW',
              whyReason: `Learner state asserts mastery for "${stateRec.concept.title}", but explicit negative verification assertion exists. Review recommended.`,
              requiresUserReview: true,
            });
          }
        }
      }
    }

    // Check for Project claim vs explicit negative external evidence
    for (const proj of userProjects) {
      for (const tech of proj.techStack) {
        const techLower = tech.toLowerCase().trim();
        const hasExplicitNegativeEv = proj.evidence.some((e) => {
          const meta = (e.metadata as Record<string, any>) || {};
          return (
            meta.verificationStatus === 'REJECTED' ||
            meta.negativeAssertion === true
          );
        });

        if (
          hasExplicitNegativeEv &&
          !conflicts.some((c) => c.conceptTitle.toLowerCase() === techLower)
        ) {
          conflicts.push({
            conceptId: `tech-${techLower.replace(/[^a-z0-9]/g, '-')}`,
            conceptTitle: tech,
            conflictType: 'PROJECT_VS_EXTERNAL_EVIDENCE',
            winningSignal: {
              source: 'COMPLETED_PROJECT_CLAIM',
              precedenceRank: 4,
              description: `Completed project "${proj.title}" lists "${tech}" in techStack.`,
            },
            conflictingSignal: {
              source: 'EXPLICIT_NEGATIVE_EVIDENCE',
              precedenceRank: 3,
              description: `Project repository verification explicitly failed or returned negative assertion for "${tech}".`,
            },
            suggestedAction: 'FLAG_FOR_REVIEW',
            whyReason: `Project "${proj.title}" declares "${tech}", but explicit negative verification assertion was recorded.`,
            requiresUserReview: true,
          });
        }
      }
    }

    return conflicts;
  }
}
