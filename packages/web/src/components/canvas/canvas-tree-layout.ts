import type {
  CanvasTreeRenderEdgeGeometry,
  CanvasTreeLayoutMode,
  CanvasTreeNodeRecord,
  CanvasTreeRenderEdge,
  CanvasTreeRenderLayout,
  CanvasTreeRenderNode,
  CanvasTreeSnapshotRecord
} from "./canvas-tree-types";

const LEFT_PADDING = 88;
const RIGHT_PADDING = 280;
const TOP_PADDING = 84;
const BOTTOM_PADDING = 96;
const COLUMN_GAP = 280;
const COLUMN_WIDTH = 228;
const NODE_WIDTH = 224;
const NODE_HEIGHT = 84;
const LEAF_GAP = 22;
const RADIAL_PADDING = 220;
const RADIAL_RING_GAP = 220;
export const CANVAS_TREE_DOT_RADIUS = 8;

const getCanvasTreeStructuralRootId = (snapshot: CanvasTreeSnapshotRecord) =>
  snapshot.nodes.find((node) => node.parentId === null)?.id || snapshot.rootNodeId;

const getCanvasTreeDepthRange = (nodes: CanvasTreeNodeRecord[]) => {
  const depths = nodes.map((node) => node.depth);
  return {
    minDepth: Math.min(...depths),
    maxDepth: Math.max(...depths)
  };
};

const formatDepthLabel = (depth: number, minDepth: number) => {
  if (depth < 0) {
    return "Root";
  }

  if (depth === 0 && minDepth >= 0) {
    return "Root";
  }

  return `Depth ${depth}`;
};

const getSubtreeLeafCount = (
  nodeId: string,
  nodeById: Map<string, CanvasTreeNodeRecord>
): number => {
  const node = nodeById.get(nodeId);

  if (!node || node.childIds.length === 0) {
    return 1;
  }

  return node.childIds.reduce(
    (total, childId) => total + getSubtreeLeafCount(childId, nodeById),
    0
  );
};

const assignVerticalPositions = (
  nodeId: string,
  nodeById: Map<string, CanvasTreeNodeRecord>,
  leafCountById: Map<string, number>,
  startLeafIndex: number,
  yByNodeId: Map<string, number>
) => {
  const node = nodeById.get(nodeId);

  if (!node) {
    return startLeafIndex;
  }

  const subtreeLeafCount = leafCountById.get(nodeId) || 1;

  if (node.childIds.length === 0) {
    yByNodeId.set(nodeId, TOP_PADDING + startLeafIndex * LEAF_GAP);
    return startLeafIndex + 1;
  }

  let cursor = startLeafIndex;
  for (const childId of node.childIds) {
    cursor = assignVerticalPositions(childId, nodeById, leafCountById, cursor, yByNodeId);
  }

  const firstLeafY = TOP_PADDING + startLeafIndex * LEAF_GAP;
  const lastLeafY = TOP_PADDING + (startLeafIndex + subtreeLeafCount - 1) * LEAF_GAP;
  yByNodeId.set(nodeId, (firstLeafY + lastLeafY) / 2);

  return cursor;
};

