import type {
  CanvasGraphNodeCategory,
  CanvasGraphNodeKind
} from "./canvas-graph-types";

export type CanvasLaneId =
  | "focus"
  | "canvas"
  | "document"
  | "context"
  | "bridge"
  | "tentative";

export type CanvasLaneCardRecord = {
  nodeId: string;
  label: string;
  kind: CanvasGraphNodeKind;
  category: CanvasGraphNodeCategory;
  notePath: string | null;
  canvasNodeId: string | null;
  canvasFile: string;
  reason: string;
  score: number;
  tentative: boolean;
  touchedByPrompt: boolean;
};

export type CanvasLaneRecord = {
  id: CanvasLaneId;
  label: string;
  description: string;
  cards: CanvasLaneCardRecord[];
};

export type CanvasLanesSnapshotRecord = {
  generatedAt: string;
  canvasPath: string;
  focusNodeId: string;
  focusHistory: string[];
  lanes: CanvasLaneRecord[];
};
