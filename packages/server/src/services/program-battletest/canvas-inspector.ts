import { promises as fs } from "node:fs";
import { DEFAULT_CANVAS_PATH } from "./scenario-pack";
import {
  normalizeDocumentStoreRelativePath,
  resolveSnapshotDocumentPath
} from "./document-store-paths";

type CanvasNode = {
  id: string;
  file?: string;
};

type CanvasEdge = {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string;
};

type CanvasDocument = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toCanvasDocument = (value: unknown): CanvasDocument => {
  if (!isRecord(value)) {
    throw new Error("Canvas document must be an object.");
  }

  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  const edges = Array.isArray(value.edges) ? value.edges : [];

  return {
    nodes: nodes.flatMap((node) => {
      if (!isRecord(node) || typeof node.id !== "string") {
        return [];
      }

      return [
        {
          id: node.id,
          file: typeof node.file === "string" ? node.file : undefined
        }
      ];
    }),
    edges: edges.flatMap((edge) => {
      if (
        !isRecord(edge) ||
        typeof edge.id !== "string" ||
        typeof edge.fromNode !== "string" ||
        typeof edge.toNode !== "string"
      ) {
        return [];
      }

      return [
        {
          id: edge.id,
          fromNode: edge.fromNode,
          toNode: edge.toNode,
          label: typeof edge.label === "string" ? edge.label : undefined
        }
      ];
    })
  };
};

const isTentativeEdgeLabel = (label: string | undefined) => {
  const normalized = (label || "").trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return ["possible", "tentative", "hypothesis", "uncertain", "may", "might"].some((token) =>
    normalized.includes(token)
  );
};

export const loadCanvasDocument = async (
  documentStoreSnapshotPath: string,
  canvasPath = DEFAULT_CANVAS_PATH
) => {
  const resolvedPath = resolveSnapshotDocumentPath(documentStoreSnapshotPath, canvasPath);
  const source = await fs.readFile(resolvedPath, "utf8");
  return toCanvasDocument(JSON.parse(source));
};

export const canvasHasNodeForPath = async ({
  documentStoreSnapshotPath,
  notePath,
  canvasPath
}: {
  documentStoreSnapshotPath: string;
  notePath: string;
  canvasPath?: string;
}) => {
  const canvas = await loadCanvasDocument(documentStoreSnapshotPath, canvasPath);
  const normalizedNotePath = normalizeDocumentStoreRelativePath(notePath);

  return canvas.nodes.some(
    (node) =>
      typeof node.file === "string" &&
      normalizeDocumentStoreRelativePath(node.file) === normalizedNotePath
  );
};

export const canvasHasTentativeEdgeBetweenPaths = async ({
  documentStoreSnapshotPath,
  from,
  to,
  canvasPath
}: {
  documentStoreSnapshotPath: string;
  from: string;
  to: string;
  canvasPath?: string;
}) => {
  const canvas = await loadCanvasDocument(documentStoreSnapshotPath, canvasPath);
  const fromPath = normalizeDocumentStoreRelativePath(from);
  const toPath = normalizeDocumentStoreRelativePath(to);
  const nodePathById = new Map(
    canvas.nodes.flatMap((node) =>
      typeof node.file === "string"
        ? [[node.id, normalizeDocumentStoreRelativePath(node.file)]]
        : []
    )
  );

  return canvas.edges.some((edge) => {
    const edgeFrom = nodePathById.get(edge.fromNode);
    const edgeTo = nodePathById.get(edge.toNode);

    if (!edgeFrom || !edgeTo) {
      return false;
    }

    const matchesPair =
      (edgeFrom === fromPath && edgeTo === toPath) ||
      (edgeFrom === toPath && edgeTo === fromPath);

    if (!matchesPair) {
      return false;
    }

    const endpointIsHypothesis = edgeFrom.startsWith("hypotheses/") || edgeTo.startsWith("hypotheses/");

    return endpointIsHypothesis || isTentativeEdgeLabel(edge.label);
  });
};
