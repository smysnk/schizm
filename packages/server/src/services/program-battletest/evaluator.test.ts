import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { evaluateBattletestRun } from "./evaluator";
import type { ScenarioPack } from "./scenario-pack";

const writeJsonFile = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const buildScenario = (): ScenarioPack => ({
  schemaVersion: "1",
  id: "demo",
  title: "Demo",
  theme: "Test",
  description: "Synthetic scenario",
  tags: ["test"],
  seed: {
    mode: "copySeedDir",
    path: "../seed"
  },
  rounds: [
    {
      id: "round-1",
      prompt: "Synthetic prompt",
      expectations: {
        decisionModes: ["create"],
        maximumContextualRelevance: 0,
        hypothesisDelta: {
          createdAtMost: 0
        },
        assertions: [
          {
            type: "pathExists",
            path: "obsidian-repository/notes/example.md"
          },
          {
            type: "canvasHasNodeForPath",
            notePath: "obsidian-repository/notes/example.md"
          }
        ]
      }
    }
  ],
  checkpoints: [
    {
      afterRound: 1,
      assertions: [
        {
          type: "decisionModeObserved",
          mode: "create"
        }
      ]
    }
  ],
  finalAssertions: [
    {
      type: "noUnexpectedHypothesisCreation"
    }
  ]
});

const buildPromptJson = (overrides?: Record<string, unknown>) => ({
  id: "prompt-1",
  content: "Synthetic prompt",
  status: "completed",
  metadata: {
    execution: {
      finalOutput: {
        decision: {
          mode: "create"
        }
      }
    }
  },
  audit: {
    decision: {
      mode: "create"
    },
    contextualRelevance: [],
    hypotheses: {
      created: [],
      updated: [],
      strengthened: [],
      weakened: [],
      disproved: [],
      resolved: []
    }
  },
  startedAt: "2026-03-15T00:00:00.000Z",
  finishedAt: "2026-03-15T00:00:02.000Z",
  errorMessage: null,
  createdAt: "2026-03-15T00:00:00.000Z",
  updatedAt: "2026-03-15T00:00:02.000Z",
  ...overrides
});

