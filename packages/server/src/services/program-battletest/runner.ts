import { promises as fs } from "node:fs";
import path from "node:path";
import {
  captureBattletestRoundSnapshot,
  prepareBattletestDocumentRepo,
  waitForPromptSettlement
} from "./harness";
import {
  loadScenarioPackFromFile,
  resolveProgramBattletestRoot,
  resolveRepoRoot,
  resolveScenarioSeedPath,
  type ScenarioPack
} from "./scenario-pack";

export type BattletestRunOptions = {
  outputRoot?: string;
  timeoutMs: number;
  pollMs: number;
  branch: string;
  codexBin?: string;
  continueOnFailure: boolean;
  keepPrompts: boolean;
  shutdownDbPool?: boolean;
};

export type BattletestRoundSummary = {
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
};

export type BattletestRunSummary = {
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
  rounds: BattletestRoundSummary[];
};

const writeJsonFile = async (filePath: string, value: unknown) => {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const resolveBattletestScenarioPath = async (
  repoRoot: string,
  scenarioArgument: string
) => {
  const directCandidate = path.resolve(repoRoot, scenarioArgument);
  const scenarioRootCandidate = path.join(
    resolveProgramBattletestRoot(repoRoot),
    scenarioArgument,
    "scenario.json"
  );
  const candidates = scenarioArgument.endsWith(".json")
    ? [directCandidate]
    : [directCandidate, scenarioRootCandidate];

  for (const candidate of candidates) {
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat?.isFile()) {
      return candidate;
    }
  }

  throw new Error(`Could not resolve scenario "${scenarioArgument}" to a scenario.json file.`);
};

const configureHarnessEnvironment = async ({
  controllerRepoRoot,
  documentStoreRepoRoot,
  remotePath,
  branch,
  pollMs,
  codexBin
}: {
  controllerRepoRoot: string;
  documentStoreRepoRoot: string;
  remotePath: string;
  branch: string;
  pollMs: number;
  codexBin?: string;
}) => {
  const { env } = await import("../../config/env");

  Object.assign(env, {
    promptRunnerEnabled: true,
    promptRunnerExecutionMode: "container",
    promptRunnerPollMs: pollMs,
    promptRunnerRepoRoot: controllerRepoRoot,
    promptRunnerContainerRepoUrl: remotePath,
    promptRunnerContainerRepoBranch: branch,
    promptRunnerRemoteName: "origin",
    documentStoreDir: documentStoreRepoRoot
  });

  if (codexBin) {
    env.promptRunnerCodexBin = codexBin;
  }

  return env;
};

export const closeBattletestResources = async () => {
  const { pool } = await import("../../db/pool");
  await pool.end();
};

export const runBattletestScenario = async ({
  scenario,
  scenarioPath,
  options
}: {
  scenario: ScenarioPack;
  scenarioPath: string;
  options: BattletestRunOptions;
}): Promise<BattletestRunSummary> => {
  const controllerRepoRoot = resolveRepoRoot();
  const outputRoot =
    options.outputRoot
      ? path.resolve(controllerRepoRoot, options.outputRoot)
      : path.join(controllerRepoRoot, ".battletest-runs");

  const preparedRepo = await prepareBattletestDocumentRepo({
    scenarioId: scenario.id,
    seedPath: resolveScenarioSeedPath(scenarioPath, scenario.seed),
    outputRoot,
    branch: options.branch
  });

  await writeJsonFile(path.join(preparedRepo.runRoot, "scenario.json"), scenario);

  const configuredEnv = await configureHarnessEnvironment({
    controllerRepoRoot,
    documentStoreRepoRoot: preparedRepo.workingPath,
    remotePath: preparedRepo.remotePath,
    branch: preparedRepo.branch,
    pollMs: options.pollMs,
    codexBin: options.codexBin
  });

  const [{ runMigrations }, { pool, query }, promptRepository, { PromptRunner }] =
    await Promise.all([
      import("../../db/migrations"),
      import("../../db/pool"),
      import("../../repositories/prompt-repository"),
      import("../prompt-runner")
    ]);

  const { createPrompt, getPrompt, updatePrompt } = promptRepository;

  await runMigrations();

  const runner = new PromptRunner();
  const createdPromptIds: string[] = [];
  const summary: BattletestRunSummary = {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    scenarioPath,
    runRoot: preparedRepo.runRoot,
    documentStoreRepoRoot: preparedRepo.workingPath,
    logicalDocumentStoreRoot: preparedRepo.logicalDocumentStoreRoot,
    remotePath: preparedRepo.remotePath,
    branch: preparedRepo.branch,
    controllerRepoRoot,
    executionMode: "container",
    pollMs: options.pollMs,
    timeoutMs: options.timeoutMs,
    codexBin: configuredEnv.promptRunnerCodexBin,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    stoppedEarly: false,
    rounds: []
  };

  await runner.start();

  try {
    for (const [index, round] of scenario.rounds.entries()) {
      const createdPrompt = await createPrompt(round.prompt);
      createdPromptIds.push(createdPrompt.id);

      await updatePrompt(createdPrompt.id, {
        metadataPatch: {
          battletest: {
            scenarioId: scenario.id,
            scenarioTitle: scenario.title,
            scenarioPath,
            runRoot: preparedRepo.runRoot,
            roundId: round.id,
            roundNumber: index + 1
          }
        }
      });

      const settledPrompt = await waitForPromptSettlement({
        promptId: createdPrompt.id,
        loadPrompt: getPrompt,
        pollMs: options.pollMs,
        timeoutMs: options.timeoutMs
      });

      const snapshot = await captureBattletestRoundSnapshot({
        snapshotsRoot: preparedRepo.snapshotsRoot,
        roundNumber: index + 1,
        roundId: round.id,
        prompt: settledPrompt,
        documentStoreRepoRoot: preparedRepo.workingPath
      });

      summary.rounds.push({
        roundNumber: index + 1,
        roundId: round.id,
        promptId: settledPrompt.id,
        status: settledPrompt.status,
        errorMessage: settledPrompt.errorMessage,
        snapshotRoot: snapshot.snapshotRoot,
        auditSectionPath: snapshot.auditSectionPath,
        markdownFileCount: snapshot.markdownFileCount,
        canvasFileCount: snapshot.canvasFileCount,
        hypothesisFileCount: snapshot.hypothesisFileCount,
        finishedAt: settledPrompt.finishedAt
      });

      if (settledPrompt.status !== "completed" && !options.continueOnFailure) {
        summary.stoppedEarly = true;
        break;
      }
    }
  } finally {
    runner.stop();

    if (!options.keepPrompts && createdPromptIds.length) {
      await query("DELETE FROM prompts WHERE id = ANY($1::uuid[])", [createdPromptIds]);
    }

    summary.finishedAt = new Date().toISOString();
    await writeJsonFile(path.join(preparedRepo.runRoot, "summary.json"), summary);

    if (options.shutdownDbPool !== false) {
      await pool.end();
    }
  }

  return summary;
};

export const runBattletestScenarioByArgument = async ({
  scenarioArgument,
  options
}: {
  scenarioArgument: string;
  options: BattletestRunOptions;
}) => {
  const repoRoot = resolveRepoRoot();
  const scenarioPath = await resolveBattletestScenarioPath(repoRoot, scenarioArgument);
  const scenario = await loadScenarioPackFromFile(scenarioPath);
  return runBattletestScenario({
    scenario,
    scenarioPath,
    options
  });
};
