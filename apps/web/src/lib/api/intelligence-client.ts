import { apiFetch } from '../api';

// Domain Enums / String Literals matching Backend Contracts
export type LearnerState = 'UNKNOWN' | 'SELF_REPORTED' | 'ASSESSED' | 'MASTERED' | 'NEEDS_REVIEW';
export type FreshnessState = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_FRESHNESS';
export type SignalStrength = 'STRONG' | 'MEDIUM' | 'WEAK';
export type RecommendationType = 'REVIEW' | 'PRACTICE' | 'LEARN' | 'PROGRESSION';
export type ConflictType = 'USER_CONFIRMATION_VS_EVIDENCE' | 'PROJECT_VS_EXTERNAL_EVIDENCE' | 'STATE_VS_EVIDENCE_CONTRADICTION';
export type SuggestedAction = 'KEEP_USER_STATE' | 'FLAG_FOR_REVIEW' | 'RECOMMEND_ASSESSMENT';
export type PaceState = 'LOW_ACTIVITY' | 'STEADY' | 'HIGH_ACTIVITY';
export type GapStatus = 'SATISFIED' | 'EVIDENCE_FOUND' | 'IN_PROGRESS' | 'MISSING';

// 1. Capability Discovery
export interface DiscoveredCapabilityDto {
  conceptId?: string;
  conceptTitle: string;
  learnerState: LearnerState;
  signalStrength: SignalStrength;
  recencyScore: number | null;
  evidenceSources: string[];
  isCandidate: boolean;
}

export interface DiscoveredCapabilitiesResponseDto {
  userId: string;
  totalDiscovered: number;
  capabilities: DiscoveredCapabilityDto[];
}

// 2. Knowledge Freshness
export interface CapabilityFreshnessDto {
  conceptId?: string;
  capabilityTitle: string;
  learnerState: LearnerState;
  freshnessState: FreshnessState;
  lastDemonstratedAt?: string | null;
  daysSinceLastDemonstration?: number | null;
  recencyScore: number | null;
}

export interface CapabilityFreshnessResponseDto {
  userId: string;
  evaluatedAt: string;
  summary: {
    total: number;
    freshCount: number;
    agingCount: number;
    staleCount: number;
    unknownCount: number;
  };
  freshnessList: CapabilityFreshnessDto[];
}

// 3. Freshness Recommendations
export interface FreshnessRecommendationDto {
  conceptId: string;
  conceptTitle: string;
  recommendationType: RecommendationType;
  learnerState: LearnerState;
  freshnessState: FreshnessState;
  lastDemonstratedAt?: string | null;
  reason: string;
  whyReason: string;
  isBlocked: boolean; // MUST ALWAYS BE FALSE
}

export interface RoadmapFreshnessRecommendationsResponseDto {
  roadmapId: string;
  roadmapTitle: string;
  totalRecommendations: number;
  recommendations: FreshnessRecommendationDto[];
}

// 4. Evidence Conflicts
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
  suggestedAction: SuggestedAction;
  whyReason: string;
  requiresUserReview: boolean;
}

// 5. Recommendation Suppression
export interface ConceptSuppressionDto {
  conceptId: string;
  conceptTitle: string;
  userIntent?: 'SKIP' | 'DEFER' | 'CONFIRM' | null;
  nextReviewAt?: string | null;
  isSuppressed: boolean;
  priorityReduced: boolean;
  reason: string;
}

export interface SuppressionResultDto {
  userId: string;
  totalConceptsEvaluated: number;
  suppressionList: ConceptSuppressionDto[];
}

// 6. Pace Adaptation
export interface PaceAdaptationDto {
  roadmapId: string;
  roadmapTitle: string;
  paceState: PaceState;
  weeklyVelocity: number;
  taskSkipRate: number;
  overdueTasks: number;
  suggestedBatchSize: number;
  horizonDays: number;
  explanation: string;
}

