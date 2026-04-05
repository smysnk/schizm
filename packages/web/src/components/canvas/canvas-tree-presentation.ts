import type {
  CanvasTreeNodeRecord,
  CanvasTreeRootOptionRecord,
  CanvasTreeSnapshotRecord
} from "./canvas-tree-types";

export type CanvasTreeRelationCell =
  | {
      kind: "node";
      nodeId: string;
      label: string;
      summary: string;
      tooltip: string;
    }
  | {
      kind: "overflow";
      label: string;
      summary: string;
      tooltip: string;
    };

export type CanvasTreeRelationRow = {
  parent: CanvasTreeRelationCell | null;
  child: CanvasTreeRelationCell | null;
};

const buildNodeById = (snapshot: CanvasTreeSnapshotRecord) =>
  new Map(snapshot.nodes.map((node) => [node.id, node]));

const formatTreeToken = (value: string) => value.replace(/[-_]+/g, " ");

const summarizeTreeNode = (node: CanvasTreeNodeRecord) => {
  const parts = node.virtual
    ? ["virtual root"]
    : [formatTreeToken(node.kind), formatTreeToken(node.category)];

  if (node.tentative) {
    parts.push("tentative");
  }

  if (node.touchedByPrompt) {
    parts.push("touched");
  }

  return parts.join(" · ");
};

