import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  discoverScenarioPackPaths,
  loadAllScenarioPacks,
  resolveProgramBattletestRoot,
  resolveRepoRoot
} from "./scenario-pack";
import { validateCanvasState } from "../canvas-validator";

test("program battletest scenario schema parses", async () => {
  const repoRoot = resolveRepoRoot();
  const schemaPath = path.join(repoRoot, "schemas", "program-battletest-scenario.schema.json");
  const source = await fs.readFile(schemaPath, "utf8");

  assert.doesNotThrow(() => JSON.parse(source));
});

test("program battletest scenario packs validate", async () => {
  const scenariosRoot = resolveProgramBattletestRoot();
  const packPaths = await discoverScenarioPackPaths(scenariosRoot);

  assert.equal(packPaths.length, 8);

  const packs = await loadAllScenarioPacks(scenariosRoot);

  assert.equal(packs.length, packPaths.length);
  assert.deepEqual(
    packs.map((pack) => pack.id).sort((left, right) => left.localeCompare(right)),
    [
      "birthdays",
      "grocery-lists",
      "hidden-pattern-pair",
      "hypothesis-disproving",
      "hypothesis-strengthening",
      "reminders",
      "unrelated-fragments",
      "weak-similarities"
    ]
  );
});

test("shared battletest seeds include valid knowledge roots", async () => {
  const repoRoot = resolveRepoRoot();
  const sharedRoot = path.join(repoRoot, "scenarios", "program-battletest", "_shared");
  const seedDirs = ["seed-empty", "seed-open-hypothesis"];

  for (const seedDir of seedDirs) {
    const fullSeedRoot = path.join(sharedRoot, seedDir);
    const knowledgeRoot = path.join(fullSeedRoot, "obsidian-repository");
    const report = await validateCanvasState({
      repoRoot: fullSeedRoot,
      knowledgeRoot,
      requireCanonical: true
    });

    assert.equal(report.valid, true, `${seedDir} canvas seed should be valid.`);
    await assert.doesNotReject(() => fs.access(path.join(knowledgeRoot, "audit.md")));
    await assert.doesNotReject(() => fs.access(path.join(knowledgeRoot, "index.md")));
  }

  const hypothesisPath = path.join(
    sharedRoot,
    "seed-open-hypothesis",
    "obsidian-repository",
    "hypotheses",
    "repeated-clock-time-may-relate-to-frequency-illusion.md"
  );
  const hypothesisSource = await fs.readFile(hypothesisPath, "utf8");

  assert.match(hypothesisSource, /^## Status$/m);
  assert.match(hypothesisSource, /^Open$/m);
});
