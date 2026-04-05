import assert from "node:assert/strict";
import test from "node:test";
import {
  getAvailableThemeOptions,
  resolveThemeId
} from "./themes";

test("getAvailableThemeOptions filters the registry to known runtime themes", () => {
  const options = getAvailableThemeOptions([
    "workflow-analysis",
    "midnight",
    "unknown-theme"
  ]);

  assert.deepEqual(
    options.map((option) => option.id),
    ["midnight", "workflow-analysis"]
  );
});

test("getAvailableThemeOptions falls back to the full registry when runtime themes are empty", () => {
  const options = getAvailableThemeOptions(["unknown-theme"]);

  assert.deepEqual(
    options.map((option) => option.id),
    ["signal", "paper", "midnight", "workflow-analysis"]
  );
});

test("resolveThemeId keeps a valid runtime-selected theme", () => {
  assert.equal(
    resolveThemeId("workflow-analysis", ["signal", "workflow-analysis"]),
    "workflow-analysis"
  );
});

test("resolveThemeId falls back to the first available runtime theme", () => {
  assert.equal(
    resolveThemeId("paper", ["workflow-analysis", "midnight"]),
    "midnight"
  );
});
