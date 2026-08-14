'use client';

import React, { useEffect, useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { fetchRoadmapById, RoadmapDto, RoadmapNodeDto, ApiError } from '../../../lib/api/roadmap-client';
import {
  fetchDiscoveredCapabilities,
  fetchCapabilityFreshness,
  fetchRoadmapFreshnessRecommendations,
  fetchConflicts,
  fetchRecommendationSuppression,
  fetchPaceAdaptation,
  fetchProjectGaps,
  CapabilityFreshnessResponseDto,
  ConflictAnalysisDto,
  PaceAdaptationDto,
  ProjectGapResult,
  CapabilityFreshnessDto,
  FreshnessRecommendationDto,
  ConceptSuppressionDto,
  DiscoveredCapabilityDto,
} from '../../../lib/api/intelligence-client';
import { createNodeIntelligenceMap, NodeMappedIntelligence } from '../../../lib/utils/intelligence-mapper';
import { RoadmapHeader } from '../../../components/roadmap/RoadmapHeader';
import { RoadmapBreadcrumb } from '../../../components/roadmap/RoadmapBreadcrumb';
import { RoadmapCanvas } from '../../../components/roadmap/RoadmapCanvas';
import { NodeDetailPanel } from '../../../components/roadmap/NodeDetailPanel';
import { GoalImpactModal } from '../../../components/roadmap/GoalImpactModal';

export default function RoadmapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken } = useAuth();
  const router = useRouter();

  const [roadmap, setRoadmap] = useState<RoadmapDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);

  // Phase 5B Real-Time Intelligence State
  const [freshnessSummary, setFreshnessSummary] = useState<CapabilityFreshnessResponseDto['summary'] | null>(null);
  const [freshnessList, setFreshnessList] = useState<CapabilityFreshnessDto[]>([]);
  const [freshnessRecommendations, setFreshnessRecommendations] = useState<FreshnessRecommendationDto[]>([]);
  const [conflicts, setConflicts] = useState<ConflictAnalysisDto[]>([]);
  const [suppressionList, setSuppressionList] = useState<ConceptSuppressionDto[]>([]);
  const [paceAdaptation, setPaceAdaptation] = useState<PaceAdaptationDto | null>(null);
  const [projectGaps, setProjectGaps] = useState<ProjectGapResult[]>([]);
  const [discoveredCapabilities, setDiscoveredCapabilities] = useState<DiscoveredCapabilityDto[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Structural Roadmap Data
      const roadmapData = await fetchRoadmapById(id, accessToken);
      setRoadmap(roadmapData);

      // 2. Fetch Phase 5B Real-Time Intelligence (Parallel Execution - Zero N+1)
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
          fetchRoadmapFreshnessRecommendations(id, accessToken).catch(() => null),
          fetchConflicts(accessToken).catch(() => []),
          fetchRecommendationSuppression(accessToken).catch(() => null),
          fetchPaceAdaptation(id, accessToken).catch(() => null),
          fetchProjectGaps(id, accessToken).catch(() => null),
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
      } catch (intelErr) {
        // Intelligence failures degrade gracefully without blocking roadmap viewing
        console.warn('Phase 5B Intelligence overlay degraded gracefully:', intelErr);
      }

      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      if (err instanceof ApiError) {
        setError({ status: err.status, message: err.message });
      } else {
        setError({ status: 500, message: err.message || 'Failed to load roadmap details.' });
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [id, accessToken]);

  // Extract nodes from latest snapshot
  const flatNodes: RoadmapNodeDto[] = useMemo(() => {
    return roadmap?.snapshots?.[0]?.nodes || [];
  }, [roadmap]);

  // Pure in-memory intelligence lookup map keyed by nodeId
  const nodeIntelligenceMap: Map<string, NodeMappedIntelligence> = useMemo(() => {
    return createNodeIntelligenceMap(
      flatNodes,
      projectGaps,
      freshnessList,
      freshnessRecommendations,
      conflicts,
      suppressionList,
      discoveredCapabilities
    );
  }, [flatNodes, projectGaps, freshnessList, freshnessRecommendations, conflicts, suppressionList, discoveredCapabilities]);

  // Fast map lookup for node navigation
  const nodeMap = useMemo(() => {
    const map = new Map<string, RoadmapNodeDto>();
    for (const node of flatNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [flatNodes]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;
  const parentNode = selectedNode?.parentNodeId ? nodeMap.get(selectedNode.parentNodeId) || null : null;
  const childrenNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    return flatNodes.filter(n => n.parentNodeId === selectedNodeId);
  }, [flatNodes, selectedNodeId]);

  const { completedCount, totalCount } = useMemo(() => {
    let completed = 0;
    for (const n of flatNodes) {
      const m = n.mappings?.[0];
      if (m?.mappingStatus === 'KNOWN_UNVERIFIED' || m?.mappingStatus === 'COMPLETED' || m?.userConfirmation) {
        completed++;
      }
    }
    return { completedCount: completed, totalCount: flatNodes.length };
  }, [flatNodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setIsImpactModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelfReportSuccess = (mappingId: string) => {
    loadData();
  };

  if (error) {
    if (error.status === 403) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 border border-slate-200 text-center shadow-lg">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Forbidden (403)</h2>
            <p className="text-sm text-slate-600 mb-6">
              You do not have permission to view this roadmap or it belongs to another user.
            </p>
            <button
              onClick={() => router.push('/roadmaps')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors"
            >
              Return to My Roadmaps
            </button>
          </div>
        </div>
      );
    }

    if (error.status === 404) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 border border-slate-200 text-center shadow-lg">
            <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Roadmap Not Found (404)</h2>
            <p className="text-sm text-slate-600 mb-6">
              The requested roadmap with ID "{id}" could not be found.
            </p>
            <button
              onClick={() => router.push('/roadmaps')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors"
            >
              Back to Roadmaps List
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 border border-red-200 text-center shadow-lg">
          <h2 className="text-xl font-bold text-red-700 mb-2">Error Loading Roadmap</h2>
          <p className="text-sm text-slate-600 mb-6">{error.message}</p>
          <button
            onClick={loadData}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !roadmap) {
    return (
      <div className="min-h-screen bg-slate-50 animate-pulse">
        <div className="h-16 bg-white border-b border-slate-200" />
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="h-12 bg-slate-200 rounded-lg w-1/3" />
          <div className="h-[600px] bg-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Roadmap Workspace Header with 5B Intelligence Bar */}
      <RoadmapHeader
        roadmap={roadmap}
        nodeCount={totalCount}
        completedCount={completedCount}
        paceAdaptation={paceAdaptation}
        freshnessSummary={freshnessSummary}
        conflictsCount={conflicts.length}
        onOpenGoalImpactModal={() => setIsImpactModalOpen(true)}
      />

      {/* Breadcrumb Path Bar */}
      <RoadmapBreadcrumb
        roadmapTitle={roadmap.title}
        selectedNode={selectedNode}
        nodeMap={nodeMap}
        onSelectNode={nodeId => setSelectedNodeId(nodeId)}
      />

      {/* Main Visual Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        <RoadmapCanvas
          flatNodes={flatNodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={nodeId => setSelectedNodeId(nodeId)}
          nodeIntelligenceMap={nodeIntelligenceMap}
        />
      </main>

      {/* Slide-Over Selected Node Detail Drawer with 5B Intelligence */}
      <NodeDetailPanel
        node={selectedNode}
        parentNode={parentNode}
        childrenNodes={childrenNodes}
        isOpen={selectedNodeId !== null}
        onClose={() => setSelectedNodeId(null)}
        onSelectNode={nodeId => setSelectedNodeId(nodeId)}
        onSelfReportSuccess={handleSelfReportSuccess}
        accessToken={accessToken}
        mappedIntelligence={selectedNodeId ? nodeIntelligenceMap.get(selectedNodeId) : undefined}
      />

      {/* Goal Change Impact Preview Modal */}
      <GoalImpactModal
        roadmapId={roadmap.id}
        roadmapTitle={roadmap.title}
        isOpen={isImpactModalOpen}
        onClose={() => setIsImpactModalOpen(false)}
        accessToken={accessToken}
      />
    </div>
  );
}
