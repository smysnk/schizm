import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverScenarioPackPaths,
  resolveProgramBattletestRoot
} from "./scenario-pack";

export const PROGRAM_BATTLETEST_SUITE_SCHEMA_VERSION = "1";
export const PROGRAM_BATTLETEST_SUITES_DIR = "scenarios/program-battletest/suites";

export type ProgramBattletestSuite = {
  schemaVersion: typeof PROGRAM_BATTLETEST_SUITE_SCHEMA_VERSION;
  id: string;
  title: string;
  description: string;
  tags: string[];
  scenarios: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertCondition = (condition: boolean, context: string, message: string): void => {
  if (!condition) {
    throw new Error(`${context}: ${message}`);
  }
};

const assertNonEmptyString = (value: unknown, context: string) => {
  assertCondition(typeof value === "string" && value.trim().length > 0, context, "Expected a non-empty string.");
  return value.trim();
};

export const resolveRepoRoot = () =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../");

export const resolveProgramBattletestSuitesRoot = (repoRoot = resolveRepoRoot()) =>
  path.join(repoRoot, PROGRAM_BATTLETEST_SUITES_DIR);

export const validateProgramBattletestSuite = async (
  value: unknown,
  suiteFilePath: string
): Promise<ProgramBattletestSuite> => {
  const context = path.relative(resolveRepoRoot(), suiteFilePath) || suiteFilePath;
  assertCondition(isRecord(value), context, "Expected a suite object.");

  const schemaVersion = assertNonEmptyString(value.schemaVersion, `${context}.schemaVersion`);
  assertCondition(
    schemaVersion === PROGRAM_BATTLETEST_SUITE_SCHEMA_VERSION,
    `${context}.schemaVersion`,
    `Expected schemaVersion ${PROGRAM_BATTLETEST_SUITE_SCHEMA_VERSION}.`
  );

  assertCondition(Array.isArray(value.tags), `${context}.tags`, "Expected tags array.");
  assertCondition(Array.isArray(value.scenarios), `${context}.scenarios`, "Expected scenarios array.");

  const tags = value.tags.map((item, index) =>
    assertNonEmptyString(item, `${context}.tags[${index}]`)
  );
  const scenarios = value.scenarios.map((item, index) =>
    assertNonEmptyString(item, `${context}.scenarios[${index}]`)
  );

  assertCondition(scenarios.length > 0, `${context}.scenarios`, "Expected at least one scenario.");

  const suite: ProgramBattletestSuite = {
    schemaVersion: PROGRAM_BATTLETEST_SUITE_SCHEMA_VERSION,
    id: assertNonEmptyString(value.id, `${context}.id`),
    title: assertNonEmptyString(value.title, `${context}.title`),
    description: assertNonEmptyString(value.description, `${context}.description`),
    tags,
    scenarios
  };

  const suiteFileName = path.basename(suiteFilePath, path.extname(suiteFilePath));
  assertCondition(
    suite.id === suiteFileName,
    `${context}.id`,
    `Suite id must match file name "${suiteFileName}".`
  );

  const scenarioIds = new Set(
    (await discoverScenarioPackPaths(resolveProgramBattletestRoot())).map((scenarioPath) =>
      path.basename(path.dirname(scenarioPath))
    )
  );

  for (const scenarioId of suite.scenarios) {
    assertCondition(
      scenarioIds.has(scenarioId),
      `${context}.scenarios`,
      `Unknown scenario id "${scenarioId}".`
    );
  }

  return suite;
};

export const loadProgramBattletestSuiteFromFile = async (suiteFilePath: string) => {
  const source = await fs.readFile(suiteFilePath, "utf8");
  const parsed = JSON.parse(source) as unknown;
  return validateProgramBattletestSuite(parsed, suiteFilePath);
};

export const resolveProgramBattletestSuitePath = async (
  repoRoot: string,
  suiteArgument: string
) => {
  const directCandidate = path.resolve(repoRoot, suiteArgument);
  const suiteRootCandidate = path.join(
    resolveProgramBattletestSuitesRoot(repoRoot),
    `${suiteArgument}.json`
  );

  for (const candidate of [directCandidate, suiteRootCandidate]) {
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat?.isFile()) {
      return candidate;
    }
  }

  throw new Error(`Could not resolve suite "${suiteArgument}" to a suite json file.`);
};
