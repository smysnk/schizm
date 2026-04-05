import {
  getCanvasTreeLineageEdgeIds,
  getCanvasTreeLineageNodeIds
} from "./canvas-tree-layout";
import type {
  CanvasTreeRelationshipFamily,
  CanvasTreeSnapshotRecord
} from "./canvas-tree-types";

type PlaybackFamilyCounts = Partial<
  Record<Exclude<CanvasTreeRelationshipFamily, "root">, number>
>;

export type CanvasTreePromptPlayback = {
  touchedNodeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  touchedNodeCount: number;
  touchedLeafCount: number;
  touchedBranchCount: number;
  deepestTouchedDepth: number;
  rootTouched: boolean;
  familyCounts: PlaybackFamilyCounts;
};

const emptyPlayback: CanvasTreePromptPlayback = {
  touchedNodeIds: new Set<string>(),
  highlightedNodeIds: new Set<string>(),
  highlightedEdgeIds: new Set<string>(),
  touchedNodeCount: 0,
  touchedLeafCount: 0,
  touchedBranchCount: 0,
  deepestTouchedDepth: 0,
  rootTouched: false,
  familyCounts: {}
};

export const buildCanvasTreePromptPlayback = (
  snapshot: CanvasTreeSnapshotRecord | null
): CanvasTreePromptPlayback => {
  if (!snapshot) {
    return emptyPlayback;
  }

  const touchedNodes = snapshot.nodes.filter((node) => node.touchedByPrompt);

  if (touchedNodes.length === 0) {
    return emptyPlayback;
  }

  const highlightedNodeIds = new Set<string>();
  const highlightedEdgeIds = new Set<string>();
  const familyCounts: PlaybackFamilyCounts = {};
  let touchedLeafCount = 0;
  let touchedBranchCount = 0;
  let deepestTouchedDepth = 0;

  for (const node of touchedNodes) {
    for (const lineageNodeId of getCanvasTreeLineageNodeIds(snapshot, node.id)) {
      highlightedNodeIds.add(lineageNodeId);
    }

    for (const lineageEdgeId of getCanvasTreeLineageEdgeIds(snapshot, node.id)) {
      highlightedEdgeIds.add(lineageEdgeId);
    }

    if (node.childIds.length === 0) {
      touchedLeafCount += 1;
    } else {
      touchedBranchCount += 1;
    }

    if (node.depth > deepestTouchedDepth) {
      deepestTouchedDepth = node.depth;
    }

    if (node.relationshipFamily !== "root") {
      familyCounts[node.relationshipFamily] =
        (familyCounts[node.relationshipFamily] || 0) + 1;
    }
  }

  return {
    touchedNodeIds: new Set(touchedNodes.map((node) => node.id)),
    highlightedNodeIds,
    highlightedEdgeIds,
    touchedNodeCount: touchedNodes.length,
    touchedLeafCount,
    touchedBranchCount,
    deepestTouchedDepth,
    rootTouched: touchedNodes.some((node) => node.id === snapshot.rootNodeId),
    familyCounts
  };
};
