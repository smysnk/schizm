import { promises as fs } from "node:fs";
import path from "node:path";
import {
  canvasHasNodeForPath,
  canvasHasTentativeEdgeBetweenPaths
} from "./canvas-inspector";
import {
  listFilesUnderRelativeDir,
  normalizeDocumentStoreRelativePath,
  resolveSnapshotDocumentPath
} from "./document-store-paths";
import {
  listHypothesisFiles,
  normalizeHypothesisPath,
  readHypothesisStatus
} from "./hypothesis-inspector";
import type { Prompt, JsonObject } from "../../repositories/prompt-repository";
import {
  DEFAULT_CANVAS_PATH,
  type ContextualDisposition,
  type HypothesisStatus,
  type ScenarioAssertion,
  type ScenarioDecisionMode,
  type ScenarioHypothesisDelta,
  type ScenarioPack,
  type ScenarioRoundExpectations
} from "./scenario-pack";

type BattletestRunSummary = {
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

type RoundSnapshotSummary = {
  roundNumber: number;
  roundId: string;
  promptId: string;
  promptStatus: string;
  snapshotRoot: string;
  documentStoreSnapshotPath: string;
  promptJsonPath: string;
  summaryJsonPath: string;
  auditSectionPath: string | null;
  git: {
    branch: string | null;
    sha: string | null;
    statusShort: string;
    lastCommitSummary: string | null;
  };
  markdownFileCount: number;
  canvasFileCount: number;
  hypothesisFileCount: number;
  files: string[];
};

type RoundEvaluationContext = {
  scenario: ScenarioPack;
  runSummary: BattletestRunSummary;
  roundSummary: BattletestRunSummary["rounds"][number];
  snapshot: RoundSnapshotSummary;
  prompt: Prompt;
  promptAudit: JsonObject;
  promptMetadata: JsonObject;
  documentStoreSnapshotPath: string;
  seedDocumentStorePath: string;
};

export type AssertionResult = {
  kind: "expectation" | "checkpoint" | "final";
  label: string;
  passed: boolean;
  message: string;
  roundNumber: number | null;
  roundId: string | null;
  assertionType: string;
};

export type RoundEvaluationResult = {
  roundNumber: number;
  roundId: string;
  promptId: string;
  promptStatus: string;
  passed: boolean;
  expectationResults: AssertionResult[];
};

export type CheckpointEvaluationResult = {
  afterRound: number;
  label: string;
  passed: boolean;
  assertionResults: AssertionResult[];
};

export type BattletestEvaluationReport = {
  scenarioId: string;
  scenarioTitle: string;
  scenarioPath: string;
  runRoot: string;
  summaryPath: string;
  startedAt: string;
  finishedAt: string | null;
  passed: boolean;
  stoppedEarly: boolean;
  roundResults: RoundEvaluationResult[];
  checkpointResults: CheckpointEvaluationResult[];
  finalAssertionResults: AssertionResult[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readJsonObjectFile = async <T extends Record<string, unknown>>(filePath: string): Promise<T> => {
  const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));

  if (!isRecord(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}.`);
  }

  return parsed as T;
};

const getJsonPathValue = (value: unknown, jsonPath: string): unknown => {
  const tokens = jsonPath.match(/[^.[\]]+|\[(\d+)\]/g) || [];
  let current: unknown = value;

  for (const token of tokens) {
    if (token.startsWith("[")) {
      const index = Number(token.slice(1, -1));

      if (!Array.isArray(current) || !Number.isInteger(index)) {
        return undefined;
      }

      current = current[index];
      continue;
    }

    if (!isRecord(current)) {
      return undefined;
    }

    current = current[token];
  }

  return current;
};

const deepEqual = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

const getPromptDecisionMode = (prompt: Prompt) => {
  const metadata = prompt.metadata as Record<string, unknown>;
  const audit = prompt.audit as Record<string, unknown>;
  const execution = isRecord(metadata.execution) ? metadata.execution : null;
  const finalOutput = execution && isRecord(execution.finalOutput) ? execution.finalOutput : null;
  const decisionFromOutput =
    finalOutput && isRecord(finalOutput.decision) && typeof finalOutput.decision.mode === "string"
      ? finalOutput.decision.mode
      : null;
  const decisionFromAudit =
    isRecord(audit.decision) && typeof audit.decision.mode === "string"
      ? audit.decision.mode
      : null;

  return (decisionFromOutput || decisionFromAudit) as ScenarioDecisionMode | null;
};

const getContextualRelevanceEntries = (prompt: Prompt) => {
  const audit = prompt.audit as Record<string, unknown>;
  if (!Array.isArray(audit.contextualRelevance)) {
    return [];
  }

  return audit.contextualRelevance.filter((item): item is Record<string, unknown> => isRecord(item));
};

const getHypothesisDelta = (prompt: Prompt) => {
  const audit = prompt.audit as Record<string, unknown>;
  const hypotheses = isRecord(audit.hypotheses) ? audit.hypotheses : {};

  const count = (key: string) => (Array.isArray(hypotheses[key]) ? hypotheses[key].length : 0);

  return {
    created: count("created"),
    updated: count("updated"),
    strengthened: count("strengthened"),
    weakened: count("weakened"),
    disproved: count("disproved"),
    resolved: count("resolved")
  };
};

const buildResult = ({
  kind,
  label,
  passed,
  message,
  roundNumber,
  roundId,
  assertionType
}: AssertionResult): AssertionResult => ({
  kind,
  label,
  passed,
  message,
  roundNumber,
  roundId,
  assertionType
});

const evaluateHypothesisDelta = (
  delta: ScenarioHypothesisDelta,
  prompt: Prompt,
  roundNumber: number,
  roundId: string
): AssertionResult[] => {
  const actual = getHypothesisDelta(prompt);
  const results: AssertionResult[] = [];
  const pairs: Array<[keyof ScenarioHypothesisDelta, number]> = [
    ["createdAtLeast", actual.created],
    ["createdAtMost", actual.created],
    ["updatedAtLeast", actual.updated],
    ["updatedAtMost", actual.updated],
    ["strengthenedAtLeast", actual.strengthened],
    ["strengthenedAtMost", actual.strengthened],
    ["weakenedAtLeast", actual.weakened],
    ["weakenedAtMost", actual.weakened],
    ["disprovedAtLeast", actual.disproved],
    ["disprovedAtMost", actual.disproved],
    ["resolvedAtLeast", actual.resolved],
    ["resolvedAtMost", actual.resolved]
  ];

  for (const [key, actualCount] of pairs) {
    const expected = delta[key];

    if (expected === undefined) {
      continue;
    }

    const passed = key.endsWith("AtLeast") ? actualCount >= expected : actualCount <= expected;
    results.push(
      buildResult({
        kind: "expectation",
        label: `Hypothesis delta ${key}`,
        passed,
        message: passed
          ? `Observed ${actualCount} which satisfies ${key}=${expected}.`
          : `Observed ${actualCount}, expected ${key}=${expected}.`,
        roundNumber,
        roundId,
        assertionType: key
      })
    );
  }

  return results;
};

const evaluateAssertion = async (
  assertion: ScenarioAssertion,
  context: RoundEvaluationContext,
  kind: AssertionResult["kind"]
): Promise<AssertionResult> => {
  const { roundSummary, snapshot, documentStoreSnapshotPath, prompt, seedDocumentStorePath } = context;
  const labelBase = assertion.reason || assertion.type;

  switch (assertion.type) {
    case "pathExists": {
      const target = resolveSnapshotDocumentPath(documentStoreSnapshotPath, assertion.path);
      const stat = await fs.stat(target).catch(() => null);
      return buildResult({
        kind,
        label: labelBase,
        passed: Boolean(stat),
        message: stat
          ? `Found ${assertion.path}.`
          : `Expected ${assertion.path} to exist in snapshot.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "pathMissing": {
      const target = resolveSnapshotDocumentPath(documentStoreSnapshotPath, assertion.path);
      const stat = await fs.stat(target).catch(() => null);
      return buildResult({
        kind,
        label: labelBase,
        passed: !stat,
        message: !stat
          ? `${assertion.path} is absent as expected.`
          : `Expected ${assertion.path} to be missing.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "fileContains":
    case "fileNotContains": {
      const target = resolveSnapshotDocumentPath(documentStoreSnapshotPath, assertion.path);
      const source = await fs.readFile(target, "utf8").catch(() => "");
      const contains = source.includes(assertion.value);
      const passed = assertion.type === "fileContains" ? contains : !contains;
      return buildResult({
        kind,
        label: labelBase,
        passed,
        message: passed
          ? `${assertion.path} satisfied ${assertion.type}.`
          : `${assertion.path} did not satisfy ${assertion.type}.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "jsonPathEquals":
    case "jsonPathIncludes": {
      const target = resolveSnapshotDocumentPath(documentStoreSnapshotPath, assertion.path);
      const json = await readJsonObjectFile<Record<string, unknown>>(target);
      const value = getJsonPathValue(json, assertion.jsonPath);
      const passed =
        assertion.type === "jsonPathEquals"
          ? deepEqual(value, assertion.value)
          : Array.isArray(value)
            ? value.some((item) => deepEqual(item, assertion.value))
            : typeof value === "string"
              ? value.includes(String(assertion.value))
              : false;
      return buildResult({
        kind,
        label: labelBase,
        passed,
        message: passed
          ? `${assertion.path} satisfied ${assertion.type} at ${assertion.jsonPath}.`
          : `${assertion.path} did not satisfy ${assertion.type} at ${assertion.jsonPath}.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "minimumFileCountInDir":
    case "maximumFileCountInDir": {
      const files = await listFilesUnderRelativeDir(documentStoreSnapshotPath, assertion.path);
      const passed =
        assertion.type === "minimumFileCountInDir"
          ? files.length >= assertion.count
          : files.length <= assertion.count;
      return buildResult({
        kind,
        label: labelBase,
        passed,
        message: passed
          ? `${assertion.path} has ${files.length} files.`
          : `${assertion.path} has ${files.length} files, expected ${assertion.type}=${assertion.count}.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "canvasHasNodeForPath": {
      const passed = await canvasHasNodeForPath({
        documentStoreSnapshotPath,
        notePath: assertion.notePath,
        canvasPath: assertion.canvasPath || DEFAULT_CANVAS_PATH
      }).catch(() => false);
      return buildResult({
        kind,
        label: labelBase,
        passed,
        message: passed
          ? `Canvas includes a node for ${assertion.notePath}.`
          : `Expected canvas node for ${assertion.notePath}.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "canvasHasTentativeEdge": {
      const passed = await canvasHasTentativeEdgeBetweenPaths({
        documentStoreSnapshotPath,
        from: assertion.from,
        to: assertion.to,
        canvasPath: assertion.canvasPath || DEFAULT_CANVAS_PATH
      }).catch(() => false);
      return buildResult({
        kind,
        label: labelBase,
        passed,
        message: passed
          ? `Canvas includes a tentative edge between ${assertion.from} and ${assertion.to}.`
          : `Expected tentative canvas edge between ${assertion.from} and ${assertion.to}.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "auditIncludesDisposition": {
      const contextualEntries = getContextualRelevanceEntries(prompt);
      const passed = contextualEntries.some(
        (entry) => entry.disposition === assertion.disposition
      );
      return buildResult({
        kind,
        label: labelBase,
        passed,
        message: passed
          ? `Audit includes disposition ${assertion.disposition}.`
          : `Expected audit to include disposition ${assertion.disposition}.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "hypothesisStatusEquals": {
      const status = await readHypothesisStatus({
        documentStoreSnapshotPath,
        hypothesisPath: assertion.path
      }).catch(() => null);
      const passed = status === assertion.status;
      return buildResult({
        kind,
        label: labelBase,
        passed,
        message: passed
          ? `${assertion.path} is ${assertion.status}.`
          : `Expected ${assertion.path} to be ${assertion.status}, received ${status || "missing"}.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "hypothesisStatusIn": {
      const status = await readHypothesisStatus({
        documentStoreSnapshotPath,
        hypothesisPath: assertion.path
      }).catch(() => null);
      const passed = Boolean(status && assertion.statuses.includes(status));
      return buildResult({
        kind,
        label: labelBase,
        passed,
        message: passed
          ? `${assertion.path} is ${status}.`
          : `Expected ${assertion.path} to be one of ${assertion.statuses.join(", ")}, received ${status || "missing"}.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "decisionModeObserved": {
      const mode = getPromptDecisionMode(prompt);
      const passed = mode === assertion.mode;
      return buildResult({
        kind,
        label: labelBase,
        passed,
        message: passed
          ? `Observed decision mode ${mode}.`
          : `Expected decision mode ${assertion.mode}, received ${mode || "missing"}.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
    case "noUnexpectedHypothesisCreation": {
      const seedHypotheses = new Set(await listHypothesisFiles(seedDocumentStorePath));
      const finalHypotheses = new Set(await listHypothesisFiles(documentStoreSnapshotPath));
      const allowedPaths = new Set(
        (assertion.allowedPaths || []).map((item) => normalizeHypothesisPath(item))
      );
      const created = [...finalHypotheses].filter((item) => !seedHypotheses.has(item));
      const unexpected = created.filter((item) => !allowedPaths.has(item));
      const passed = unexpected.length === 0;
      return buildResult({
        kind,
        label: labelBase,
        passed,
        message: passed
          ? "No unexpected hypothesis files were created."
          : `Unexpected hypothesis files created: ${unexpected.join(", ")}.`,
        roundNumber: roundSummary.roundNumber,
        roundId: roundSummary.roundId,
        assertionType: assertion.type
      });
    }
  }
};

const evaluateRoundExpectations = async (
  expectations: ScenarioRoundExpectations | undefined,
  context: RoundEvaluationContext
) => {
  if (!expectations) {
    return [];
  }

  const results: AssertionResult[] = [];

  if (expectations.decisionModes?.length) {
    const observed = getPromptDecisionMode(context.prompt);
    const passed = Boolean(observed && expectations.decisionModes.includes(observed));
    results.push(
      buildResult({
        kind: "expectation",
        label: "Decision mode expectation",
        passed,
        message: passed
          ? `Observed decision mode ${observed}.`
          : `Expected one of ${expectations.decisionModes.join(", ")}, received ${observed || "missing"}.`,
        roundNumber: context.roundSummary.roundNumber,
        roundId: context.roundSummary.roundId,
        assertionType: "decisionModes"
      })
    );
  }

  if (expectations.minimumContextualRelevance !== undefined) {
    const observed = getContextualRelevanceEntries(context.prompt).length;
    const passed = observed >= expectations.minimumContextualRelevance;
    results.push(
      buildResult({
        kind: "expectation",
        label: "Minimum contextual relevance",
        passed,
        message: passed
          ? `Observed ${observed} contextual relevance entries.`
          : `Observed ${observed}, expected at least ${expectations.minimumContextualRelevance}.`,
        roundNumber: context.roundSummary.roundNumber,
        roundId: context.roundSummary.roundId,
        assertionType: "minimumContextualRelevance"
      })
    );
  }

  if (expectations.maximumContextualRelevance !== undefined) {
    const observed = getContextualRelevanceEntries(context.prompt).length;
    const passed = observed <= expectations.maximumContextualRelevance;
    results.push(
      buildResult({
        kind: "expectation",
        label: "Maximum contextual relevance",
        passed,
        message: passed
          ? `Observed ${observed} contextual relevance entries.`
          : `Observed ${observed}, expected at most ${expectations.maximumContextualRelevance}.`,
        roundNumber: context.roundSummary.roundNumber,
        roundId: context.roundSummary.roundId,
        assertionType: "maximumContextualRelevance"
      })
    );
  }

  if (expectations.hypothesisDelta) {
    results.push(...evaluateHypothesisDelta(expectations.hypothesisDelta, context.prompt, context.roundSummary.roundNumber, context.roundSummary.roundId));
  }

  if (expectations.assertions?.length) {
    for (const assertion of expectations.assertions) {
      results.push(await evaluateAssertion(assertion, context, "expectation"));
    }
  }

  return results;
};

const buildRoundContext = async ({
  scenario,
  runSummary,
  roundSummary,
  seedDocumentStorePath
}: {
  scenario: ScenarioPack;
  runSummary: BattletestRunSummary;
  roundSummary: BattletestRunSummary["rounds"][number];
  seedDocumentStorePath: string;
}): Promise<RoundEvaluationContext> => {
  const snapshot = await readJsonObjectFile<RoundSnapshotSummary>(
    path.join(roundSummary.snapshotRoot, "snapshot.json")
  );
  const prompt = await readJsonObjectFile<Prompt>(snapshot.promptJsonPath);

  return {
    scenario,
    runSummary,
    roundSummary,
    snapshot,
    prompt,
    promptAudit: prompt.audit,
    promptMetadata: prompt.metadata,
    documentStoreSnapshotPath: snapshot.documentStoreSnapshotPath,
    seedDocumentStorePath
  };
};

export const evaluateBattletestRun = async ({
  scenario,
  scenarioPath,
  runRoot,
  summaryPath,
  seedDocumentStorePath
}: {
  scenario: ScenarioPack;
  scenarioPath: string;
  runRoot: string;
  summaryPath: string;
  seedDocumentStorePath: string;
}): Promise<BattletestEvaluationReport> => {
  const runSummary = await readJsonObjectFile<BattletestRunSummary>(summaryPath);
  const roundResults: RoundEvaluationResult[] = [];
  const contextByRound = new Map<number, RoundEvaluationContext>();

  for (const roundSummary of runSummary.rounds) {
    const scenarioRound = scenario.rounds[roundSummary.roundNumber - 1];
    const context = await buildRoundContext({
      scenario,
      runSummary,
      roundSummary,
      seedDocumentStorePath
    });
    contextByRound.set(roundSummary.roundNumber, context);
    const expectationResults = await evaluateRoundExpectations(scenarioRound?.expectations, context);

    roundResults.push({
      roundNumber: roundSummary.roundNumber,
      roundId: roundSummary.roundId,
      promptId: roundSummary.promptId,
      promptStatus: roundSummary.status,
      passed: expectationResults.every((result) => result.passed),
      expectationResults
    });
  }

  const checkpointResults: CheckpointEvaluationResult[] = [];

  for (const checkpoint of scenario.checkpoints) {
    const context = contextByRound.get(checkpoint.afterRound);

    if (!context) {
      checkpointResults.push({
        afterRound: checkpoint.afterRound,
        label: checkpoint.label || `After round ${checkpoint.afterRound}`,
        passed: false,
        assertionResults: [
          buildResult({
            kind: "checkpoint",
            label: checkpoint.label || `After round ${checkpoint.afterRound}`,
            passed: false,
            message: `No snapshot found for round ${checkpoint.afterRound}.`,
            roundNumber: checkpoint.afterRound,
            roundId: null,
            assertionType: "missingRound"
          })
        ]
      });
      continue;
    }

    const assertionResults = await Promise.all(
      checkpoint.assertions.map((assertion) => evaluateAssertion(assertion, context, "checkpoint"))
    );

    checkpointResults.push({
      afterRound: checkpoint.afterRound,
      label: checkpoint.label || `After round ${checkpoint.afterRound}`,
      passed: assertionResults.every((result) => result.passed),
      assertionResults
    });
  }

  const finalContext = contextByRound.get(runSummary.rounds[runSummary.rounds.length - 1]?.roundNumber || -1);
  const finalAssertionResults = finalContext
    ? await Promise.all(
        scenario.finalAssertions.map((assertion) =>
          evaluateAssertion(assertion, finalContext, "final")
        )
      )
    : [
        buildResult({
          kind: "final",
          label: "Final assertions",
          passed: false,
          message: "No final round snapshot was available.",
          roundNumber: null,
          roundId: null,
          assertionType: "missingFinalRound"
        })
      ];

  const passed =
    roundResults.every((result) => result.passed) &&
    checkpointResults.every((result) => result.passed) &&
    finalAssertionResults.every((result) => result.passed);

  return {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    scenarioPath,
    runRoot,
    summaryPath,
    startedAt: runSummary.startedAt,
    finishedAt: runSummary.finishedAt,
    passed,
    stoppedEarly: runSummary.stoppedEarly,
    roundResults,
    checkpointResults,
    finalAssertionResults
  };
};
