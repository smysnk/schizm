import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { verifyContainerDocumentRepoPush } from "./container-document-repo";

const execFileAsync = promisify(execFile);

const runGit = async (cwd: string, args: string[]) => {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    env: process.env,
    encoding: "utf8"
  });

  return stdout.trim();
};

test("verifyContainerDocumentRepoPush confirms a committed and pushed branch", async () => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "schizm-container-repo-"));
  const remoteRoot = path.join(rootDirectory, "origin.git");
  const seedRoot = path.join(rootDirectory, "seed");
  const cloneRoot = path.join(rootDirectory, "clone");

  try {
    await mkdir(seedRoot, { recursive: true });
    await runGit(seedRoot, ["init", "-b", "main"]);
    await runGit(seedRoot, ["config", "user.name", "Schizm Tests"]);
    await runGit(seedRoot, ["config", "user.email", "schizm-tests@example.com"]);
    await writeFile(path.join(seedRoot, "audit.md"), "# Audit\n", "utf8");
    await runGit(seedRoot, ["add", "audit.md"]);
    await runGit(seedRoot, ["commit", "-m", "Initial commit"]);

    await runGit(rootDirectory, ["init", "--bare", remoteRoot]);
    await runGit(seedRoot, ["remote", "add", "origin", remoteRoot]);
    await runGit(seedRoot, ["push", "-u", "origin", "main"]);

    await runGit(rootDirectory, ["clone", "--branch", "main", remoteRoot, cloneRoot]);
    await runGit(cloneRoot, ["config", "user.name", "Schizm Tests"]);
    await runGit(cloneRoot, ["config", "user.email", "schizm-tests@example.com"]);

    await writeFile(path.join(cloneRoot, "note.md"), "Captured thought.\n", "utf8");
    await runGit(cloneRoot, ["add", "note.md"]);
    await runGit(cloneRoot, ["commit", "-m", "Add note"]);
    const headSha = await runGit(cloneRoot, ["rev-parse", "HEAD"]);
    await runGit(cloneRoot, ["push", "origin", "main"]);

    const verification = await verifyContainerDocumentRepoPush({
      repoRoot: cloneRoot,
      remoteName: "origin",
      branch: "main",
      expectedCommitSha: headSha
    });

    assert.equal(verification.headSha, headSha);
    assert.equal(verification.remoteSha, headSha);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test("verifyContainerDocumentRepoPush rejects commits that were not pushed", async () => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "schizm-container-repo-unpushed-"));
  const remoteRoot = path.join(rootDirectory, "origin.git");
  const seedRoot = path.join(rootDirectory, "seed");
  const cloneRoot = path.join(rootDirectory, "clone");

  try {
    await mkdir(seedRoot, { recursive: true });
    await runGit(seedRoot, ["init", "-b", "main"]);
    await runGit(seedRoot, ["config", "user.name", "Schizm Tests"]);
    await runGit(seedRoot, ["config", "user.email", "schizm-tests@example.com"]);
    await writeFile(path.join(seedRoot, "audit.md"), "# Audit\n", "utf8");
    await runGit(seedRoot, ["add", "audit.md"]);
    await runGit(seedRoot, ["commit", "-m", "Initial commit"]);

    await runGit(rootDirectory, ["init", "--bare", remoteRoot]);
    await runGit(seedRoot, ["remote", "add", "origin", remoteRoot]);
    await runGit(seedRoot, ["push", "-u", "origin", "main"]);

    await runGit(rootDirectory, ["clone", "--branch", "main", remoteRoot, cloneRoot]);
    await runGit(cloneRoot, ["config", "user.name", "Schizm Tests"]);
    await runGit(cloneRoot, ["config", "user.email", "schizm-tests@example.com"]);

    await writeFile(path.join(cloneRoot, "note.md"), "Local only.\n", "utf8");
    await runGit(cloneRoot, ["add", "note.md"]);
    await runGit(cloneRoot, ["commit", "-m", "Local commit"]);

    await assert.rejects(
      () =>
        verifyContainerDocumentRepoPush({
          repoRoot: cloneRoot,
          remoteName: "origin",
          branch: "main"
        }),
      /push verification failed/
    );
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});
