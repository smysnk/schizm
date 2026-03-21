import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

export type CanvasGraphNodeKind = "file" | "text" | "group" | "missing";
export type CanvasGraphNodeCategory =
  | "fragment"
  | "concept"
  | "hypothesis"
  | "practical"
  | "other";
export type CanvasGraphEdgeKind = "canvas" | "markdown-link" | "inferred";

export type CanvasGraphNode = {
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

export type CanvasGraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: CanvasGraphEdgeKind;
  label: string | null;
  weight: number;
  tentative: boolean;
};

export type CanvasGraphSnapshot = {
  generatedAt: string;
  canvasPath: string;
  nodes: CanvasGraphNode[];
  edges: CanvasGraphEdge[];
};

type CanvasGraphOptions = {
  documentStoreRoot: string;
  canvasPath?: string | null;
};

type CanvasDocument = {
  nodes?: unknown[];
  edges?: unknown[];
};

type CanvasNodeRecord = {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  label?: unknown;
  file?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
};

type CanvasEdgeRecord = {
  id?: unknown;
  fromNode?: unknown;
  toNode?: unknown;
  label?: unknown;
};

const IGNORED_DIRS = new Set([
  ".codex-runs",
  ".git",
  ".next",
  ".yarn",
  "dist",
  "node_modules"
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toPortableRelativePath = (filePath: string) =>
  filePath.replace(/\\/g, "/").replace(/^\.\//, "");

const normalizeRelativeDocumentPath = (relativePath: string) =>
  toPortableRelativePath(path.normalize(relativePath)).replace(/^\/+/, "");

const resolveCanvasFilePath = (documentStoreRoot: string, canvasPath?: string | null) => {
  if (!canvasPath || !canvasPath.trim()) {
    return path.join(documentStoreRoot, "main.canvas");
  }

  return path.isAbsolute(canvasPath)
    ? canvasPath
    : path.join(documentStoreRoot, normalizeRelativeDocumentPath(canvasPath));
};

const findCanvasFiles = async (rootDirectory: string): Promise<string[]> => {
  if (!existsSync(rootDirectory)) {
    return [];
  }

  const entries = await fs.readdir(rootDirectory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDirectory, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          return [];
        }

        return findCanvasFiles(entryPath);
      }

      if (entry.isFile() && entry.name.endsWith(".canvas")) {
        return [entryPath];
      }

      return [];
    })
  );

  return nested.flat().sort((left, right) => left.localeCompare(right));
};

const deriveCategoryFromNotePath = (notePath: string | null): CanvasGraphNodeCategory => {
  if (!notePath) {
    return "other";
  }

  if (notePath.startsWith("fragments/")) {
    return "fragment";
  }

  if (notePath.startsWith("concepts/")) {
    return "concept";
  }

  if (notePath.startsWith("hypotheses/")) {
    return "hypothesis";
  }

  if (
    notePath.startsWith("lists/") ||
    notePath.startsWith("reminders/") ||
    notePath.startsWith("birthdays/") ||
    notePath.startsWith("practical/")
  ) {
    return "practical";
  }

  return "other";
};

const deriveLabelFromPath = (notePath: string) =>
  path.basename(notePath, path.extname(notePath)).replace(/[-_]+/g, " ").trim() || notePath;

const deriveLabelFromText = (text: string) => {
  const firstLine = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine || "Text";
};

const deriveNodeKind = (value: unknown): CanvasGraphNodeKind => {
  if (value === "file" || value === "text" || value === "group") {
    return value;
  }

  return "missing";
};

const isTentativeLabel = (label: string | null) =>
  Boolean(label && /\b(possible|tentative|hypothesis)\b/i.test(label));

const parseCanvasDocument = (raw: string, canvasFile: string): CanvasDocument => {
  const parsed = JSON.parse(raw);

  if (!isRecord(parsed)) {
    throw new Error(`Canvas file "${canvasFile}" must contain a JSON object.`);
  }

  return parsed as CanvasDocument;
};

const stripLinkDecorators = (target: string) => {
  const withoutAlias = target.split("|", 1)[0] || "";
  const withoutHeading = withoutAlias.split("#", 1)[0] || "";
  const withoutQuery = withoutHeading.split("?", 1)[0] || "";

  return withoutQuery.trim();
};

const normalizeLinkCandidate = (value: string) => normalizeRelativeDocumentPath(value).replace(/\.md$/iu, "");

