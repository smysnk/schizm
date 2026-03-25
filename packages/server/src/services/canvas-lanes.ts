import path from "node:path";
import {
  getCanvasGraphSnapshot,
  type CanvasGraphEdge,
  type CanvasGraphNode,
  type CanvasGraphSnapshot
} from "./canvas-graph";

export type CanvasLaneId =
  | "focus"
  | "canvas"
  | "document"
  | "context"
  | "bridge"
  | "tentative";

export type CanvasLaneCard = {
  nodeId: string;
  label: string;
  kind: CanvasGraphNode["kind"];
  category: CanvasGraphNode["category"];
  notePath: string | null;
  canvasNodeId: string | null;
  canvasFile: string;
  reason: string;
  score: number;
  tentative: boolean;
  touchedByPrompt: boolean;
};

export type CanvasLane = {
  id: CanvasLaneId;
  label: string;
  description: string;
  cards: CanvasLaneCard[];
};

export type CanvasLanesSnapshot = {
  generatedAt: string;
  canvasPath: string;
  focusNodeId: string;
  focusHistory: string[];
  lanes: CanvasLane[];
};

type CanvasLanesOptions = {
  documentStoreRoot: string;
  canvasPath?: string | null;
  focusNodeId?: string | null;
  focusHistory?: string[];
  highlightedNotePaths?: string[];
};

const laneDefinitions: Record<Exclude<CanvasLaneId, "focus">, { label: string; description: string }> = {
  canvas: {
    label: "Explicit canvas links",
    description: "Direct, manually-curated relationships from canvas edges."
  },
  document: {
    label: "Document links",
    description: "Direct note references carried through markdown links."
  },
  context: {
    label: "Shared context",
    description: "Nodes that share folder, category, or kind context with the focus."
  },
  bridge: {
    label: "Bridge / indirect",
    description: "Nodes that connect strongly through a shared intermediary."
  },
  tentative: {
    label: "Tentative / inferred",
    description: "Weak or explicitly tentative relationships worth treating carefully."
  }
};

const priorityByLane: Record<Exclude<CanvasLaneId, "focus">, number> = {
  canvas: 1,
  document: 2,
  context: 3,
  bridge: 4,
  tentative: 5
};

const sortCards = (left: CanvasLaneCard, right: CanvasLaneCard) =>
  right.score - left.score ||
  left.label.localeCompare(right.label) ||
  left.nodeId.localeCompare(right.nodeId);

const normalizePortablePath = (value: string) => value.replace(/\\/g, "/").trim();

const normalizeHighlightedNotePath = (value: string) => {
  const portable = normalizePortablePath(value)
    .replace(/^\.\/+/u, "")
    .replace(/^\/+/u, "");

  if (!portable) {
    return null;
  }

  const withoutDocumentStorePrefix = portable.startsWith("obsidian-repository/")
    ? portable.slice("obsidian-repository/".length)
    : portable;

  const normalized = withoutDocumentStorePrefix.replace(/^\/+/u, "");
  return normalized || null;
};

const pickInitialFocusNode = (snapshot: CanvasGraphSnapshot) => {
  const sorted = [...snapshot.nodes].sort((left, right) => {
    const leftFileBias = left.kind === "file" ? 0 : 1;
    const rightFileBias = right.kind === "file" ? 0 : 1;

    return (
      leftFileBias - rightFileBias ||
      right.degree - left.degree ||
      left.label.localeCompare(right.label) ||
      left.id.localeCompare(right.id)
    );
  });

  return sorted[0] || null;
};

const buildAdjacency = (edges: CanvasGraphEdge[]) => {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    const sourceNeighbors = adjacency.get(edge.sourceId) || new Set<string>();
    sourceNeighbors.add(edge.targetId);
    adjacency.set(edge.sourceId, sourceNeighbors);

    const targetNeighbors = adjacency.get(edge.targetId) || new Set<string>();
    targetNeighbors.add(edge.sourceId);
    adjacency.set(edge.targetId, targetNeighbors);
  }

  return adjacency;
};