const buildTreeNodeTooltip = (node: CanvasTreeNodeRecord) =>
  [
    node.label,
    `Type: ${summarizeTreeNode(node)}`,
    `Relationship: ${formatTreeToken(node.relationshipFamily)}`,
    `Reason: ${node.relationshipReason}`,
    node.notePath ? `Note: ${node.notePath}` : null,
    `Canvas: ${node.canvasFile}`
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");

const buildRelationCell = (node: CanvasTreeNodeRecord): CanvasTreeRelationCell => ({
  kind: "node",
  nodeId: node.id,
  label: node.label,
  summary: summarizeTreeNode(node),
  tooltip: buildTreeNodeTooltip(node)
});

const buildOverflowRelationCell = (
  hiddenCount: number,
  relationLabel: "parent" | "child"
): CanvasTreeRelationCell => ({
  kind: "overflow",
  label: `+${hiddenCount} more`,
  summary: `${
    relationLabel === "child"
      ? hiddenCount === 1
        ? "child"
        : "children"
      : hiddenCount === 1
        ? "parent"
        : "parents"
  } not shown`,
  tooltip: `${hiddenCount} additional ${
    relationLabel === "child"
      ? hiddenCount === 1
        ? "child"
        : "children"
      : hiddenCount === 1
        ? "parent"
        : "parents"
  } are not shown in this condensed list.`
});

const limitRelationCells = (
  nodes: CanvasTreeNodeRecord[],
  relationLabel: "parent" | "child",
  maxRows: number
) => {
  if (nodes.length <= maxRows) {
    return nodes.map(buildRelationCell);
  }

  const visibleLimit = Math.max(maxRows - 1, 0);
  const visibleNodes = nodes.slice(0, visibleLimit).map(buildRelationCell);

  return [
    ...visibleNodes,
    buildOverflowRelationCell(nodes.length - visibleLimit, relationLabel)
  ];
};

const collectDescendantIds = (
  nodeId: string,
  nodeById: Map<string, CanvasTreeNodeRecord>,
  descendantIds: Set<string>
) => {
  const node = nodeById.get(nodeId);

  if (!node) {
    return;
  }

  for (const childId of node.childIds) {
    if (descendantIds.has(childId)) {
      continue;
    }

    descendantIds.add(childId);
    collectDescendantIds(childId, nodeById, descendantIds);
  }
};

export const getCanvasTreeCollapsedDescendantIds = (
  snapshot: CanvasTreeSnapshotRecord,
  collapsedNodeIds: Iterable<string>
) => {
  const nodeById = buildNodeById(snapshot);
  const descendantIds = new Set<string>();

  for (const nodeId of collapsedNodeIds) {
    collectDescendantIds(nodeId, nodeById, descendantIds);
  }

  return descendantIds;
};

export const getVisibleCanvasTreeSnapshot = (
  snapshot: CanvasTreeSnapshotRecord,
  collapsedNodeIds: Iterable<string>
) => {
  const descendantIds = getCanvasTreeCollapsedDescendantIds(snapshot, collapsedNodeIds);
  const visibleNodes = snapshot.nodes
    .filter((node) => !descendantIds.has(node.id))
    .map((node) => ({
      ...node,
      childIds: node.childIds.filter((childId) => !descendantIds.has(childId))
    }));
  const visibleLinks = snapshot.links.filter((link) => !descendantIds.has(link.targetId));
  const visibleLeafCount = visibleNodes.filter((node) => node.childIds.length === 0).length;
  const visibleBranchCount = visibleNodes.length - visibleLeafCount;

  return {
    ...snapshot,
    nodeCount: visibleNodes.length,
    linkCount: visibleLinks.length,
    nodes: visibleNodes,
    links: visibleLinks,
    summary: {
      ...snapshot.summary,
      visibleLeafCount,
      visibleBranchCount
    }
  };
};

export const getDefaultCollapsedCanvasTreeNodeIds = (
  snapshot: CanvasTreeSnapshotRecord | null
) => {
  if (!snapshot) {
    return [];
  }

  return snapshot.nodes
    .filter((node) => node.defaultCollapsed)
    .map((node) => node.id);
};

export const filterCanvasTreeRoots = (
  roots: CanvasTreeRootOptionRecord[],
  query: string
) => {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return roots;
  }

  return roots.filter((root) => {
    const haystack = [root.label, root.notePath || "", root.kind, root.category]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
};

export const getCanvasTreeRelationRows = ({
  snapshot,
  nodeId,
  maxRows = 10
}: {
  snapshot: CanvasTreeSnapshotRecord | null;
  nodeId: string | null;
  maxRows?: number;
}): CanvasTreeRelationRow[] => {
  if (!snapshot || !nodeId || maxRows <= 0) {
    return [];
  }

  const nodeById = buildNodeById(snapshot);
  const selectedNode = nodeById.get(nodeId);

  if (!selectedNode) {
    return [];
  }

  const parentNodes = selectedNode.parentId
    ? [nodeById.get(selectedNode.parentId)].filter(
        (node): node is CanvasTreeNodeRecord => Boolean(node)
      )
    : [];
  const childNodes = selectedNode.childIds
    .map((childId) => nodeById.get(childId))
    .filter((node): node is CanvasTreeNodeRecord => Boolean(node));

  const parentCells = limitRelationCells(parentNodes, "parent", maxRows);
  const childCells = limitRelationCells(childNodes, "child", maxRows);
  const rowCount = Math.max(1, parentCells.length, childCells.length);

  return Array.from({ length: Math.min(maxRows, rowCount) }, (_, index) => ({
    parent: parentCells[index] || null,
    child: childCells[index] || null
  }));
};

export const getCanvasTreeEmptyState = ({
  snapshot,
  visibleSnapshot,
  rootSearchQuery,
  filteredRootsCount
}: {
  snapshot: CanvasTreeSnapshotRecord | null;
  visibleSnapshot: CanvasTreeSnapshotRecord | null;
  rootSearchQuery: string;
  filteredRootsCount: number;
}) => {
  if (!snapshot) {
    return {
      title: "Tree of life data is not available yet.",
      detail: "Once the current canvas has graphable nodes, the tree view will appear here."
    };
  }

  if (snapshot.availableRoots.length === 0) {
    return {
      title: "No valid root nodes are available for this canvas.",
      detail: "Add note-backed nodes to the canvas or switch to a canvas with a stronger note structure."
    };
  }

  if (rootSearchQuery.trim() && filteredRootsCount === 0) {
    return {
      title: "No roots match the current search.",
      detail: "Clear the root search or try a broader phrase."
    };
  }

  if (!visibleSnapshot || visibleSnapshot.nodeCount <= 1) {
    if (snapshot.summary.hiddenByDepthCount > 0) {
      return {
        title: "This root does not have visible descendants at the current depth.",
        detail: `Increase "Layers deep" or choose a different root to explore a wider lineage.`
      };
    }

    return {
      title: "The selected root is isolated right now.",
      detail: "Choose a different root or enrich the canvas relationships around this note."
    };
  }

  return null;
};
