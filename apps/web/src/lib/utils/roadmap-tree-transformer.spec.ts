import { transformNodesToTree, TreeNode } from './roadmap-tree-transformer';
import { RoadmapNodeDto } from '../api/roadmap-client';

describe('roadmap-tree-transformer (Sub-Block 5A Requirements)', () => {
  const createMockNode = (id: string, parentNodeId: string | null = null, sortOrder: number = 0): RoadmapNodeDto => ({
    id,
    snapshotId: 'snap-1',
    externalNodeId: `ext-${id}`,
    parentNodeId,
    title: `Node ${id}`,
    nodeType: 'TOPIC',
    sortOrder,
    dependencies: [],
    resourceUrls: [],
  });

  it('1. Handles empty array safely', () => {
    const res = transformNodesToTree([]);
    expect(res).toEqual([]);
  });

  it('2. Transforms a single root node correctly', () => {
    const nodes = [createMockNode('node-1', null, 1)];
    const tree = transformNodesToTree(nodes);

    expect(tree.length).toBe(1);
    expect(tree[0].node.id).toBe('node-1');
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children).toEqual([]);
  });

  it('3. Transforms multiple root nodes', () => {
    const nodes = [
      createMockNode('root-2', null, 2),
      createMockNode('root-1', null, 1),
    ];
    const tree = transformNodesToTree(nodes);

    expect(tree.length).toBe(2);
    expect(tree[0].node.id).toBe('root-1');
    expect(tree[1].node.id).toBe('root-2');
  });

  it('4. Connects parent and child nodes', () => {
    const nodes = [
      createMockNode('root-1', null, 0),
      createMockNode('child-1', 'root-1', 0),
    ];
    const tree = transformNodesToTree(nodes);

    expect(tree.length).toBe(1);
    expect(tree[0].node.id).toBe('root-1');
    expect(tree[0].children.length).toBe(1);
    expect(tree[0].children[0].node.id).toBe('child-1');
    expect(tree[0].children[0].depth).toBe(1);
  });

  it('5. Handles multiple levels of nesting', () => {
    const nodes = [
      createMockNode('root', null, 0),
      createMockNode('level-1', 'root', 0),
      createMockNode('level-2', 'level-1', 0),
    ];
    const tree = transformNodesToTree(nodes);

    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[0].depth).toBe(1);
    expect(tree[0].children[0].children[0].depth).toBe(2);
    expect(tree[0].children[0].children[0].node.id).toBe('level-2');
  });

  it('6. Handles orphan nodes deterministically (non-existent parent)', () => {
    const nodes = [
      createMockNode('orphan', 'non-existent-parent-id', 0),
    ];
    const tree = transformNodesToTree(nodes);

    expect(tree.length).toBe(1);
    expect(tree[0].node.id).toBe('orphan');
    expect(tree[0].depth).toBe(0);
  });

  it('7. Handles invalid or self-referential parent references', () => {
    const nodes = [
      createMockNode('self-ref', 'self-ref', 0),
    ];
    const tree = transformNodesToTree(nodes);

    expect(tree.length).toBe(1);
    expect(tree[0].node.id).toBe('self-ref');
    expect(tree[0].depth).toBe(0);
  });

  it('8. Preserves sortOrder among siblings', () => {
    const nodes = [
      createMockNode('c3', 'root', 30),
      createMockNode('root', null, 0),
      createMockNode('c1', 'root', 10),
      createMockNode('c2', 'root', 20),
    ];
    const tree = transformNodesToTree(nodes);

    const childIds = tree[0].children.map(c => c.node.id);
    expect(childIds).toEqual(['c1', 'c2', 'c3']);
  });

  it('9. Preserves immutability of original input array and objects', () => {
    const originalNode = createMockNode('root', null, 0);
    const originalArray = [originalNode];

    const tree = transformNodesToTree(originalArray);

    expect(originalArray[0]).toBe(originalNode);
    expect(tree[0].node).not.toBe(originalNode); // Cloned
    expect(tree[0].node.id).toBe(originalNode.id);
  });
});