const getContextTokens = (node: CanvasGraphNode) => {
  const tokens = new Set<string>();

  if (node.kind !== "file") {
    tokens.add(`kind:${node.kind}`);
  }

  if (node.category !== "other") {
    tokens.add(`category:${node.category}`);
  }

  if (node.notePath) {
    const directory = path.posix.dirname(node.notePath);
    const topLevel = node.notePath.split("/", 1)[0] || "";

    if (directory && directory !== "." && directory !== "") {
      tokens.add(`dir:${directory}`);
    }

    if (topLevel) {
      tokens.add(`top:${topLevel}`);
    }
  }

  return tokens;
};

const getDirectCanvasEdge = (focusNodeId: string, candidateNodeId: string, edges: CanvasGraphEdge[]) =>
  edges.find(
    (edge) =>
      edge.kind === "canvas" &&
      ((edge.sourceId === focusNodeId && edge.targetId === candidateNodeId) ||
        (edge.sourceId === candidateNodeId && edge.targetId === focusNodeId))
  ) || null;

const getDirectDocumentEdge = (focusNodeId: string, candidateNodeId: string, edges: CanvasGraphEdge[]) =>
  edges.find(
    (edge) =>
      edge.kind === "markdown-link" &&
      ((edge.sourceId === focusNodeId && edge.targetId === candidateNodeId) ||
        (edge.sourceId === candidateNodeId && edge.targetId === focusNodeId))
  ) || null;

const getSharedContextMatch = (
  focusNode: CanvasGraphNode,
  candidateNode: CanvasGraphNode
) => {
  const focusTokens = getContextTokens(focusNode);
  const candidateTokens = getContextTokens(candidateNode);
  const shared = [...focusTokens].filter((token) => candidateTokens.has(token));

  return shared.sort()[0] || null;
};

const getBridgeMatch = (
  focusNodeId: string,
  candidateNodeId: string,
  adjacency: Map<string, Set<string>>
) => {
  const focusNeighbors = adjacency.get(focusNodeId) || new Set<string>();
  const candidateNeighbors = adjacency.get(candidateNodeId) || new Set<string>();
  const shared = [...focusNeighbors].filter((neighborId) => candidateNeighbors.has(neighborId));

  return shared.sort();
};

const createCard = (
  node: CanvasGraphNode,
  {
    reason,
    score,
    tentative
  }: {
    reason: string;
    score: number;
    tentative: boolean;
  }
): CanvasLaneCard => ({
  nodeId: node.id,
  label: node.label,
  kind: node.kind,
  category: node.category,
  notePath: node.notePath,
  canvasNodeId: node.canvasNodeId,
  canvasFile: node.canvasFile,
  reason,
  score,
  tentative,
  touchedByPrompt: false
});

const classifyCandidate = (
  focusNode: CanvasGraphNode,
  candidateNode: CanvasGraphNode,
  snapshot: CanvasGraphSnapshot,
  adjacency: Map<string, Set<string>>
): { laneId: Exclude<CanvasLaneId, "focus">; card: CanvasLaneCard } | null => {
  const tentativeCanvasEdge = getDirectCanvasEdge(focusNode.id, candidateNode.id, snapshot.edges);

  if (tentativeCanvasEdge?.tentative) {
    return {
      laneId: "tentative",
      card: createCard(candidateNode, {
        reason: tentativeCanvasEdge.label
          ? `tentative canvas edge: ${tentativeCanvasEdge.label}`
          : "tentative canvas edge",
        score: 100 + tentativeCanvasEdge.weight,
        tentative: true
      })
    };
  }

  if (tentativeCanvasEdge) {
    return {
      laneId: "canvas",
      card: createCard(candidateNode, {
        reason: tentativeCanvasEdge.label
          ? `canvas edge: ${tentativeCanvasEdge.label}`
          : "canvas edge",
        score: 400 + tentativeCanvasEdge.weight + candidateNode.degree / 100,
        tentative: false
      })
    };
  }

  const documentEdge = getDirectDocumentEdge(focusNode.id, candidateNode.id, snapshot.edges);

  if (documentEdge) {
    return {
      laneId: "document",
      card: createCard(candidateNode, {
        reason: "links with focus note",
        score: 300 + documentEdge.weight + candidateNode.degree / 100,
        tentative: false
      })
    };
  }

  const sharedContext = getSharedContextMatch(focusNode, candidateNode);

  if (sharedContext) {
    return {
      laneId: "context",
      card: createCard(candidateNode, {
        reason: `shared ${sharedContext.replace(":", " ")}`,
        score: 200 + candidateNode.degree / 100,
        tentative: false
      })
    };
  }

  const bridgeNeighbors = getBridgeMatch(focusNode.id, candidateNode.id, adjacency);

  if (bridgeNeighbors.length > 0) {
    return {
      laneId: "bridge",
      card: createCard(candidateNode, {
        reason:
          bridgeNeighbors.length === 1
            ? `shared via ${bridgeNeighbors[0]}`
            : `shared via ${bridgeNeighbors.length} intermediaries`,
        score: 100 + bridgeNeighbors.length * 10 + candidateNode.degree / 100,
        tentative: false
      })
    };
  }

  const inferredEdge = snapshot.edges.find(
    (edge) =>
      edge.kind === "inferred" &&
      ((edge.sourceId === focusNode.id && edge.targetId === candidateNode.id) ||
        (edge.sourceId === candidateNode.id && edge.targetId === focusNode.id))
  );

  if (inferredEdge) {
    return {
      laneId: "tentative",
      card: createCard(candidateNode, {
        reason: inferredEdge.label ? `inferred: ${inferredEdge.label}` : "inferred relation",
        score: 50 + inferredEdge.weight,
        tentative: true
      })
    };
  }

  return null;
};

