import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ScenarioJsonValue =
  | null
  | string
  | number
  | boolean
  | ScenarioJsonValue[]
  | { [key: string]: ScenarioJsonValue };

export const PROGRAM_BATTLETEST_SCHEMA_VERSION = "1";
export const PROGRAM_BATTLETEST_SCENARIOS_DIR = "scenarios/program-battletest";
export const DEFAULT_CANVAS_PATH = "obsidian-repository/main.canvas";

export const scenarioSeedModes = ["copySeedDir"] as const;
export type ScenarioSeedMode = (typeof scenarioSeedModes)[number];

export const scenarioDecisionModes = ["create", "integrate", "append"] as const;
export type ScenarioDecisionMode = (typeof scenarioDecisionModes)[number];

export const contextualDispositions = [
  "related_but_unproven",
  "supports_existing_topic",
  "complicates_existing_topic",
  "contradicts_existing_topic"
] as const;
export type ContextualDisposition = (typeof contextualDispositions)[number];

export const hypothesisStatuses = [
  "Open",
  "Strengthening",
  "Weakening",
  "Disproved",
  "Resolved"
] as const;
export type HypothesisStatus = (typeof hypothesisStatuses)[number];

export const scenarioAssertionTypes = [
  "pathExists",
  "pathMissing",
  "fileContains",
  "fileNotContains",
  "jsonPathEquals",
  "jsonPathIncludes",
  "minimumFileCountInDir",
  "maximumFileCountInDir",
  "canvasHasNodeForPath",
  "canvasHasTentativeEdge",
  "auditIncludesDisposition",
  "hypothesisStatusEquals",
  "hypothesisStatusIn",
  "decisionModeObserved",
  "noUnexpectedHypothesisCreation"
] as const;
export type ScenarioAssertionType = (typeof scenarioAssertionTypes)[number];

type BaseScenarioAssertion = {
  type: ScenarioAssertionType;
  reason?: string;
};

export type ScenarioAssertion =
  | (BaseScenarioAssertion & {
      type: "pathExists" | "pathMissing";
      path: string;
    })
  | (BaseScenarioAssertion & {
      type: "fileContains" | "fileNotContains";
      path: string;
      value: string;
    })
  | (BaseScenarioAssertion & {
      type: "jsonPathEquals" | "jsonPathIncludes";
      path: string;
      jsonPath: string;
      value: ScenarioJsonValue;
    })
  | (BaseScenarioAssertion & {
      type: "minimumFileCountInDir" | "maximumFileCountInDir";
      path: string;
      count: number;
    })
  | (BaseScenarioAssertion & {
      type: "canvasHasNodeForPath";
      notePath: string;
      canvasPath?: string;
    })
  | (BaseScenarioAssertion & {
      type: "canvasHasTentativeEdge";
      from: string;
      to: string;
      canvasPath?: string;
    })
  | (BaseScenarioAssertion & {
      type: "auditIncludesDisposition";
      disposition: ContextualDisposition;
    })
  | (BaseScenarioAssertion & {
      type: "hypothesisStatusEquals";
      path: string;
      status: HypothesisStatus;
    })
  | (BaseScenarioAssertion & {
      type: "hypothesisStatusIn";
      path: string;
      statuses: HypothesisStatus[];
    })
  | (BaseScenarioAssertion & {
      type: "decisionModeObserved";
      mode: ScenarioDecisionMode;
    })
  | (BaseScenarioAssertion & {
      type: "noUnexpectedHypothesisCreation";
      allowedPaths?: string[];
    });

export type ScenarioHypothesisDelta = Partial<{
  createdAtLeast: number;
  createdAtMost: number;
  updatedAtLeast: number;
  updatedAtMost: number;
  strengthenedAtLeast: number;
  strengthenedAtMost: number;
  weakenedAtLeast: number;
  weakenedAtMost: number;
  disprovedAtLeast: number;
  disprovedAtMost: number;
  resolvedAtLeast: number;
  resolvedAtMost: number;
}>;

export type ScenarioRoundExpectations = {
  decisionModes?: ScenarioDecisionMode[];
  minimumContextualRelevance?: number;
  maximumContextualRelevance?: number;
  hypothesisDelta?: ScenarioHypothesisDelta;
  assertions?: ScenarioAssertion[];
};

export type ScenarioRound = {
  id: string;
  title?: string;
  prompt: string;
  expectations?: ScenarioRoundExpectations;
};

export type ScenarioCheckpoint = {
  afterRound: number;
  label?: string;
  assertions: ScenarioAssertion[];
};

export type ScenarioSeed = {
  mode: ScenarioSeedMode;
  path: string;
};

