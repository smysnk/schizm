import { promises as fs } from "node:fs";
import path from "node:path";

const DOCUMENT_STORE_PREFIX = "obsidian-repository";

export const normalizeDocumentStoreRelativePath = (value: string) => {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");

  if (trimmed === DOCUMENT_STORE_PREFIX) {
    return "";
  }

  if (trimmed.startsWith(`${DOCUMENT_STORE_PREFIX}/`)) {
    return trimmed.slice(DOCUMENT_STORE_PREFIX.length + 1);
  }

  return trimmed;
};

export const resolveSnapshotDocumentPath = (
  documentStoreSnapshotPath: string,
  relativePath: string
) => path.join(documentStoreSnapshotPath, normalizeDocumentStoreRelativePath(relativePath));

export const listRelativeFiles = async (rootDirectory: string): Promise<string[]> => {
  const entries = await fs.readdir(rootDirectory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDirectory, entry.name);

      if (entry.isDirectory()) {
        const children = await listRelativeFiles(entryPath);
        return children.map((child) => path.join(entry.name, child));
      }

      if (entry.isFile()) {
        return [entry.name];
      }

      return [];
    })
  );

  return nested
    .flat()
    .sort((left, right) => left.localeCompare(right));
};

export const listFilesUnderRelativeDir = async (
  documentStoreSnapshotPath: string,
  relativeDirectory: string
) => {
  const resolvedDirectory = resolveSnapshotDocumentPath(
    documentStoreSnapshotPath,
    relativeDirectory
  );

  const stat = await fs.stat(resolvedDirectory).catch(() => null);

  if (!stat?.isDirectory()) {
    return [];
  }

  return listRelativeFiles(resolvedDirectory);
};
