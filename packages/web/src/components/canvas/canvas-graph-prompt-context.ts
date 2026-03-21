import type { PromptRecord } from "../../lib/graphql";
import type { CanvasGraphSnapshotRecord } from "./canvas-graph-types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toPortablePath = (value: string) => value.replace(/\\/g, "/").trim();

const normalizeAuditNotePath = (value: string) => {
  const portable = toPortablePath(value)
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

const collectStringPaths = (target: Set<string>, value: unknown) => {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const normalized = normalizeAuditNotePath(entry);

    if (!normalized || !normalized.endsWith(".md")) {
      continue;
    }

    target.add(normalized);
  }
};

const collectMovedPaths = (target: Set<string>, value: unknown) => {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const from = typeof entry.from === "string" ? normalizeAuditNotePath(entry.from) : null;
    const to = typeof entry.to === "string" ? normalizeAuditNotePath(entry.to) : null;

    if (from && from.endsWith(".md")) {
      target.add(from);
    }

    if (to && to.endsWith(".md")) {
      target.add(to);
    }
  }
};

const collectContextualPaths = (target: Set<string>, value: unknown) => {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.path !== "string") {
      continue;
    }

    const normalized = normalizeAuditNotePath(entry.path);

    if (!normalized || !normalized.endsWith(".md")) {
      continue;
    }

    target.add(normalized);
  }
};

const collectHypothesisPaths = (target: Set<string>, value: unknown) => {
  if (typeof value === "string") {
    const normalized = normalizeAuditNotePath(value);

    if (normalized && normalized.endsWith(".md")) {
      target.add(normalized);
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectHypothesisPaths(target, entry);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const nested of Object.values(value)) {
    collectHypothesisPaths(target, nested);
  }
};

export const getPromptTouchedNotePaths = (prompt: PromptRecord | null): string[] => {
  if (!prompt || !isRecord(prompt.audit)) {
    return [];
  }

  const touched = new Set<string>();

  collectStringPaths(touched, prompt.audit.added);
  collectStringPaths(touched, prompt.audit.modified);
  collectStringPaths(touched, prompt.audit.deleted);
  collectMovedPaths(touched, prompt.audit.moved);
  collectContextualPaths(touched, prompt.audit.contextualRelevance);
  collectHypothesisPaths(touched, prompt.audit.hypotheses);

  return Array.from(touched).sort((left, right) => left.localeCompare(right));
};

export const getCanvasGraphHighlightedNodeIds = (
  snapshot: CanvasGraphSnapshotRecord | null,
  notePaths: string[]
) => {
  if (!snapshot || !notePaths.length) {
    return [];
  }

  const normalizedPaths = new Set(
    notePaths
      .map((notePath) => normalizeAuditNotePath(notePath))
      .filter((notePath): notePath is string => Boolean(notePath))
  );

  return snapshot.nodes
    .filter((node) => node.notePath && normalizedPaths.has(node.notePath))
    .map((node) => node.id);
};

export const getCanvasGraphPromptRefreshToken = (prompts: PromptRecord[]) => {
  let latestPrompt: PromptRecord | null = null;
  let latestTimestamp = -Infinity;

  for (const prompt of prompts) {
    if (prompt.status !== "completed") {
      continue;
    }

    const timestamp = Date.parse(prompt.finishedAt || prompt.updatedAt || prompt.createdAt);

    if (Number.isNaN(timestamp) || timestamp < latestTimestamp) {
      continue;
    }

    latestTimestamp = timestamp;
    latestPrompt = prompt;
  }

  if (!latestPrompt) {
    return null;
  }

  return `${latestPrompt.id}:${latestPrompt.finishedAt || latestPrompt.updatedAt || latestPrompt.createdAt}`;
};
