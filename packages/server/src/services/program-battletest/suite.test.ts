import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  loadProgramBattletestSuiteFromFile,
  resolveProgramBattletestSuitesRoot,
  resolveRepoRoot
} from "./suite";

test("program battletest suite schema parses", async () => {
  const repoRoot = resolveRepoRoot();
  const schemaPath = path.join(repoRoot, "schemas", "program-battletest-suite.schema.json");
  const source = await fs.readFile(schemaPath, "utf8");

  assert.doesNotThrow(() => JSON.parse(source));
});

test("initial battletest suite validates and includes the starter eight scenarios", async () => {
  const suitePath = path.join(resolveProgramBattletestSuitesRoot(), "initial.json");
  const suite = await loadProgramBattletestSuiteFromFile(suitePath);

  assert.equal(suite.id, "initial");
  assert.deepEqual(suite.scenarios, [
    "unrelated-fragments",
    "weak-similarities",
    "hidden-pattern-pair",
    "hypothesis-strengthening",
    "hypothesis-disproving",
    "grocery-lists",
    "reminders",
    "birthdays"
  ]);
});