// 7. Project Gaps
export interface ProjectGapResult {
  nodeId: string; // Exact RoadmapNode UUID match
  nodeTitle: string;
  nodeType: string;
  gapStatus: GapStatus;
  projectMatch: boolean;
  evidenceFound: boolean;
  matchedProjectId?: string | null;
  matchedEvidenceIds: string[];
  requiredTechStack: string[];
  missingCapabilities: string[];
  whyReason: string;
}

export interface ProjectGapAnalysisResponseDto {
  roadmapId: string;
  roadmapTitle: string;
  totalProjectNodes: number;
  satisfiedCount: number;
  evidenceFoundCount: number;
  inProgressCount: number;
  missingCount: number;
  gaps: ProjectGapResult[];
}

// 8. Goal Impact Analysis
export interface GoalChangeImpactRequestDto {
  targetPriority?: 'PRIMARY' | 'SECONDARY' | 'EXPLORATORY';
  targetStatus?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  targetRoleOrGoal?: string;
  addedTechnologies?: string[];
  removedTechnologies?: string[];
}

export interface GoalChangeImpactResponseDto {
  roadmapId: string;
  roadmapTitle?: string;
  previousPriority?: string;
  newPriority?: string;
  previousStatus?: string;
  newStatus?: string;
  affectedNodesCount?: number;
  activeMaterializedTasksCount?: number;
  retainedUsefulTasks?: { taskId: string; title: string; reason: string }[];
  deprioritizedTasks?: { taskId: string; title: string; newFocusScore: number }[];
  prerequisitesAffected?: { nodeId: string; nodeTitle: string; impactDescription: string }[];
  estimatedTimelineDeltaDays?: number;
  summaryExplanation: string;
  targetRoleOrGoal?: string;
  totalNodesEvaluated?: number;
  affectedNodeIds?: string[];
  redundantNodeIds?: string[];
  newlyRequiredCapabilities?: string[];
  recommendedAdjustments?: string[];
}

// Node-level Skip Impact Analysis
export interface SkipImpactAnalysisResponseDto {
  targetNode: { id: string; title: string };
  blockedDependentNodes: { id: string; title: string }[];
  impactWarning: string;
}

// Complementary Context Response
export interface ComplementaryContextNodeDto {
  nodeId: string;
  nodeTitle: string;
  matchedConceptTitle: string;
  learnerCurrentState: LearnerState;
  suggestedTaskTitle: string;
  suggestedTaskDescription: string;
  whyReason: string;
}

export interface ComplementaryContextResponseDto {
  roadmapId: string;
  roadmapTitle: string;
  totalComplementaryNodes: number;
  complementaryNodes: ComplementaryContextNodeDto[];
}

// Node Decomposition Request/Response
export interface DecomposeNodeRequestDto {
  forceDecomposition?: boolean;
}

export interface NodeDecompositionResponseDto {
  nodeId: string;
  nodeTitle: string;
  subTasks: { title: string; description: string; estimatedHours: number }[];
  explanation: string;
}

export interface DismissDecompositionRequestDto {
  reason?: string;
}

export interface DismissDecompositionResponseDto {
  success: boolean;
  message: string;
}

// ==========================================
// Phase 5B.1 Intelligence API Client Functions
// Reuses central apiFetch from ../api
// ==========================================

// 1. GET /api/v1/capabilities/discovered
export async function fetchDiscoveredCapabilities(
  accessToken?: string | null
): Promise<DiscoveredCapabilitiesResponseDto> {
  return apiFetch<DiscoveredCapabilitiesResponseDto>('/api/v1/capabilities/discovered', { accessToken });
}

// 2. GET /api/v1/capabilities/freshness
export async function fetchCapabilityFreshness(
  accessToken?: string | null
): Promise<CapabilityFreshnessResponseDto> {
  return apiFetch<CapabilityFreshnessResponseDto>('/api/v1/capabilities/freshness', { accessToken });
}

