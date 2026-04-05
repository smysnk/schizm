import assert from "node:assert/strict";
import test from "node:test";
import { mockCanvasTreeSnapshot } from "./canvas-tree-layout";
import { buildCanvasTreePromptPlayback } from "./canvas-tree-playback";

test("buildCanvasTreePromptPlayback highlights touched branches back to the root", () => {
  const playback = buildCanvasTreePromptPlayback(mockCanvasTreeSnapshot);

  assert.equal(playback.touchedNodeCount, 2);
  assert.equal(playback.touchedLeafCount, 1);
  assert.equal(playback.touchedBranchCount, 1);
  assert.equal(playback.deepestTouchedDepth, 2);
  assert.equal(playback.rootTouched, true);
  assert.deepEqual(Array.from(playback.highlightedNodeIds), [
    "focus-note",
    "concept-a",
    "concept-c"
  ]);
  assert.deepEqual(Array.from(playback.highlightedEdgeIds), [
    "focus-note->concept-a",
    "concept-a->concept-c"
  ]);
  assert.deepEqual(playback.familyCounts, {
    document: 1
  });
});

test("buildCanvasTreePromptPlayback returns an empty overlay when no touched nodes exist", () => {
  const playback = buildCanvasTreePromptPlayback({
    ...mockCanvasTreeSnapshot,
    nodes: mockCanvasTreeSnapshot.nodes.map((node) => ({
      ...node,
      touchedByPrompt: false
    }))
  });

  assert.equal(playback.touchedNodeCount, 0);
  assert.equal(playback.highlightedNodeIds.size, 0);
  assert.equal(playback.highlightedEdgeIds.size, 0);
  assert.deepEqual(playback.familyCounts, {});
});
