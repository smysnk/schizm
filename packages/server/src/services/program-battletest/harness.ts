import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { Prompt } from "../../repositories/prompt-repository";

const execFileAsync = promisify(execFile);

export const battletestTerminalStatuses = new Set(["completed", "failed", "cancelled"]);

export type BattletestPreparedRepo = {
  runRoot: string;
  remotePath: string;
  workingPath: string;
  branch: string;
  remoteName: string;
  logicalDocumentStoreRoot: string;
  snapshotsRoot: string;
};

export type BattletestGitSnapshot = {
  branch: string | null;
  sha: string | null;
  statusShort: string;
  lastCommitSummary: string | null;
};

export type BattletestRoundSnapshot = {
  roundNumber: number;
  roundId: string;
  promptId: string;
  promptStatus: string;
  snapshotRoot: string;
  documentStoreSnapshotPath: string;
  promptJsonPath: string;
  summaryJsonPath: string;
  auditSectionPath: string | null;
  git: BattletestGitSnapshot;
  markdownFileCount: number;
  canvasFileCount: number;
  hypothesisFileCount: number;
  files: string[];
};

const isTerminalPromptStatus = (status: string) => battletestTerminalStatuses.has(status);

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "scenario";

const timestampToken = () => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join("") +
    "-" +
    [pad(date.getUTCHours()), pad(date.getUTCMinutes()), pad(date.getUTCSeconds())].join("");
};

const ensureDir = async (directory: string) => {
  await fs.mkdir(directory, { recursive: true });
};

const copyDirectoryContents = async (sourceDir: string, destinationDir: string) => {
  await ensureDir(destinationDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, destinationPath);
      continue;
    }

    if (entry.isSymbolicLink()) {
      const target = await fs.readlink(sourcePath);
      await fs.symlink(target, destinationPath);
      continue;
    }

    await fs.copyFile(sourcePath, destinationPath);
  }
};

const runGit = async (repoRoot: string, args: string[]) => {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8"
  });

  return stdout.trim();
};

const safeRunGit = async (repoRoot: string, args: string[]) => {
  try {
    return await runGit(repoRoot, args);
  } catch {
    return "";
  }
};