// 3. GET /api/v1/roadmaps/:id/freshness-recommendations
export async function fetchRoadmapFreshnessRecommendations(
  roadmapId: string,
  accessToken?: string | null
): Promise<RoadmapFreshnessRecommendationsResponseDto> {
  return apiFetch<RoadmapFreshnessRecommendationsResponseDto>(
    `/api/v1/roadmaps/${roadmapId}/freshness-recommendations`,
    { accessToken }
  );
}

// 4. GET /api/v1/learning/conflicts
export async function fetchConflicts(
  accessToken?: string | null
): Promise<ConflictAnalysisDto[]> {
  return apiFetch<ConflictAnalysisDto[]>('/api/v1/learning/conflicts', { accessToken });
}

// 5. GET /api/v1/learning/recommendation-adaptation
export async function fetchRecommendationSuppression(
  accessToken?: string | null
): Promise<SuppressionResultDto> {
  return apiFetch<SuppressionResultDto>('/api/v1/learning/recommendation-adaptation', { accessToken });
}

// 6. GET /api/v1/roadmaps/:id/adaptation
export async function fetchPaceAdaptation(
  roadmapId: string,
  accessToken?: string | null
): Promise<PaceAdaptationDto> {
  return apiFetch<PaceAdaptationDto>(`/api/v1/roadmaps/${roadmapId}/adaptation`, { accessToken });
}

// 7. GET /api/v1/roadmaps/:id/project-gaps
export async function fetchProjectGaps(
  roadmapId: string,
  accessToken?: string | null
): Promise<ProjectGapAnalysisResponseDto> {
  return apiFetch<ProjectGapAnalysisResponseDto>(`/api/v1/roadmaps/${roadmapId}/project-gaps`, { accessToken });
}

// 8. POST /api/v1/roadmaps/:id/impact-analysis
export async function analyzeGoalChangeImpact(
  roadmapId: string,
  payload: GoalChangeImpactRequestDto,
  accessToken?: string | null
): Promise<GoalChangeImpactResponseDto> {
  return apiFetch<GoalChangeImpactResponseDto>(`/api/v1/roadmaps/${roadmapId}/impact-analysis`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
  });
}

// 9. POST /api/v1/roadmaps/:id/skip-impact/:nodeId
export async function analyzeSkipImpact(
  roadmapId: string,
  nodeId: string,
  accessToken?: string | null
): Promise<SkipImpactAnalysisResponseDto> {
  return apiFetch<SkipImpactAnalysisResponseDto>(`/api/v1/roadmaps/${roadmapId}/skip-impact/${nodeId}`, {
    method: 'POST',
    accessToken,
  });
}

// 10. GET /api/v1/roadmaps/:id/complementary-context
export async function fetchComplementaryContext(
  roadmapId: string,
  nodeId?: string,
  accessToken?: string | null
): Promise<ComplementaryContextResponseDto> {
  const query = nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : '';
  return apiFetch<ComplementaryContextResponseDto>(`/api/v1/roadmaps/${roadmapId}/complementary-context${query}`, {
    accessToken,
  });
}

// 11. POST /api/v1/roadmaps/nodes/:nodeId/decompose
export async function decomposeNode(
  nodeId: string,
  payload: DecomposeNodeRequestDto = {},
  accessToken?: string | null
): Promise<NodeDecompositionResponseDto> {
  return apiFetch<NodeDecompositionResponseDto>(`/api/v1/roadmaps/nodes/${nodeId}/decompose`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
  });
}

// 12. POST /api/v1/roadmaps/nodes/:nodeId/dismiss-decomposition
export async function dismissDecomposition(
  nodeId: string,
  payload: DismissDecompositionRequestDto = {},
  accessToken?: string | null
): Promise<DismissDecompositionResponseDto> {
  return apiFetch<DismissDecompositionResponseDto>(`/api/v1/roadmaps/nodes/${nodeId}/dismiss-decomposition`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
  });
}
