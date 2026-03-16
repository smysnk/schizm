import { promises as fs } from "node:fs";
import path from "node:path";
import {
  listFilesUnderRelativeDir,
  normalizeDocumentStoreRelativePath,
  resolveSnapshotDocumentPath
} from "./document-store-paths";
import { hypothesisStatuses, type HypothesisStatus } from "./scenario-pack";

export const listHypothesisFiles = async (documentStoreSnapshotPath: string) =>
  (await listFilesUnderRelativeDir(documentStoreSnapshotPath, "obsidian-repository/hypotheses"))
    .filter((filePath) => filePath.endsWith(".md"))
    .map((filePath) => path.posix.join("obsidian-repository", "hypotheses", filePath.replace(/\\/g, "/")))
    .sort((left, right) => left.localeCompare(right));

export const readHypothesisStatus = async ({
  documentStoreSnapshotPath,
  hypothesisPath
}: {
  documentStoreSnapshotPath: string;
  hypothesisPath: string;
}): Promise<HypothesisStatus | null> => {
  const resolvedPath = resolveSnapshotDocumentPath(documentStoreSnapshotPath, hypothesisPath);
  const source = await fs.readFile(resolvedPath, "utf8");
  const normalized = source.replace(/\r\n/g, "\n");
  const match = normalized.match(/^## Status\s*\n+([^\n]+)$/m);

  if (!match) {
    return null;
  }

  const status = match[1].trim();

  if (!hypothesisStatuses.includes(status as HypothesisStatus)) {
    return null;
  }

  return status as HypothesisStatus;
};

export const normalizeHypothesisPath = (hypothesisPath: string) =>
  path.posix.join("obsidian-repository", normalizeDocumentStoreRelativePath(hypothesisPath));
