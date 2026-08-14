import { RoadmapNodeDto } from '../api/roadmap-client';

export interface TreeNode {
  node: RoadmapNodeDto;
  children: TreeNode[];
  depth: number;
}

/**
 * Pure in-memory transformation converting a flat RoadmapNode array into a hierarchical TreeNode tree.
 * Preserves canonical sortOrder, handles orphan nodes safely, and never mutates input arrays.
 */
export function transformNodesToTree(flatNodes: RoadmapNodeDto[] = []): TreeNode[] {
  if (!Array.isArray(flatNodes) || flatNodes.length === 0) {
    return [];
  }

  // Create deep clones/wrappers to prevent mutation of the input array or objects
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Step 1: Map every node to a TreeNode wrapper
  for (const node of flatNodes) {
    nodeMap.set(node.id, {
      node: { ...node },
      children: [],
      depth: 0,
    });
  }

  // Step 2: Build parent-child relationships
  for (const node of flatNodes) {
    const current = nodeMap.get(node.id)!;
    const parentId = node.parentNodeId;

    if (parentId && nodeMap.has(parentId) && parentId !== node.id) {
      const parent = nodeMap.get(parentId)!;
      parent.children.push(current);
    } else {
      // Root node or orphan node (non-existent parent or self-referential parent)
      roots.push(current);
    }
  }

  // Step 3: Sort siblings recursively by sortOrder and calculate depths
  function sortAndAssignDepth(nodes: TreeNode[], depth: number) {
    nodes.sort((a, b) => (a.node.sortOrder ?? 0) - (b.node.sortOrder ?? 0));
    for (const treeNode of nodes) {
      treeNode.depth = depth;
      if (treeNode.children.length > 0) {
        sortAndAssignDepth(treeNode.children, depth + 1);
      }
    }
  }

  sortAndAssignDepth(roots, 0);

  return roots;
}
