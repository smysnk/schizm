import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanvasLanesBackRequest,
  buildCanvasLanesFocusRequest,
  buildCanvasLanesResetRequest
} from "./canvas-lanes-navigation";
import type { CanvasLanesSnapshotRecord } from "./canvas-lanes-types";

const snapshot: CanvasLanesSnapshotRecord = {
  generatedAt: "2026-03-23T16:00:00.000Z",
  canvasPath: "main.canvas",
  focusNodeId: "focus-note",
  focusHistory: ["earlier-focus"],
  lanes: [
    {
      id: "focus",
      label: "Main frame",
      description: "Current focus",
      cards: [
        {
          nodeId: "focus-note",
          label: "Focus",
          kind: "file",
          category: "fragment",
          notePath: "fragments/focus.md",
          canvasNodeId: "focus-note",
          canvasFile: "main.canvas",
          reason: "current focus",
          score: 999,
          tentative: false,
          touchedByPrompt: false
        }
      ]
    },
    {
      id: "canvas",
      label: "Canvas",
      description: "Explicit canvas links",
      cards: [
        {
          nodeId: "canvas-neighbor",
          label: "Canvas neighbor",
          kind: "file",
          category: "concept",
          notePath: "concepts/canvas-neighbor.md",
          canvasNodeId: "canvas-neighbor",
          canvasFile: "main.canvas",
          reason: "canvas edge",
          score: 400,
          tentative: false,
          touchedByPrompt: false
        }
      ]
    }
  ]
};

test("buildCanvasLanesFocusRequest promotes a downstream card and appends the current focus to history", () => {
  const next = buildCanvasLanesFocusRequest(snapshot, "canvas-neighbor");

  assert.deepEqual(next, {
    focusNodeId: "canvas-neighbor",
    focusHistory: ["earlier-focus", "focus-note"]
  });
});

test("buildCanvasLanesFocusRequest ignores invalid or already-focused ids", () => {
  assert.equal(buildCanvasLanesFocusRequest(snapshot, "focus-note"), null);
  assert.equal(buildCanvasLanesFocusRequest(snapshot, "missing-note"), null);
});

test("buildCanvasLanesBackRequest returns the prior focus and trims history", () => {
  const back = buildCanvasLanesBackRequest(snapshot);

  assert.deepEqual(back, {
    focusNodeId: "earlier-focus",
    focusHistory: []
  });
});

test("buildCanvasLanesResetRequest resets to the original focus with empty history", () => {
  assert.deepEqual(buildCanvasLanesResetRequest("initial-focus"), {
    focusNodeId: "initial-focus",
    focusHistory: []
  });
  assert.equal(buildCanvasLanesResetRequest(null), null);
});
