import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  buildBattletestSuiteReport,
  renderBattletestSuiteMarkdown,
  writeBattletestSuiteReport
} from "./reporting";
import { createSyntheticBattletestSuiteFixture } from "./report-fixture";

test("buildBattletestSuiteReport summarizes scenarios and failure explanations", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "schizm-battletest-reporting-"));
  const fixture = await createSyntheticBattletestSuiteFixture(rootDir);
  const report = await buildBattletestSuiteReport({
    suiteSummaryPath: fixture.suiteSummaryPath
  });

  assert.equal(report.suiteId, "initial");
  assert.equal(report.scenarioCount, 2);
  assert.equal(report.failedScenarioCount, 1);
  assert.equal(report.passedScenarioCount, 1);
  assert.equal(report.scenarios[0]?.failureExplanations[0], "Decision mode selection (round 1): Expected one of create, received missing.");
  assert.equal(
    report.scenarios[0]?.roundArtifacts[0]?.snapshotSummaryPath,
    "scenario-runs/unrelated-fragments-demo/snapshots/round-01-round-1/snapshot.json"
  );
  assert.equal(
    report.scenarios[1]?.roundArtifacts[0]?.auditSectionPath,
    "scenario-runs/grocery-lists-demo/snapshots/round-01-round-1/audit-section.md"
  );
});

test("renderBattletestSuiteMarkdown includes scenario summaries and artifact links", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "schizm-battletest-report-md-"));
  const fixture = await createSyntheticBattletestSuiteFixture(rootDir);
  const report = await buildBattletestSuiteReport({
    suiteSummaryPath: fixture.suiteSummaryPath
  });
  const markdown = renderBattletestSuiteMarkdown(report);

  assert.match(markdown, /^# Initial Program Battletest Suite/m);
  assert.match(markdown, /### Unrelated Fragments/);
  assert.match(markdown, /Decision mode selection \(round 1\): Expected one of create, received missing\./);
  assert.match(markdown, /\[evaluation\.json\]\(scenario-runs\/unrelated-fragments-demo\/evaluation\.json\)/);
  assert.match(markdown, /\[document-store\]\(scenario-runs\/grocery-lists-demo\/snapshots\/round-01-round-1\/obsidian-repository\)/);
});

test("writeBattletestSuiteReport writes JSON and markdown outputs", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "schizm-battletest-report-write-"));
  const fixture = await createSyntheticBattletestSuiteFixture(rootDir);
  const report = await buildBattletestSuiteReport({
    suiteSummaryPath: fixture.suiteSummaryPath
  });
  const jsonPath = path.join(rootDir, "artifacts", "suite-report.json");
  const markdownPath = path.join(rootDir, "artifacts", "suite-report.md");

  await writeBattletestSuiteReport({
    report,
    jsonPath,
    markdownPath
  });

  const [jsonSource, markdownSource] = await Promise.all([
    fs.readFile(jsonPath, "utf8"),
    fs.readFile(markdownPath, "utf8")
  ]);

  assert.match(jsonSource, /"suiteId": "initial"/);
  assert.match(markdownSource, /## Scenario Results/);
});