const resolveCanvasNoteReference = (
  rawTarget: string,
  sourceNotePath: string,
  knownNoteIdsByPath: Map<string, string>,
  knownNoteIdsByBarePath: Map<string, string>,
  knownNoteIdsByBasename: Map<string, string | null>
) => {
  const target = stripLinkDecorators(rawTarget);

  if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/iu.test(target)) {
    return null;
  }

  const sourceDirectory = path.posix.dirname(sourceNotePath);
  const isRelativePath = target.startsWith("./") || target.startsWith("../");
  const normalizedCandidate = normalizeLinkCandidate(
    isRelativePath ? path.posix.join(sourceDirectory, target) : target
  );

  const explicitPathMatch =
    knownNoteIdsByPath.get(`${normalizedCandidate}.md`) || knownNoteIdsByPath.get(normalizedCandidate);

  if (explicitPathMatch) {
    return explicitPathMatch;
  }

  const barePathMatch = knownNoteIdsByBarePath.get(normalizedCandidate);

  if (barePathMatch) {
    return barePathMatch;
  }

  if (normalizedCandidate.includes("/")) {
    return null;
  }

  return knownNoteIdsByBasename.get(normalizedCandidate) || null;
};

const collectMarkdownTargets = (
  raw: string,
  sourceNotePath: string,
  knownNoteIdsByPath: Map<string, string>,
  knownNoteIdsByBarePath: Map<string, string>,
  knownNoteIdsByBasename: Map<string, string | null>
) => {
  const targetIds = new Set<string>();

  const wikiLinkPattern = /\[\[([^[\]]+)\]\]/gu;
  for (const match of raw.matchAll(wikiLinkPattern)) {
    const targetId = resolveCanvasNoteReference(
      match[1] || "",
      sourceNotePath,
      knownNoteIdsByPath,
      knownNoteIdsByBarePath,
      knownNoteIdsByBasename
    );

    if (targetId) {
      targetIds.add(targetId);
    }
  }

  const markdownLinkPattern = /\[[^\]]*?\]\(([^)\s]+(?:\s+"[^"]*")?)\)/gu;
  for (const match of raw.matchAll(markdownLinkPattern)) {
    const rawHref = (match[1] || "").trim().replace(/\s+"[^"]*"\s*$/u, "");
    const targetId = resolveCanvasNoteReference(
      rawHref,
      sourceNotePath,
      knownNoteIdsByPath,
      knownNoteIdsByBarePath,
      knownNoteIdsByBasename
    );

    if (targetId) {
      targetIds.add(targetId);
    }
  }

  return targetIds;
};

export const listCanvasGraphFiles = async ({
  documentStoreRoot
}: {
  documentStoreRoot: string;
}) => {
  const files = await findCanvasFiles(documentStoreRoot);
  return files.map((filePath) => toPortableRelativePath(path.relative(documentStoreRoot, filePath)));
};

