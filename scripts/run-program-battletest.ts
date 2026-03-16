import {
  runBattletestScenarioByArgument,
  type BattletestRunOptions
} from "../packages/server/src/services/program-battletest/runner";

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseArgs = (argv: string[]): BattletestRunOptions & { scenario: string } => {
  let scenario = "";
  let outputRoot: string | undefined;
  let timeoutMs = 180_000;
  let pollMs = 250;
  let branch = "main";
  let codexBin: string | undefined;
  let continueOnFailure = false;
  let keepPrompts = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--scenario") {
      scenario = argv[index + 1] || "";
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

  if (!scenario.trim()) {
    throw new Error("Missing required argument: --scenario <scenario-id-or-path>");
  }

  return {
    scenario: scenario.trim(),
    outputRoot,
    timeoutMs,
    pollMs,
    branch: branch.trim() || "main",
    codexBin: codexBin?.trim() || undefined,
    continueOnFailure,
    keepPrompts
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const summary = await runBattletestScenarioByArgument({
    scenarioArgument: options.scenario,
    options
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
};

void main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : "Program battletest failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