const buildTreePath = (source: CanvasTreeRenderNode, target: CanvasTreeRenderNode) => {
  const startX = source.x + source.width / 2;
  const startY = source.y;
  const endX = target.x - target.width / 2;
  const endY = target.y;
  const controlX = startX + (endX - startX) * 0.5;

  return `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
};

const buildRadialTreePath = (source: CanvasTreeRenderNode, target: CanvasTreeRenderNode) => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy) || 1;
  const startX = source.x + (dx / distance) * (source.width / 2);
  const startY = source.y + (dy / distance) * (source.height / 2);
  const endX = target.x - (dx / distance) * (target.width / 2);
  const endY = target.y - (dy / distance) * (target.height / 2);
  const controlX = (startX + endX) / 2;
  const controlY = (startY + endY) / 2;

  return `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`;
};

const getNodeVisualExtent = (node: CanvasTreeRenderNode, expanded: boolean) =>
  expanded ? Math.min(node.width, node.height) * 0.42 : CANVAS_TREE_DOT_RADIUS;

const buildPhylogenyLayout = (
  snapshot: CanvasTreeSnapshotRecord,
  nodes: CanvasTreeNodeRecord[],
  nodeById: Map<string, CanvasTreeNodeRecord>,
  leafCountById: Map<string, number>
): CanvasTreeRenderLayout => {
  const structuralRootId = getCanvasTreeStructuralRootId(snapshot);
  const yByNodeId = new Map<string, number>();
  assignVerticalPositions(structuralRootId, nodeById, leafCountById, 0, yByNodeId);

  const { minDepth, maxDepth } = getCanvasTreeDepthRange(nodes);
  const columns = Array.from({ length: maxDepth - minDepth + 1 }, (_, index) => {
    const depth = minDepth + index;

    return {
      depth,
      label: formatDepthLabel(depth, minDepth),
      x: LEFT_PADDING + index * COLUMN_GAP,
      width: COLUMN_WIDTH
    };
  });

  const renderNodes: CanvasTreeRenderNode[] = nodes.map((node) => ({
    ...node,
    x: LEFT_PADDING + (node.depth - minDepth) * COLUMN_GAP + COLUMN_WIDTH / 2,
    y: yByNodeId.get(node.id) ?? TOP_PADDING,
    width: NODE_WIDTH,
    height: NODE_HEIGHT
  }));
  const renderNodeById = new Map(renderNodes.map((node) => [node.id, node]));
  const renderEdges: CanvasTreeRenderEdge[] = snapshot.links
    .map((link) => {
      const source = renderNodeById.get(link.sourceId);
      const target = renderNodeById.get(link.targetId);

      if (!source || !target) {
        return null;
      }

      return {
        ...link,
        path: buildTreePath(source, target),
        labelX: (source.x + target.x) / 2,
        labelY: (source.y + target.y) / 2 - 10
      };
    })
    .filter((edge): edge is CanvasTreeRenderEdge => Boolean(edge));

  const maxLeafCount = leafCountById.get(structuralRootId) || 1;
  const height = TOP_PADDING + Math.max(maxLeafCount - 1, 0) * LEAF_GAP + BOTTOM_PADDING;
  const width = LEFT_PADDING + columns.length * COLUMN_GAP + RIGHT_PADDING;

  return {
    mode: "phylogeny",
    width,
    height,
    columns,
    rings: [],
    centerX: width / 2,
    centerY: height / 2,
    nodes: renderNodes,
    edges: renderEdges
  };
};

const assignRadialAngles = (
  nodeId: string,
  structuralRootId: string,
  nodeById: Map<string, CanvasTreeNodeRecord>,
  leafCountById: Map<string, number>,
  startAngle: number,
  endAngle: number,
  angleByNodeId: Map<string, number>
) => {
  const node = nodeById.get(nodeId);

  if (!node) {
    return;
  }

  if (node.childIds.length === 0) {
    angleByNodeId.set(nodeId, (startAngle + endAngle) / 2);
    return;
  }

  const totalLeaves = leafCountById.get(nodeId) || 1;
  let cursor = startAngle;

  for (const childId of node.childIds) {
    const childLeaves = leafCountById.get(childId) || 1;
    const span = ((endAngle - startAngle) * childLeaves) / totalLeaves;
    assignRadialAngles(
      childId,
      structuralRootId,
      nodeById,
      leafCountById,
      cursor,
      cursor + span,
      angleByNodeId
    );
    cursor += span;
  }

  if (node.id === structuralRootId) {
    angleByNodeId.set(nodeId, -Math.PI / 2);
    return;
  }

  const childAngles = node.childIds
    .map((childId) => angleByNodeId.get(childId))
    .filter((angle): angle is number => typeof angle === "number");

  angleByNodeId.set(
    nodeId,
    childAngles.length
      ? childAngles.reduce((total, angle) => total + angle, 0) / childAngles.length
      : (startAngle + endAngle) / 2
  );
};

const buildRadialLayout = (
  snapshot: CanvasTreeSnapshotRecord,
  nodes: CanvasTreeNodeRecord[],
  nodeById: Map<string, CanvasTreeNodeRecord>,
  leafCountById: Map<string, number>
): CanvasTreeRenderLayout => {
  const structuralRootId = getCanvasTreeStructuralRootId(snapshot);
  const { minDepth, maxDepth } = getCanvasTreeDepthRange(nodes);
  const maxRelativeDepth = Math.max(maxDepth - minDepth, 0);
  const outerRadius = Math.max(maxRelativeDepth, 1) * RADIAL_RING_GAP;
  const width = outerRadius * 2 + RADIAL_PADDING * 2;
  const height = outerRadius * 2 + RADIAL_PADDING * 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const angleByNodeId = new Map<string, number>();
  assignRadialAngles(
    structuralRootId,
    structuralRootId,
    nodeById,
    leafCountById,
    -Math.PI / 2,
    Math.PI * 1.5,
    angleByNodeId
  );

  const rings = Array.from({ length: maxRelativeDepth + 1 }, (_, index) => {
    const depth = minDepth + index;

    return {
      depth,
      label: formatDepthLabel(depth, minDepth),
      cx: centerX,
      cy: centerY,
      radius: index * RADIAL_RING_GAP
    };
  });

  const renderNodes: CanvasTreeRenderNode[] = nodes.map((node) => {
    if (node.id === structuralRootId) {
      return {
        ...node,
        x: centerX,
        y: centerY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      };
    }

    const angle = angleByNodeId.get(node.id) ?? -Math.PI / 2;
    const radius = Math.max(node.depth - minDepth, 0) * RADIAL_RING_GAP;

    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      width: NODE_WIDTH,
      height: NODE_HEIGHT
    };
  });
  const renderNodeById = new Map(renderNodes.map((node) => [node.id, node]));
  const renderEdges: CanvasTreeRenderEdge[] = snapshot.links
    .map((link) => {
      const source = renderNodeById.get(link.sourceId);
      const target = renderNodeById.get(link.targetId);

      if (!source || !target) {
        return null;
      }

      return {
        ...link,
        path: buildRadialTreePath(source, target),
        labelX: (source.x + target.x) / 2,
        labelY: (source.y + target.y) / 2 - 12
      };
    })
    .filter((edge): edge is CanvasTreeRenderEdge => Boolean(edge));

  return {
    mode: "radial",
    width,
    height,
    columns: [],
    rings,
    centerX,
    centerY,
    nodes: renderNodes,
    edges: renderEdges
  };
};

export const buildCanvasTreeLayout = (
  snapshot: CanvasTreeSnapshotRecord,
  mode: CanvasTreeLayoutMode = "phylogeny"
): CanvasTreeRenderLayout => {
  const nodes = [...snapshot.nodes].sort(
    (left, right) =>
      left.depth - right.depth ||
      left.label.localeCompare(right.label) ||
      left.id.localeCompare(right.id)
  );
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const leafCountById = new Map<string, number>();

  for (const node of nodes) {
    leafCountById.set(node.id, getSubtreeLeafCount(node.id, nodeById));
  }

  if (mode === "radial") {
    return buildRadialLayout(snapshot, nodes, nodeById, leafCountById);
  }

  return buildPhylogenyLayout(snapshot, nodes, nodeById, leafCountById);
};

export const buildCanvasTreeDefaultViewBox = (layout: CanvasTreeRenderLayout) => ({
  x: 0,
  y: 0,
  width: layout.width,
  height: layout.height
});

export const getCanvasTreeEdgeGeometry = ({
  layout,
  edge,
  nodeById,
  expandedNodeIds
}: {
  layout: CanvasTreeRenderLayout;
  edge: CanvasTreeRenderEdge;
  nodeById: Map<string, CanvasTreeRenderNode>;
  expandedNodeIds: Set<string>;
}): CanvasTreeRenderEdgeGeometry => {
  const source = nodeById.get(edge.sourceId);
  const target = nodeById.get(edge.targetId);

  if (!source || !target) {
    return {
      path: edge.path,
      labelX: edge.labelX,
      labelY: edge.labelY
    };
  }

  if (layout.mode === "radial") {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const sourceExtent = getNodeVisualExtent(source, expandedNodeIds.has(source.id));
    const targetExtent = getNodeVisualExtent(target, expandedNodeIds.has(target.id));
    const startX = source.x + (dx / distance) * sourceExtent;
    const startY = source.y + (dy / distance) * sourceExtent;
    const endX = target.x - (dx / distance) * targetExtent;
    const endY = target.y - (dy / distance) * targetExtent;
    const controlX = (startX + endX) / 2;
    const controlY = (startY + endY) / 2;

    return {
      path: `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`,
      labelX: controlX,
      labelY: controlY - 12
    };
  }

  const direction = target.x >= source.x ? 1 : -1;
  const sourceExtent = expandedNodeIds.has(source.id) ? source.width / 2 : CANVAS_TREE_DOT_RADIUS;
  const targetExtent = expandedNodeIds.has(target.id) ? target.width / 2 : CANVAS_TREE_DOT_RADIUS;
  const startX = source.x + direction * sourceExtent;
  const startY = source.y;
  const endX = target.x - direction * targetExtent;
  const endY = target.y;
  const controlX = startX + (endX - startX) * 0.5;

  return {
    path: `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - 10
  };
};