export type ScenarioPack = {
  schemaVersion: typeof PROGRAM_BATTLETEST_SCHEMA_VERSION;
  id: string;
  title: string;
  theme: string;
  description: string;
  tags: string[];
  seed: ScenarioSeed;
  rounds: ScenarioRound[];
  checkpoints: ScenarioCheckpoint[];
  finalAssertions: ScenarioAssertion[];
};

const hypothesisDeltaKeys = [
  "createdAtLeast",
  "createdAtMost",
  "updatedAtLeast",
  "updatedAtMost",
  "strengthenedAtLeast",
  "strengthenedAtMost",
  "weakenedAtLeast",
  "weakenedAtMost",
  "disprovedAtLeast",
  "disprovedAtMost",
  "resolvedAtLeast",
  "resolvedAtMost"
] as const;

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const assertCondition = (condition: boolean, context: string, message: string): void => {
  if (!condition) {
    throw new Error(`${context}: ${message}`);
  }
};

const assertNonEmptyString = (value: unknown, context: string): string => {
  assertCondition(isNonEmptyString(value), context, "Expected a non-empty string.");
  return value.trim();
};

const assertOptionalString = (value: unknown, context: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return assertNonEmptyString(value, context);
};

const assertStringArray = (
  value: unknown,
  context: string,
  allowedValues?: readonly string[]
): string[] => {
  assertCondition(Array.isArray(value), context, "Expected an array.");

  const items = value.map((item, index) =>
    assertNonEmptyString(item, `${context}[${index}]`)
  );

  if (allowedValues) {
    for (const item of items) {
      assertCondition(
        allowedValues.includes(item),
        context,
        `Unexpected value "${item}". Expected one of: ${allowedValues.join(", ")}.`
      );
    }
  }

  return items;
};

const assertRelativePath = (value: unknown, context: string): string => {
  const normalized = assertNonEmptyString(value, context);
  assertCondition(!path.isAbsolute(normalized), context, "Expected a relative path.");
  return normalized;
};

const assertNonNegativeInteger = (value: unknown, context: string): number => {
  assertCondition(isNonNegativeInteger(value), context, "Expected a non-negative integer.");
  return value;
};

const validateHypothesisDelta = (
  value: unknown,
  context: string
): ScenarioHypothesisDelta | undefined => {
  if (value === undefined) {
    return undefined;
  }

  assertCondition(isJsonObject(value), context, "Expected an object.");

  const delta: ScenarioHypothesisDelta = {};

  for (const key of hypothesisDeltaKeys) {
    if (value[key] !== undefined) {
      delta[key] = assertNonNegativeInteger(value[key], `${context}.${key}`);
    }
  }

  assertCondition(
    Object.keys(delta).length > 0,
    context,
    "Expected at least one hypothesis delta bound."
  );

  return delta;
};

const validateAssertion = (value: unknown, context: string): ScenarioAssertion => {
  assertCondition(isJsonObject(value), context, "Expected an assertion object.");

  const type = assertNonEmptyString(value.type, `${context}.type`) as ScenarioAssertionType;
  assertCondition(
    scenarioAssertionTypes.includes(type),
    `${context}.type`,
    `Unexpected assertion type "${type}".`
  );

  const reason = assertOptionalString(value.reason, `${context}.reason`);

  switch (type) {
    case "pathExists":
    case "pathMissing":
      return {
        type,
        path: assertRelativePath(value.path, `${context}.path`),
        ...(reason ? { reason } : {})
      };
    case "fileContains":
    case "fileNotContains":
      return {
        type,
        path: assertRelativePath(value.path, `${context}.path`),
        value: assertNonEmptyString(value.value, `${context}.value`),
        ...(reason ? { reason } : {})
      };
    case "jsonPathEquals":
    case "jsonPathIncludes":
      assertCondition("value" in value, context, 'Expected a "value" property.');
      return {
        type,
        path: assertRelativePath(value.path, `${context}.path`),
        jsonPath: assertNonEmptyString(value.jsonPath, `${context}.jsonPath`),
        value: value.value as ScenarioJsonValue,
        ...(reason ? { reason } : {})
      };
    case "minimumFileCountInDir":
    case "maximumFileCountInDir":
      return {
        type,
        path: assertRelativePath(value.path, `${context}.path`),
        count: assertNonNegativeInteger(value.count, `${context}.count`),
        ...(reason ? { reason } : {})
      };
    case "canvasHasNodeForPath":
      return {
        type,
        notePath: assertRelativePath(value.notePath, `${context}.notePath`),
        ...(value.canvasPath !== undefined
          ? { canvasPath: assertRelativePath(value.canvasPath, `${context}.canvasPath`) }
          : {}),
        ...(reason ? { reason } : {})
      };
    case "canvasHasTentativeEdge":
      return {
        type,
        from: assertRelativePath(value.from, `${context}.from`),
        to: assertRelativePath(value.to, `${context}.to`),
        ...(value.canvasPath !== undefined
          ? { canvasPath: assertRelativePath(value.canvasPath, `${context}.canvasPath`) }
          : {}),
        ...(reason ? { reason } : {})
      };
    case "auditIncludesDisposition":
      return {
        type,
        disposition: assertNonEmptyString(
          value.disposition,
          `${context}.disposition`
        ) as ContextualDisposition,
        ...(reason ? { reason } : {})
      };
    case "hypothesisStatusEquals":
      return {
        type,
        path: assertRelativePath(value.path, `${context}.path`),
        status: assertNonEmptyString(value.status, `${context}.status`) as HypothesisStatus,
        ...(reason ? { reason } : {})
      };
    case "hypothesisStatusIn":
      return {
        type,
        path: assertRelativePath(value.path, `${context}.path`),
        statuses: assertStringArray(
          value.statuses,
          `${context}.statuses`,
          hypothesisStatuses
        ) as HypothesisStatus[],
        ...(reason ? { reason } : {})
      };
    case "decisionModeObserved":
      return {
        type,
        mode: assertNonEmptyString(value.mode, `${context}.mode`) as ScenarioDecisionMode,
        ...(reason ? { reason } : {})
      };
    case "noUnexpectedHypothesisCreation":
      return {
        type,
        ...(value.allowedPaths !== undefined
          ? {
              allowedPaths: assertStringArray(
                value.allowedPaths,
                `${context}.allowedPaths`
              ).map((item) => assertRelativePath(item, `${context}.allowedPaths`))
            }
          : {}),
        ...(reason ? { reason } : {})
      };
  }
};

