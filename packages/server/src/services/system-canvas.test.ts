import assert from "node:assert/strict";
import test from "node:test";
import type { Prompt } from "../repositories/prompt-repository";
import type { PromptExecution } from "../repositories/prompt-execution-repository";
import { buildSystemCanvasSnapshot } from "./system-canvas";

const createPrompt = (overrides: Partial<Prompt> & Pick<Prompt, "id" | "content" | "status">): Prompt => ({
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

test("buildSystemCanvasSnapshot emits the curated system topology with stable metadata", () => {
  const snapshot = buildSystemCanvasSnapshot({
    generatedAt: "2026-03-21T12:00:00.000Z"
  });

  assert.equal(snapshot.generatedAt, "2026-03-21T12:00:00.000Z");
  assert.equal(snapshot.summary.totalNodes, snapshot.nodes.length);
  assert.equal(snapshot.summary.totalEdges, snapshot.edges.length);
  assert.equal(snapshot.summary.queuedPromptCount, 0);
  assert.equal(snapshot.summary.activeExecutionCount, 0);
  assert.equal(snapshot.selectedPrompt, null);
  assert.ok(snapshot.nodes.length >= 20);
  assert.ok(snapshot.edges.length >= 20);

  const promptRunner = snapshot.nodes.find((node) => node.id === "prompt-runner");
  const documentStore = snapshot.nodes.find((node) => node.id === "document-store-repo");
  const dispatchEdge = snapshot.edges.find((edge) => edge.id === "prompt-runner-dispatches-kube");

  assert.equal(promptRunner?.lane, "api");
  assert.equal(promptRunner?.kind, "service");
  assert.ok(promptRunner?.codeRefs.includes("/packages/server/src/services/prompt-runner.ts"));
  assert.equal(documentStore?.lane, "document-store");
  assert.equal(dispatchEdge?.interaction, "dispatches");
  assert.equal(dispatchEdge?.active, false);
});

test("buildSystemCanvasSnapshot enriches the topology with active prompt and worker runtime state", () => {
  const prompt = createPrompt({
    id: "prompt-1",
    content: "Sort out these connected notes.",
    status: "writing",
    metadata: {
      git: {
        branch: "main",
        sha: "abc123456789"
      },
      runner: {
        gitOperations: [
          {
            at: "2026-03-21T12:00:18.000Z",
            repoRoot: "/tmp/doc-store",
            command: "git push -u origin main"
          }
        ]
      }
    },
    audit: {
      timing: {
        queueWaitMs: 4000,
        processingMs: 16000
      },
      performance: {
        totalRuntimeMs: 20000,
        gitOperationsMs: 1800,
        agentWorkMs: 12000,
        canvasRearrangeMs: 900,
        gitCommitMs: 600,
        gitPushMs: 700,
        steps: {
          auditSyncMs: 300
        }
      }
    },
    startedAt: "2026-03-21T12:00:10.000Z",
    updatedAt: "2026-03-21T12:00:20.000Z"
  });
  const queuedPrompt = createPrompt({
    id: "prompt-2",
    content: "Queued prompt",
    status: "queued",
    updatedAt: "2026-03-21T12:00:05.000Z"
  });
  const execution = createExecution({
    id: "execution-1",
    promptId: "prompt-1",
    attempt: 1,
    status: "running",
    executionMode: "kube-worker",
    jobName: "schizm-prompt-prompt1-1",
    podName: "schizm-prompt-prompt1-1-xyz",
    workerNode: "worker-a"
  });

  const snapshot = buildSystemCanvasSnapshot({
    prompts: [prompt, queuedPrompt],
    promptExecutions: [execution],
    selectedPromptId: "prompt-1",
    promptRunnerState: {
      paused: false,
      inFlight: true,
      activePromptId: "prompt-1",
      activePromptStatus: "writing",
      pollMs: 5000,
      automationBranch: "codex/mindmap",
      worktreeRoot: ".codex-workdirs",
      runnerSessionId: "runner-1"
    }
  });

  assert.equal(snapshot.summary.queuedPromptCount, 1);
  assert.equal(snapshot.summary.activePromptCount, 1);
  assert.equal(snapshot.summary.activeExecutionCount, 1);
  assert.equal(snapshot.selectedPrompt?.status, "writing");
  assert.equal(snapshot.selectedPrompt?.executionStatus, "running");
  assert.equal(snapshot.selectedPrompt?.currentStageNodeId, "codex-executor");
  assert.equal(snapshot.selectedPrompt?.jobName, "schizm-prompt-prompt1-1");
  assert.equal(snapshot.selectedPrompt?.podName, "schizm-prompt-prompt1-1-xyz");
  assert.equal(snapshot.selectedPrompt?.latestGitOperation, "git push -u origin main");
  assert.equal(snapshot.selectedPrompt?.queueWaitMs, 4000);
  assert.equal(snapshot.selectedPrompt?.processingMs, 16000);
  assert.equal(snapshot.selectedPrompt?.gitPushMs, 700);

  const promptRunner = snapshot.nodes.find((node) => node.id === "prompt-runner");
  const workerJob = snapshot.nodes.find((node) => node.id === "worker-job");
  const codex = snapshot.nodes.find((node) => node.id === "codex-executor");
  const auditLog = snapshot.nodes.find((node) => node.id === "audit-log-artifact");
  const dispatchEdge = snapshot.edges.find((edge) => edge.id === "prompt-runner-dispatches-kube");

  assert.equal(promptRunner?.tone, "active");
  assert.equal(promptRunner?.badge, "writing");
  assert.equal(workerJob?.tone, "active");
  assert.equal(workerJob?.badge, "schizm-prompt-prompt1-1");
  assert.equal(codex?.tone, "active");
  assert.equal(codex?.badge, "writing");
  assert.equal(auditLog?.metrics.queueWaitMs, 4000);
  assert.equal(dispatchEdge?.active, true);
  assert.ok(snapshot.focusNodeIds.includes("prompt-runner"));
  assert.ok(snapshot.focusNodeIds.includes("worker-job"));
});

test("buildSystemCanvasSnapshot marks failure paths and paused runner state", () => {
  const failedPrompt = createPrompt({
    id: "prompt-failed",
    content: "Try the failed path",
    status: "failed",
    metadata: {
      failure: {
        stage: "bootstrapping"
      },
      git: {
        branch: "main",
        sha: "deadbeefcafebabe"
      }
    },
    errorMessage: "Worker bootstrap failed.",
    updatedAt: "2026-03-21T13:00:00.000Z"
  });
  const failedExecution = createExecution({
    id: "execution-failed",
    promptId: "prompt-failed",
    attempt: 2,
    status: "failed",
    executionMode: "kube-worker",
    jobName: "schizm-prompt-failed-2",
    errorMessage: "Bootstrap error"
  });

  const snapshot = buildSystemCanvasSnapshot({
    prompts: [failedPrompt],
    promptExecutions: [failedExecution],
    selectedPromptId: "prompt-failed",
    promptRunnerState: {
      paused: true,
      inFlight: false,
      activePromptId: null,
      activePromptStatus: null,
      pollMs: 5000,
      automationBranch: "codex/mindmap",
      worktreeRoot: ".codex-workdirs",
      runnerSessionId: "runner-2"
    }
  });

  assert.equal(snapshot.summary.failedPromptCount, 1);
  assert.equal(snapshot.selectedPrompt?.failureStage, "bootstrapping");

  const promptRunner = snapshot.nodes.find((node) => node.id === "prompt-runner");
  const workerJob = snapshot.nodes.find((node) => node.id === "worker-job");
  const workerBootstrap = snapshot.nodes.find((node) => node.id === "worker-bootstrap");

  assert.equal(promptRunner?.tone, "warning");
  assert.equal(promptRunner?.badge, "bootstrapping");
  assert.equal(workerJob?.tone, "error");
  assert.equal(workerJob?.badge, "bootstrapping");
  assert.equal(workerBootstrap?.tone, "error");
  assert.ok(snapshot.focusEdgeIds.includes("kube-dispatcher-launches-worker-job"));
});
