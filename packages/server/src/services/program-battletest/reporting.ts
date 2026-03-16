import { promises as fs } from "node:fs";
import path from "node:path";
import type { AssertionResult, BattletestEvaluationReport } from "./evaluator";

type BattletestSuiteSummary = {
  suiteId: string;
  suiteTitle: string;
  suitePath: string;
  runRoot: string;
  startedAt: string;
  finishedAt: string | null;
  passed: boolean;
  scenarios: Array<{
    scenarioId: string;
    scenarioTitle: string;
    scenarioPath: string;
    runRoot: string;
    summaryPath: string;
    evaluationPath: string;
    passed: boolean;
    stoppedEarly: boolean;
  }>;
};

type BattletestScenarioRunSummary = {
  scenarioId: string;
  scenarioTitle: string;
  scenarioPath: string;
  runRoot: string;
  documentStoreRepoRoot: string;
  logicalDocumentStoreRoot: string;
  remotePath: string;
  branch: string;
  controllerRepoRoot: string;
  executionMode: "container";
  pollMs: number;
  timeoutMs: number;
  codexBin: string;
  startedAt: string;
  finishedAt: string | null;
  stoppedEarly: boolean;
  rounds: Array<{
    roundNumber: number;
    roundId: string;
    promptId: string;
    status: string;
    errorMessage: string | null;
    snapshotRoot: string;
    auditSectionPath: string | null;
    markdownFileCount: number;
    canvasFileCount: number;
    hypothesisFileCount: number;
    finishedAt: string | null;
  }>;
};

export type BattletestSuiteScenarioArtifactLinks = {
  roundNumber: number;
  roundId: string;
  promptId: string;
  promptStatus: string;
  snapshotRoot: string;
  snapshotSummaryPath: string;
  promptJsonPath: string;
  documentStoreSnapshotPath: string;
  auditSectionPath: string | null;
  markdownFileCount: number;
  canvasFileCount: number;
  hypothesisFileCount: number;
};

export type BattletestSuiteScenarioReport = {
  scenarioId: string;
  scenarioTitle: string;
  scenarioPath: string;
  runRoot: string;
  summaryPath: string;
  evaluationPath: string;
  passed: boolean;
  stoppedEarly: boolean;
  roundCount: number;
  completedRoundCount: number;
  failedRoundCount: number;
  failureExplanations: string[];
  roundArtifacts: BattletestSuiteScenarioArtifactLinks[];
};

