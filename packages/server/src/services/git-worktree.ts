import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

type GitOutput = {
  stdout: string;
  stderr: string;
};

export type PreparedPromptWorktree = {
  repoRoot: string;
  worktreeRoot: string;
  worktreePath: string;
  automationBranch: string;
  promptBranch: string;
  remoteName: string;
  remoteConfigured: boolean;
};

export type FinalizedPromptWorktree = {
  promptBranch: string;
  automationBranch: string;
  promptCommitSha: string;
  automationCommitSha: string;
  worktreeRemoved: boolean;
  promptBranchDeleted: boolean;
  remotePromptBranchDeleted: boolean;
};

const execFileAsync = promisify(execFile);

const runGit = async (repoRoot: string, args: string[], cwd = repoRoot): Promise<GitOutput> => {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd,
    env: process.env
  });

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim()
  };
};

const tryGit = async (repoRoot: string, args: string[], cwd = repoRoot) => {
  try {
    return await runGit(repoRoot, args, cwd);
  } catch (_error) {
    return null;
  }
};

const branchExists = async (repoRoot: string, branchName: string) =>
  Boolean(await tryGit(repoRoot, ["rev-parse", "--verify", branchName]));

const remoteExists = async (repoRoot: string, remoteName: string) =>
  Boolean(await tryGit(repoRoot, ["remote", "get-url", remoteName]));

const sanitizePromptBranchName = (promptId: string) =>
  `codex/run-${promptId.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;

const resolveBaseRef = async (repoRoot: string) => {
  for (const candidate of ["main", "master", "HEAD"]) {
    if (candidate === "HEAD" || (await branchExists(repoRoot, candidate))) {
      return candidate;
    }
  }

  return "HEAD";
};

export const ensureGitRepository = async (repoRoot: string) => {
  const result = await runGit(repoRoot, ["rev-parse", "--is-inside-work-tree"]);

  if (result.stdout !== "true") {
    throw new Error(`${repoRoot} is not a Git work tree.`);
  }
};

export const ensureAutomationBranch = async ({
  repoRoot,
  automationBranch,
  remoteName
}: {
  repoRoot: string;
  automationBranch: string;
  remoteName: string;
}) => {
  if (!(await branchExists(repoRoot, automationBranch))) {
    const baseRef = await resolveBaseRef(repoRoot);
    await runGit(repoRoot, ["branch", automationBranch, baseRef]);
  }

  if (await remoteExists(repoRoot, remoteName)) {
    await runGit(repoRoot, ["push", "-u", remoteName, automationBranch]);
    return true;
  }

  return false;
};

export const preparePromptWorktree = async ({
  repoRoot,
  worktreeRoot,
  automationBranch,
  promptId,
  remoteName
}: {
  repoRoot: string;
  worktreeRoot: string;
  automationBranch: string;
  promptId: string;
  remoteName: string;
}): Promise<PreparedPromptWorktree> => {
  await ensureGitRepository(repoRoot);
  await fs.mkdir(worktreeRoot, { recursive: true });

  const remoteConfigured = await ensureAutomationBranch({
    repoRoot,
    automationBranch,
    remoteName
  });
  const worktreePath = path.join(worktreeRoot, promptId);
  const promptBranch = sanitizePromptBranchName(promptId);

  if (existsSync(worktreePath)) {
    throw new Error(`Prompt worktree path already exists: ${worktreePath}`);
  }

  if (await branchExists(repoRoot, promptBranch)) {
    throw new Error(`Prompt branch already exists: ${promptBranch}`);
  }

  await runGit(repoRoot, ["worktree", "add", "-b", promptBranch, worktreePath, automationBranch]);

  if (remoteConfigured) {
    await runGit(repoRoot, ["push", "-u", remoteName, promptBranch], worktreePath);
  }

  return {
    repoRoot,
    worktreeRoot,
    worktreePath,
    automationBranch,
    promptBranch,
    remoteName,
    remoteConfigured
  };
};

export const finalizePromptWorktree = async (
  prepared: PreparedPromptWorktree
): Promise<FinalizedPromptWorktree> => {
  const promptCommitSha = (
    await runGit(prepared.repoRoot, ["rev-parse", prepared.promptBranch])
  ).stdout;

  await runGit(prepared.repoRoot, ["branch", "-f", prepared.automationBranch, promptCommitSha]);

  if (prepared.remoteConfigured) {
    await runGit(prepared.repoRoot, ["push", prepared.remoteName, prepared.automationBranch]);
  }

  await runGit(prepared.repoRoot, ["worktree", "remove", prepared.worktreePath]);
  await runGit(prepared.repoRoot, ["branch", "-D", prepared.promptBranch]);

  let remotePromptBranchDeleted = false;

  if (prepared.remoteConfigured) {
    await runGit(prepared.repoRoot, ["push", prepared.remoteName, "--delete", prepared.promptBranch]);
    remotePromptBranchDeleted = true;
  }

  return {
    promptBranch: prepared.promptBranch,
    automationBranch: prepared.automationBranch,
    promptCommitSha,
    automationCommitSha: (
      await runGit(prepared.repoRoot, ["rev-parse", prepared.automationBranch])
    ).stdout,
    worktreeRemoved: !existsSync(prepared.worktreePath),
    promptBranchDeleted: !(await branchExists(prepared.repoRoot, prepared.promptBranch)),
    remotePromptBranchDeleted
  };
};
