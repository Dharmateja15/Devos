import { RoadmapNodeDto } from '../api/roadmap-client';
import {
  CapabilityFreshnessDto,
  DiscoveredCapabilityDto,
  FreshnessRecommendationDto,
  ConflictAnalysisDto,
  ConceptSuppressionDto,
  ProjectGapResult,
} from '../api/intelligence-client';

export interface NodeMappedIntelligence {
  nodeId: string;
  projectGap?: ProjectGapResult;
  freshness?: CapabilityFreshnessDto;
  freshnessRecommendation?: FreshnessRecommendationDto;
  conflict?: ConflictAnalysisDto;
  suppression?: ConceptSuppressionDto;
  discoveredCapability?: DiscoveredCapabilityDto;
}

/**
 * Pure in-memory mapper resolving backend Phase 4 intelligence items to RoadmapNodes.
 * Uses strict primary UUID identity matching first, canonical concept identity second,
 * and unambiguous title matching as a last-resort display fallback.
 */
export function createNodeIntelligenceMap(
  nodes: RoadmapNodeDto[] = [],
  projectGaps: ProjectGapResult[] = [],
  freshnessList: CapabilityFreshnessDto[] = [],
  freshnessRecommendations: FreshnessRecommendationDto[] = [],
  conflicts: ConflictAnalysisDto[] = [],
  suppressionList: ConceptSuppressionDto[] = [],
  discoveredCapabilities: DiscoveredCapabilityDto[] = []
): Map<string, NodeMappedIntelligence> {
  const result = new Map<string, NodeMappedIntelligence>();

  if (!nodes || nodes.length === 0) return result;

  // Track title frequencies to guard against ambiguous title mappings
  const titleCountMap = new Map<string, number>();
  const nodesByTitleMap = new Map<string, RoadmapNodeDto[]>();

  for (const node of nodes) {
    result.set(node.id, { nodeId: node.id });
    const normalizedTitle = node.title.toLowerCase().trim();
    titleCountMap.set(normalizedTitle, (titleCountMap.get(normalizedTitle) || 0) + 1);

    if (!nodesByTitleMap.has(normalizedTitle)) {
      nodesByTitleMap.set(normalizedTitle, []);
    }
    nodesByTitleMap.get(normalizedTitle)!.push(node);
  }

  // 1. Map Project Gaps (PRIMARY IDENTITY: Exact RoadmapNode UUID match!)
  for (const gap of projectGaps) {
    if (gap.nodeId && result.has(gap.nodeId)) {
      result.get(gap.nodeId)!.projectGap = gap;
    } else {
      // Fallback title match if unambiguous
      const normTitle = gap.nodeTitle.toLowerCase().trim();
      if (titleCountMap.get(normTitle) === 1) {
        const matchingNode = nodesByTitleMap.get(normTitle)![0];
        result.get(matchingNode.id)!.projectGap = gap;
      }
    }
  }

  // Helper for concept/title lookup
  function findMatchingNodes(conceptId?: string, conceptTitle?: string): RoadmapNodeDto[] {
    const matches: RoadmapNodeDto[] = [];
    const normTitle = conceptTitle?.toLowerCase().trim();

    for (const node of nodes) {
      const mapping = node.mappings?.[0];
      if (conceptId && (mapping?.skillId === conceptId || (node as any).conceptId === conceptId)) {
        matches.push(node);
      }
    }

    if (matches.length > 0) return matches;

    // Fallback: title lookup ONLY IF unambiguous (title occurs exactly once)
    if (normTitle && titleCountMap.get(normTitle) === 1) {
      const titleMatches = nodesByTitleMap.get(normTitle);
      if (titleMatches && titleMatches.length === 1) {
        return titleMatches;
      }
    }

    return [];
  }

  // 2. Map Capability Freshness
  for (const freshness of freshnessList) {
    const matched = findMatchingNodes(freshness.conceptId, freshness.capabilityTitle);
    for (const node of matched) {
      result.get(node.id)!.freshness = freshness;
    }
  }

  // 3. Map Freshness Recommendations
  for (const rec of freshnessRecommendations) {
    const matched = findMatchingNodes(rec.conceptId, rec.conceptTitle);
    for (const node of matched) {
      result.get(node.id)!.freshnessRecommendation = rec;
    }
  }

  // 4. Map Conflicts
  for (const conflict of conflicts) {
    const matched = findMatchingNodes(conflict.conceptId, conflict.conceptTitle);
    for (const node of matched) {
      result.get(node.id)!.conflict = conflict;
    }
  }

  // 5. Map Recommendation Suppression
  for (const supp of suppressionList) {
    const matched = findMatchingNodes(supp.conceptId, supp.conceptTitle);
    for (const node of matched) {
      result.get(node.id)!.suppression = supp;
    }
  }

  // 6. Map Discovered Capabilities
  for (const cap of discoveredCapabilities) {
    const matched = findMatchingNodes(cap.conceptId, cap.conceptTitle);
    for (const node of matched) {
      result.get(node.id)!.discoveredCapability = cap;
    }
  }

  return result;
}