const validateAssertions = (value: unknown, context: string): ScenarioAssertion[] => {
  assertCondition(Array.isArray(value), context, "Expected an array of assertions.");
  return value.map((item, index) => validateAssertion(item, `${context}[${index}]`));
};

const validateRoundExpectations = (
  value: unknown,
  context: string
): ScenarioRoundExpectations | undefined => {
  if (value === undefined) {
    return undefined;
  }

  assertCondition(isJsonObject(value), context, "Expected an object.");

  const expectations: ScenarioRoundExpectations = {};

  if (value.decisionModes !== undefined) {
    expectations.decisionModes = assertStringArray(
      value.decisionModes,
      `${context}.decisionModes`,
      scenarioDecisionModes
    ) as ScenarioDecisionMode[];
  }

  if (value.minimumContextualRelevance !== undefined) {
    expectations.minimumContextualRelevance = assertNonNegativeInteger(
      value.minimumContextualRelevance,
      `${context}.minimumContextualRelevance`
    );
  }

  if (value.maximumContextualRelevance !== undefined) {
    expectations.maximumContextualRelevance = assertNonNegativeInteger(
      value.maximumContextualRelevance,
      `${context}.maximumContextualRelevance`
    );
  }

  if (
    expectations.minimumContextualRelevance !== undefined &&
    expectations.maximumContextualRelevance !== undefined
  ) {
    assertCondition(
      expectations.minimumContextualRelevance <= expectations.maximumContextualRelevance,
      context,
      "minimumContextualRelevance cannot exceed maximumContextualRelevance."
    );
  }

  const hypothesisDelta = validateHypothesisDelta(value.hypothesisDelta, `${context}.hypothesisDelta`);
  if (hypothesisDelta) {
    expectations.hypothesisDelta = hypothesisDelta;
  }

  if (value.assertions !== undefined) {
    expectations.assertions = validateAssertions(value.assertions, `${context}.assertions`);
  }

  return expectations;
};

const validateRound = (value: unknown, context: string): ScenarioRound => {
  assertCondition(isJsonObject(value), context, "Expected a round object.");

  return {
    id: assertNonEmptyString(value.id, `${context}.id`),
    title: assertOptionalString(value.title, `${context}.title`),
    prompt: assertNonEmptyString(value.prompt, `${context}.prompt`),
    expectations: validateRoundExpectations(value.expectations, `${context}.expectations`)
  };
};

const validateCheckpoint = (
  value: unknown,
  context: string,
  roundCount: number
): ScenarioCheckpoint => {
  assertCondition(isJsonObject(value), context, "Expected a checkpoint object.");

  const afterRound = assertNonNegativeInteger(value.afterRound, `${context}.afterRound`);
  assertCondition(
    afterRound >= 1 && afterRound <= roundCount,
    `${context}.afterRound`,
    `Expected a round number between 1 and ${roundCount}.`
  );

  return {
    afterRound,
    label: assertOptionalString(value.label, `${context}.label`),
    assertions: validateAssertions(value.assertions, `${context}.assertions`)
  };
};

const validateSeed = (value: unknown, context: string): ScenarioSeed => {
  assertCondition(isJsonObject(value), context, "Expected a seed object.");

  const mode = assertNonEmptyString(value.mode, `${context}.mode`) as ScenarioSeedMode;
  assertCondition(
    scenarioSeedModes.includes(mode),
    `${context}.mode`,
    `Unexpected seed mode "${mode}".`
  );

  return {
    mode,
    path: assertRelativePath(value.path, `${context}.path`)
  };
};

