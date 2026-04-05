import {
  getCanvasGraphSnapshot,
  type CanvasGraphEdge,
  type CanvasGraphNode,
  type CanvasGraphSnapshot
} from "./canvas-graph";

export type CanvasTreeRelationshipFamily =
  | "root"
  | "virtual"
  | "canvas"
  | "tentative-canvas"
  | "document"
  | "context"
  | "bridge";

export type CanvasTreeRootOption = {
  id: string;
  label: string;
  kind: CanvasGraphNode["kind"];
  category: CanvasGraphNode["category"];
  notePath: string | null;
  canvasFile: string;
};

export type CanvasTreeNode = {
  id: string;
  parentId: string | null;
  depth: number;
  label: string;
  notePath: string | null;
  kind: CanvasGraphNode["kind"];
  category: CanvasGraphNode["category"];
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

export type CanvasTreeLink = {
  id: string;
  sourceId: string;
  targetId: string;
  depth: number;
  relationshipFamily: Exclude<CanvasTreeRelationshipFamily, "root">;
  relationshipReason: string;
  tentative: boolean;
  weight: number;
};

export type CanvasTreeSummary = {
  availableRootCount: number;
  visibleLeafCount: number;
  visibleBranchCount: number;
  hiddenByDepthCount: number;
  relationshipFamilyCounts: Record<
    Exclude<CanvasTreeRelationshipFamily, "root" | "virtual">,
    number
  >;
};

export type CanvasTreeSnapshot = {
  contractVersion: 1;
  generatedAt: string;
  canvasPath: string;
  rootNodeId: string;
  rootLabel: string;
  maxDepthRequested: number;
  maxDepthResolved: number;
  nodeCount: number;
  linkCount: number;
  truncated: boolean;
  availableRoots: CanvasTreeRootOption[];
  nodes: CanvasTreeNode[];
  links: CanvasTreeLink[];
  summary: CanvasTreeSummary;
};

type CanvasTreeOptions = {
  documentStoreRoot: string;
  canvasPath?: string | null;
  rootNodeId?: string | null;
  maxDepth?: number | null;
  highlightedNotePaths?: string[];
};

type CanvasParentChoice = {
  family: "canvas" | "tentative-canvas";
  reason: string;
  score: number;
  tentative: boolean;
  weight: number;
  parentId: string;
  candidateId: string;
  parentDegree: number;
  parentLabel: string;
};

type MutableResolvedNode = CanvasTreeNode & {
  childIds: string[];
  descendantCount: number;
};

const DEFAULT_MAX_DEPTH = 3;
const MIN_MAX_DEPTH = 1;
const MAX_MAX_DEPTH = 6;
const VIRTUAL_ROOT_NODE_ID = "__virtual__/root";

const summarizedRelationshipFamilies: Array<
  Exclude<CanvasTreeRelationshipFamily, "root" | "virtual">
> = [
  "canvas",
  "tentative-canvas",
  "document",
  "context",
  "bridge"
];

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

const clampRequestedDepth = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_DEPTH;
  }

  return Math.max(MIN_MAX_DEPTH, Math.min(MAX_MAX_DEPTH, Math.trunc(value as number)));
};

const compareRootCandidates = (left: CanvasGraphNode, right: CanvasGraphNode) => {
  const leftFileBias = left.kind === "file" ? 0 : 1;
  const rightFileBias = right.kind === "file" ? 0 : 1;

  return (
    leftFileBias - rightFileBias ||
    right.degree - left.degree ||
    left.label.localeCompare(right.label) ||
    left.id.localeCompare(right.id)
  );
};

const pickInitialRootNode = (snapshot: CanvasGraphSnapshot) =>
  [...snapshot.nodes].sort(compareRootCandidates)[0] || null;

const sortNodes = (left: CanvasGraphNode, right: CanvasGraphNode) =>
  left.label.localeCompare(right.label) || left.id.localeCompare(right.id);

