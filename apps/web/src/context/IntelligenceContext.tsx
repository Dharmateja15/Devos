'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { RoadmapNodeDto } from '../lib/api/roadmap-client';
import {
  fetchDiscoveredCapabilities,
  fetchCapabilityFreshness,
  fetchRoadmapFreshnessRecommendations,
  fetchConflicts,
  fetchRecommendationSuppression,
  fetchPaceAdaptation,
  fetchProjectGaps,
  analyzeGoalChangeImpact,
  analyzeSkipImpact,
  fetchComplementaryContext,
  decomposeNode,
  dismissDecomposition,
  DiscoveredCapabilityDto,
  CapabilityFreshnessResponseDto,
  CapabilityFreshnessDto,
  FreshnessRecommendationDto,
  ConflictAnalysisDto,
  ConceptSuppressionDto,
  PaceAdaptationDto,
  ProjectGapResult,
  GoalChangeImpactRequestDto,
  GoalChangeImpactResponseDto,
  SkipImpactAnalysisResponseDto,
  ComplementaryContextResponseDto,
  DecomposeNodeRequestDto,
  NodeDecompositionResponseDto,
  DismissDecompositionRequestDto,
  DismissDecompositionResponseDto,
} from '../lib/api/intelligence-client';
import { createNodeIntelligenceMap, NodeMappedIntelligence } from '../lib/utils/intelligence-mapper';

export interface IntelligenceState {
  // User Global Intelligence
  discoveredCapabilities: DiscoveredCapabilityDto[];
  freshnessSummary: CapabilityFreshnessResponseDto['summary'] | null;
  freshnessList: CapabilityFreshnessDto[];
  conflicts: ConflictAnalysisDto[];
  suppressionList: ConceptSuppressionDto[];

  // Active Roadmap Intelligence
  activeRoadmapId: string | null;
  freshnessRecommendations: FreshnessRecommendationDto[];
  paceAdaptation: PaceAdaptationDto | null;
  projectGaps: ProjectGapResult[];

  // Status & Control
  isLoading: boolean;
  isRefetching: boolean;
  error: string | null;
}

export interface IntelligenceContextType extends IntelligenceState {
  // Orchestration & Actions
  loadRoadmapIntelligence: (roadmapId: string, force?: boolean) => Promise<void>;
  refreshIntelligence: (roadmapId?: string) => Promise<void>;
  clearActiveRoadmap: () => void;

  // Intelligence Mapping Helper
  getNodeIntelligenceMap: (nodes?: RoadmapNodeDto[]) => Map<string, NodeMappedIntelligence>;

  // Action API Wrappers
  analyzeGoalImpact: (roadmapId: string, payload: GoalChangeImpactRequestDto) => Promise<GoalChangeImpactResponseDto>;
  analyzeNodeSkip: (roadmapId: string, nodeId: string) => Promise<SkipImpactAnalysisResponseDto>;
  getComplementaryContext: (roadmapId: string, nodeId?: string) => Promise<ComplementaryContextResponseDto>;
  decomposeRoadmapNode: (nodeId: string, payload?: DecomposeNodeRequestDto) => Promise<NodeDecompositionResponseDto>;
  dismissRoadmapNodeDecomposition: (nodeId: string, payload?: DismissDecompositionRequestDto) => Promise<DismissDecompositionResponseDto>;
}

const IntelligenceContext = createContext<IntelligenceContextType | undefined>(undefined);

