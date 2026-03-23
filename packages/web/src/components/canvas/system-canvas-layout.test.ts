import assert from "node:assert/strict";
import test from "node:test";
import type { SystemCanvasSnapshotRecord } from "../../lib/graphql";
import {
  buildSystemCanvasLayout,
  getSystemCanvasNodeRelations
} from "./system-canvas-layout";

const snapshot: SystemCanvasSnapshotRecord = {
  generatedAt: "2026-03-21T12:00:00.000Z",
  focusNodeIds: ["prompt-runner", "worker-job"],
  focusEdgeIds: ["prompt-runner-dispatches-kube"],
  summary: {
    totalNodes: 4,
    totalEdges: 3,
    queuedPromptCount: 1,
    activePromptCount: 1,
    failedPromptCount: 0,
    completedPromptCount: 0,
    activeExecutionCount: 1
  },
  selectedPrompt: {
    id: "prompt-1",
    status: "writing",
    executionStatus: "running",
    currentStageNodeId: "worker-job",
    branch: "main",
    sha: "abc1234",
    failureStage: null,
    routeNodeIds: ["prompt-composer", "graphql-api", "prompt-runner", "worker-job"],
    routeEdgeIds: ["prompt-composer-uses-apollo", "graphql-claims-runner", "prompt-runner-dispatches-kube"],
    workerAttempt: 1,
    jobName: "schizm-prompt-1",
    podName: "schizm-prompt-1-abc",
    workerNode: "kube-node-a",
    latestGitOperation: "git push -u origin main",
    latestGitOperationAt: "2026-03-21T12:00:10.000Z",
    latestGitOperationRepoRoot: "/tmp/doc-store",
    queueWaitMs: 2400,
    processingMs: 16000,
    totalRuntimeMs: 18400,
    gitOperationsMs: 900,
    agentWorkMs: 12000,
    canvasRearrangeMs: 700,
    gitCommitMs: 350,
    gitPushMs: 550,
    auditSyncMs: 180
  },
  nodes: [
    {
      id: "prompt-composer",
      label: "Prompt composer",
      kind: "surface",
      lane: "browser",
      description: "Compose prompts",
      owner: "smysnk",
      codeRefs: ["/packages/web/src/components/canvas/idea-canvas.tsx"],
      defaultX: 320,
      defaultY: 120,
      tags: ["ui"],
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
      codeRefs: ["/packages/server/src/graphql/resolvers.ts"],
      defaultX: 880,
      defaultY: 140,
      tags: ["api"],
      tone: "active",
      active: true,
      badge: "writing",
      metrics: { runnerSessionId: "runner-1" }
    },
    {
      id: "prompt-runner",
      label: "Prompt runner",
      kind: "service",
      lane: "api",
      description: "Runner",
      owner: "smysnk",
      codeRefs: ["/packages/server/src/services/prompt-runner.ts"],
      defaultX: 880,
      defaultY: 280,
      tags: ["runner"],
      tone: "active",
      active: true,
      badge: "writing",
      metrics: { activePromptId: "prompt-1" }
    },
    {
      id: "worker-job",
      label: "Worker job",
      kind: "worker",
      lane: "worker",
      description: "Job",
      owner: "smysnk",
      codeRefs: ["/packages/server/src/worker/index.ts"],
      defaultX: 1280,
      defaultY: 120,
      tags: ["worker"],
      tone: "active",
      active: true,
      badge: "schizm-prompt-1",
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
      badge: "running"
    }
  ]
};

test("buildSystemCanvasLayout produces a stable lane-based layout with routed edges", () => {
  const layout = buildSystemCanvasLayout(snapshot);

  assert.equal(layout.nodes.length, 4);
  assert.equal(layout.edges.length, 3);
  assert.ok(layout.width >= 1720);
  assert.ok(layout.height >= 760);
  assert.equal(layout.lanes[0]?.id, "user");
  assert.equal(layout.lanes[1]?.id, "browser");
  assert.equal(layout.lanes[3]?.label, "API / Control plane");

  const workerNode = layout.nodes.find((node) => node.id === "worker-job");
  const dispatchEdge = layout.edges.find((edge) => edge.id === "prompt-runner-dispatches-kube");

  assert.equal(workerNode?.x, 1280);
  assert.ok(dispatchEdge?.path.startsWith("M "));
  assert.ok(typeof dispatchEdge?.labelX === "number");
  assert.ok(typeof dispatchEdge?.labelY === "number");
});

test("getSystemCanvasNodeRelations groups inbound and outbound interactions for a selected node", () => {
  const relations = getSystemCanvasNodeRelations(snapshot, "prompt-runner");

  assert.equal(relations.incoming.length, 1);
  assert.equal(relations.outgoing.length, 1);
  assert.equal(relations.incoming[0]?.node?.id, "graphql-api");
  assert.equal(relations.outgoing[0]?.node?.id, "worker-job");
});
