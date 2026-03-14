import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { JsonObject } from "../repositories/prompt-repository";

type CanvasValidationIssue = {
  path: string;
  message: string;
};

type CanvasValidationOptions = {
  repoRoot: string;
  requireCanonical?: boolean;
};

export type CanvasValidationReport = JsonObject & {
  checkedAt: string;
  repoRoot: string;
  canonicalPath: string;
  canonicalExists: boolean;
  valid: boolean;
  files: string[];
  issues: CanvasValidationIssue[];
};

const IGNORED_DIRS = new Set([
  ".codex-runs",
  ".git",
  ".next",
  ".yarn",
  "dist",
  "node_modules"
]);

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasFiniteNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

const toRelativePath = (repoRoot: string, filePath: string) =>
  path.relative(repoRoot, filePath) || path.basename(filePath);

const findCanvasFiles = async (rootDirectory: string): Promise<string[]> => {
  const entries = await fs.readdir(rootDirectory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
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

  return nestedFiles.flat().sort((left, right) => left.localeCompare(right));
};

const validateCanvasDocument = (
  repoRoot: string,
  filePath: string,
  document: unknown
): CanvasValidationIssue[] => {
  const issues: CanvasValidationIssue[] = [];
  const relativePath = toRelativePath(repoRoot, filePath);

  if (!isJsonObject(document)) {
    return [{ path: relativePath, message: "Canvas file must contain a JSON object." }];
  }

  const nodes = document.nodes;
  const edges = document.edges;

  if (!Array.isArray(nodes)) {
    issues.push({ path: relativePath, message: 'Canvas file is missing a "nodes" array.' });
  }

  if (!Array.isArray(edges)) {
    issues.push({ path: relativePath, message: 'Canvas file is missing an "edges" array.' });
  }

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return issues;
  }

  const nodeIds = new Set<string>();

  nodes.forEach((node, index) => {
    if (!isJsonObject(node)) {
      issues.push({
        path: relativePath,
        message: `Node ${index + 1} must be a JSON object.`
      });
      return;
    }

    if (typeof node.id !== "string" || !node.id.trim()) {
      issues.push({
        path: relativePath,
        message: `Node ${index + 1} is missing a string id.`
      });
      return;
    }

    if (nodeIds.has(node.id)) {
      issues.push({
        path: relativePath,
        message: `Node id "${node.id}" is duplicated.`
      });
    }

    nodeIds.add(node.id);

    if (typeof node.type !== "string" || !node.type.trim()) {
      issues.push({
        path: relativePath,
        message: `Node "${node.id}" is missing a string type.`
      });
    }

    for (const coordinate of ["x", "y", "width", "height"] as const) {
      if (node[coordinate] !== undefined && !hasFiniteNumber(node[coordinate])) {
        issues.push({
          path: relativePath,
          message: `Node "${node.id}" has a non-numeric ${coordinate}.`
        });
      }
    }
  });

  edges.forEach((edge, index) => {
    if (!isJsonObject(edge)) {
      issues.push({
        path: relativePath,
        message: `Edge ${index + 1} must be a JSON object.`
      });
      return;
    }

    if (typeof edge.id !== "string" || !edge.id.trim()) {
      issues.push({
        path: relativePath,
        message: `Edge ${index + 1} is missing a string id.`
      });
    }

    const fromNode = typeof edge.fromNode === "string" ? edge.fromNode.trim() : "";
    const toNode = typeof edge.toNode === "string" ? edge.toNode.trim() : "";

    if (!fromNode || !toNode) {
      issues.push({
        path: relativePath,
        message: `Edge ${index + 1} must include string fromNode and toNode references.`
      });
      return;
    }

    if (!nodeIds.has(fromNode)) {
      issues.push({
        path: relativePath,
        message: `Edge ${index + 1} references missing fromNode "${fromNode}".`
      });
    }

    if (!nodeIds.has(toNode)) {
      issues.push({
        path: relativePath,
        message: `Edge ${index + 1} references missing toNode "${toNode}".`
      });
    }
  });

  return issues;
};

export const validateCanvasState = async ({
  repoRoot,
  requireCanonical = false
}: CanvasValidationOptions): Promise<CanvasValidationReport> => {
  const checkedAt = new Date().toISOString();
  const canonicalPath = path.join(repoRoot, "main.canvas");
  const canonicalExists = existsSync(canonicalPath);
  const files = await findCanvasFiles(repoRoot);
  const issues: CanvasValidationIssue[] = [];

  if (requireCanonical && !canonicalExists) {
    issues.push({
      path: "main.canvas",
      message: "Canonical canvas is required for this run but does not exist."
    });
  }

  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      issues.push(...validateCanvasDocument(repoRoot, filePath, parsed));
    } catch (error) {
      issues.push({
        path: toRelativePath(repoRoot, filePath),
        message:
          error instanceof Error
            ? `Canvas file could not be parsed: ${error.message}`
            : "Canvas file could not be parsed."
      });
    }
  }

  return {
    checkedAt,
    repoRoot,
    canonicalPath: toRelativePath(repoRoot, canonicalPath),
    canonicalExists,
    valid: issues.length === 0,
    files: files.map((filePath) => toRelativePath(repoRoot, filePath)),
    issues
  };
};

export const formatCanvasValidationError = (
  report: CanvasValidationReport,
  context: string
) => {
  const details = report.issues
    .slice(0, 5)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("; ");

  return details ? `${context}: ${details}` : context;
};
