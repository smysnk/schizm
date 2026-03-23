import type {
  SystemCanvasEdgeRecord,
  SystemCanvasNodeRecord,
  SystemCanvasSnapshotRecord
} from "../../lib/graphql";

export const systemCanvasLaneOrder = [
  "user",
  "browser",
  "transport",
  "api",
  "persistence",
  "worker",
  "document-store",
  "infrastructure"
] as const;

export type SystemCanvasLaneId = (typeof systemCanvasLaneOrder)[number];

export type SystemCanvasRenderLane = {
  id: SystemCanvasLaneId;
  label: string;
  x: number;
  width: number;
};

export type SystemCanvasRenderNode = SystemCanvasNodeRecord & {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SystemCanvasRenderEdge = SystemCanvasEdgeRecord & {
  path: string;
  labelX: number;
  labelY: number;
};

export type SystemCanvasRenderLayout = {
  width: number;
  height: number;
  lanes: SystemCanvasRenderLane[];
  nodes: SystemCanvasRenderNode[];
  edges: SystemCanvasRenderEdge[];
};

export type SystemCanvasSnapshot = SystemCanvasSnapshotRecord;
