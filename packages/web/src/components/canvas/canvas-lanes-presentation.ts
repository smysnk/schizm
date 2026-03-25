import type {
  CanvasLaneCardRecord,
  CanvasLaneRecord,
  CanvasLanesSnapshotRecord
} from "./canvas-lanes-types";

export type CanvasLaneCardWithLane = {
  card: CanvasLaneCardRecord;
  lane: CanvasLaneRecord;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getCanvasLaneReasonFamily = (reason: string) => {
  const [family = reason] = reason.split(":");
  return slugify(family) || "related";
};

export const formatCanvasLaneReasonFamily = (reason: string) =>
  getCanvasLaneReasonFamily(reason).replace(/-/g, " ");

export const getVisibleCanvasLanes = (snapshot: CanvasLanesSnapshotRecord) => {
  const focusLane = snapshot.lanes.find((lane) => lane.id === "focus") || snapshot.lanes[0];
  const downstreamLanes = snapshot.lanes.filter(
    (lane) => lane.id !== "focus" && lane.cards.length > 0
  );

  return [focusLane, ...downstreamLanes];
};

export const findCanvasLaneCard = (
  snapshot: CanvasLanesSnapshotRecord,
  nodeId: string | null
): CanvasLaneCardWithLane | null => {
  if (!nodeId) {
    return null;
  }

  for (const lane of snapshot.lanes) {
    const card = lane.cards.find((candidate) => candidate.nodeId === nodeId);

    if (card) {
      return { card, lane };
    }
  }

  return null;
};

export const getCanvasLaneRelatedNodeIds = (
  snapshot: CanvasLanesSnapshotRecord,
  focusNodeId: string,
  pivotNodeId: string | null
) => {
  if (!pivotNodeId || pivotNodeId === focusNodeId) {
    return null;
  }

  const pivot = findCanvasLaneCard(snapshot, pivotNodeId);

  if (!pivot) {
    return null;
  }

  const pivotFamily = getCanvasLaneReasonFamily(pivot.card.reason);
  const relatedNodeIds = new Set<string>([pivot.card.nodeId, focusNodeId]);

  for (const lane of getVisibleCanvasLanes(snapshot)) {
    for (const card of lane.cards) {
      if (card.nodeId === pivot.card.nodeId) {
        relatedNodeIds.add(card.nodeId);
        continue;
      }

      const sharesFamily =
        lane.id !== "focus" && getCanvasLaneReasonFamily(card.reason) === pivotFamily;
      const sharesCategory = card.category === pivot.card.category;
      const sharesPromptTouch = pivot.card.touchedByPrompt && card.touchedByPrompt;

      if (sharesFamily || sharesCategory || sharesPromptTouch) {
        relatedNodeIds.add(card.nodeId);
      }
    }
  }

  return relatedNodeIds;
};
