import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasLanesTab } from "./canvas-lanes-tab";
import type { CanvasLanesSnapshotRecord } from "./canvas-lanes-types";
import {
  buildCanvasLanesBackRequest,
  buildCanvasLanesFocusRequest,
  buildCanvasLanesResetRequest
} from "./canvas-lanes-navigation";

const snapshot: CanvasLanesSnapshotRecord = {
  generatedAt: "2026-03-23T15:10:00.000Z",
  canvasPath: "main.canvas",
  focusNodeId: "focus-note",
  focusHistory: ["earlier-focus"],
  lanes: [
    {
      id: "focus",
      label: "Main frame",
      description: "The current focal node for lane-based exploration.",
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
      description: "Direct, manually-curated relationships from canvas edges.",
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
        }
      ]
    },
    {
      id: "bridge",
      label: "Bridge / indirect",
      description: "Nodes that connect strongly through a shared intermediary.",
      cards: []
    }
  ]
};

test("CanvasLanesTab renders the focus lane first and downstream lane headers after it", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CanvasLanesTab, {
      snapshot,
      selectedPromptLabel: "#a1b2c3d4"
    })
  );

  const focusIndex = markup.indexOf("Main frame");
  const canvasIndex = markup.indexOf("Explicit canvas links");
  const bridgeIndex = markup.indexOf("Bridge / indirect");

  assert.ok(focusIndex >= 0);
  assert.ok(canvasIndex > focusIndex);
  assert.equal(bridgeIndex, -1);
  assert.match(markup, /Recurring dream fragment/);
  assert.match(markup, /Sleep fragmentation/);
  assert.match(markup, /prompt <strong>#a1b2c3d4<\/strong>/);
  assert.match(markup, /touched 1/);
  assert.match(markup, /focus touched/);
  assert.match(markup, /Selected card/);
  assert.match(markup, /current focus/);
  assert.match(markup, /collapsed <strong>1<\/strong>/);
  assert.match(markup, /canvas edge/);
});

test("CanvasLanesTab shows navigation controls when a snapshot is navigable", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CanvasLanesTab, {
      snapshot,
      onRequestSnapshot: async () => snapshot
    })
  );

  assert.match(markup, />Back</);
  assert.match(markup, />Reset focus</);
});

test("lane navigation helpers support promote, back, and reset flows", () => {
  assert.deepEqual(buildCanvasLanesFocusRequest(snapshot, "concept-a"), {
    focusNodeId: "concept-a",
    focusHistory: ["earlier-focus", "focus-note"]
  });
  assert.deepEqual(buildCanvasLanesBackRequest(snapshot), {
    focusNodeId: "earlier-focus",
    focusHistory: []
  });
  assert.deepEqual(buildCanvasLanesResetRequest("focus-note"), {
    focusNodeId: "focus-note",
    focusHistory: []
  });
});
