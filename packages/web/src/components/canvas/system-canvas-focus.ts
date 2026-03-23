import type { SystemCanvasSnapshotRecord } from "../../lib/graphql";
import type { SystemCanvasRenderLayout } from "./system-canvas-types";

export type SystemCanvasViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SystemCanvasFocusState = {
  focusedNodeIds: Set<string>;
  focusedEdgeIds: Set<string>;
  dimmedNodeIds: Set<string>;
  hiddenEdgeIds: Set<string>;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const buildAdjacency = (snapshot: SystemCanvasSnapshotRecord) => {
  const adjacency = new Map<string, Set<string>>();

  for (const node of snapshot.nodes) {
    adjacency.set(node.id, new Set());
  }

  for (const edge of snapshot.edges) {
    adjacency.get(edge.sourceId)?.add(edge.targetId);
    adjacency.get(edge.targetId)?.add(edge.sourceId);
  }

  return adjacency;
};

export const getSystemCanvasNeighborhood = (
  snapshot: SystemCanvasSnapshotRecord,
  nodeId: string | null,
  maxDepth = 1
) => {
  if (!nodeId || !snapshot.nodes.some((node) => node.id === nodeId)) {
    return new Set<string>();
  }

  const adjacency = buildAdjacency(snapshot);
  const visited = new Set<string>([nodeId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || current.depth >= maxDepth) {
      continue;
    }

    for (const neighborId of adjacency.get(current.id) || []) {
      if (visited.has(neighborId)) {
        continue;
      }

      visited.add(neighborId);
      queue.push({ id: neighborId, depth: current.depth + 1 });
    }
  }

  return visited;
};

export const buildSystemCanvasFocusState = (
  snapshot: SystemCanvasSnapshotRecord,
  {
    selectedNodeId,
    enabled,
    maxDepth = 1
  }: {
    selectedNodeId: string | null;
    enabled: boolean;
    maxDepth?: number;
  }
): SystemCanvasFocusState => {
  if (!enabled || !selectedNodeId) {
    return {
      focusedNodeIds: new Set(snapshot.nodes.map((node) => node.id)),
      focusedEdgeIds: new Set(snapshot.edges.map((edge) => edge.id)),
      dimmedNodeIds: new Set<string>(),
      hiddenEdgeIds: new Set<string>()
    };
  }

  const focusedNodeIds = getSystemCanvasNeighborhood(snapshot, selectedNodeId, maxDepth);
  const focusedEdgeIds = new Set(
    snapshot.edges
      .filter(
        (edge) => focusedNodeIds.has(edge.sourceId) && focusedNodeIds.has(edge.targetId)
      )
      .map((edge) => edge.id)
  );

  return {
    focusedNodeIds,
    focusedEdgeIds,
    dimmedNodeIds: new Set(
      snapshot.nodes
        .map((node) => node.id)
        .filter((nodeId) => !focusedNodeIds.has(nodeId))
    ),
    hiddenEdgeIds: new Set(
      snapshot.edges
        .map((edge) => edge.id)
        .filter((edgeId) => !focusedEdgeIds.has(edgeId))
    )
  };
};

export const buildSystemCanvasFocusViewBox = (
  layout: SystemCanvasRenderLayout,
  focusedNodeIds: Set<string>,
  padding = 120
): SystemCanvasViewBox => {
  const focusedNodes = layout.nodes.filter((node) => focusedNodeIds.has(node.id));

  if (focusedNodes.length === 0 || focusedNodes.length === layout.nodes.length) {
    return {
      x: 0,
      y: 0,
      width: layout.width,
      height: layout.height
    };
  }

  const minX = Math.min(...focusedNodes.map((node) => node.x - node.width / 2));
  const maxX = Math.max(...focusedNodes.map((node) => node.x + node.width / 2));
  const minY = Math.min(...focusedNodes.map((node) => node.y - node.height / 2));
  const maxY = Math.max(...focusedNodes.map((node) => node.y + node.height / 2));

  const width = Math.min(layout.width, maxX - minX + padding * 2);
  const height = Math.min(layout.height, maxY - minY + padding * 2);
  const x = clamp(minX - padding, 0, Math.max(0, layout.width - width));
  const y = clamp(minY - padding, 0, Math.max(0, layout.height - height));

  return {
    x,
    y,
    width: Math.max(360, width),
    height: Math.max(240, height)
  };
};
