import type {
  SystemCanvasEdgeRecord,
  SystemCanvasNodeRecord,
  SystemCanvasSnapshotRecord
} from "../../lib/graphql";
import type {
  SystemCanvasLaneId,
  SystemCanvasRenderEdge,
  SystemCanvasRenderLane,
  SystemCanvasRenderLayout,
  SystemCanvasRenderNode
} from "./system-canvas-types";
import { systemCanvasLaneOrder } from "./system-canvas-types";

const laneLabels: Record<SystemCanvasLaneId, string> = {
  user: "User",
  browser: "Browser / UI",
  transport: "Transport",
  api: "API / Control plane",
  persistence: "Persistence",
  worker: "Worker / Execution",
  "document-store": "Document store / Git",
  infrastructure: "Infrastructure"
};

const nodeWidth = 158;
const nodeHeight = 60;
const outerPaddingX = 112;
const outerPaddingY = 84;
const lanePadding = 72;
const laneHeaderHeight = 52;

const coerceLaneId = (lane: string): SystemCanvasLaneId =>
  systemCanvasLaneOrder.includes(lane as SystemCanvasLaneId)
    ? (lane as SystemCanvasLaneId)
    : "infrastructure";

const average = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;

const computeLaneCenters = (nodes: SystemCanvasNodeRecord[]) => {
  const centers: number[] = [];

  for (const [index, laneId] of systemCanvasLaneOrder.entries()) {
    const laneNodes = nodes.filter((node) => coerceLaneId(node.lane) === laneId);

    if (laneNodes.length > 0) {
      centers.push(average(laneNodes.map((node) => node.defaultX)));
      continue;
    }

    if (index === 0) {
      centers.push(outerPaddingX + nodeWidth / 2);
      continue;
    }

    centers.push(centers[index - 1] + 220);
  }

  return centers;
};

const buildLaneRects = (nodes: SystemCanvasNodeRecord[]): SystemCanvasRenderLane[] => {
  const centers = computeLaneCenters(nodes);

  return systemCanvasLaneOrder.map((laneId, index) => {
    const center = centers[index];
    const previousCenter = centers[index - 1] ?? center - 220;
    const nextCenter = centers[index + 1] ?? center + 220;
    const leftBoundary =
      index === 0 ? center - nodeWidth / 2 - lanePadding : (previousCenter + center) / 2;
    const rightBoundary =
      index === centers.length - 1
        ? center + nodeWidth / 2 + lanePadding
        : (center + nextCenter) / 2;

    return {
      id: laneId,
      label: laneLabels[laneId],
      x: Math.max(0, leftBoundary),
      width: Math.max(140, rightBoundary - leftBoundary)
    };
  });
};

const midpoint = (start: number, end: number) => start + (end - start) / 2;

const buildEdgePath = (source: SystemCanvasRenderNode, target: SystemCanvasRenderNode) => {
  const sourceToRight = target.x >= source.x;
  const startX = sourceToRight ? source.x + source.width / 2 : source.x - source.width / 2;
  const endX = sourceToRight ? target.x - target.width / 2 : target.x + target.width / 2;
  const startY = source.y;
  const endY = target.y;
  const deltaX = Math.abs(endX - startX);
  const controlOffset = Math.max(56, Math.min(180, deltaX * 0.45));
  const controlOneX = sourceToRight ? startX + controlOffset : startX - controlOffset;
  const controlTwoX = sourceToRight ? endX - controlOffset : endX + controlOffset;
  const controlOneY = startY;
  const controlTwoY = endY;

  return {
    path: `M ${startX} ${startY} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${endX} ${endY}`,
    labelX: midpoint(startX, endX),
    labelY: midpoint(startY, endY) - (Math.abs(endY - startY) > 80 ? 12 : 0)
  };
};

export const buildSystemCanvasLayout = (
  snapshot: SystemCanvasSnapshotRecord
): SystemCanvasRenderLayout => {
  const lanes = buildLaneRects(snapshot.nodes);
  const maxNodeX = Math.max(...snapshot.nodes.map((node) => node.defaultX), 0);
  const maxNodeY = Math.max(...snapshot.nodes.map((node) => node.defaultY), 0);
  const width = Math.max(
    1720,
    Math.round(
      Math.max(...lanes.map((lane) => lane.x + lane.width), maxNodeX + nodeWidth / 2 + outerPaddingX)
    )
  );
  const height = Math.max(
    760,
    Math.round(maxNodeY + nodeHeight / 2 + outerPaddingY + laneHeaderHeight)
  );

  const nodes: SystemCanvasRenderNode[] = snapshot.nodes.map((node) => ({
    ...node,
    x: node.defaultX,
    y: node.defaultY + laneHeaderHeight,
    width: nodeWidth,
    height: nodeHeight
  }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const edges: SystemCanvasRenderEdge[] = snapshot.edges
    .map((edge) => {
      const source = nodeById.get(edge.sourceId);
      const target = nodeById.get(edge.targetId);

      if (!source || !target) {
        return null;
      }

      const geometry = buildEdgePath(source, target);

      return {
        ...edge,
        ...geometry
      };
    })
    .filter((edge): edge is SystemCanvasRenderEdge => Boolean(edge));

  return {
    width,
    height,
    lanes,
    nodes,
    edges
  };
};

export const getSystemCanvasNodeRelations = (
  snapshot: SystemCanvasSnapshotRecord,
  nodeId: string
) => {
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const incoming = snapshot.edges
    .filter((edge) => edge.targetId === nodeId)
    .map((edge) => ({
      edge,
      node: nodeById.get(edge.sourceId) || null
    }));
  const outgoing = snapshot.edges
    .filter((edge) => edge.sourceId === nodeId)
    .map((edge) => ({
      edge,
      node: nodeById.get(edge.targetId) || null
    }));

  return { incoming, outgoing };
};
