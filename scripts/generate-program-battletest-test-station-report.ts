import path from "node:path";
import { promises as fs } from "node:fs";
import { buildBattletestSuiteReport, renderBattletestSuiteMarkdown, writeBattletestSuiteReport } from "../packages/server/src/services/program-battletest/reporting";
import { createSyntheticBattletestSuiteFixture } from "../packages/server/src/services/program-battletest/report-fixture";
import { resolveRepoRoot } from "../packages/server/src/services/program-battletest/scenario-pack";

const main = async () => {
  const repoRoot = resolveRepoRoot();
  const rawOutputDir = path.join(repoRoot, ".test-results", "schizm-test-report", "raw");
  const fixtureRoot = path.join(rawOutputDir, "program-battletest-report-fixture");
  const outputJsonPath = path.join(rawOutputDir, "program-battletest-suite-report.json");
  const outputMarkdownPath = path.join(rawOutputDir, "program-battletest-suite-report.md");

  await fs.mkdir(rawOutputDir, { recursive: true });

  const fixture = await createSyntheticBattletestSuiteFixture(fixtureRoot);
  const report = await buildBattletestSuiteReport({
    suiteSummaryPath: fixture.suiteSummaryPath
  });

  await writeBattletestSuiteReport({
    report,
    jsonPath: outputJsonPath,
    markdownPath: outputMarkdownPath
  });

  process.stdout.write(renderBattletestSuiteMarkdown(report));
};

void main().catch((error) => {
  const message =
    error instanceof Error ? error.stack || error.message : "Failed to generate battletest test-station report.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
