import path from "node:path";
import { buildBattletestSuiteReport, writeBattletestSuiteReport } from "../packages/server/src/services/program-battletest/reporting";

const parseArgs = (argv: string[]) => {
  let suiteSummary = "";
  let outputJson: string | undefined;
  let outputMarkdown: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--suite-summary") {
      suiteSummary = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (value === "--output-json") {
      outputJson = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--output-markdown") {
      outputMarkdown = argv[index + 1];
      index += 1;
      continue;
    }
  }

  if (!suiteSummary.trim()) {
    throw new Error("Missing required argument: --suite-summary <path>");
  }

  return {
    suiteSummary: path.resolve(suiteSummary.trim()),
    outputJson: outputJson ? path.resolve(outputJson) : undefined,
    outputMarkdown: outputMarkdown ? path.resolve(outputMarkdown) : undefined
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const report = await buildBattletestSuiteReport({
    suiteSummaryPath: args.suiteSummary
  });
  const defaultJsonPath = path.join(report.runRoot, "suite-report.json");
  const defaultMarkdownPath = path.join(report.runRoot, "suite-report.md");

  await writeBattletestSuiteReport({
    report,
    jsonPath: args.outputJson || defaultJsonPath,
    markdownPath: args.outputMarkdown || defaultMarkdownPath
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

void main().catch((error) => {
  const message =
    error instanceof Error ? error.stack || error.message : "Program battletest report generation failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
