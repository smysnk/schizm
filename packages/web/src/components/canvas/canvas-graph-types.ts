export type CanvasGraphNodeKind = "file" | "text" | "group" | "missing";
export type CanvasGraphNodeCategory =
  | "fragment"
  | "concept"
  | "hypothesis"
  | "practical"
  | "other";
export type CanvasGraphEdgeKind = "canvas" | "markdown-link" | "inferred";

export type CanvasGraphNodeRecord = {
  id: string;
  notePath: string | null;
  canvasNodeId: string | null;
  label: string;
  kind: CanvasGraphNodeKind;
  category: CanvasGraphNodeCategory;
  canvasFile: string;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  degree: number;
  inboundLinkCount: number;
  outboundLinkCount: number;
  tags: string[];
};

export type CanvasGraphEdgeRecord = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: CanvasGraphEdgeKind;
  label: string | null;
  weight: number;
  tentative: boolean;
};

export type CanvasGraphSnapshotRecord = {
  generatedAt: string;
  canvasPath: string;
  nodes: CanvasGraphNodeRecord[];
  edges: CanvasGraphEdgeRecord[];
};

export type CanvasGraphCamera = {
  x: number;
  y: number;
  scale: number;
};

export type CanvasGraphRenderNode = CanvasGraphNodeRecord & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchorX: number;
  anchorY: number;
  radius: number;
  pinned: boolean;
};

export type CanvasGraphRenderEdge = CanvasGraphEdgeRecord;

export type CanvasGraphRenderState = {
  nodes: CanvasGraphRenderNode[];
  edges: CanvasGraphRenderEdge[];
  adjacency: Map<string, Set<string>>;
};

export type CanvasGraphPinnedNodeState = {
  id: string;
  x: number;
  y: number;
};
