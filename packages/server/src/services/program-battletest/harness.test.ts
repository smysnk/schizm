import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  captureBattletestRoundSnapshot,
  prepareBattletestDocumentRepo,
  waitForPromptSettlement
} from "./harness";
import type { Prompt } from "../../repositories/prompt-repository";

const execFileAsync = promisify(execFile);

const makePrompt = (overrides: Partial<Prompt> = {}): Prompt => ({
  id: "prompt-123",
  content: "Example",
  status: "completed",
  metadata: {},
  audit: {},
  startedAt: "2026-03-15T00:00:00.000Z",
  finishedAt: "2026-03-15T00:00:05.000Z",
  errorMessage: null,
  createdAt: "2026-03-15T00:00:00.000Z",
  updatedAt: "2026-03-15T00:00:05.000Z",
  ...overrides
});

test("prepareBattletestDocumentRepo creates seeded isolated repo with remote", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "schizm-battletest-"));
  const seedRoot = path.join(tempRoot, "seed");
  const outputRoot = path.join(tempRoot, "out");

  await fs.mkdir(path.join(seedRoot, "obsidian-repository"), { recursive: true });
  await fs.writeFile(path.join(seedRoot, "obsidian-repository", "audit.md"), "# Audit\n", "utf8");
  await fs.writeFile(
    path.join(seedRoot, "obsidian-repository", "main.canvas"),
    '{"nodes":[],"edges":[]}\n',
    "utf8"
  );

  const prepared = await prepareBattletestDocumentRepo({
    scenarioId: "demo-scenario",
    seedPath: seedRoot,
    outputRoot
  });

  await assert.doesNotReject(() =>
    fs.access(path.join(prepared.workingPath, "audit.md"))
  );
  assert.equal(
    await execFileAsync("git", ["branch", "--show-current"], {
      cwd: prepared.workingPath,
      encoding: "utf8"
    }).then((result) => result.stdout.trim()),
    "main"
  );
  assert.equal(
    await execFileAsync("git", ["remote", "get-url", "origin"], {
      cwd: prepared.workingPath,
      encoding: "utf8"
    }).then((result) => result.stdout.trim()),
    prepared.remotePath
  );
  assert.match(
    await execFileAsync("git", ["ls-remote", "--heads", "origin", "main"], {
      cwd: prepared.workingPath,
      encoding: "utf8"
    }).then((result) => result.stdout.trim()),
    /refs\/heads\/main$/
  );
});

test("waitForPromptSettlement polls until prompt reaches a terminal state", async () => {
  const states = ["queued", "scanning", "writing", "completed"];
  let index = 0;

  const settled = await waitForPromptSettlement({
    promptId: "prompt-123",
    loadPrompt: async () => makePrompt({ status: states[Math.min(index++, states.length - 1)] }),
    pollMs: 5,
    timeoutMs: 1_000
  });

  assert.equal(settled.status, "completed");
});

test("captureBattletestRoundSnapshot copies the logical document store and audit slice", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "schizm-battletest-"));
  const repoRoot = path.join(tempRoot, "repo");
  const snapshotsRoot = path.join(tempRoot, "snapshots");

  await fs.mkdir(path.join(repoRoot, "hypotheses"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, "audit.md"), `# Audit

<!-- PROMPT-AUDIT-START:prompt-123 -->
## Prompt Round

- Date: 2026-03-15T00:00:00Z
- Prompt ID: prompt-123
- Input Prompt: Example

\`\`\`json
{"promptId":"prompt-123"}
\`\`\`
<!-- PROMPT-AUDIT-END:prompt-123 -->
`, "utf8");
  await fs.writeFile(path.join(repoRoot, "main.canvas"), '{"nodes":[],"edges":[]}\n', "utf8");
  await fs.writeFile(path.join(repoRoot, "index.md"), "# Index\n", "utf8");
  await fs.writeFile(
    path.join(repoRoot, "hypotheses", "test-hypothesis.md"),
    "# Test Hypothesis\n\n## Status\nOpen\n",
    "utf8"
  );

  await execFileAsync("git", ["init"], { cwd: repoRoot, env: process.env });
  await execFileAsync("git", ["config", "user.name", "Test"], { cwd: repoRoot, env: process.env });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], {
    cwd: repoRoot,
    env: process.env
  });
  await execFileAsync("git", ["checkout", "-b", "main"], { cwd: repoRoot, env: process.env });
  await execFileAsync("git", ["add", "."], { cwd: repoRoot, env: process.env });
  await execFileAsync("git", ["commit", "-m", "seed"], { cwd: repoRoot, env: process.env });

  const snapshot = await captureBattletestRoundSnapshot({
    snapshotsRoot,
    roundNumber: 1,
    roundId: "round-1",
    prompt: makePrompt(),
    documentStoreRepoRoot: repoRoot
  });

  assert.equal(snapshot.promptStatus, "completed");
  assert.equal(snapshot.markdownFileCount, 3);
  assert.equal(snapshot.canvasFileCount, 1);
  assert.equal(snapshot.hypothesisFileCount, 1);
  assert.equal(snapshot.git.branch, "main");
  await assert.doesNotReject(() => fs.access(path.join(snapshot.documentStoreSnapshotPath, "audit.md")));
  await assert.doesNotReject(() => fs.access(snapshot.promptJsonPath));
  await assert.doesNotReject(() => fs.access(snapshot.summaryJsonPath));
  await assert.doesNotReject(() => fs.access(snapshot.auditSectionPath!));
});
