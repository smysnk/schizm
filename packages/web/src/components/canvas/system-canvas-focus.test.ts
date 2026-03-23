import assert from "node:assert/strict";
import test from "node:test";
import type { SystemCanvasSnapshotRecord } from "../../lib/graphql";
import { buildSystemCanvasLayout } from "./system-canvas-layout";
import {
  buildSystemCanvasFocusState,
  buildSystemCanvasFocusViewBox,
  getSystemCanvasNeighborhood
} from "./system-canvas-focus";

const snapshot: SystemCanvasSnapshotRecord = {
  generatedAt: "2026-03-21T12:00:00.000Z",
  focusNodeIds: ["prompt-runner", "worker-job"],
  focusEdgeIds: ["prompt-runner-dispatches-kube"],
  summary: {
    totalNodes: 5,
    totalEdges: 4,
    queuedPromptCount: 1,
    activePromptCount: 1,
    failedPromptCount: 0,
    completedPromptCount: 0,
    activeExecutionCount: 1
  },
  selectedPrompt: null,
  nodes: [
    {
      id: "prompt-composer",
      label: "Prompt composer",
      kind: "surface",
      lane: "browser",
      description: "Compose prompts",
      owner: "smysnk",
      codeRefs: [],
      defaultX: 320,
      defaultY: 120,
      tags: [],
      tone: "idle",
      active: false,
      badge: null,
      metrics: {}
    },
    {
      id: "graphql-api",
      label: "GraphQL API",
      kind: "service",
      lane: "api",
      description: "API",
      owner: "smysnk",
      codeRefs: [],
      defaultX: 880,
      defaultY: 140,
      tags: [],
      tone: "active",
      active: true,
      badge: null,
      metrics: {}
    },
    {
      id: "prompt-runner",
      label: "Prompt runner",
      kind: "service",
      lane: "api",
      description: "Runner",
      owner: "smysnk",
      codeRefs: [],
      defaultX: 880,
      defaultY: 280,
      tags: [],
      tone: "active",
      active: true,
      badge: null,
      metrics: {}
    },
    {
      id: "worker-job",
      label: "Worker job",
      kind: "worker",
      lane: "worker",
      description: "Worker",
      owner: "smysnk",
      codeRefs: [],
      defaultX: 1280,
      defaultY: 120,
      tags: [],
      tone: "active",
      active: true,
      badge: null,
      metrics: {}
    },
    {
      id: "document-store-repo",
      label: "Document-store repo",
      kind: "artifact",
      lane: "document-store",
      description: "Repo",
      owner: "smysnk",
      codeRefs: [],
      defaultX: 1480,
      defaultY: 220,
      tags: [],
      tone: "idle",
      active: false,
      badge: null,
      metrics: {}
    }
  ],
  edges: [
    {
      id: "prompt-composer-uses-apollo",
      sourceId: "prompt-composer",
      targetId: "graphql-api",
      interaction: "mutates",
      description: "submit",
      importance: "primary",
      codeRefs: [],
      active: false,
      badge: null
    },
    {
      id: "graphql-claims-runner",
      sourceId: "graphql-api",
      targetId: "prompt-runner",
      interaction: "claims",
      description: "claim",
      importance: "secondary",
      codeRefs: [],
      active: true,
      badge: null
    },
    {
      id: "prompt-runner-dispatches-kube",
      sourceId: "prompt-runner",
      targetId: "worker-job",
      interaction: "dispatches",
      description: "dispatch",
      importance: "primary",
      codeRefs: [],
      active: true,
      badge: null
    },
    {
      id: "worker-job-touches-repo",
      sourceId: "worker-job",
      targetId: "document-store-repo",
      interaction: "writes",
      description: "writes repo",
      importance: "primary",
      codeRefs: [],
      active: true,
      badge: null
    }
  ]
};

test("getSystemCanvasNeighborhood expands from a selected node by hop count", () => {
  const oneHop = getSystemCanvasNeighborhood(snapshot, "prompt-runner", 1);
  const twoHop = getSystemCanvasNeighborhood(snapshot, "prompt-runner", 2);

  assert.deepEqual(
    new Set(oneHop),
    new Set(["prompt-runner", "graphql-api", "worker-job"])
  );
  assert.deepEqual(
    new Set(twoHop),
    new Set([
      "prompt-runner",
      "graphql-api",
      "worker-job",
      "prompt-composer",
      "document-store-repo"
    ])
  );
});

test("buildSystemCanvasFocusState dims unrelated nodes and hides unrelated edges", () => {
  const focusState = buildSystemCanvasFocusState(snapshot, {
    selectedNodeId: "prompt-runner",
    enabled: true,
    maxDepth: 1
  });

  assert.ok(focusState.focusedNodeIds.has("prompt-runner"));
  assert.ok(focusState.focusedNodeIds.has("graphql-api"));
  assert.ok(focusState.focusedNodeIds.has("worker-job"));
  assert.ok(focusState.dimmedNodeIds.has("prompt-composer"));
  assert.ok(focusState.hiddenEdgeIds.has("prompt-composer-uses-apollo"));
  assert.ok(!focusState.hiddenEdgeIds.has("graphql-claims-runner"));
  assert.ok(!focusState.hiddenEdgeIds.has("prompt-runner-dispatches-kube"));
});

test("buildSystemCanvasFocusViewBox centers the focused subgraph instead of the full canvas", () => {
  const layout = buildSystemCanvasLayout(snapshot);
  const focusState = buildSystemCanvasFocusState(snapshot, {
    selectedNodeId: "worker-job",
    enabled: true,
    maxDepth: 1
  });
  const fullViewBox = buildSystemCanvasFocusViewBox(
    layout,
    new Set(layout.nodes.map((node) => node.id))
  );
  const focusedViewBox = buildSystemCanvasFocusViewBox(layout, focusState.focusedNodeIds);

  assert.deepEqual(fullViewBox, {
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height
  });
  assert.ok(focusedViewBox.width < layout.width);
  assert.ok(focusedViewBox.height < layout.height);
  assert.ok(focusedViewBox.x > 0);
});