export function IntelligenceProvider({ children }: { children: ReactNode }) {
  const { accessToken, user, loading: authLoading } = useAuth();

  // User Global State
  const [discoveredCapabilities, setDiscoveredCapabilities] = useState<DiscoveredCapabilityDto[]>([]);
  const [freshnessSummary, setFreshnessSummary] = useState<CapabilityFreshnessResponseDto['summary'] | null>(null);
  const [freshnessList, setFreshnessList] = useState<CapabilityFreshnessDto[]>([]);
  const [conflicts, setConflicts] = useState<ConflictAnalysisDto[]>([]);
  const [suppressionList, setSuppressionList] = useState<ConceptSuppressionDto[]>([]);

  // Active Roadmap-Specific State
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);
  const [freshnessRecommendations, setFreshnessRecommendations] = useState<FreshnessRecommendationDto[]>([]);
  const [paceAdaptation, setPaceAdaptation] = useState<PaceAdaptationDto | null>(null);
  const [projectGaps, setProjectGaps] = useState<ProjectGapResult[]>([]);

  // Status State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Authentication Lifecycle Handling
  const resetIntelligenceState = useCallback(() => {
    setDiscoveredCapabilities([]);
    setFreshnessSummary(null);
    setFreshnessList([]);
    setConflicts([]);
    setSuppressionList([]);
    setActiveRoadmapId(null);
    setFreshnessRecommendations([]);
    setPaceAdaptation(null);
    setProjectGaps([]);
    setIsLoading(false);
    setIsRefetching(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken || !user) {
      resetIntelligenceState();
    }
  }, [accessToken, user, authLoading, resetIntelligenceState]);

  // Load Roadmap & Global Intelligence
  const loadRoadmapIntelligence = useCallback(
    async (roadmapId: string, force = false) => {
      if (!accessToken || !user) {
        resetIntelligenceState();
        return;
      }

      // Duplicate Request Prevention: Skip if already loaded for this roadmapId unless forced
      if (!force && activeRoadmapId === roadmapId && (freshnessRecommendations.length > 0 || paceAdaptation !== null || projectGaps.length > 0)) {
        return;
      }

      if (activeRoadmapId === roadmapId) {
        setIsRefetching(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const [
          discoveredRes,
          freshnessRes,
          freshnessRecsRes,
          conflictsRes,
          suppressionRes,
          paceRes,
          gapsRes,
        ] = await Promise.all([
          fetchDiscoveredCapabilities(accessToken).catch(() => null),
          fetchCapabilityFreshness(accessToken).catch(() => null),
          fetchRoadmapFreshnessRecommendations(roadmapId, accessToken).catch(() => null),
          fetchConflicts(accessToken).catch(() => []),
          fetchRecommendationSuppression(accessToken).catch(() => null),
          fetchPaceAdaptation(roadmapId, accessToken).catch(() => null),
          fetchProjectGaps(roadmapId, accessToken).catch(() => null),
        ]);

        if (discoveredRes?.capabilities) setDiscoveredCapabilities(discoveredRes.capabilities);
        if (freshnessRes?.summary) {
          setFreshnessSummary(freshnessRes.summary);
          setFreshnessList(freshnessRes.freshnessList || []);
        }
        if (freshnessRecsRes?.recommendations) setFreshnessRecommendations(freshnessRecsRes.recommendations);
        if (conflictsRes) setConflicts(conflictsRes);
        if (suppressionRes?.suppressionList) setSuppressionList(suppressionRes.suppressionList);
        if (paceRes) setPaceAdaptation(paceRes);
        if (gapsRes?.gaps) setProjectGaps(gapsRes.gaps);

        setActiveRoadmapId(roadmapId);
      } catch (err: any) {
        const errMsg = err?.message || 'Failed to load intelligence data.';
        setError(errMsg);
      } finally {
        setIsLoading(false);
        setIsRefetching(false);
      }
    },
    [accessToken, user, activeRoadmapId, freshnessRecommendations.length, paceAdaptation, projectGaps.length, resetIntelligenceState]
  );

  const refreshIntelligence = useCallback(
    async (roadmapId?: string) => {
      const targetId = roadmapId || activeRoadmapId;
      if (targetId) {
        await loadRoadmapIntelligence(targetId, true);
      }
    },
    [activeRoadmapId, loadRoadmapIntelligence]
  );

  const clearActiveRoadmap = useCallback(() => {
    setActiveRoadmapId(null);
    setFreshnessRecommendations([]);
    setPaceAdaptation(null);
    setProjectGaps([]);
  }, []);

  // Intelligence Mapper Helper integration
  const getNodeIntelligenceMap = useCallback(
    (nodes: RoadmapNodeDto[] = []): Map<string, NodeMappedIntelligence> => {
      return createNodeIntelligenceMap(
        nodes,
        projectGaps,
        freshnessList,
        freshnessRecommendations,
        conflicts,
        suppressionList,
        discoveredCapabilities
      );
    },
    [projectGaps, freshnessList, freshnessRecommendations, conflicts, suppressionList, discoveredCapabilities]
  );

  // Action API Wrappers
  const analyzeGoalImpact = useCallback(
    async (roadmapId: string, payload: GoalChangeImpactRequestDto): Promise<GoalChangeImpactResponseDto> => {
      return analyzeGoalChangeImpact(roadmapId, payload, accessToken);
    },
    [accessToken]
  );

  const analyzeNodeSkip = useCallback(
    async (roadmapId: string, nodeId: string): Promise<SkipImpactAnalysisResponseDto> => {
      return analyzeSkipImpact(roadmapId, nodeId, accessToken);
    },
    [accessToken]
  );

  const getComplementaryContext = useCallback(
    async (roadmapId: string, nodeId?: string): Promise<ComplementaryContextResponseDto> => {
      return fetchComplementaryContext(roadmapId, nodeId, accessToken);
    },
    [accessToken]
  );

  const decomposeRoadmapNode = useCallback(
    async (nodeId: string, payload: DecomposeNodeRequestDto = {}): Promise<NodeDecompositionResponseDto> => {
      return decomposeNode(nodeId, payload, accessToken);
    },
    [accessToken]
  );

  const dismissRoadmapNodeDecomposition = useCallback(
    async (nodeId: string, payload: DismissDecompositionRequestDto = {}): Promise<DismissDecompositionResponseDto> => {
      return dismissDecomposition(nodeId, payload, accessToken);
    },
    [accessToken]
  );

  const contextValue: IntelligenceContextType = useMemo(
    () => ({
      discoveredCapabilities,
      freshnessSummary,
      freshnessList,
      conflicts,
      suppressionList,
      activeRoadmapId,
      freshnessRecommendations,
      paceAdaptation,
      projectGaps,
      isLoading,
      isRefetching,
      error,
      loadRoadmapIntelligence,
      refreshIntelligence,
      clearActiveRoadmap,
      getNodeIntelligenceMap,
      analyzeGoalImpact,
      analyzeNodeSkip,
      getComplementaryContext,
      decomposeRoadmapNode,
      dismissRoadmapNodeDecomposition,
    }),
    [
      discoveredCapabilities,
      freshnessSummary,
      freshnessList,
      conflicts,
      suppressionList,
      activeRoadmapId,
      freshnessRecommendations,
      paceAdaptation,
      projectGaps,
      isLoading,
      isRefetching,
      error,
      loadRoadmapIntelligence,
      refreshIntelligence,
      clearActiveRoadmap,
      getNodeIntelligenceMap,
      analyzeGoalImpact,
      analyzeNodeSkip,
      getComplementaryContext,
      decomposeRoadmapNode,
      dismissRoadmapNodeDecomposition,
    ]
  );

  return <IntelligenceContext.Provider value={contextValue}>{children}</IntelligenceContext.Provider>;
}

export function useIntelligence(): IntelligenceContextType {
  const context = useContext(IntelligenceContext);
  if (context === undefined) {
    throw new Error('useIntelligence must be used within an IntelligenceProvider');
  }
  return context;
}
