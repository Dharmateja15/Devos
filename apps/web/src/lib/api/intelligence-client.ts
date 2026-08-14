const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type LearnerState = 'UNKNOWN' | 'SELF_REPORTED' | 'ASSESSED' | 'MASTERED' | 'NEEDS_REVIEW';
export type FreshnessState = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_FRESHNESS';
export type SignalStrength = 'STRONG' | 'MEDIUM' | 'WEAK';
export type RecommendationType = 'REVIEW' | 'PRACTICE' | 'LEARN' | 'PROGRESSION';
export type ConflictType = 'USER_CONFIRMATION_VS_EVIDENCE' | 'PROJECT_VS_EXTERNAL_EVIDENCE' | 'STATE_VS_EVIDENCE_CONTRADICTION';
export type SuggestedAction = 'KEEP_USER_STATE' | 'FLAG_FOR_REVIEW' | 'RECOMMEND_ASSESSMENT';
export type PaceState = 'LOW_ACTIVITY' | 'STEADY' | 'HIGH_ACTIVITY';
export type GapStatus = 'SATISFIED' | 'EVIDENCE_FOUND' | 'IN_PROGRESS' | 'MISSING';

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

export interface GoalChangeImpactRequestDto {
  targetRoleOrGoal?: string;
  addedTechnologies?: string[];
  removedTechnologies?: string[];
}

export interface GoalChangeImpactResponseDto {
  roadmapId: string;
  roadmapTitle: string;
  targetRoleOrGoal: string;
  totalNodesEvaluated: number;
  affectedNodeIds: string[];
  redundantNodeIds: string[];
  newlyRequiredCapabilities: string[];
  summaryExplanation: string;
  recommendedAdjustments: string[];
}

function getHeaders(accessToken?: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

// 1. GET /api/v1/capabilities/discovered
export async function fetchDiscoveredCapabilities(accessToken?: string | null): Promise<DiscoveredCapabilitiesResponseDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/capabilities/discovered`, {
    headers: getHeaders(accessToken),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch discovered capabilities');
  return res.json();
}

// 2. GET /api/v1/capabilities/freshness
export async function fetchCapabilityFreshness(accessToken?: string | null): Promise<CapabilityFreshnessResponseDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/capabilities/freshness`, {
    headers: getHeaders(accessToken),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch capability freshness');
  return res.json();
}

// 3. GET /api/v1/roadmaps/:id/freshness-recommendations
export async function fetchRoadmapFreshnessRecommendations(roadmapId: string, accessToken?: string | null): Promise<RoadmapFreshnessRecommendationsResponseDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/roadmaps/${roadmapId}/freshness-recommendations`, {
    headers: getHeaders(accessToken),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch roadmap freshness recommendations');
  return res.json();
}

// 4. GET /api/v1/learning/conflicts
export async function fetchConflicts(accessToken?: string | null): Promise<ConflictAnalysisDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/learning/conflicts`, {
    headers: getHeaders(accessToken),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch conflicts');
  return res.json();
}

// 5. GET /api/v1/learning/recommendation-adaptation
export async function fetchRecommendationSuppression(accessToken?: string | null): Promise<SuppressionResultDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/learning/recommendation-adaptation`, {
    headers: getHeaders(accessToken),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch recommendation suppression');
  return res.json();
}

// 6. GET /api/v1/roadmaps/:id/adaptation
export async function fetchPaceAdaptation(roadmapId: string, accessToken?: string | null): Promise<PaceAdaptationDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/roadmaps/${roadmapId}/adaptation`, {
    headers: getHeaders(accessToken),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch pace adaptation');
  return res.json();
}

// 7. GET /api/v1/roadmaps/:id/project-gaps
export async function fetchProjectGaps(roadmapId: string, accessToken?: string | null): Promise<ProjectGapAnalysisResponseDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/roadmaps/${roadmapId}/project-gaps`, {
    headers: getHeaders(accessToken),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch project gaps');
  return res.json();
}

// 8. POST /api/v1/roadmaps/:id/impact-analysis (LAZY TRIGGERED)
export async function analyzeGoalChangeImpact(
  roadmapId: string,
  payload: GoalChangeImpactRequestDto,
  accessToken?: string | null
): Promise<GoalChangeImpactResponseDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/roadmaps/${roadmapId}/impact-analysis`, {
    method: 'POST',
    headers: getHeaders(accessToken),
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to analyze goal change impact');
  return res.json();
}
