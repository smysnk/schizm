import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  finalizePromptWorktree,
  preparePromptWorktree
} from "./git-worktree";

const execFileAsync = promisify(execFile);

const runGit = async (cwd: string, args: string[]) => {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    env: process.env
  });

  return stdout.trim();
};

test("preparePromptWorktree and finalizePromptWorktree promote a prompt branch safely", async () => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "schizm-git-worktree-"));
  const repoRoot = path.join(rootDirectory, "repo");
  const remoteRoot = path.join(rootDirectory, "origin.git");
  const worktreeRoot = path.join(rootDirectory, "worktrees");

  try {
    await mkdir(repoRoot, { recursive: true });
    await runGit(repoRoot, ["init", "-b", "main"]);
    await runGit(repoRoot, ["config", "user.name", "Schizm Tests"]);
    await runGit(repoRoot, ["config", "user.email", "schizm-tests@example.com"]);

    await writeFile(path.join(repoRoot, "README.md"), "# Schizm\n", "utf8");
    await runGit(repoRoot, ["add", "README.md"]);
    await runGit(repoRoot, ["commit", "-m", "Initial commit"]);

    await runGit(rootDirectory, ["init", "--bare", remoteRoot]);
    await runGit(repoRoot, ["remote", "add", "origin", remoteRoot]);
    await runGit(repoRoot, ["push", "-u", "origin", "main"]);

    const prepared = await preparePromptWorktree({
      repoRoot,
      worktreeRoot,
      automationBranch: "codex/mindmap",
      promptId: "prompt-123",
      remoteName: "origin"
    });

    assert.equal(prepared.promptBranch, "codex/run-prompt-123");
    assert.equal(prepared.remoteConfigured, true);
    assert.equal(existsSync(prepared.worktreePath), true);

    await writeFile(
      path.join(prepared.worktreePath, "notes.md"),
      "Isolated worktree verification.\n",
      "utf8"
    );
    await runGit(prepared.worktreePath, ["add", "notes.md"]);
    await runGit(prepared.worktreePath, ["commit", "-m", "Add worktree note"]);

    const finalized = await finalizePromptWorktree(prepared);

    assert.equal(finalized.worktreeRemoved, true);
    assert.equal(finalized.promptBranchDeleted, true);
    assert.equal(finalized.remotePromptBranchDeleted, true);
    assert.match(finalized.promptCommitSha, /^[0-9a-f]{40}$/);
    assert.match(finalized.automationCommitSha, /^[0-9a-f]{40}$/);
    assert.equal(existsSync(prepared.worktreePath), false);
    assert.equal(
      await runGit(repoRoot, ["show", "codex/mindmap:notes.md"]),
      "Isolated worktree verification."
    );
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});