export const getCanvasGraphSnapshot = async ({
  documentStoreRoot,
  canvasPath
}: CanvasGraphOptions): Promise<CanvasGraphSnapshot> => {
  const canvasFilePath = resolveCanvasFilePath(documentStoreRoot, canvasPath);

  if (!existsSync(canvasFilePath)) {
    throw new Error(
      `Canvas file "${toPortableRelativePath(path.relative(documentStoreRoot, canvasFilePath))}" does not exist.`
    );
  }

  const raw = await fs.readFile(canvasFilePath, "utf8");
  const canvasFile = toPortableRelativePath(path.relative(documentStoreRoot, canvasFilePath));
  const document = parseCanvasDocument(raw, canvasFile);
  const rawNodes = Array.isArray(document.nodes) ? document.nodes : [];
  const rawEdges = Array.isArray(document.edges) ? document.edges : [];

  const inboundCounts = new Map<string, number>();
  const outboundCounts = new Map<string, number>();
  const degreeCounts = new Map<string, number>();

  const nodes = rawNodes
    .map((node): CanvasGraphNode | null => {
      if (!isRecord(node)) {
        return null;
      }

      const canvasNode = node as CanvasNodeRecord;
      const id = typeof canvasNode.id === "string" && canvasNode.id.trim() ? canvasNode.id : null;

      if (!id) {
        return null;
      }

      const kind = deriveNodeKind(canvasNode.type);
      const notePath =
        kind === "file" && typeof canvasNode.file === "string" && canvasNode.file.trim()
          ? normalizeRelativeDocumentPath(canvasNode.file)
          : null;

      const label =
        kind === "file" && notePath
          ? deriveLabelFromPath(notePath)
          : kind === "text" && typeof canvasNode.text === "string"
            ? deriveLabelFromText(canvasNode.text)
            : kind === "group" && typeof canvasNode.label === "string" && canvasNode.label.trim()
              ? canvasNode.label.trim()
              : id;

      return {
        id,
        notePath,
        canvasNodeId: id,
        label,
        kind,
        category: deriveCategoryFromNotePath(notePath),
        canvasFile,
        x: hasFiniteNumber(canvasNode.x) ? canvasNode.x : null,
        y: hasFiniteNumber(canvasNode.y) ? canvasNode.y : null,
        width: hasFiniteNumber(canvasNode.width) ? canvasNode.width : null,
        height: hasFiniteNumber(canvasNode.height) ? canvasNode.height : null,
        degree: 0,
        inboundLinkCount: 0,
        outboundLinkCount: 0,
        tags: []
      };
    })
    .filter((node): node is CanvasGraphNode => Boolean(node));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const knownNoteIdsByPath = new Map<string, string>();
  const knownNoteIdsByBarePath = new Map<string, string>();
  const basenameBuckets = new Map<string, string[]>();

  for (const node of nodes) {
    if (!node.notePath) {
      continue;
    }

    knownNoteIdsByPath.set(node.notePath, node.id);
    knownNoteIdsByBarePath.set(node.notePath.replace(/\.md$/iu, ""), node.id);

    const basename = path.posix.basename(node.notePath, ".md");
    basenameBuckets.set(basename, [...(basenameBuckets.get(basename) || []), node.id]);
  }

  const knownNoteIdsByBasename = new Map<string, string | null>();
  for (const [basename, ids] of basenameBuckets) {
    knownNoteIdsByBasename.set(basename, ids.length === 1 ? ids[0] : null);
  }

  const canvasEdges = rawEdges
    .map((edge): CanvasGraphEdge | null => {
      if (!isRecord(edge)) {
        return null;
      }

      const canvasEdge = edge as CanvasEdgeRecord;
      const id =
        typeof canvasEdge.id === "string" && canvasEdge.id.trim()
          ? canvasEdge.id
          : `edge-${String(canvasEdge.fromNode || "")}-${String(canvasEdge.toNode || "")}`;
      const sourceId =
        typeof canvasEdge.fromNode === "string" && canvasEdge.fromNode.trim()
          ? canvasEdge.fromNode
          : null;
      const targetId =
        typeof canvasEdge.toNode === "string" && canvasEdge.toNode.trim() ? canvasEdge.toNode : null;

      if (!sourceId || !targetId || !nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
        return null;
      }

      const label =
        typeof canvasEdge.label === "string" && canvasEdge.label.trim() ? canvasEdge.label.trim() : null;

      return {
        id,
        sourceId,
        targetId,
        kind: "canvas",
        label,
        weight: 1,
        tentative: isTentativeLabel(label)
      };
    })
    .filter((edge): edge is CanvasGraphEdge => Boolean(edge));

  const markdownEdges: CanvasGraphEdge[] = [];
  const markdownEdgeIds = new Set<string>();

  await Promise.all(
    nodes.map(async (node) => {
      if (!node.notePath) {
        return;
      }

      const filePath = path.join(documentStoreRoot, node.notePath);

      if (!existsSync(filePath)) {
        return;
      }

      const rawNote = await fs.readFile(filePath, "utf8");
      const targetIds = collectMarkdownTargets(
        rawNote,
        node.notePath,
        knownNoteIdsByPath,
        knownNoteIdsByBarePath,
        knownNoteIdsByBasename
      );

      for (const targetId of targetIds) {
        if (!targetId || targetId === node.id) {
          continue;
        }

        const edgeId = `markdown:${node.id}->${targetId}`;

        if (markdownEdgeIds.has(edgeId)) {
          continue;
        }

        markdownEdgeIds.add(edgeId);
        markdownEdges.push({
          id: edgeId,
          sourceId: node.id,
          targetId,
          kind: "markdown-link",
          label: null,
          weight: 0.65,
          tentative: false
        });
      }
    })
  );

  const edges = [...canvasEdges, ...markdownEdges];

  for (const edge of edges) {
    outboundCounts.set(edge.sourceId, (outboundCounts.get(edge.sourceId) || 0) + 1);
    inboundCounts.set(edge.targetId, (inboundCounts.get(edge.targetId) || 0) + 1);
    degreeCounts.set(edge.sourceId, (degreeCounts.get(edge.sourceId) || 0) + 1);
    degreeCounts.set(edge.targetId, (degreeCounts.get(edge.targetId) || 0) + 1);
  }

  for (const node of nodes) {
    node.inboundLinkCount = inboundCounts.get(node.id) || 0;
    node.outboundLinkCount = outboundCounts.get(node.id) || 0;
    node.degree = degreeCounts.get(node.id) || 0;
  }

  return {
    generatedAt: new Date().toISOString(),
    canvasPath: canvasFile,
    nodes,
    edges
  };
};
