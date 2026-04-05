import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockCanvasTreeSnapshot } from "./canvas-tree-layout";
import { CanvasTreeTab } from "./canvas-tree-tab";

test("CanvasTreeTab renders the tree toolbar, detail panel, and status summary", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CanvasTreeTab, {
      snapshot: mockCanvasTreeSnapshot,
      selectedPromptLabel: "#f0c5abcd",
      playbackEnabled: true
    })
  );

  assert.match(markup, /Canvas tree of life view/);
  assert.match(markup, /Hide details/);
  assert.match(markup, /Search roots/);
  assert.match(markup, /Layout/);
  assert.match(markup, /Layers deep/);
  assert.match(markup, /Prompt playback/);
  assert.match(markup, /Prompt playback/);
  assert.match(markup, /Selected node/);
  assert.match(markup, /Collapse subtree/);
  assert.match(markup, /Relationship families/);
  assert.match(markup, /recurring dream fragment/);
  assert.match(markup, /Lineage reason/);
  assert.match(markup, /Immediate relations/);
  assert.match(markup, />Parent</);
  assert.match(markup, />Child</);
  assert.match(markup, /sleep fragmentation/);
  assert.match(markup, /frequency illusion/);
  assert.match(markup, /supports/);
  assert.match(markup, /possible overlap/);
  assert.match(markup, /data-node-id="concept-a"/);
  assert.match(markup, /data-node-id="concept-b"/);
  assert.match(markup, /Showing 2 touched nodes across 2 lineage edges/);
  assert.match(markup, /tree-surface__node--dot/);
  assert.equal((markup.match(/tree-surface__node-frame/g) || []).length, 1);
  assert.match(markup, /root <strong>recurring dream fragment<\/strong>/);
  assert.match(markup, /mode <strong>phylogeny<\/strong>/);
  assert.match(markup, /collapsed <strong>0<\/strong>/);
  assert.match(markup, /hidden <strong>3<\/strong>/);
  assert.match(markup, /playback <strong>on<\/strong>/);
  assert.match(markup, /prompt <strong>#f0c5abcd<\/strong>/);
  assert.match(markup, /direct canvas <strong>1<\/strong>/);
  assert.match(markup, /tentative <strong>1<\/strong>/);
});

test("CanvasTreeTab enables root and depth controls when a snapshot callback is provided", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CanvasTreeTab, {
      snapshot: mockCanvasTreeSnapshot,
      layoutMode: "radial",
      rootHistory: ["older-root"],
      onRequestSnapshot: async () => mockCanvasTreeSnapshot
    })
  );

  assert.match(markup, /<select class="graph-surface__select"/);
  assert.match(markup, />Radial</);
  assert.match(markup, />Back</);
  assert.match(markup, />Zoom in</);
  assert.match(markup, />Zoom out</);
  assert.match(markup, />Reset view</);
});