const buildCanvasEdgeIndexes = (snapshot: CanvasGraphSnapshot) => {
  const outgoingCanvasEdgesBySource = new Map<string, CanvasGraphEdge[]>();
  const incomingCanvasParentIdsByTarget = new Map<string, Set<string>>();

  for (const edge of snapshot.edges) {
    if (edge.kind !== "canvas") {
      continue;
    }

    const outgoingEdges = outgoingCanvasEdgesBySource.get(edge.sourceId) || [];
    outgoingEdges.push(edge);
    outgoingCanvasEdgesBySource.set(edge.sourceId, outgoingEdges);

    const incomingParentIds = incomingCanvasParentIdsByTarget.get(edge.targetId) || new Set<string>();
    incomingParentIds.add(edge.sourceId);
    incomingCanvasParentIdsByTarget.set(edge.targetId, incomingParentIds);
  }

  for (const edges of outgoingCanvasEdgesBySource.values()) {
    edges.sort(
      (left, right) =>
        Number(left.tentative) - Number(right.tentative) ||
        right.weight - left.weight ||
        left.targetId.localeCompare(right.targetId) ||
        left.id.localeCompare(right.id)
    );
  }

  return { outgoingCanvasEdgesBySource, incomingCanvasParentIdsByTarget };
};

const buildCanvasParentChoice = ({
  parent,
  candidate,
  edge
}: {
  parent: CanvasGraphNode;
  candidate: CanvasGraphNode;
  edge: CanvasGraphEdge;
}): CanvasParentChoice => ({
  family: edge.tentative ? "tentative-canvas" : "canvas",
  reason: edge.label
    ? `${edge.tentative ? "tentative " : ""}canvas edge: ${edge.label}`
    : `${edge.tentative ? "tentative " : ""}canvas edge`,
  score:
    (edge.tentative ? 400 : 500) +
    edge.weight * 100 +
    parent.degree / 100 +
    candidate.degree / 100,
  tentative: edge.tentative,
  weight: edge.weight,
  parentId: parent.id,
  candidateId: candidate.id,
  parentDegree: parent.degree,
  parentLabel: parent.label
});

const compareCanvasParentChoice = (left: CanvasParentChoice, right: CanvasParentChoice) =>
  left.score - right.score ||
  left.parentDegree - right.parentDegree ||
  right.parentLabel.localeCompare(left.parentLabel) ||
  right.parentId.localeCompare(left.parentId) ||
  right.candidateId.localeCompare(left.candidateId);

const sortCanvasParentChoices = (left: CanvasParentChoice, right: CanvasParentChoice) =>
  left.candidateId.localeCompare(right.candidateId) ||
  left.parentId.localeCompare(right.parentId);

const pickNextComponentRootNode = ({
  remainingNodeIds,
  graphNodeById,
  incomingCanvasParentIdsByTarget
}: {
  remainingNodeIds: Set<string>;
  graphNodeById: Map<string, CanvasGraphNode>;
  incomingCanvasParentIdsByTarget: Map<string, Set<string>>;
}) => {
  const candidateRoots = [...remainingNodeIds]
    .map((nodeId) => graphNodeById.get(nodeId))
    .filter((node): node is CanvasGraphNode => Boolean(node))
    .filter((node) => {
      const incomingParentIds = incomingCanvasParentIdsByTarget.get(node.id);

      if (!incomingParentIds || incomingParentIds.size === 0) {
        return true;
      }

      return ![...incomingParentIds].some((parentId) => remainingNodeIds.has(parentId));
    })
    .sort(compareRootCandidates);

  if (candidateRoots[0]) {
    return candidateRoots[0];
  }

  return [...remainingNodeIds]
    .map((nodeId) => graphNodeById.get(nodeId))
    .filter((node): node is CanvasGraphNode => Boolean(node))
    .sort(compareRootCandidates)[0] || null;
};

const buildAvailableRoots = (snapshot: CanvasGraphSnapshot): CanvasTreeRootOption[] =>
  [...snapshot.nodes].sort(compareRootCandidates).map((node) => ({
    id: node.id,
    label: node.label,
    kind: node.kind,
    category: node.category,
    notePath: node.notePath,
    canvasFile: node.canvasFile
  }));

const computeDescendantCount = (
  nodeId: string,
  nodesById: Map<string, MutableResolvedNode>
): number => {
  const node = nodesById.get(nodeId);

  if (!node) {
    return 0;
  }

  let total = 0;

  for (const childId of node.childIds) {
    total += 1 + computeDescendantCount(childId, nodesById);
  }

  node.descendantCount = total;
  return total;
};

