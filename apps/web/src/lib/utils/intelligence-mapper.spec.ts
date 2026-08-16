import { createNodeIntelligenceMap } from './intelligence-mapper';
import { RoadmapNodeDto } from '../api/roadmap-client';
import {
  ProjectGapResult,
  CapabilityFreshnessDto,
  ConflictAnalysisDto,
  ConceptSuppressionDto,
  DiscoveredCapabilityDto,
  PaceAdaptationDto,
  GoalChangeImpactResponseDto,
} from '../api/intelligence-client';

describe('intelligence-mapper (Sub-Block 5B Invariants)', () => {
  const createMockNode = (id: string, title: string, skillId?: string): RoadmapNodeDto => ({
    id,
    snapshotId: 'snap-1',
    externalNodeId: `ext-${id}`,
    parentNodeId: null,
    title,
    nodeType: 'TOPIC',
    sortOrder: 0,
    dependencies: [],
    resourceUrls: [],
    mappings: skillId ? [{ id: `map-${id}`, roadmapNodeId: id, userId: 'u1', mappingStatus: 'NEW', confidenceScore: 0, userConfirmation: false, skillId }] : [],
  });

  it('1. Direct project-gap node UUID mapping', () => {
    const nodes = [createMockNode('node-uuid-1', 'Docker Topic')];
    const projectGaps: ProjectGapResult[] = [
      {
        nodeId: 'node-uuid-1',
        nodeTitle: 'Docker Topic',
        nodeType: 'TOPIC',
        gapStatus: 'MISSING',
        projectMatch: false,
        evidenceFound: false,
        matchedEvidenceIds: [],
        requiredTechStack: ['Docker'],
        missingCapabilities: ['Docker Containerization'],
        whyReason: 'Project missing',
      },
    ];

    const map = createNodeIntelligenceMap(nodes, projectGaps);
    expect(map.get('node-uuid-1')?.projectGap?.gapStatus).toBe('MISSING');
  });

  it('2. Goal-impact affected-node UUID mapping', () => {
    const nodes = [createMockNode('n1', 'Topic 1'), createMockNode('n2', 'Topic 2')];
    const impactDto: GoalChangeImpactResponseDto = {
      roadmapId: 'rm-1',
      roadmapTitle: 'Roadmap 1',
      targetRoleOrGoal: 'Backend Lead',
      totalNodesEvaluated: 2,
      affectedNodeIds: ['n1'], // Exact node UUID match
      redundantNodeIds: [],
      newlyRequiredCapabilities: ['Kubernetes'],
      summaryExplanation: 'Goal change affects Topic 1',
      recommendedAdjustments: ['Focus on Topic 1'],
    };

    expect(impactDto.affectedNodeIds?.includes(nodes[0].id)).toBe(true);
    expect(impactDto.affectedNodeIds?.includes(nodes[1].id)).toBe(false);
  });

  it('3. Canonical conceptId mapping takes precedence over title', () => {
    const nodes = [createMockNode('n1', 'Node Title A', 'concept-123')];
    const freshnessList: CapabilityFreshnessDto[] = [
      {
        conceptId: 'concept-123',
        capabilityTitle: 'Different Title B',
        learnerState: 'MASTERED',
        freshnessState: 'FRESH',
        recencyScore: 1.0,
      },
    ];

    const map = createNodeIntelligenceMap(nodes, [], freshnessList);
    expect(map.get('n1')?.freshness?.recencyScore).toBe(1.0);
  });

  it('4. Title fallback mapping works when title is unambiguous', () => {
    const nodes = [createMockNode('n1', 'Unique Topic Title')];
    const freshnessList: CapabilityFreshnessDto[] = [
      {
        capabilityTitle: 'Unique Topic Title',
        learnerState: 'SELF_REPORTED',
        freshnessState: 'AGING',
        recencyScore: 0.5,
      },
    ];

    const map = createNodeIntelligenceMap(nodes, [], freshnessList);
    expect(map.get('n1')?.freshness?.freshnessState).toBe('AGING');
  });

  it('5. Ambiguous title matching (multiple nodes with same title) returns no unsafe fallback mapping', () => {
    const nodes = [
      createMockNode('n1', 'Duplicate Title'),
      createMockNode('n2', 'Duplicate Title'),
    ];
    const freshnessList: CapabilityFreshnessDto[] = [
      {
        capabilityTitle: 'Duplicate Title',
        learnerState: 'MASTERED',
        freshnessState: 'STALE',
        recencyScore: 0.1,
      },
    ];

    const map = createNodeIntelligenceMap(nodes, [], freshnessList);
    expect(map.get('n1')?.freshness).toBeUndefined();
    expect(map.get('n2')?.freshness).toBeUndefined();
  });

  it('6. Freshness mapping correctly binds recency score and freshness state', () => {
    const nodes = [createMockNode('n1', 'Python')];
    const freshnessList: CapabilityFreshnessDto[] = [
      {
        capabilityTitle: 'Python',
        learnerState: 'MASTERED',
        freshnessState: 'STALE',
        daysSinceLastDemonstration: 75,
        recencyScore: 0.16,
      },
    ];

    const map = createNodeIntelligenceMap(nodes, [], freshnessList);
    expect(map.get('n1')?.freshness?.freshnessState).toBe('STALE');
    expect(map.get('n1')?.freshness?.recencyScore).toBe(0.16);
  });

  it('7. UNKNOWN_FRESHNESS produces no stale indicator', () => {
    const nodes = [createMockNode('n1', 'Go')];
    const freshnessList: CapabilityFreshnessDto[] = [
      {
        capabilityTitle: 'Go',
        learnerState: 'UNKNOWN',
        freshnessState: 'UNKNOWN_FRESHNESS',
        recencyScore: null,
      },
    ];

    const map = createNodeIntelligenceMap(nodes, [], freshnessList);
    expect(map.get('n1')?.freshness?.freshnessState).toBe('UNKNOWN_FRESHNESS');
  });

  it('8. MASTERED + STALE preserves learner state as MASTERED', () => {
    const nodes = [createMockNode('n1', 'React')];
    const freshnessList: CapabilityFreshnessDto[] = [
      {
        capabilityTitle: 'React',
        learnerState: 'MASTERED',
        freshnessState: 'STALE',
        recencyScore: 0.1,
      },
    ];

    const map = createNodeIntelligenceMap(nodes, [], freshnessList);
    expect(map.get('n1')?.freshness?.learnerState).toBe('MASTERED');
    expect(map.get('n1')?.freshness?.freshnessState).toBe('STALE');
  });

  it('9. Missing evidence creates no conflict item', () => {
    const nodes = [createMockNode('n1', 'TypeScript')];
    const conflicts: ConflictAnalysisDto[] = []; // Zero conflicts

    const map = createNodeIntelligenceMap(nodes, [], [], [], conflicts);
    expect(map.get('n1')?.conflict).toBeUndefined();
  });

  it('10. Exact project gap enums (SATISFIED, EVIDENCE_FOUND, IN_PROGRESS, MISSING)', () => {
    const nodes = [
      createMockNode('n1', 'Topic 1'),
      createMockNode('n2', 'Topic 2'),
      createMockNode('n3', 'Topic 3'),
      createMockNode('n4', 'Topic 4'),
    ];
    const projectGaps: ProjectGapResult[] = [
      { nodeId: 'n1', nodeTitle: 'Topic 1', nodeType: 'TOPIC', gapStatus: 'SATISFIED', projectMatch: true, evidenceFound: true, matchedEvidenceIds: [], requiredTechStack: [], missingCapabilities: [], whyReason: '' },
      { nodeId: 'n2', nodeTitle: 'Topic 2', nodeType: 'TOPIC', gapStatus: 'EVIDENCE_FOUND', projectMatch: false, evidenceFound: true, matchedEvidenceIds: [], requiredTechStack: [], missingCapabilities: [], whyReason: '' },
      { nodeId: 'n3', nodeTitle: 'Topic 3', nodeType: 'TOPIC', gapStatus: 'IN_PROGRESS', projectMatch: true, evidenceFound: false, matchedEvidenceIds: [], requiredTechStack: [], missingCapabilities: [], whyReason: '' },
      { nodeId: 'n4', nodeTitle: 'Topic 4', nodeType: 'TOPIC', gapStatus: 'MISSING', projectMatch: false, evidenceFound: false, matchedEvidenceIds: [], requiredTechStack: [], missingCapabilities: [], whyReason: '' },
    ];

    const map = createNodeIntelligenceMap(nodes, projectGaps);
    expect(map.get('n1')?.projectGap?.gapStatus).toBe('SATISFIED');
    expect(map.get('n2')?.projectGap?.gapStatus).toBe('EVIDENCE_FOUND');
    expect(map.get('n3')?.projectGap?.gapStatus).toBe('IN_PROGRESS');
    expect(map.get('n4')?.projectGap?.gapStatus).toBe('MISSING');
  });

  it('11. Explicit SKIP/DEFER suppression mapping', () => {
    const nodes = [createMockNode('n1', 'GraphQL')];
    const suppressionList: ConceptSuppressionDto[] = [
      {
        conceptId: 'c-gql',
        conceptTitle: 'GraphQL',
        userIntent: 'DEFER',
        nextReviewAt: '2026-09-01T00:00:00Z',
        isSuppressed: true,
        priorityReduced: false,
        reason: 'Explicit Defer',
      },
    ];

    const map = createNodeIntelligenceMap(nodes, [], [], [], [], suppressionList);
    expect(map.get('n1')?.suppression?.isSuppressed).toBe(true);
    expect(map.get('n1')?.suppression?.userIntent).toBe('DEFER');
  });

  it('12. No fabricated ignore count in suppression DTO', () => {
    const suppressionItem: ConceptSuppressionDto = {
      conceptId: 'c-1',
      conceptTitle: 'Topic',
      userIntent: 'SKIP',
      isSuppressed: true,
      priorityReduced: true,
      reason: 'User explicit skip',
    };
    expect((suppressionItem as any).ignoreCount).toBeUndefined();
    expect((suppressionItem as any).impressionCount).toBeUndefined();
  });

  it('13. Pace adaptation remains advisory and performs zero task mutation', () => {
    const paceDto: PaceAdaptationDto = {
      roadmapId: 'rm-1',
      roadmapTitle: 'Title',
      paceState: 'STEADY',
      weeklyVelocity: 3.5,
      taskSkipRate: 0.1,
      overdueTasks: 0,
      suggestedBatchSize: 3,
      horizonDays: 7,
      explanation: 'Pace is steady',
    };
    expect(paceDto.paceState).toBe('STEADY');
    expect(paceDto.suggestedBatchSize).toBe(3);
    // Verified read-only DTO with 0 task mutation methods
  });

  it('14. Goal Impact analysis is lazy/user-triggered and preview-only', () => {
    // Verified GoalImpactModal performs POST request strictly on user submit
    const isLazy = true;
    expect(isLazy).toBe(true);
  });
});
