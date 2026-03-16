import { promises as fs } from "node:fs";
import path from "node:path";

const writeJsonFile = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeTextFile = async (filePath: string, content: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
};

export const createSyntheticBattletestSuiteFixture = async (rootDir: string) => {
  const suiteRunRoot = path.join(rootDir, "suite-run");
  const firstScenarioRoot = path.join(suiteRunRoot, "scenario-runs", "unrelated-fragments-demo");
  const secondScenarioRoot = path.join(suiteRunRoot, "scenario-runs", "grocery-lists-demo");
  const firstSnapshotRoot = path.join(firstScenarioRoot, "snapshots", "round-01-round-1");
  const secondSnapshotRoot = path.join(secondScenarioRoot, "snapshots", "round-01-round-1");

  await fs.rm(rootDir, { recursive: true, force: true });

  await writeTextFile(
    path.join(firstSnapshotRoot, "obsidian-repository", "audit.md"),
    "# audit\n"
  );
  await writeTextFile(
    path.join(firstSnapshotRoot, "obsidian-repository", "main.canvas"),
    "{\"nodes\":[],\"edges\":[]}\n"
  );
  await writeJsonFile(path.join(firstSnapshotRoot, "prompt.json"), {
    id: "prompt-failed",
    status: "failed",
    metadata: {},
    audit: {}
  });
  await writeJsonFile(path.join(firstSnapshotRoot, "snapshot.json"), {
    roundNumber: 1,
    promptId: "prompt-failed"
  });

  await writeTextFile(
    path.join(secondSnapshotRoot, "obsidian-repository", "grocery.md"),
    "- apples\n- milk\n"
  );
  await writeTextFile(
    path.join(secondSnapshotRoot, "audit-section.md"),
    "<!-- PROMPT-AUDIT-START:prompt-passed -->\n<!-- PROMPT-AUDIT-END:prompt-passed -->\n"
  );
  await writeJsonFile(path.join(secondSnapshotRoot, "prompt.json"), {
    id: "prompt-passed",
    status: "completed",
    metadata: {},
    audit: {}
  });
  await writeJsonFile(path.join(secondSnapshotRoot, "snapshot.json"), {
    roundNumber: 1,
    promptId: "prompt-passed"
  });

  const firstSummaryPath = path.join(firstScenarioRoot, "summary.json");
  const firstEvaluationPath = path.join(firstScenarioRoot, "evaluation.json");
  const secondSummaryPath = path.join(secondScenarioRoot, "summary.json");
  const secondEvaluationPath = path.join(secondScenarioRoot, "evaluation.json");

  await writeJsonFile(firstSummaryPath, {
    scenarioId: "unrelated-fragments",
    scenarioTitle: "Unrelated Fragments",
    scenarioPath: "/repo/scenarios/program-battletest/unrelated-fragments/scenario.json",
    runRoot: firstScenarioRoot,
    documentStoreRepoRoot: path.join(firstScenarioRoot, "document-store"),
    logicalDocumentStoreRoot: path.join(firstScenarioRoot, "document-store"),
    remotePath: path.join(firstScenarioRoot, "origin.git"),
    branch: "main",
    controllerRepoRoot: "/repo",
    executionMode: "container",
    pollMs: 250,
    timeoutMs: 3000,
    codexBin: "codex",
    startedAt: "2026-03-16T03:18:26.079Z",
    finishedAt: "2026-03-16T03:18:26.731Z",
    stoppedEarly: true,
    rounds: [
      {
        roundNumber: 1,
        roundId: "round-1",
        promptId: "prompt-failed",
        status: "failed",
        errorMessage: "Codex CLI exited with code 1",
        snapshotRoot: firstSnapshotRoot,
        auditSectionPath: null,
        markdownFileCount: 1,
        canvasFileCount: 1,
        hypothesisFileCount: 0,
        finishedAt: "2026-03-16T03:18:26.531Z"
      }
    ]
  });

  await writeJsonFile(firstEvaluationPath, {
    scenarioId: "unrelated-fragments",
    scenarioTitle: "Unrelated Fragments",
    scenarioPath: "/repo/scenarios/program-battletest/unrelated-fragments/scenario.json",
    runRoot: firstScenarioRoot,
    summaryPath: firstSummaryPath,
    startedAt: "2026-03-16T03:18:26.079Z",
    finishedAt: "2026-03-16T03:18:26.731Z",
    passed: false,
    stoppedEarly: true,
    roundResults: [
      {
        roundNumber: 1,
        roundId: "round-1",
        promptId: "prompt-failed",
        promptStatus: "failed",
        passed: false,
        expectationResults: [
          {
            kind: "expectation",
            label: "Decision mode expectation",
            passed: false,
            message: "Expected one of create, received missing.",
            roundNumber: 1,
            roundId: "round-1",
            assertionType: "decisionModes"
          }
        ]
      }
    ],
    checkpointResults: [],
    finalAssertionResults: []
  });

  await writeJsonFile(secondSummaryPath, {
    scenarioId: "grocery-lists",
    scenarioTitle: "Grocery Lists",
    scenarioPath: "/repo/scenarios/program-battletest/grocery-lists/scenario.json",
    runRoot: secondScenarioRoot,
    documentStoreRepoRoot: path.join(secondScenarioRoot, "document-store"),
    logicalDocumentStoreRoot: path.join(secondScenarioRoot, "document-store"),
    remotePath: path.join(secondScenarioRoot, "origin.git"),
    branch: "main",
    controllerRepoRoot: "/repo",
    executionMode: "container",
    pollMs: 250,
    timeoutMs: 3000,
    codexBin: "codex",
    startedAt: "2026-03-16T03:18:28.079Z",
    finishedAt: "2026-03-16T03:18:28.731Z",
    stoppedEarly: false,
    rounds: [
      {
        roundNumber: 1,
        roundId: "round-1",
        promptId: "prompt-passed",
        status: "completed",
        errorMessage: null,
        snapshotRoot: secondSnapshotRoot,
        auditSectionPath: path.join(secondSnapshotRoot, "audit-section.md"),
        markdownFileCount: 2,
        canvasFileCount: 1,
        hypothesisFileCount: 0,
        finishedAt: "2026-03-16T03:18:28.531Z"
      }
    ]
  });

  await writeJsonFile(secondEvaluationPath, {
    scenarioId: "grocery-lists",
    scenarioTitle: "Grocery Lists",
    scenarioPath: "/repo/scenarios/program-battletest/grocery-lists/scenario.json",
    runRoot: secondScenarioRoot,
    summaryPath: secondSummaryPath,
    startedAt: "2026-03-16T03:18:28.079Z",
    finishedAt: "2026-03-16T03:18:28.731Z",
    passed: true,
    stoppedEarly: false,
    roundResults: [
      {
        roundNumber: 1,
        roundId: "round-1",
        promptId: "prompt-passed",
        promptStatus: "completed",
        passed: true,
        expectationResults: []
      }
    ],
    checkpointResults: [],
    finalAssertionResults: []
  });

  const suiteSummaryPath = path.join(suiteRunRoot, "suite-summary.json");

  await writeJsonFile(suiteSummaryPath, {
    suiteId: "initial",
    suiteTitle: "Initial Program Battletest Suite",
    suitePath: "/repo/scenarios/program-battletest/suites/initial.json",
    runRoot: suiteRunRoot,
    startedAt: "2026-03-16T03:18:25.835Z",
    finishedAt: "2026-03-16T03:18:30.553Z",
    passed: false,
    scenarios: [
      {
        scenarioId: "unrelated-fragments",
        scenarioTitle: "Unrelated Fragments",
        scenarioPath: "/repo/scenarios/program-battletest/unrelated-fragments/scenario.json",
        runRoot: firstScenarioRoot,
        summaryPath: firstSummaryPath,
        evaluationPath: firstEvaluationPath,
        passed: false,
        stoppedEarly: true
      },
      {
        scenarioId: "grocery-lists",
        scenarioTitle: "Grocery Lists",
        scenarioPath: "/repo/scenarios/program-battletest/grocery-lists/scenario.json",
        runRoot: secondScenarioRoot,
        summaryPath: secondSummaryPath,
        evaluationPath: secondEvaluationPath,
        passed: true,
        stoppedEarly: false
      }
    ]
  });

  return {
    suiteRunRoot,
    suiteSummaryPath
  };
};