export const resolveRepoRoot = () =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../");

export const resolveProgramBattletestRoot = (repoRoot = resolveRepoRoot()) =>
  path.join(repoRoot, PROGRAM_BATTLETEST_SCENARIOS_DIR);

export const resolveScenarioSeedPath = (scenarioFilePath: string, seed: ScenarioSeed) =>
  path.resolve(path.dirname(scenarioFilePath), seed.path);

export const validateScenarioPack = async (
  value: unknown,
  scenarioFilePath: string
): Promise<ScenarioPack> => {
  const context = path.relative(resolveRepoRoot(), scenarioFilePath) || scenarioFilePath;
  assertCondition(isJsonObject(value), context, "Expected a scenario object.");

  const schemaVersion = assertNonEmptyString(
    value.schemaVersion,
    `${context}.schemaVersion`
  );
  assertCondition(
    schemaVersion === PROGRAM_BATTLETEST_SCHEMA_VERSION,
    `${context}.schemaVersion`,
    `Expected schemaVersion ${PROGRAM_BATTLETEST_SCHEMA_VERSION}.`
  );

  const pack: ScenarioPack = {
    schemaVersion: PROGRAM_BATTLETEST_SCHEMA_VERSION,
    id: assertNonEmptyString(value.id, `${context}.id`),
    title: assertNonEmptyString(value.title, `${context}.title`),
    theme: assertNonEmptyString(value.theme, `${context}.theme`),
    description: assertNonEmptyString(value.description, `${context}.description`),
    tags: assertStringArray(value.tags, `${context}.tags`),
    seed: validateSeed(value.seed, `${context}.seed`),
    rounds: (() => {
      assertCondition(Array.isArray(value.rounds), `${context}.rounds`, "Expected an array.");
      assertCondition(value.rounds.length > 0, `${context}.rounds`, "Expected at least one round.");
      return value.rounds.map((round, index) => validateRound(round, `${context}.rounds[${index}]`));
    })(),
    checkpoints: (() => {
      if (value.checkpoints === undefined) {
        return [];
      }

      assertCondition(Array.isArray(value.checkpoints), `${context}.checkpoints`, "Expected an array.");
      return value.checkpoints.map((checkpoint, index) =>
        validateCheckpoint(checkpoint, `${context}.checkpoints[${index}]`, value.rounds.length)
      );
    })(),
    finalAssertions: validateAssertions(value.finalAssertions, `${context}.finalAssertions`)
  };

  assertCondition(
    pack.finalAssertions.length > 0,
    `${context}.finalAssertions`,
    "Expected at least one final assertion."
  );

  const scenarioDirName = path.basename(path.dirname(scenarioFilePath));
  assertCondition(
    scenarioDirName === pack.id,
    `${context}.id`,
    `Scenario id must match its directory name "${scenarioDirName}".`
  );

  const seedDir = resolveScenarioSeedPath(scenarioFilePath, pack.seed);
  const seedStat = await fs.stat(seedDir).catch(() => null);
  assertCondition(Boolean(seedStat?.isDirectory()), `${context}.seed.path`, "Seed directory does not exist.");

  const knowledgeRoot = path.join(seedDir, "obsidian-repository");
  const knowledgeRootStat = await fs.stat(knowledgeRoot).catch(() => null);
  assertCondition(
    Boolean(knowledgeRootStat?.isDirectory()),
    `${context}.seed.path`,
    'Seed directory must contain an "obsidian-repository" directory.'
  );

  return pack;
};

export const loadScenarioPackFromFile = async (scenarioFilePath: string): Promise<ScenarioPack> => {
  const source = await fs.readFile(scenarioFilePath, "utf8");
  const parsed = JSON.parse(source) as unknown;
  return validateScenarioPack(parsed, scenarioFilePath);
};

export const discoverScenarioPackPaths = async (scenariosRoot: string): Promise<string[]> => {
  const entries = await fs.readdir(scenariosRoot, { withFileTypes: true });
  const packPaths = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => path.join(scenariosRoot, entry.name, "scenario.json"));

  const filtered: string[] = [];

  for (const candidate of packPaths) {
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat?.isFile()) {
      filtered.push(candidate);
    }
  }

  return filtered.sort((left, right) => left.localeCompare(right));
};

export const loadAllScenarioPacks = async (
  scenariosRoot = resolveProgramBattletestRoot()
): Promise<ScenarioPack[]> => {
  const packPaths = await discoverScenarioPackPaths(scenariosRoot);
  return Promise.all(packPaths.map((packPath) => loadScenarioPackFromFile(packPath)));
};
