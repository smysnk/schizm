import assert from "node:assert/strict";
import test from "node:test";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import type { Prompt } from "../repositories/prompt-repository";
import type { PromptExecution } from "../repositories/prompt-execution-repository";
import { createResolvers } from "./resolvers";
import { typeDefs } from "./schema";

const createPrompt = (
  overrides: Partial<Prompt> & Pick<Prompt, "id" | "content" | "status">
): Prompt => ({
  id: overrides.id,
  content: overrides.content,
  status: overrides.status,
  metadata: overrides.metadata || {},
  audit: overrides.audit || {},
  startedAt: overrides.startedAt || null,
  finishedAt: overrides.finishedAt || null,
  errorMessage: overrides.errorMessage || null,
  createdAt: overrides.createdAt || "2026-03-21T00:00:00.000Z",
  updatedAt: overrides.updatedAt || "2026-03-21T00:00:00.000Z"
});

const createExecution = (
  overrides: Partial<PromptExecution> &
    Pick<PromptExecution, "id" | "promptId" | "attempt" | "status" | "executionMode">
): PromptExecution => ({
  id: overrides.id,
  promptId: overrides.promptId,
  attempt: overrides.attempt,
  status: overrides.status,
  executionMode: overrides.executionMode,
  jobName: overrides.jobName || null,
  podName: overrides.podName || null,
  namespace: overrides.namespace || null,
  image: overrides.image || null,
  workerNode: overrides.workerNode || null,
  startedAt: overrides.startedAt || null,
  finishedAt: overrides.finishedAt || null,
  exitCode: overrides.exitCode || null,
  errorMessage: overrides.errorMessage || null,
  metadata: overrides.metadata || {},
  createdAt: overrides.createdAt || "2026-03-21T00:00:00.000Z",
  updatedAt: overrides.updatedAt || "2026-03-21T00:00:00.000Z"
});

test("systemCanvas GraphQL query returns the runtime-enriched snapshot", async () => {
  const selectedPrompt = createPrompt({
    id: "prompt-1",
    content: "Trace the live prompt path.",
    status: "writing",
    metadata: {
      git: {
        branch: "main",
        sha: "abc1234"
      }
    },
    createdAt: "2026-03-21T12:00:00.000Z"
  });
  const queuedPrompt = createPrompt({
    id: "prompt-2",
    content: "Queued follow-up prompt",
    status: "queued",
    createdAt: "2026-03-21T11:59:00.000Z"
  });
  const execution = createExecution({
    id: "execution-1",
    promptId: "prompt-1",
    attempt: 1,
    status: "running",
    executionMode: "kube-worker",
    jobName: "schizm-prompt-1",
    podName: "schizm-prompt-1-abc"
  });

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: createResolvers({
      listPrompts: async () => [selectedPrompt, queuedPrompt],
      getPrompt: async (id) => (id === selectedPrompt.id ? selectedPrompt : null),
      listPromptExecutions: async (promptId) =>
        promptId === selectedPrompt.id ? [execution] : [],
      getPromptRunnerState: () => ({
        paused: false,
        inFlight: true,
        activePromptId: selectedPrompt.id,
        activePromptStatus: selectedPrompt.status,
        pollMs: 5000,
        automationBranch: "codex/mindmap",
        worktreeRoot: ".codex-workdirs",
        runnerSessionId: "runner-graphql"
      })
    })
  });

  const result = await graphql({
    schema,
    source: `
      query SystemCanvasSnapshot($selectedPromptId: ID) {
        systemCanvas(selectedPromptId: $selectedPromptId) {
          generatedAt
          focusNodeIds
          focusEdgeIds
          summary {
            queuedPromptCount
            activePromptCount
            activeExecutionCount
          }
          selectedPrompt {
            id
            status
            executionStatus
            currentStageNodeId
            branch
            sha
            jobName
            podName
            routeNodeIds
          }
          nodes {
            id
            tone
            active
            badge
            metrics
          }
          edges {
            id
            active
            badge
          }
        }
      }
    `,
    variableValues: {
      selectedPromptId: selectedPrompt.id
    }
  });

  assert.equal(result.errors, undefined);

  const systemCanvas = (result.data as { systemCanvas: any }).systemCanvas;
  const promptRunner = systemCanvas.nodes.find((node: any) => node.id === "prompt-runner");
  const workerJob = systemCanvas.nodes.find((node: any) => node.id === "worker-job");
  const dispatchEdge = systemCanvas.edges.find(
    (edge: any) => edge.id === "prompt-runner-dispatches-kube"
  );

  assert.equal(systemCanvas.summary.queuedPromptCount, 1);
  assert.equal(systemCanvas.summary.activePromptCount, 1);
  assert.equal(systemCanvas.summary.activeExecutionCount, 1);
  assert.equal(systemCanvas.selectedPrompt.id, selectedPrompt.id);
  assert.equal(systemCanvas.selectedPrompt.executionStatus, "running");
  assert.equal(systemCanvas.selectedPrompt.currentStageNodeId, "codex-executor");
  assert.equal(systemCanvas.selectedPrompt.branch, "main");
  assert.equal(systemCanvas.selectedPrompt.sha, "abc1234");
  assert.equal(systemCanvas.selectedPrompt.jobName, "schizm-prompt-1");
  assert.equal(systemCanvas.selectedPrompt.podName, "schizm-prompt-1-abc");
  assert.ok(systemCanvas.selectedPrompt.routeNodeIds.includes("codex-executor"));
  assert.equal(promptRunner.tone, "active");
  assert.equal(workerJob.badge, "schizm-prompt-1");
  assert.equal(dispatchEdge.active, true);
  assert.ok(systemCanvas.focusNodeIds.includes("worker-job"));
});
