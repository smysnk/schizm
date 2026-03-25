import type { CanvasLanesSnapshotRecord } from "./canvas-lanes-types";

export type CanvasLanesFocusRequest = {
  focusNodeId: string;
  focusHistory: string[];
};

export const buildCanvasLanesFocusRequest = (
  snapshot: CanvasLanesSnapshotRecord,
  focusNodeId: string
): CanvasLanesFocusRequest | null => {
  if (!focusNodeId || focusNodeId === snapshot.focusNodeId) {
    return null;
  }

  const isVisibleDownstreamCard = snapshot.lanes.some(
    (lane) => lane.id !== "focus" && lane.cards.some((card) => card.nodeId === focusNodeId)
  );

  if (!isVisibleDownstreamCard) {
    return null;
  }

  return {
    focusNodeId,
    focusHistory: [...snapshot.focusHistory, snapshot.focusNodeId]
  };
};

export const buildCanvasLanesBackRequest = (
  snapshot: CanvasLanesSnapshotRecord
): CanvasLanesFocusRequest | null => {
  const previousFocusNodeId = snapshot.focusHistory[snapshot.focusHistory.length - 1];

  if (!previousFocusNodeId) {
    return null;
  }

  return {
    focusNodeId: previousFocusNodeId,
    focusHistory: snapshot.focusHistory.slice(0, -1)
  };
};

export const buildCanvasLanesResetRequest = (
  initialFocusNodeId: string | null
): CanvasLanesFocusRequest | null => {
  if (!initialFocusNodeId) {
    return null;
  }

  return {
    focusNodeId: initialFocusNodeId,
    focusHistory: []
  };
};