export const getCanvasLanesSnapshot = async ({
  documentStoreRoot,
  canvasPath,
  focusNodeId,
  focusHistory = [],
  highlightedNotePaths = []
}: CanvasLanesOptions): Promise<CanvasLanesSnapshot> => {
  const snapshot = await getCanvasGraphSnapshot({ documentStoreRoot, canvasPath });
  const highlightedNotePathSet = new Set(
    highlightedNotePaths
      .map((notePath) => normalizeHighlightedNotePath(notePath))
      .filter((notePath): notePath is string => Boolean(notePath))
  );
  const focusNode =
    (focusNodeId ? snapshot.nodes.find((node) => node.id === focusNodeId) : null) ||
    pickInitialFocusNode(snapshot);

  if (!focusNode) {
    throw new Error("Canvas graph does not contain any nodes to focus.");
  }

  const adjacency = buildAdjacency(snapshot.edges);
  const laneCards = new Map<Exclude<CanvasLaneId, "focus">, CanvasLaneCard[]>(
    Object.keys(laneDefinitions).map((laneId) => [laneId as Exclude<CanvasLaneId, "focus">, []])
  );

  for (const node of snapshot.nodes) {
    if (node.id === focusNode.id) {
      continue;
    }

    const classification = classifyCandidate(focusNode, node, snapshot, adjacency);

    if (!classification) {
      continue;
    }

    laneCards.get(classification.laneId)?.push(classification.card);
  }

  const applyTouchedState = (card: CanvasLaneCard): CanvasLaneCard => ({
    ...card,
    touchedByPrompt: Boolean(card.notePath && highlightedNotePathSet.has(card.notePath))
  });

  const lanes: CanvasLane[] = [
    {
      id: "focus",
      label: "Main frame",
      description: "The current focal node for lane-based exploration.",
      cards: [
        applyTouchedState(createCard(focusNode, {
          reason: "current focus",
          score: Number.MAX_SAFE_INTEGER,
          tentative: false
        }))
      ]
    },
    ...Object.entries(laneDefinitions)
      .sort(
        ([left], [right]) =>
          priorityByLane[left as Exclude<CanvasLaneId, "focus">] -
          priorityByLane[right as Exclude<CanvasLaneId, "focus">]
      )
      .map(([laneId, definition]) => ({
        id: laneId as Exclude<CanvasLaneId, "focus">,
        label: definition.label,
        description: definition.description,
        cards: (laneCards.get(laneId as Exclude<CanvasLaneId, "focus">) || [])
          .map(applyTouchedState)
          .sort(sortCards)
      }))
  ];

  return {
    generatedAt: snapshot.generatedAt,
    canvasPath: snapshot.canvasPath,
    focusNodeId: focusNode.id,
    focusHistory,
    lanes
  };
};