const initializeResolvedRootNode = (
  rootNode: CanvasGraphNode,
  highlightedNotePathSet: Set<string>,
  relationshipReason: string
) => ({
  id: rootNode.id,
  parentId: null,
  depth: 0,
  label: rootNode.label,
  notePath: rootNode.notePath,
  kind: rootNode.kind,
  category: rootNode.category,
  canvasFile: rootNode.canvasFile,
  relationshipFamily: "root" as const,
  relationshipReason,
  lineage: [],
  childIds: [],
  descendantCount: 0,
  degree: rootNode.degree,
  touchedByPrompt: Boolean(rootNode.notePath && highlightedNotePathSet.has(rootNode.notePath)),
  tentative: false,
  score: Number.MAX_SAFE_INTEGER,
  xHint: rootNode.x,
  yHint: rootNode.y,
  virtual: false,
  defaultCollapsed: false
});

const resolveTreeComponent = (
  snapshot: CanvasGraphSnapshot,
  rootNode: CanvasGraphNode,
  highlightedNotePathSet: Set<string>,
  remainingNodeIds: Set<string>,
  outgoingCanvasEdgesBySource: Map<string, CanvasGraphEdge[]>,
  relationshipReason: string
) => {
  const graphNodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const nodesById = new Map<string, MutableResolvedNode>();
  const links: CanvasTreeLink[] = [];
  const resolvedNodeIds = new Set<string>([rootNode.id]);

  nodesById.set(
    rootNode.id,
    initializeResolvedRootNode(rootNode, highlightedNotePathSet, relationshipReason)
  );

  for (let depth = 0; depth < snapshot.nodes.length; depth += 1) {
    const parentsAtDepth = [...nodesById.values()]
      .filter((node) => node.depth === depth)
      .map((node) => graphNodeById.get(node.id))
      .filter((node): node is CanvasGraphNode => Boolean(node))
      .sort(sortNodes);

    if (parentsAtDepth.length === 0) {
      break;
    }

    const candidateChoices = new Map<string, CanvasParentChoice>();

    for (const parent of parentsAtDepth) {
      const outgoingEdges = outgoingCanvasEdgesBySource.get(parent.id) || [];

      for (const edge of outgoingEdges) {
        const candidate = graphNodeById.get(edge.targetId);

        if (!candidate || resolvedNodeIds.has(candidate.id) || !remainingNodeIds.has(candidate.id)) {
          continue;
        }

        const choice = buildCanvasParentChoice({ parent, candidate, edge });
        const existing = candidateChoices.get(candidate.id);
        if (!existing || compareCanvasParentChoice(choice, existing) > 0) {
          candidateChoices.set(candidate.id, choice);
        }
      }
    }

    if (candidateChoices.size === 0) {
      break;
    }

    for (const choice of [...candidateChoices.values()].sort(sortCanvasParentChoices)) {
      const candidate = graphNodeById.get(choice.candidateId);
      const parent = nodesById.get(choice.parentId);

      if (!candidate || !parent || resolvedNodeIds.has(candidate.id)) {
        continue;
      }

      resolvedNodeIds.add(candidate.id);
      parent.childIds.push(candidate.id);

      nodesById.set(candidate.id, {
        id: candidate.id,
        parentId: parent.id,
        depth: parent.depth + 1,
        label: candidate.label,
        notePath: candidate.notePath,
        kind: candidate.kind,
        category: candidate.category,
        canvasFile: candidate.canvasFile,
        relationshipFamily: choice.family,
        relationshipReason: choice.reason,
        lineage: [...parent.lineage, parent.id],
        childIds: [],
        descendantCount: 0,
        degree: candidate.degree,
        touchedByPrompt: Boolean(candidate.notePath && highlightedNotePathSet.has(candidate.notePath)),
        tentative: choice.tentative,
        score: choice.score,
        xHint: candidate.x,
        yHint: candidate.y,
        virtual: false,
        defaultCollapsed: false
      });

      links.push({
        id: `${parent.id}->${candidate.id}`,
        sourceId: parent.id,
        targetId: candidate.id,
        depth: parent.depth + 1,
        relationshipFamily: choice.family,
        relationshipReason: choice.reason,
        tentative: choice.tentative,
        weight: choice.weight
      });
    }
  }

  return {
    rootNodeId: rootNode.id,
    nodes: [...nodesById.values()],
    links,
    resolvedNodeIds
  };
};