test("evaluateBattletestRun passes a valid synthetic run", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "schizm-battletest-eval-"));
  const scenario = buildScenario();
  const scenarioPath = path.join(tempRoot, "scenario.json");
  const seedRoot = path.join(tempRoot, "seed", "obsidian-repository");
  const runRoot = path.join(tempRoot, "run");
  const snapshotRoot = path.join(runRoot, "snapshots", "round-01-round-1");
  const documentStoreSnapshotPath = path.join(snapshotRoot, "obsidian-repository");
  const summaryPath = path.join(runRoot, "summary.json");
  const promptJsonPath = path.join(snapshotRoot, "prompt.json");

  await fs.mkdir(path.join(seedRoot), { recursive: true });
  await fs.writeFile(path.join(seedRoot, "audit.md"), "# Audit\n", "utf8");
  await fs.writeFile(path.join(seedRoot, "main.canvas"), '{"nodes":[],"edges":[]}\n', "utf8");
  await fs.writeFile(path.join(seedRoot, "index.md"), "# Index\n", "utf8");

  await fs.mkdir(path.join(documentStoreSnapshotPath, "notes"), { recursive: true });
  await fs.writeFile(path.join(documentStoreSnapshotPath, "audit.md"), "# Audit\n", "utf8");
  await fs.writeFile(
    path.join(documentStoreSnapshotPath, "main.canvas"),
    JSON.stringify(
      {
        nodes: [
          {
            id: "note-example",
            type: "file",
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            file: "notes/example.md"
          }
        ],
        edges: []
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.writeFile(path.join(documentStoreSnapshotPath, "notes", "example.md"), "# Example\n", "utf8");

  await writeJsonFile(promptJsonPath, buildPromptJson());
  await writeJsonFile(path.join(snapshotRoot, "snapshot.json"), {
    roundNumber: 1,
    roundId: "round-1",
    promptId: "prompt-1",
    promptStatus: "completed",
    snapshotRoot,
    documentStoreSnapshotPath,
    promptJsonPath,
    summaryJsonPath: path.join(snapshotRoot, "snapshot.json"),
    auditSectionPath: null,
    git: {
      branch: "main",
      sha: "deadbeef",
      statusShort: "",
      lastCommitSummary: "deadbeef prompt"
    },
    markdownFileCount: 3,
    canvasFileCount: 1,
    hypothesisFileCount: 0,
    files: [
      "obsidian-repository/audit.md",
      "obsidian-repository/main.canvas",
      "obsidian-repository/notes/example.md"
    ]
  });
  await writeJsonFile(summaryPath, {
    scenarioId: "demo",
    scenarioTitle: "Demo",
    scenarioPath,
    runRoot,
    documentStoreRepoRoot: path.join(runRoot, "document-store"),
    logicalDocumentStoreRoot: path.join(runRoot, "document-store"),
    remotePath: path.join(runRoot, "origin.git"),
    branch: "main",
    controllerRepoRoot: tempRoot,
    executionMode: "container",
    pollMs: 250,
    timeoutMs: 1000,
    codexBin: "codex",
    startedAt: "2026-03-15T00:00:00.000Z",
    finishedAt: "2026-03-15T00:00:02.000Z",
    stoppedEarly: false,
    rounds: [
      {
        roundNumber: 1,
        roundId: "round-1",
        promptId: "prompt-1",
        status: "completed",
        errorMessage: null,
        snapshotRoot,
        auditSectionPath: null,
        markdownFileCount: 3,
        canvasFileCount: 1,
        hypothesisFileCount: 0,
        finishedAt: "2026-03-15T00:00:02.000Z"
      }
    ]
  });
  await writeJsonFile(scenarioPath, scenario);

  const report = await evaluateBattletestRun({
    scenario,
    scenarioPath,
    runRoot,
    summaryPath,
    seedDocumentStorePath: seedRoot
  });

  assert.equal(report.passed, true);
  assert.equal(report.roundResults.length, 1);
  assert.equal(report.roundResults[0].passed, true);
  assert.equal(report.checkpointResults[0].passed, true);
  assert.equal(report.finalAssertionResults[0].passed, true);
});

test("evaluateBattletestRun reports a failing hypothesis status assertion", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "schizm-battletest-eval-"));
  const scenario: ScenarioPack = {
    ...buildScenario(),
    finalAssertions: [
      {
        type: "hypothesisStatusEquals",
        path: "obsidian-repository/hypotheses/test.md",
        status: "Disproved"
      }
    ]
  };
  const scenarioPath = path.join(tempRoot, "scenario.json");
  const seedRoot = path.join(tempRoot, "seed", "obsidian-repository");
  const runRoot = path.join(tempRoot, "run");
  const snapshotRoot = path.join(runRoot, "snapshots", "round-01-round-1");
  const documentStoreSnapshotPath = path.join(snapshotRoot, "obsidian-repository");
  const summaryPath = path.join(runRoot, "summary.json");
  const promptJsonPath = path.join(snapshotRoot, "prompt.json");

  await fs.mkdir(path.join(seedRoot), { recursive: true });
  await fs.writeFile(path.join(seedRoot, "audit.md"), "# Audit\n", "utf8");
  await fs.writeFile(path.join(seedRoot, "main.canvas"), '{"nodes":[],"edges":[]}\n', "utf8");
  await fs.writeFile(path.join(seedRoot, "index.md"), "# Index\n", "utf8");

  await fs.mkdir(path.join(documentStoreSnapshotPath, "hypotheses"), { recursive: true });
  await fs.writeFile(path.join(documentStoreSnapshotPath, "audit.md"), "# Audit\n", "utf8");
  await fs.writeFile(path.join(documentStoreSnapshotPath, "main.canvas"), '{"nodes":[],"edges":[]}\n', "utf8");
  await fs.writeFile(
    path.join(documentStoreSnapshotPath, "hypotheses", "test.md"),
    "# Test\n\n## Status\nOpen\n",
    "utf8"
  );

  await writeJsonFile(promptJsonPath, buildPromptJson());
  await writeJsonFile(path.join(snapshotRoot, "snapshot.json"), {
    roundNumber: 1,
    roundId: "round-1",
    promptId: "prompt-1",
    promptStatus: "completed",
    snapshotRoot,
    documentStoreSnapshotPath,
    promptJsonPath,
    summaryJsonPath: path.join(snapshotRoot, "snapshot.json"),
    auditSectionPath: null,
    git: {
      branch: "main",
      sha: "deadbeef",
      statusShort: "",
      lastCommitSummary: "deadbeef prompt"
    },
    markdownFileCount: 3,
    canvasFileCount: 1,
    hypothesisFileCount: 1,
    files: [
      "obsidian-repository/audit.md",
      "obsidian-repository/main.canvas",
      "obsidian-repository/hypotheses/test.md"
    ]
  });
  await writeJsonFile(summaryPath, {
    scenarioId: "demo",
    scenarioTitle: "Demo",
    scenarioPath,
    runRoot,
    documentStoreRepoRoot: path.join(runRoot, "document-store"),
    logicalDocumentStoreRoot: path.join(runRoot, "document-store"),
    remotePath: path.join(runRoot, "origin.git"),
    branch: "main",
    controllerRepoRoot: tempRoot,
    executionMode: "container",
    pollMs: 250,
    timeoutMs: 1000,
    codexBin: "codex",
    startedAt: "2026-03-15T00:00:00.000Z",
    finishedAt: "2026-03-15T00:00:02.000Z",
    stoppedEarly: false,
    rounds: [
      {
        roundNumber: 1,
        roundId: "round-1",
        promptId: "prompt-1",
        status: "completed",
        errorMessage: null,
        snapshotRoot,
        auditSectionPath: null,
        markdownFileCount: 3,
        canvasFileCount: 1,
        hypothesisFileCount: 1,
        finishedAt: "2026-03-15T00:00:02.000Z"
      }
    ]
  });
  await writeJsonFile(scenarioPath, scenario);

  const report = await evaluateBattletestRun({
    scenario,
    scenarioPath,
    runRoot,
    summaryPath,
    seedDocumentStorePath: seedRoot
  });

  assert.equal(report.passed, false);
  assert.equal(report.finalAssertionResults[0].passed, false);
  assert.match(report.finalAssertionResults[0].message, /Expected .* Disproved/);
});
