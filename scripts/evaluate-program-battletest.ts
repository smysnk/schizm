import { promises as fs } from "node:fs";
import path from "node:path";
import { evaluateBattletestRun } from "../packages/server/src/services/program-battletest/evaluator";
import {
  loadScenarioPackFromFile,
  resolveRepoRoot,
  resolveScenarioSeedPath
} from "../packages/server/src/services/program-battletest/scenario-pack";

type CliOptions = {
  runRoot?: string;
  summaryPath?: string;
  outputPath?: string;
};

const parseArgs = (argv: string[]): CliOptions => {
  let runRoot: string | undefined;
  let summaryPath: string | undefined;
  let outputPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--run-root") {
      runRoot = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--summary") {
      summaryPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--output") {
      outputPath = argv[index + 1];
      index += 1;
      continue;
    }
  }

  if (!runRoot && !summaryPath) {
    throw new Error("Provide either --run-root <path> or --summary <summary.json>.");
  }

  return {
    runRoot,
    summaryPath,
    outputPath
  };
};

const readJsonObject = async <T extends Record<string, unknown>>(filePath: string): Promise<T> => {
  const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}.`);
  }

  return parsed as T;
};

const writeJsonFile = async (filePath: string, value: unknown) => {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const summaryPath = options.summaryPath
    ? path.resolve(repoRoot, options.summaryPath)
    : path.join(path.resolve(repoRoot, options.runRoot!), "summary.json");
  const runSummary = await readJsonObject<{ scenarioPath: string; runRoot: string }>(summaryPath);
  const scenarioPath = path.resolve(repoRoot, runSummary.scenarioPath);
  const runRoot = options.runRoot
    ? path.resolve(repoRoot, options.runRoot)
    : path.resolve(path.dirname(summaryPath));
  const scenario = await loadScenarioPackFromFile(scenarioPath);
  const report = await evaluateBattletestRun({
    scenario,
    scenarioPath,
    runRoot,
    summaryPath,
    seedDocumentStorePath: path.join(resolveScenarioSeedPath(scenarioPath, scenario.seed), "obsidian-repository")
  });
  const outputPath =
    options.outputPath
      ? path.resolve(repoRoot, options.outputPath)
      : path.join(runRoot, "evaluation.json");

  await writeJsonFile(outputPath, report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (!report.passed) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  const message =
    error instanceof Error ? error.stack || error.message : "Program battletest evaluation failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