const sortResolvedChildren = (nodesById: Map<string, MutableResolvedNode>) => {
  for (const node of nodesById.values()) {
    node.childIds.sort((leftId, rightId) => {
      const left = nodesById.get(leftId);
      const right = nodesById.get(rightId);

      if (!left || !right) {
        return leftId.localeCompare(rightId);
      }

      return (
        right.score - left.score ||
        left.label.localeCompare(right.label) ||
        left.id.localeCompare(right.id)
      );
    });
  }
};

const buildResolvedForest = (
  snapshot: CanvasGraphSnapshot,
  focusRootNode: CanvasGraphNode,
  highlightedNotePathSet: Set<string>
) => {
  const { outgoingCanvasEdgesBySource, incomingCanvasParentIdsByTarget } =
    buildCanvasEdgeIndexes(snapshot);
  const graphNodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const remainingNodeIds = new Set(snapshot.nodes.map((node) => node.id));
  const nodesById = new Map<string, MutableResolvedNode>();
  const links: CanvasTreeLink[] = [];
  const componentRootIds: string[] = [];

  const addComponent = (rootNode: CanvasGraphNode, relationshipReason: string) => {
    const component = resolveTreeComponent(
      snapshot,
      rootNode,
      highlightedNotePathSet,
      remainingNodeIds,
      outgoingCanvasEdgesBySource,
      relationshipReason
    );

    componentRootIds.push(component.rootNodeId);

    for (const node of component.nodes) {
      nodesById.set(node.id, node);
      remainingNodeIds.delete(node.id);
    }

    for (const link of component.links) {
      links.push(link);
    }
  };

  addComponent(focusRootNode, "selected root");

  while (remainingNodeIds.size > 0) {
    const nextRootNode = pickNextComponentRootNode({
      remainingNodeIds,
      graphNodeById,
      incomingCanvasParentIdsByTarget
    });

    if (!nextRootNode) {
      break;
    }

    addComponent(nextRootNode, "disconnected root");
  }

  if (componentRootIds.length > 0) {
    nodesById.set(VIRTUAL_ROOT_NODE_ID, {
      id: VIRTUAL_ROOT_NODE_ID,
      parentId: null,
      depth: -1,
      label: "root",
      notePath: null,
      kind: "group",
      category: "other",
      canvasFile: snapshot.canvasPath,
      relationshipFamily: "virtual",
      relationshipReason: `virtual parent for ${componentRootIds.length} root nodes`,
      lineage: [],
      childIds: [...componentRootIds],
      descendantCount: 0,
      degree: componentRootIds.length,
      touchedByPrompt: componentRootIds.some(
        (rootId) => nodesById.get(rootId)?.touchedByPrompt ?? false
      ),
      tentative: false,
      score: Number.MAX_SAFE_INTEGER - 1,
      xHint: focusRootNode.x,
      yHint: focusRootNode.y,
      virtual: true,
      defaultCollapsed: false
    });

    for (const rootId of componentRootIds) {
      const componentRoot = nodesById.get(rootId);

      if (!componentRoot) {
        continue;
      }

      for (const node of nodesById.values()) {
        if (node.id !== rootId && !node.lineage.includes(rootId)) {
          continue;
        }

        node.lineage = [VIRTUAL_ROOT_NODE_ID, ...node.lineage];
      }

      componentRoot.parentId = VIRTUAL_ROOT_NODE_ID;

      links.push({
        id: `${VIRTUAL_ROOT_NODE_ID}->${rootId}`,
        sourceId: VIRTUAL_ROOT_NODE_ID,
        targetId: rootId,
        depth: 0,
        relationshipFamily: "virtual",
        relationshipReason: `virtual parent for ${componentRootIds.length} root nodes`,
        tentative: false,
        weight: 0
      });
    }
  }

  sortResolvedChildren(nodesById);

  const structuralRootIds = [...nodesById.values()]
    .filter((node) => node.parentId === null)
    .map((node) => node.id);

  for (const structuralRootId of structuralRootIds) {
    computeDescendantCount(structuralRootId, nodesById);
  }

  const nodes = [...nodesById.values()].sort(
    (left, right) =>
      left.depth - right.depth ||
      left.lineage.join(">").localeCompare(right.lineage.join(">")) ||
      left.label.localeCompare(right.label) ||
      left.id.localeCompare(right.id)
  );

  return {
    nodes,
    links,
    maxDepthResolved: Math.max(...nodes.map((node) => node.depth)),
    relationshipFamilyCounts: summarizedRelationshipFamilies.reduce(
      (counts, family) => ({
        ...counts,
        [family]: nodes.filter((node) => node.relationshipFamily === family).length
      }),
      {} as Record<Exclude<CanvasTreeRelationshipFamily, "root" | "virtual">, number>
    )
  };
};