const listRelativeFiles = async (rootDirectory: string): Promise<string[]> => {
  const entries = await fs.readdir(rootDirectory, { withFileTypes: true });
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

const writeJsonFile = async (filePath: string, value: unknown) => {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const extractPromptAuditSection = async (auditPath: string, promptId: string) => {
  const source = await fs.readFile(auditPath, "utf8").catch(() => null);

  if (!source) {
    return null;
  }

  const startMarker = `<!-- PROMPT-AUDIT-START:${promptId} -->`;
  const endMarker = `<!-- PROMPT-AUDIT-END:${promptId} -->`;
  const startIndex = source.lastIndexOf(startMarker);

  if (startIndex < 0) {
    return null;
  }

  const endIndex = source.indexOf(endMarker, startIndex);

  if (endIndex < 0) {
    return null;
  }

  return source.slice(startIndex, endIndex + endMarker.length);
};

export const prepareBattletestDocumentRepo = async ({
  scenarioId,
  seedPath,
  outputRoot,
  branch = "main",
  remoteName = "origin"
}: {
  scenarioId: string;
  seedPath: string;
  outputRoot: string;
  branch?: string;
  remoteName?: string;
}): Promise<BattletestPreparedRepo> => {
  const scenarioSlug = toSlug(scenarioId);
  const runRoot = path.join(outputRoot, `${scenarioSlug}-${timestampToken()}`);
  const remotePath = path.join(runRoot, "origin.git");
  const workingPath = path.join(runRoot, "document-store");
  const snapshotsRoot = path.join(runRoot, "snapshots");
  const logicalDocumentStoreRoot = workingPath;
  const knowledgeSeedRoot = path.join(seedPath, "obsidian-repository");

  await ensureDir(runRoot);
  await ensureDir(snapshotsRoot);
  await copyDirectoryContents(knowledgeSeedRoot, workingPath);

  await execFileAsync("git", ["init", "--bare", remotePath], {
    cwd: runRoot,
    env: process.env
  });
  await execFileAsync("git", ["init"], {
    cwd: workingPath,
    env: process.env
  });
  await execFileAsync("git", ["config", "user.name", "Schizm Battletest"], {
    cwd: workingPath,
    env: process.env
  });
  await execFileAsync("git", ["config", "user.email", "schizm-battletest@smysnk.com"], {
    cwd: workingPath,
    env: process.env
  });
  await execFileAsync("git", ["checkout", "-b", branch], {
    cwd: workingPath,
    env: process.env
  });
  await execFileAsync("git", ["add", "."], {
    cwd: workingPath,
    env: process.env
  });
  await execFileAsync("git", ["commit", "-m", `seed(${scenarioSlug}): initialize battletest repo`], {
    cwd: workingPath,
    env: process.env
  });
  await execFileAsync("git", ["remote", "add", remoteName, remotePath], {
    cwd: workingPath,
    env: process.env
  });
  await execFileAsync("git", ["push", "-u", remoteName, branch], {
    cwd: workingPath,
    env: process.env
  });

  return {
    runRoot,
    remotePath,
    workingPath,
    branch,
    remoteName,
    logicalDocumentStoreRoot,
    snapshotsRoot
  };
};

export const waitForPromptSettlement = async <TPrompt extends { id: string; status: string }>({
  promptId,
  loadPrompt,
  pollMs,
  timeoutMs
}: {
  promptId: string;
  loadPrompt: (promptId: string) => Promise<TPrompt | null>;
  pollMs: number;
  timeoutMs: number;
}): Promise<TPrompt> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const prompt = await loadPrompt(promptId);

    if (!prompt) {
      throw new Error(`Prompt ${promptId} disappeared while waiting for settlement.`);
    }

    if (isTerminalPromptStatus(prompt.status)) {
      return prompt;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Timed out waiting ${timeoutMs}ms for prompt ${promptId} to settle.`);
};

export const captureBattletestRoundSnapshot = async ({
  snapshotsRoot,
  roundNumber,
  roundId,
  prompt,
  documentStoreRepoRoot
}: {
  snapshotsRoot: string;
  roundNumber: number;
  roundId: string;
  prompt: Prompt;
  documentStoreRepoRoot: string;
}): Promise<BattletestRoundSnapshot> => {
  const roundRoot = path.join(
    snapshotsRoot,
    `round-${String(roundNumber).padStart(2, "0")}-${toSlug(roundId)}`
  );
  const documentStoreSnapshotPath = path.join(roundRoot, "obsidian-repository");
  const promptJsonPath = path.join(roundRoot, "prompt.json");
  const summaryJsonPath = path.join(roundRoot, "snapshot.json");
  const auditSectionPath = path.join(roundRoot, "audit-section.md");

  await ensureDir(roundRoot);
  await copyDirectoryContents(documentStoreRepoRoot, documentStoreSnapshotPath);
  await writeJsonFile(promptJsonPath, prompt);

  const files = await listRelativeFiles(documentStoreRepoRoot);
  const git: BattletestGitSnapshot = {
    branch: (await safeRunGit(documentStoreRepoRoot, ["rev-parse", "--abbrev-ref", "HEAD"])) || null,
    sha: (await safeRunGit(documentStoreRepoRoot, ["rev-parse", "HEAD"])) || null,
    statusShort: await safeRunGit(documentStoreRepoRoot, ["status", "--short"]),
    lastCommitSummary:
      (await safeRunGit(documentStoreRepoRoot, ["log", "-1", "--pretty=%h %s"])) || null
  };

  const markdownFileCount = files.filter((file) => file.endsWith(".md")).length;
  const canvasFileCount = files.filter((file) => file.endsWith(".canvas")).length;
  const hypothesisFileCount = files.filter((file) =>
    file.startsWith(path.join("hypotheses", path.sep)) && file.endsWith(".md")
  ).length;

  const extractedAuditSection = await extractPromptAuditSection(
    path.join(documentStoreRepoRoot, "audit.md"),
    prompt.id
  );

  if (extractedAuditSection) {
    await fs.writeFile(auditSectionPath, extractedAuditSection, "utf8");
  }

  const snapshot: BattletestRoundSnapshot = {
    roundNumber,
    roundId,
    promptId: prompt.id,
    promptStatus: prompt.status,
    snapshotRoot: roundRoot,
    documentStoreSnapshotPath,
    promptJsonPath,
    summaryJsonPath,
    auditSectionPath: extractedAuditSection ? auditSectionPath : null,
    git,
    markdownFileCount,
    canvasFileCount,
    hypothesisFileCount,
    files: files.map((file) => path.join("obsidian-repository", file))
  };

  await writeJsonFile(summaryJsonPath, snapshot);
  return snapshot;
};
