import { promises as fs } from "node:fs";
import path from "node:path";
import { evaluateBattletestRun } from "../packages/server/src/services/program-battletest/evaluator";
import {
  buildBattletestSuiteReport,
  writeBattletestSuiteReport
} from "../packages/server/src/services/program-battletest/reporting";
import {
  runBattletestScenario,
  closeBattletestResources,
  type BattletestRunOptions
} from "../packages/server/src/services/program-battletest/runner";
import {
  loadScenarioPackFromFile,
  resolveProgramBattletestRoot,
  resolveRepoRoot,
  resolveScenarioSeedPath
} from "../packages/server/src/services/program-battletest/scenario-pack";
import {
  loadProgramBattletestSuiteFromFile,
  resolveProgramBattletestSuitePath
} from "../packages/server/src/services/program-battletest/suite";

type SuiteCliOptions = BattletestRunOptions & {
  suite: string;
};

type ProgramBattletestSuiteRunReport = {
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

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseArgs = (argv: string[]): SuiteCliOptions => {
  let suite = "";
  let outputRoot: string | undefined;
  let timeoutMs = 180_000;
  let pollMs = 250;
  let branch = "main";
  let codexBin: string | undefined;
  let continueOnFailure = false;
  let keepPrompts = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--suite") {
      suite = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--output-root") {
      outputRoot = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--timeout-ms") {
      timeoutMs = parseNumber(argv[index + 1], timeoutMs);
      index += 1;
      continue;
    }

    if (value === "--poll-ms") {
      pollMs = parseNumber(argv[index + 1], pollMs);
      index += 1;
      continue;
    }

    if (value === "--branch") {
      branch = argv[index + 1] || branch;
      index += 1;
      continue;
    }

    if (value === "--codex-bin") {
      codexBin = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--continue-on-failure") {
      continueOnFailure = true;
      continue;
    }

    if (value === "--keep-prompts") {
      keepPrompts = true;
      continue;
    }
  }

  if (!suite.trim()) {
    throw new Error("Missing required argument: --suite <suite-id-or-path>");
  }

  return {
    suite: suite.trim(),
    outputRoot,
    timeoutMs,
    pollMs,
    branch: branch.trim() || "main",
    codexBin: codexBin?.trim() || undefined,
    continueOnFailure,
    keepPrompts,
    shutdownDbPool: false
  };
};

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

const writeJsonFile = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const suitePath = await resolveProgramBattletestSuitePath(repoRoot, options.suite);
  const suite = await loadProgramBattletestSuiteFromFile(suitePath);
  const suiteRunRoot = path.resolve(
    repoRoot,
    options.outputRoot || path.join(".battletest-runs", "suites", `${suite.id}-${timestampToken()}`)
  );
  const scenarioRunsRoot = path.join(suiteRunRoot, "scenario-runs");

  await fs.mkdir(scenarioRunsRoot, { recursive: true });

  const report: ProgramBattletestSuiteRunReport = {
    suiteId: suite.id,
    suiteTitle: suite.title,
    suitePath,
    runRoot: suiteRunRoot,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    passed: true,
    scenarios: []
  };
  const suiteSummaryPath = path.join(suiteRunRoot, "suite-summary.json");

  try {
    for (const scenarioId of suite.scenarios) {
      const scenarioPath = path.join(
        resolveProgramBattletestRoot(repoRoot),
        scenarioId,
        "scenario.json"
      );
      const scenario = await loadScenarioPackFromFile(scenarioPath);
      const summary = await runBattletestScenario({
        scenario,
        scenarioPath,
        options: {
          ...options,
          outputRoot: scenarioRunsRoot,
          shutdownDbPool: false
        }
      });

      const evaluation = await evaluateBattletestRun({
        scenario,
        scenarioPath,
        runRoot: summary.runRoot,
        summaryPath: path.join(summary.runRoot, "summary.json"),
        seedDocumentStorePath: path.join(
          resolveScenarioSeedPath(scenarioPath, scenario.seed),
          "obsidian-repository"
        )
      });
      const evaluationPath = path.join(summary.runRoot, "evaluation.json");

      await writeJsonFile(evaluationPath, evaluation);

      report.scenarios.push({
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        scenarioPath,
        runRoot: summary.runRoot,
        summaryPath: path.join(summary.runRoot, "summary.json"),
        evaluationPath,
        passed: evaluation.passed,
        stoppedEarly: summary.stoppedEarly
      });

      if (!evaluation.passed) {
        report.passed = false;
      }
    }
  } finally {
    await closeBattletestResources();
    report.finishedAt = new Date().toISOString();
    await writeJsonFile(suiteSummaryPath, report);

    const suiteReport = await buildBattletestSuiteReport({
      suiteSummaryPath
    });

    await writeBattletestSuiteReport({
      report: suiteReport,
      jsonPath: path.join(suiteRunRoot, "suite-report.json"),
      markdownPath: path.join(suiteRunRoot, "suite-report.md")
    });
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (!report.passed) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  const message =
    error instanceof Error ? error.stack || error.message : "Program battletest suite failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