const buildVisibleTree = (
  fullTree: ReturnType<typeof buildResolvedForest>,
  maxDepth: number
) => {
  const visibleNodes = fullTree.nodes
    .filter((node) => node.parentId === null || node.depth <= maxDepth)
    .map((node) => ({
      ...node,
      childIds: node.childIds.filter((childId) =>
        fullTree.nodes.some(
          (candidate) =>
            candidate.id === childId &&
            (candidate.parentId === null || candidate.depth <= maxDepth)
        )
      )
    }));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleLinks = fullTree.links.filter(
    (link) => visibleNodeIds.has(link.sourceId) && visibleNodeIds.has(link.targetId)
  );

  return {
    nodes: visibleNodes,
    links: visibleLinks,
    maxDepthResolved: Math.max(...visibleNodes.map((node) => node.depth)),
    relationshipFamilyCounts: summarizedRelationshipFamilies.reduce(
      (counts, family) => ({
        ...counts,
        [family]: visibleNodes.filter((node) => node.relationshipFamily === family).length
      }),
      {} as Record<Exclude<CanvasTreeRelationshipFamily, "root" | "virtual">, number>
    )
  };
};

export const getCanvasTreeSnapshot = async ({
  documentStoreRoot,
  canvasPath,
  rootNodeId,
  maxDepth,
  highlightedNotePaths = []
}: CanvasTreeOptions): Promise<CanvasTreeSnapshot> => {
  const snapshot = await getCanvasGraphSnapshot({ documentStoreRoot, canvasPath });
  const requestedDepth = clampRequestedDepth(maxDepth);
  const availableRoots = buildAvailableRoots(snapshot);
  const highlightedNotePathSet = new Set(
    highlightedNotePaths
      .map((notePath) => normalizeHighlightedNotePath(notePath))
      .filter((notePath): notePath is string => Boolean(notePath))
  );
  const rootNode =
    (rootNodeId ? snapshot.nodes.find((node) => node.id === rootNodeId) : null) ||
    pickInitialRootNode(snapshot);

  if (!rootNode) {
    throw new Error("Canvas graph does not contain any nodes to use as a tree root.");
  }

  const fullTree = buildResolvedForest(snapshot, rootNode, highlightedNotePathSet);
  const visibleTree = buildVisibleTree(fullTree, requestedDepth);
  const visibleLeafCount = visibleTree.nodes.filter((node) => node.childIds.length === 0).length;
  const visibleBranchCount = visibleTree.nodes.length - visibleLeafCount;
  const hiddenByDepthCount = Math.max(fullTree.nodes.length - visibleTree.nodes.length, 0);

  return {
    contractVersion: 1,
    generatedAt: snapshot.generatedAt,
    canvasPath: snapshot.canvasPath,
    rootNodeId: rootNode.id,
    rootLabel: rootNode.label,
    maxDepthRequested: requestedDepth,
    maxDepthResolved: visibleTree.maxDepthResolved,
    nodeCount: visibleTree.nodes.length,
    linkCount: visibleTree.links.length,
    truncated: hiddenByDepthCount > 0,
    availableRoots,
    nodes: visibleTree.nodes,
    links: visibleTree.links,
    summary: {
      availableRootCount: availableRoots.length,
      visibleLeafCount,
      visibleBranchCount,
      hiddenByDepthCount,
      relationshipFamilyCounts: visibleTree.relationshipFamilyCounts
    }
  };
};
