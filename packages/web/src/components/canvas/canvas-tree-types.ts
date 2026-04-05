import type {
  CanvasGraphNodeCategory,
  CanvasGraphNodeKind
} from "./canvas-graph-types";

export type CanvasTreeRelationshipFamily =
  | "root"
  | "virtual"
  | "canvas"
  | "tentative-canvas"
  | "document"
  | "context"
  | "bridge";

export type CanvasTreeRootOptionRecord = {
  id: string;
  label: string;
  kind: CanvasGraphNodeKind;
  category: CanvasGraphNodeCategory;
  notePath: string | null;
  canvasFile: string;
};

export type CanvasTreeNodeRecord = {
  id: string;
  parentId: string | null;
  depth: number;
  label: string;
  notePath: string | null;
  kind: CanvasGraphNodeKind;
  category: CanvasGraphNodeCategory;
  canvasFile: string;
  relationshipFamily: CanvasTreeRelationshipFamily;
  relationshipReason: string;
  lineage: string[];
  childIds: string[];
  descendantCount: number;
  degree: number;
  touchedByPrompt: boolean;
  tentative: boolean;
  score: number;
  xHint: number | null;
  yHint: number | null;
  virtual: boolean;
  defaultCollapsed: boolean;
};

export type CanvasTreeLinkRecord = {
  id: string;
  sourceId: string;
  targetId: string;
  depth: number;
  relationshipFamily: Exclude<CanvasTreeRelationshipFamily, "root">;
  relationshipReason: string;
  tentative: boolean;
  weight: number;
};

export type CanvasTreeSummaryRecord = {
  availableRootCount: number;
  visibleLeafCount: number;
  visibleBranchCount: number;
  hiddenByDepthCount: number;
  relationshipFamilyCounts: {
    canvas: number;
    tentativeCanvas?: number;
    "tentative-canvas"?: number;
    document: number;
    context: number;
    bridge: number;
  };
};

export type CanvasTreeSnapshotRecord = {
  contractVersion: number;
  generatedAt: string;
  canvasPath: string;
  rootNodeId: string;
  rootLabel: string;
  maxDepthRequested: number;
  maxDepthResolved: number;
  nodeCount: number;
  linkCount: number;
  truncated: boolean;
  availableRoots: CanvasTreeRootOptionRecord[];
  nodes: CanvasTreeNodeRecord[];
  links: CanvasTreeLinkRecord[];
  summary: CanvasTreeSummaryRecord;
};

export type CanvasTreeLayoutMode = "phylogeny" | "radial";

export type CanvasTreeRenderColumn = {
  depth: number;
  label: string;
  x: number;
  width: number;
};

export type CanvasTreeRenderRing = {
  depth: number;
  label: string;
  cx: number;
  cy: number;
  radius: number;
};

export type CanvasTreeRenderNode = CanvasTreeNodeRecord & {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasTreeRenderEdge = CanvasTreeLinkRecord & {
  path: string;
  labelX: number;
  labelY: number;
};

export type CanvasTreeRenderEdgeGeometry = {
  path: string;
  labelX: number;
  labelY: number;
};

export type CanvasTreeRenderLayout = {
  mode: CanvasTreeLayoutMode;
  width: number;
  height: number;
  columns: CanvasTreeRenderColumn[];
  rings: CanvasTreeRenderRing[];
  centerX: number;
  centerY: number;
  nodes: CanvasTreeRenderNode[];
  edges: CanvasTreeRenderEdge[];
};
