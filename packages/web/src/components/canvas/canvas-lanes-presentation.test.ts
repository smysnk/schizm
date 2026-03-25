import assert from "node:assert/strict";
import test from "node:test";
import {
  findCanvasLaneCard,
  formatCanvasLaneReasonFamily,
  getCanvasLaneRelatedNodeIds,
  getVisibleCanvasLanes
} from "./canvas-lanes-presentation";
import type { CanvasLanesSnapshotRecord } from "./canvas-lanes-types";

const snapshot: CanvasLanesSnapshotRecord = {
  generatedAt: "2026-03-23T18:10:00.000Z",
  canvasPath: "main.canvas",
  focusNodeId: "focus-note",
  focusHistory: ["earlier-focus"],
  lanes: [
    {
      id: "focus",
      label: "Main frame",
      description: "Focus lane",
      cards: [
        {
          nodeId: "focus-note",
          label: "Recurring dream fragment",
          kind: "file",
          category: "fragment",
          notePath: "fragments/recurring-dream-fragment.md",
          canvasNodeId: "focus-note",
          canvasFile: "main.canvas",
          reason: "current focus",
          score: 9999,
          tentative: false,
          touchedByPrompt: true
        }
      ]
    },
    {
      id: "canvas",
      label: "Explicit canvas links",
      description: "Direct links",
      cards: [
        {
          nodeId: "concept-a",
          label: "Sleep fragmentation",
          kind: "file",
          category: "concept",
          notePath: "concepts/sleep-fragmentation.md",
          canvasNodeId: "concept-a",
          canvasFile: "main.canvas",
          reason: "canvas edge: supports",
          score: 410.5,
          tentative: false,
          touchedByPrompt: false
        },
        {
          nodeId: "concept-b",
          label: "Dream residue",
          kind: "file",
          category: "concept",
          notePath: "concepts/dream-residue.md",
          canvasNodeId: "concept-b",
          canvasFile: "main.canvas",
          reason: "canvas edge: mentions",
          score: 300.5,
          tentative: false,
          touchedByPrompt: true
        }
      ]
    },
    {
      id: "bridge",
      label: "Bridge / indirect",
      description: "Indirect links",
      cards: []
    },
    {
      id: "tentative",
      label: "Tentative / inferred",
      description: "Tentative links",
      cards: [
        {
          nodeId: "fragment-c",
          label: "Night sink fragment",
          kind: "file",
          category: "fragment",
          notePath: "fragments/night-sink-fragment.md",
          canvasNodeId: "fragment-c",
          canvasFile: "main.canvas",
          reason: "tentative relation: recurring night motif",
          score: 120.2,
          tentative: true,
          touchedByPrompt: true
        }
      ]
    }
  ]
};

test("getVisibleCanvasLanes collapses empty downstream lanes", () => {
  const lanes = getVisibleCanvasLanes(snapshot);

  assert.deepEqual(
    lanes.map((lane) => lane.id),
    ["focus", "canvas", "tentative"]
  );
});

test("findCanvasLaneCard returns the matching card and lane", () => {
  const result = findCanvasLaneCard(snapshot, "concept-a");

  assert.ok(result);
  assert.equal(result.card.label, "Sleep fragmentation");
  assert.equal(result.lane.id, "canvas");
});

test("formatCanvasLaneReasonFamily normalizes reason groups", () => {
  assert.equal(formatCanvasLaneReasonFamily("canvas edge: supports"), "canvas edge");
  assert.equal(formatCanvasLaneReasonFamily("tentative relation: recurring night motif"), "tentative relation");
});

test("getCanvasLaneRelatedNodeIds groups related cards around a selected lane card", () => {
  const related = getCanvasLaneRelatedNodeIds(snapshot, "focus-note", "concept-a");

  assert.deepEqual(
    Array.from(related ?? []).sort(),
    ["concept-a", "concept-b", "focus-note"].sort()
  );
});