export type BattletestSuiteReport = {
  suiteId: string;
  suiteTitle: string;
  suitePath: string;
  suiteSummaryPath: string;
  runRoot: string;
  generatedAt: string;
  startedAt: string;
  finishedAt: string | null;
  passed: boolean;
  scenarioCount: number;
  passedScenarioCount: number;
  failedScenarioCount: number;
  scenarios: BattletestSuiteScenarioReport[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readJsonObjectFile = async <T extends Record<string, unknown>>(filePath: string) => {
  const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));

  if (!isRecord(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}.`);
  }

  return parsed as T;
};

const toPortableRelativePath = (rootPath: string, absolutePath: string) =>
  path.relative(rootPath, absolutePath).split(path.sep).join("/");

const contractBehaviorLabel = (assertionType: string) => {
  if (assertionType === "decisionModes") {
    return "Decision mode selection";
  }

  if (assertionType.endsWith("ContextualRelevance")) {
    return "Contextual relevance handling";
  }

  if (
    assertionType.endsWith("AtLeast") ||
    assertionType.endsWith("AtMost") ||
    assertionType.startsWith("hypothesisStatus")
  ) {
    return "Hypothesis lifecycle tracking";
  }

  if (
    assertionType === "maximumFileCountInDir" ||
    assertionType === "minimumFileCountInDir" ||
    assertionType === "pathExists" ||
    assertionType === "pathMissing" ||
    assertionType === "fileContains" ||
    assertionType === "fileNotContains"
  ) {
    return "Note organization";
  }

  if (assertionType.startsWith("canvasHas")) {
    return "Canvas maintenance";
  }

  if (
    assertionType === "auditIncludesDisposition" ||
    assertionType.startsWith("jsonPath")
  ) {
    return "Audit fidelity";
  }

  if (assertionType === "noUnexpectedHypothesisCreation") {
    return "Hypothesis restraint";
  }

  if (assertionType === "missingRound") {
    return "Run continuity";
  }

  return "Contract behavior";
};

const collectFailureExplanations = (evaluation: BattletestEvaluationReport | null) => {
  if (!evaluation) {
    return ["Missing evaluation.json for scenario run."];
  }

  const failedAssertions: AssertionResult[] = [];

  for (const roundResult of evaluation.roundResults) {
    failedAssertions.push(...roundResult.expectationResults.filter((result) => !result.passed));
  }

  for (const checkpoint of evaluation.checkpointResults) {
    failedAssertions.push(...checkpoint.assertionResults.filter((result) => !result.passed));
  }

  failedAssertions.push(...evaluation.finalAssertionResults.filter((result) => !result.passed));

  const seen = new Set<string>();
  const explanations: string[] = [];

  for (const failure of failedAssertions) {
    const location =
      failure.roundNumber === null ? "final evaluation" : `round ${failure.roundNumber}`;
    const explanation = `${contractBehaviorLabel(failure.assertionType)} (${location}): ${failure.message}`;

    if (seen.has(explanation)) {
      continue;
    }

    seen.add(explanation);
    explanations.push(explanation);

    if (explanations.length >= 3) {
      break;
    }
  }

  return explanations;
};

const buildRoundArtifacts = ({
  suiteRunRoot,
  scenarioSummary
}: {
  suiteRunRoot: string;
  scenarioSummary: BattletestScenarioRunSummary | null;
}): BattletestSuiteScenarioArtifactLinks[] => {
  if (!scenarioSummary) {
    return [];
  }

  return scenarioSummary.rounds.map((round) => {
    const snapshotSummaryPath = path.join(round.snapshotRoot, "snapshot.json");
    const promptJsonPath = path.join(round.snapshotRoot, "prompt.json");
    const documentStoreSnapshotPath = path.join(round.snapshotRoot, "obsidian-repository");

    return {
      roundNumber: round.roundNumber,
      roundId: round.roundId,
      promptId: round.promptId,
      promptStatus: round.status,
      snapshotRoot: toPortableRelativePath(suiteRunRoot, round.snapshotRoot),
      snapshotSummaryPath: toPortableRelativePath(suiteRunRoot, snapshotSummaryPath),
      promptJsonPath: toPortableRelativePath(suiteRunRoot, promptJsonPath),
      documentStoreSnapshotPath: toPortableRelativePath(suiteRunRoot, documentStoreSnapshotPath),
      auditSectionPath: round.auditSectionPath
        ? toPortableRelativePath(suiteRunRoot, round.auditSectionPath)
        : null,
      markdownFileCount: round.markdownFileCount,
      canvasFileCount: round.canvasFileCount,
      hypothesisFileCount: round.hypothesisFileCount
    };
  });
};

export const buildBattletestSuiteReport = async ({
  suiteSummaryPath
}: {
  suiteSummaryPath: string;
}): Promise<BattletestSuiteReport> => {
  const suiteSummary = await readJsonObjectFile<BattletestSuiteSummary>(suiteSummaryPath);
  const suiteRunRoot = suiteSummary.runRoot;
  const scenarios: BattletestSuiteScenarioReport[] = [];

  for (const scenario of suiteSummary.scenarios) {
    const [scenarioSummary, evaluation] = await Promise.all([
      readJsonObjectFile<BattletestScenarioRunSummary>(scenario.summaryPath).catch(() => null),
      readJsonObjectFile<BattletestEvaluationReport>(scenario.evaluationPath).catch(() => null)
    ]);
    const roundArtifacts = buildRoundArtifacts({
      suiteRunRoot,
      scenarioSummary
    });
    const completedRoundCount =
      scenarioSummary?.rounds.filter((round) => round.status === "completed").length || 0;
    const failedRoundCount =
      scenarioSummary?.rounds.filter((round) => round.status === "failed").length || 0;

    scenarios.push({
      scenarioId: scenario.scenarioId,
      scenarioTitle: scenario.scenarioTitle,
      scenarioPath: toPortableRelativePath(suiteRunRoot, scenario.scenarioPath),
      runRoot: toPortableRelativePath(suiteRunRoot, scenario.runRoot),
      summaryPath: toPortableRelativePath(suiteRunRoot, scenario.summaryPath),
      evaluationPath: toPortableRelativePath(suiteRunRoot, scenario.evaluationPath),
      passed: Boolean(evaluation?.passed ?? scenario.passed),
      stoppedEarly: Boolean(scenarioSummary?.stoppedEarly ?? scenario.stoppedEarly),
      roundCount: scenarioSummary?.rounds.length || 0,
      completedRoundCount,
      failedRoundCount,
      failureExplanations: collectFailureExplanations(evaluation),
      roundArtifacts
    });
  }

  return {
    suiteId: suiteSummary.suiteId,
    suiteTitle: suiteSummary.suiteTitle,
    suitePath: toPortableRelativePath(suiteRunRoot, suiteSummary.suitePath),
    suiteSummaryPath: toPortableRelativePath(suiteRunRoot, suiteSummaryPath),
    runRoot: suiteRunRoot,
    generatedAt: new Date().toISOString(),
    startedAt: suiteSummary.startedAt,
    finishedAt: suiteSummary.finishedAt,
    passed: suiteSummary.passed,
    scenarioCount: scenarios.length,
    passedScenarioCount: scenarios.filter((scenario) => scenario.passed).length,
    failedScenarioCount: scenarios.filter((scenario) => !scenario.passed).length,
    scenarios
  };
};

export const renderBattletestSuiteMarkdown = (report: BattletestSuiteReport) => {
  const lines: string[] = [
    `# ${report.suiteTitle}`,
    "",
    `- Suite ID: \`${report.suiteId}\``,
    `- Status: ${report.passed ? "passed" : "failed"}`,
    `- Scenario summary: ${report.passedScenarioCount}/${report.scenarioCount} passed`,
    `- Suite summary: [suite-summary.json](${report.suiteSummaryPath})`,
    "",
    "## Scenario Results",
    ""
  ];

  for (const scenario of report.scenarios) {
    lines.push(`### ${scenario.scenarioTitle}`);
    lines.push("");
    lines.push(`- Status: ${scenario.passed ? "passed" : "failed"}`);
    lines.push(`- Stopped early: ${scenario.stoppedEarly ? "yes" : "no"}`);
    lines.push(`- Scenario: [scenario.json](${scenario.scenarioPath})`);
    lines.push(`- Run summary: [summary.json](${scenario.summaryPath})`);
    lines.push(`- Evaluation: [evaluation.json](${scenario.evaluationPath})`);
    lines.push(
      `- Round count: ${scenario.roundCount} total, ${scenario.completedRoundCount} completed, ${scenario.failedRoundCount} failed`
    );
    lines.push("");

    if (scenario.failureExplanations.length > 0) {
      lines.push("Failure explanations:");
      for (const explanation of scenario.failureExplanations) {
        lines.push(`- ${explanation}`);
      }
      lines.push("");
    }

    if (scenario.roundArtifacts.length > 0) {
      lines.push("Round artifacts:");
      for (const round of scenario.roundArtifacts) {
        const artifactLinks = [
          `[snapshot](${round.snapshotSummaryPath})`,
          `[prompt](${round.promptJsonPath})`,
          `[document-store](${round.documentStoreSnapshotPath})`
        ];

        if (round.auditSectionPath) {
          artifactLinks.push(`[audit](${round.auditSectionPath})`);
        }

        lines.push(
          `- Round ${round.roundNumber} (${round.promptStatus}): ${artifactLinks.join(", ")}`
        );
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
};

export const writeBattletestSuiteReport = async ({
  report,
  jsonPath,
  markdownPath
}: {
  report: BattletestSuiteReport;
  jsonPath: string;
  markdownPath: string;
}) => {
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.mkdir(path.dirname(markdownPath), { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownPath, renderBattletestSuiteMarkdown(report), "utf8");
};