export const getCanvasTreeLineageNodeIds = (
  snapshot: CanvasTreeSnapshotRecord,
  nodeId: string | null
) => {
  if (!nodeId) {
    return new Set<string>();
  }

  const node = snapshot.nodes.find((entry) => entry.id === nodeId);

  if (!node) {
    return new Set<string>();
  }

  return new Set([...node.lineage, node.id]);
};

export const getCanvasTreeLineageEdgeIds = (
  snapshot: CanvasTreeSnapshotRecord,
  nodeId: string | null
) => {
  if (!nodeId) {
    return new Set<string>();
  }

  const lineageNodeIds = getCanvasTreeLineageNodeIds(snapshot, nodeId);
  return new Set(
    snapshot.links
      .filter(
        (link) => lineageNodeIds.has(link.sourceId) && lineageNodeIds.has(link.targetId)
      )
      .map((link) => link.id)
  );
};

export const mockCanvasTreeSnapshot: CanvasTreeSnapshotRecord = {
  contractVersion: 1,
  generatedAt: "2026-03-30T18:20:00.000Z",
  canvasPath: "main.canvas",
  rootNodeId: "focus-note",
  rootLabel: "recurring dream fragment",
  maxDepthRequested: 3,
  maxDepthResolved: 2,
  nodeCount: 5,
  linkCount: 4,
  truncated: true,
  availableRoots: [
    {
      id: "focus-note",
      label: "recurring dream fragment",
      kind: "file",
      category: "fragment",
      notePath: "fragments/recurring-dream-fragment.md",
      canvasFile: "main.canvas"
    }
  ],
  nodes: [
    {
      id: "focus-note",
      parentId: null,
      depth: 0,
      label: "recurring dream fragment",
      notePath: "fragments/recurring-dream-fragment.md",
      kind: "file",
      category: "fragment",
      canvasFile: "main.canvas",
      relationshipFamily: "root",
      relationshipReason: "selected root",
      lineage: [],
      childIds: ["concept-a", "concept-b"],
      descendantCount: 4,
      degree: 5,
      touchedByPrompt: true,
      tentative: false,
      score: Number.MAX_SAFE_INTEGER,
      xHint: 40,
      yHint: 40,
      virtual: false,
      defaultCollapsed: false
    },
    {
      id: "concept-a",
      parentId: "focus-note",
      depth: 1,
      label: "sleep fragmentation",
      notePath: "concepts/sleep-fragmentation.md",
      kind: "file",
      category: "concept",
      canvasFile: "main.canvas",
      relationshipFamily: "canvas",
      relationshipReason: "canvas edge: supports",
      lineage: ["focus-note"],
      childIds: ["concept-c"],
      descendantCount: 1,
      degree: 4,
      touchedByPrompt: false,
      tentative: false,
      score: 512,
      xHint: 260,
      yHint: 40,
      virtual: false,
      defaultCollapsed: false
    },
    {
      id: "concept-b",
      parentId: "focus-note",
      depth: 1,
      label: "frequency illusion",
      notePath: "concepts/frequency-illusion.md",
      kind: "file",
      category: "concept",
      canvasFile: "main.canvas",
      relationshipFamily: "tentative-canvas",
      relationshipReason: "tentative canvas edge: possible overlap",
      lineage: ["focus-note"],
      childIds: ["concept-d"],
      descendantCount: 1,
      degree: 2,
      touchedByPrompt: false,
      tentative: true,
      score: 412,
      xHint: 260,
      yHint: 180,
      virtual: false,
      defaultCollapsed: false
    },
    {
      id: "concept-c",
      parentId: "concept-a",
      depth: 2,
      label: "sleep cadence",
      notePath: "concepts/sleep-cadence.md",
      kind: "file",
      category: "concept",
      canvasFile: "main.canvas",
      relationshipFamily: "document",
      relationshipReason: "document link from parent note",
      lineage: ["focus-note", "concept-a"],
      childIds: [],
      descendantCount: 0,
      degree: 1,
      touchedByPrompt: true,
      tentative: false,
      score: 305,
      xHint: 520,
      yHint: 40,
      virtual: false,
      defaultCollapsed: false
    },
    {
      id: "concept-d",
      parentId: "concept-b",
      depth: 2,
      label: "shared context branch",
      notePath: "concepts/shared-context-branch.md",
      kind: "file",
      category: "concept",
      canvasFile: "main.canvas",
      relationshipFamily: "context",
      relationshipReason: "shared dir concepts",
      lineage: ["focus-note", "concept-b"],
      childIds: [],
      descendantCount: 0,
      degree: 1,
      touchedByPrompt: false,
      tentative: false,
      score: 220,
      xHint: 520,
      yHint: 180,
      virtual: false,
      defaultCollapsed: false
    }
  ],
  links: [
    {
      id: "focus-note->concept-a",
      sourceId: "focus-note",
      targetId: "concept-a",
      depth: 1,
      relationshipFamily: "canvas",
      relationshipReason: "canvas edge: supports",
      tentative: false,
      weight: 1
    },
    {
      id: "focus-note->concept-b",
      sourceId: "focus-note",
      targetId: "concept-b",
      depth: 1,
      relationshipFamily: "tentative-canvas",
      relationshipReason: "tentative canvas edge: possible overlap",
      tentative: true,
      weight: 1
    },
    {
      id: "concept-a->concept-c",
      sourceId: "concept-a",
      targetId: "concept-c",
      depth: 2,
      relationshipFamily: "document",
      relationshipReason: "document link from parent note",
      tentative: false,
      weight: 0.65
    },
    {
      id: "concept-b->concept-d",
      sourceId: "concept-b",
      targetId: "concept-d",
      depth: 2,
      relationshipFamily: "context",
      relationshipReason: "shared dir concepts",
      tentative: false,
      weight: 0.5
    }
  ],
  summary: {
    availableRootCount: 1,
    visibleLeafCount: 2,
    visibleBranchCount: 3,
    hiddenByDepthCount: 3,
    relationshipFamilyCounts: {
      canvas: 1,
      "tentative-canvas": 1,
      document: 1,
      context: 1,
      bridge: 0
    }
  }
};
