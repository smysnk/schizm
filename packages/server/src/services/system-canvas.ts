import {
  activePromptStatuses,
  type Prompt,
  type PromptStatus
} from "../repositories/prompt-repository";
import type {
  PromptExecution,
  PromptExecutionStatus
} from "../repositories/prompt-execution-repository";
import type { PromptRunnerStateSnapshot } from "./prompt-runner";
import {
  systemCanvasTopologyEdges,
  systemCanvasTopologyNodes,
  type SystemCanvasInteractionKind,
  type SystemCanvasLane,
  type SystemCanvasNodeKind
} from "./system-canvas.manifest";

export type SystemCanvasNodeRuntimeTone = "idle" | "active" | "warning" | "error";

export type SystemCanvasNode = {
  id: string;
  label: string;
  kind: SystemCanvasNodeKind;
  lane: SystemCanvasLane;
  description: string;
  owner: string;
  codeRefs: string[];
  defaultX: number;
  defaultY: number;
  tags: string[];
  tone: SystemCanvasNodeRuntimeTone;
  active: boolean;
  badge: string | null;
  metrics: Record<string, string | number | boolean | null>;
};

export type SystemCanvasEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  interaction: SystemCanvasInteractionKind;
  description: string;
  importance: "primary" | "secondary";
  codeRefs: string[];
  active: boolean;
  badge: string | null;
};

export type SystemCanvasSummary = {
  totalNodes: number;
  totalEdges: number;
  queuedPromptCount: number;
  activePromptCount: number;
  failedPromptCount: number;
  completedPromptCount: number;
  activeExecutionCount: number;
};

export type SystemCanvasSelectedPromptSummary = {
  id: string;
  status: PromptStatus;
  executionStatus: PromptExecutionStatus | null;
  currentStageNodeId: string | null;
  branch: string | null;
  sha: string | null;
  failureStage: string | null;
  routeNodeIds: string[];
  routeEdgeIds: string[];
  workerAttempt: number | null;
  jobName: string | null;
  podName: string | null;
  workerNode: string | null;
  latestGitOperation: string | null;
  latestGitOperationAt: string | null;
  latestGitOperationRepoRoot: string | null;
  queueWaitMs: number | null;
  processingMs: number | null;
  totalRuntimeMs: number | null;
  gitOperationsMs: number | null;
  agentWorkMs: number | null;
  canvasRearrangeMs: number | null;
  gitCommitMs: number | null;
  gitPushMs: number | null;
  auditSyncMs: number | null;
};

export type SystemCanvasSnapshot = {
  generatedAt: string;
  nodes: SystemCanvasNode[];
  edges: SystemCanvasEdge[];
  focusNodeIds: string[];
  focusEdgeIds: string[];
  summary: SystemCanvasSummary;
  selectedPrompt: SystemCanvasSelectedPromptSummary | null;
};

type BuildSystemCanvasSnapshotOptions = {
  prompts?: Prompt[];
  promptExecutions?: PromptExecution[];
  promptRunnerState?: PromptRunnerStateSnapshot | null;
  selectedPromptId?: string | null;
  generatedAt?: string;
};

const activeExecutionStatuses = new Set<PromptExecutionStatus>([
  "dispatched",
  "bootstrapping",
  "running",
  "publishing"
]);

const promptStageToRouteNodeIds: Record<PromptStatus, string[]> = {
  queued: [
    "user",
    "prompt-composer",
    "apollo-client",
    "graphql-api",
    "prompt-repository",
    "postgres",
    "prompt-runner"
  ],
  cancelled: [
    "prompt-history",
    "apollo-client",
    "graphql-api",
    "prompt-repository",
    "postgres"
  ],
  scanning: [
    "prompt-terminal",
    "apollo-client",
    "websocket-transport",
    "graphql-api",
    "prompt-repository",
    "prompt-execution-repository",
    "postgres",
    "prompt-runner",
    "kube-dispatcher",
    "worker-job",
    "worker-bootstrap",
    "codex-executor",
    "document-store-repo"
  ],
  deciding: [
    "prompt-terminal",
    "apollo-client",
    "websocket-transport",
    "graphql-api",
    "prompt-repository",
    "prompt-execution-repository",
    "postgres",
    "prompt-runner",
    "kube-dispatcher",
    "worker-job",
    "worker-bootstrap",
    "codex-executor",
    "document-store-repo"
  ],
  writing: [
    "prompt-terminal",
    "apollo-client",
    "websocket-transport",
    "graphql-api",
    "prompt-repository",
    "prompt-execution-repository",
    "postgres",
    "prompt-runner",
    "kube-dispatcher",
    "worker-job",
    "worker-bootstrap",
    "codex-executor",
    "document-store-repo"
  ],
  updating_canvas: [
    "prompt-terminal",
    "apollo-client",
    "websocket-transport",
    "graphql-api",
    "prompt-repository",
    "prompt-execution-repository",
    "postgres",
    "prompt-runner",
    "kube-dispatcher",
    "worker-job",
    "worker-bootstrap",
    "codex-executor",
    "canvas-rearrange",
    "document-store-repo",
    "main-canvas-artifact"
  ],
  auditing: [
    "prompt-terminal",
    "apollo-client",
    "websocket-transport",
    "graphql-api",
    "prompt-repository",
    "prompt-execution-repository",
    "postgres",
    "prompt-runner",
    "kube-dispatcher",
    "worker-job",
    "worker-bootstrap",
    "codex-executor",
    "publisher-phase",
    "document-store-repo",
    "audit-log-artifact"
  ],
  committing: [
    "prompt-terminal",
    "apollo-client",
    "websocket-transport",
    "graphql-api",
    "prompt-repository",
    "prompt-execution-repository",
    "postgres",
    "prompt-runner",
    "kube-dispatcher",
    "worker-job",
    "publisher-phase",
    "document-store-repo"
  ],
  pushing: [
    "prompt-terminal",
    "apollo-client",
    "websocket-transport",
    "graphql-api",
    "prompt-repository",
    "prompt-execution-repository",
    "postgres",
    "prompt-runner",
    "kube-dispatcher",
    "worker-job",
    "publisher-phase",
    "document-store-repo",
    "git-remote"
  ],
  syncing_audit: [
    "prompt-terminal",
    "apollo-client",
    "websocket-transport",
    "graphql-api",
    "prompt-repository",
    "prompt-execution-repository",
    "postgres",
    "prompt-runner",
    "kube-dispatcher",
    "worker-job",
    "publisher-phase",
    "audit-log-artifact"
  ],
  completed: [
    "prompt-history",
    "prompt-terminal",
    "canvas-graph-view",
    "system-canvas-view",
    "apollo-client",
    "websocket-transport",
    "graphql-api",
    "prompt-repository",
    "prompt-execution-repository",
    "postgres",
    "prompt-runner",
    "kube-dispatcher",
    "worker-job",
    "publisher-phase",
    "document-store-repo",
    "main-canvas-artifact",
    "audit-log-artifact",
    "git-remote"
  ],
  failed: [
    "prompt-history",
    "prompt-terminal",
    "apollo-client",
    "websocket-transport",
    "graphql-api",
    "prompt-repository",
    "prompt-execution-repository",
    "postgres",
    "prompt-runner",
    "kube-dispatcher",
    "worker-job"
  ]
};

const promptStageToRouteEdgeIds: Record<PromptStatus, string[]> = {
  queued: [
    "user-submits-prompt",
    "prompt-composer-uses-apollo",
    "apollo-mutates-graphql",
    "graphql-uses-prompt-repository",
    "prompt-repository-persists-postgres",
    "prompt-runner-claims-prompts"
  ],
  cancelled: [
    "prompt-history-queries-apollo",
    "apollo-mutates-graphql",
    "graphql-uses-prompt-repository",
    "prompt-repository-persists-postgres"
  ],
  scanning: [
    "apollo-subscribes-websocket",
    "websocket-connects-graphql",
    "graphql-publishes-terminal",
    "graphql-uses-prompt-repository",
    "graphql-uses-prompt-execution-repository",
    "prompt-repository-persists-postgres",
    "prompt-execution-repository-persists-postgres",
    "prompt-runner-claims-prompts",
    "prompt-runner-dispatches-kube",
    "kube-dispatcher-tracks-executions",
    "kube-dispatcher-launches-worker-job",
    "worker-job-bootstraps-worker",
    "worker-bootstrap-prepares-document-store",
    "worker-bootstrap-starts-codex",
    "codex-writes-document-store"
  ],
  deciding: [
    "apollo-subscribes-websocket",
    "websocket-connects-graphql",
    "graphql-publishes-terminal",
    "graphql-uses-prompt-repository",
    "graphql-uses-prompt-execution-repository",
    "prompt-repository-persists-postgres",
    "prompt-execution-repository-persists-postgres",
    "prompt-runner-claims-prompts",
    "prompt-runner-dispatches-kube",
    "kube-dispatcher-tracks-executions",
    "kube-dispatcher-launches-worker-job",
    "worker-job-bootstraps-worker",
    "worker-bootstrap-prepares-document-store",
    "worker-bootstrap-starts-codex",
    "codex-writes-document-store"
  ],
  writing: [
    "apollo-subscribes-websocket",
    "websocket-connects-graphql",
    "graphql-publishes-terminal",
    "graphql-uses-prompt-repository",
    "graphql-uses-prompt-execution-repository",
    "prompt-repository-persists-postgres",
    "prompt-execution-repository-persists-postgres",
    "prompt-runner-claims-prompts",
    "prompt-runner-dispatches-kube",
    "kube-dispatcher-tracks-executions",
    "kube-dispatcher-launches-worker-job",
    "worker-job-bootstraps-worker",
    "worker-bootstrap-prepares-document-store",
    "worker-bootstrap-starts-codex",
    "codex-writes-document-store"
  ],
  updating_canvas: [
    "apollo-subscribes-websocket",
    "websocket-connects-graphql",
    "graphql-publishes-terminal",
    "graphql-uses-prompt-repository",
    "graphql-uses-prompt-execution-repository",
    "prompt-repository-persists-postgres",
    "prompt-execution-repository-persists-postgres",
    "prompt-runner-claims-prompts",
    "prompt-runner-dispatches-kube",
    "kube-dispatcher-tracks-executions",
    "kube-dispatcher-launches-worker-job",
    "worker-job-bootstraps-worker",
    "worker-bootstrap-prepares-document-store",
    "worker-bootstrap-starts-codex",
    "codex-writes-document-store",
    "codex-writes-main-canvas",
    "canvas-rearrange-updates-main-canvas"
  ],
  auditing: [
    "apollo-subscribes-websocket",
    "websocket-connects-graphql",
    "graphql-publishes-terminal",
    "graphql-uses-prompt-repository",
    "graphql-uses-prompt-execution-repository",
    "prompt-repository-persists-postgres",
    "prompt-execution-repository-persists-postgres",
    "prompt-runner-claims-prompts",
    "prompt-runner-dispatches-kube",
    "kube-dispatcher-tracks-executions",
    "kube-dispatcher-launches-worker-job",
    "worker-job-bootstraps-worker",
    "worker-bootstrap-prepares-document-store",
    "worker-bootstrap-starts-codex",
    "codex-writes-document-store",
    "codex-writes-audit-log"
  ],
  committing: [
    "apollo-subscribes-websocket",
    "websocket-connects-graphql",
    "graphql-publishes-terminal",
    "prompt-runner-dispatches-kube",
    "kube-dispatcher-tracks-executions",
    "kube-dispatcher-launches-worker-job",
    "publisher-commits-document-store"
  ],
  pushing: [
    "apollo-subscribes-websocket",
    "websocket-connects-graphql",
    "graphql-publishes-terminal",
    "prompt-runner-dispatches-kube",
    "kube-dispatcher-tracks-executions",
    "kube-dispatcher-launches-worker-job",
    "publisher-commits-document-store",
    "publisher-pushes-remote"
  ],
  syncing_audit: [
    "apollo-subscribes-websocket",
    "websocket-connects-graphql",
    "graphql-publishes-terminal",
    "publisher-syncs-prompt-metadata",
    "prompt-repository-persists-postgres"
  ],
  completed: [
    "apollo-subscribes-websocket",
    "websocket-connects-graphql",
    "graphql-publishes-terminal",
    "graphql-publishes-history",
    "graphql-publishes-canvas-graph",
    "graphql-publishes-system-canvas",
    "publisher-commits-document-store",
    "publisher-pushes-remote",
    "publisher-syncs-prompt-metadata"
  ],
  failed: [
    "apollo-subscribes-websocket",
    "websocket-connects-graphql",
    "graphql-publishes-terminal",
    "graphql-publishes-history",
    "graphql-uses-prompt-repository",
    "graphql-uses-prompt-execution-repository",
    "prompt-runner-dispatches-kube",
    "kube-dispatcher-tracks-executions",
    "kube-dispatcher-launches-worker-job"
  ]
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readString = (value: unknown) =>
  typeof value === "string" && value.trim().length ? value.trim() : null;

const readNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const pickSelectedPrompt = (prompts: Prompt[], selectedPromptId?: string | null) => {
  if (!prompts.length) {
    return null;
  }

  if (selectedPromptId) {
    const selected = prompts.find((prompt) => prompt.id === selectedPromptId);

    if (selected) {
      return selected;
    }
  }

  const sorted = [...prompts].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  );

  return (
    sorted.find((prompt) => activePromptStatuses.includes(prompt.status)) ||
    sorted[0] ||
    null
  );
};

const getLatestExecutionForPrompt = (promptExecutions: PromptExecution[], promptId: string) =>
  [...promptExecutions]
    .filter((execution) => execution.promptId === promptId)
    .sort((left, right) => right.attempt - left.attempt)[0] || null;

const getPromptGitSummary = (prompt: Prompt | null) => {
  if (!prompt || !isRecord(prompt.metadata.git)) {
    return {
      branch: null,
      sha: null
    };
  }

  const git = prompt.metadata.git as Record<string, unknown>;

  return {
    branch: readString(git.branch),
    sha: readString(git.sha)
  };
};

const getPromptFailureStage = (prompt: Prompt | null) => {
  if (!prompt || !isRecord(prompt.metadata.failure)) {
    return null;
  }

  return readString((prompt.metadata.failure as Record<string, unknown>).stage);
};

const getLatestGitOperation = (prompt: Prompt | null) => {
  if (!prompt || !isRecord(prompt.metadata.runner)) {
    return {
      command: null,
      at: null,
      repoRoot: null
    };
  }

  const operations = Array.isArray((prompt.metadata.runner as Record<string, unknown>).gitOperations)
    ? ((prompt.metadata.runner as Record<string, unknown>).gitOperations as unknown[])
    : [];
  const latestOperationRecord = [...operations]
    .reverse()
    .find((entry) => isRecord(entry) && readString(entry.command));

  if (!latestOperationRecord || !isRecord(latestOperationRecord)) {
    return {
      command: null,
      at: null,
      repoRoot: null
    };
  }

  return {
    command: readString(latestOperationRecord.command),
    at: readString(latestOperationRecord.at),
    repoRoot: readString(latestOperationRecord.repoRoot)
  };
};

const getPromptTimingTelemetry = (prompt: Prompt | null) => {
  const audit = prompt && isRecord(prompt.audit) ? prompt.audit : null;
  const auditTiming = audit && isRecord(audit.timing) ? (audit.timing as Record<string, unknown>) : null;
  const auditPerformance =
    audit && isRecord(audit.performance) ? (audit.performance as Record<string, unknown>) : null;
  const runner =
    prompt && isRecord(prompt.metadata.runner) ? (prompt.metadata.runner as Record<string, unknown>) : null;
  const runnerAuditTiming =
    runner && isRecord(runner.auditTiming) ? (runner.auditTiming as Record<string, unknown>) : null;
  const runnerPerformance =
    runner && isRecord(runner.profiling) ? (runner.profiling as Record<string, unknown>) : null;
  const steps =
    auditPerformance && isRecord(auditPerformance.steps)
      ? (auditPerformance.steps as Record<string, unknown>)
      : runnerPerformance && isRecord(runnerPerformance.steps)
        ? (runnerPerformance.steps as Record<string, unknown>)
        : null;

  return {
    queueWaitMs:
      readNumber(auditTiming?.queueWaitMs) ?? readNumber(runnerAuditTiming?.timing?.queueWaitMs),
    processingMs:
      readNumber(auditTiming?.processingMs) ?? readNumber(runnerAuditTiming?.timing?.processingMs),
    totalRuntimeMs: readNumber(auditPerformance?.totalRuntimeMs) ?? readNumber(runnerPerformance?.totalRuntimeMs),
    gitOperationsMs:
      readNumber(auditPerformance?.gitOperationsMs) ?? readNumber(runnerPerformance?.gitOperationsMs),
    agentWorkMs: readNumber(auditPerformance?.agentWorkMs) ?? readNumber(runnerPerformance?.agentWorkMs),
    canvasRearrangeMs:
      readNumber(auditPerformance?.canvasRearrangeMs) ?? readNumber(runnerPerformance?.canvasRearrangeMs),
    gitCommitMs: readNumber(auditPerformance?.gitCommitMs) ?? readNumber(runnerPerformance?.gitCommitMs),
    gitPushMs: readNumber(auditPerformance?.gitPushMs) ?? readNumber(runnerPerformance?.gitPushMs),
    auditSyncMs: readNumber(steps?.auditSyncMs)
  };
};

const promptStatusToCurrentStageNodeId: Record<PromptStatus, string> = {
  queued: "prompt-runner",
  cancelled: "prompt-history",
  scanning: "worker-bootstrap",
  deciding: "codex-executor",
  writing: "codex-executor",
  updating_canvas: "canvas-rearrange",
  auditing: "audit-log-artifact",
  committing: "publisher-phase",
  pushing: "git-remote",
  syncing_audit: "prompt-repository",
  completed: "prompt-history",
  failed: "worker-job"
};

const failureStageToNodeId: Partial<Record<string, string>> = {
  bootstrapping: "worker-bootstrap",
  scanning: "codex-executor",
  deciding: "codex-executor",
  writing: "codex-executor",
  updating_canvas: "canvas-rearrange",
  auditing: "audit-log-artifact",
  committing: "publisher-phase",
  pushing: "git-remote",
  syncing_audit: "prompt-repository"
};

const getCurrentStageNodeId = (prompt: Prompt, failureStage: string | null) => {
  if (prompt.status === "failed" && failureStage) {
    return failureStageToNodeId[failureStage] || "worker-job";
  }

  return promptStatusToCurrentStageNodeId[prompt.status] || null;
};

const addBadge = (
  nodeMap: Map<string, SystemCanvasNode>,
  nodeId: string,
  patch: Partial<Pick<SystemCanvasNode, "tone" | "active" | "badge">> & {
    metrics?: Record<string, string | number | boolean | null>;
  }
) => {
  const current = nodeMap.get(nodeId);

  if (!current) {
    return;
  }

  nodeMap.set(nodeId, {
    ...current,
    tone: patch.tone || current.tone,
    active: patch.active ?? current.active,
    badge: patch.badge ?? current.badge,
    metrics: patch.metrics ? { ...current.metrics, ...patch.metrics } : current.metrics
  });
};

const activateRoute = (
  edgeMap: Map<string, SystemCanvasEdge>,
  nodeMap: Map<string, SystemCanvasNode>,
  routeNodeIds: string[],
  routeEdgeIds: string[]
) => {
  for (const nodeId of routeNodeIds) {
    addBadge(nodeMap, nodeId, { tone: "active", active: true });
  }

  for (const edgeId of routeEdgeIds) {
    const edge = edgeMap.get(edgeId);

    if (!edge) {
      continue;
    }

    edgeMap.set(edgeId, {
      ...edge,
      active: true
    });
  }
};

export const buildSystemCanvasSnapshot = ({
  prompts = [],
  promptExecutions = [],
  promptRunnerState = null,
  selectedPromptId = null,
  generatedAt = new Date().toISOString()
}: BuildSystemCanvasSnapshotOptions = {}): SystemCanvasSnapshot => {
  const queuedPromptCount = prompts.filter((prompt) => prompt.status === "queued").length;
  const activePromptCount = prompts.filter((prompt) =>
    activePromptStatuses.includes(prompt.status)
  ).length;
  const failedPromptCount = prompts.filter((prompt) => prompt.status === "failed").length;
  const completedPromptCount = prompts.filter((prompt) => prompt.status === "completed").length;
  const activeExecutionCount = promptExecutions.filter((execution) =>
    activeExecutionStatuses.has(execution.status)
  ).length;

  const nodeMap = new Map(
    systemCanvasTopologyNodes.map((node) => [
      node.id,
      {
        ...node,
        tone: "idle" as const,
        active: false,
        badge: null,
        metrics: {}
      }
    ])
  );

  const edgeMap = new Map(
    systemCanvasTopologyEdges.map((edge) => [
      edge.id,
      {
        ...edge,
        active: false,
        badge: null
      }
    ])
  );

  const selectedPrompt = pickSelectedPrompt(prompts, selectedPromptId);
  const selectedExecution = selectedPrompt
    ? getLatestExecutionForPrompt(promptExecutions, selectedPrompt.id)
    : null;
  const promptGit = getPromptGitSummary(selectedPrompt);
  const failureStage = getPromptFailureStage(selectedPrompt);
  const latestGitOperation = getLatestGitOperation(selectedPrompt);
  const timingTelemetry = getPromptTimingTelemetry(selectedPrompt);

  addBadge(nodeMap, "prompt-history", {
    badge: prompts.length ? `${prompts.length} prompt${prompts.length === 1 ? "" : "s"}` : null,
    metrics: {
      prompts: prompts.length,
      queued: queuedPromptCount,
      failed: failedPromptCount
    }
  });
  addBadge(nodeMap, "prompt-repository", {
    badge: prompts.length ? `${prompts.length} stored` : null,
    metrics: {
      prompts: prompts.length,
      queued: queuedPromptCount,
      active: activePromptCount,
      completed: completedPromptCount
    }
  });
  addBadge(nodeMap, "prompt-execution-repository", {
    badge: promptExecutions.length
      ? `${promptExecutions.length} attempt${promptExecutions.length === 1 ? "" : "s"}`
      : null,
    metrics: {
      executions: promptExecutions.length,
      activeExecutions: activeExecutionCount
    }
  });
  addBadge(nodeMap, "postgres", {
    badge: prompts.length || promptExecutions.length ? "live state" : "ready",
    metrics: {
      prompts: prompts.length,
      promptExecutions: promptExecutions.length
    }
  });

  if (promptRunnerState?.paused) {
    addBadge(nodeMap, "prompt-runner", {
      tone: "warning",
      active: false,
      badge: "paused",
      metrics: {
        inFlight: promptRunnerState.inFlight,
        activePromptId: promptRunnerState.activePromptId
      }
    });
  } else if (promptRunnerState?.inFlight || queuedPromptCount > 0) {
    addBadge(nodeMap, "prompt-runner", {
      tone: "active",
      active: true,
      badge: promptRunnerState?.activePromptStatus || (queuedPromptCount > 0 ? "queue pending" : null),
      metrics: {
        inFlight: promptRunnerState?.inFlight || false,
        queued: queuedPromptCount,
        activePromptId: promptRunnerState?.activePromptId
      }
    });
  }

  if (activeExecutionCount > 0) {
    addBadge(nodeMap, "kube-dispatcher", {
      tone: "active",
      active: true,
      badge: `${activeExecutionCount} active`,
      metrics: {
        activeExecutions: activeExecutionCount
      }
    });
  }

  if (selectedPrompt) {
    const routeNodeIds = promptStageToRouteNodeIds[selectedPrompt.status];
    const routeEdgeIds = promptStageToRouteEdgeIds[selectedPrompt.status];
    activateRoute(edgeMap, nodeMap, routeNodeIds, routeEdgeIds);

    addBadge(nodeMap, "prompt-terminal", {
      tone: activePromptStatuses.includes(selectedPrompt.status) ? "active" : "idle",
      active: activePromptStatuses.includes(selectedPrompt.status),
      badge: selectedPrompt.status
    });

    if (selectedPrompt.status === "completed") {
      addBadge(nodeMap, "document-store-repo", {
        badge: promptGit.branch || "updated",
        metrics: {
          promptId: selectedPrompt.id,
          branch: promptGit.branch,
          sha: promptGit.sha
        }
      });
      addBadge(nodeMap, "git-remote", {
        tone: "active",
        active: true,
        badge: promptGit.sha ? promptGit.sha.slice(0, 8) : "pushed"
      });
    }

    addBadge(nodeMap, getCurrentStageNodeId(selectedPrompt, failureStage), {
      tone: selectedPrompt.status === "failed" ? "error" : "active",
      active: true,
      badge: selectedPrompt.status
    });

    if (timingTelemetry.queueWaitMs !== null || timingTelemetry.processingMs !== null) {
      addBadge(nodeMap, "audit-log-artifact", {
        badge:
          timingTelemetry.processingMs !== null
            ? `${Math.max(1, Math.round(timingTelemetry.processingMs / 1000))}s`
            : "timed",
        metrics: {
          queueWaitMs: timingTelemetry.queueWaitMs,
          processingMs: timingTelemetry.processingMs,
          totalRuntimeMs: timingTelemetry.totalRuntimeMs
        }
      });
    }

    if (latestGitOperation.command) {
      addBadge(nodeMap, "publisher-phase", {
        metrics: {
          latestGitOperation: latestGitOperation.command,
          latestGitOperationAt: latestGitOperation.at,
          latestGitOperationRepoRoot: latestGitOperation.repoRoot,
          gitCommitMs: timingTelemetry.gitCommitMs,
          gitPushMs: timingTelemetry.gitPushMs,
          auditSyncMs: timingTelemetry.auditSyncMs
        }
      });
    }

    if (selectedPrompt.status === "failed") {
      addBadge(nodeMap, "worker-job", {
        tone: "error",
        active: true,
        badge: failureStage || selectedExecution?.status || "failed"
      });
      addBadge(nodeMap, "prompt-runner", {
        tone: promptRunnerState?.paused ? "warning" : "error",
        active: Boolean(promptRunnerState?.inFlight),
        badge: failureStage || "failed"
      });
    }
  }

  if (selectedExecution) {
    addBadge(nodeMap, "worker-job", {
      tone: selectedExecution.status === "failed" ? "error" : "active",
      active: activeExecutionStatuses.has(selectedExecution.status),
      badge:
        selectedExecution.status === "failed"
          ? failureStage || selectedExecution.errorMessage || selectedExecution.jobName || "failed"
          : selectedExecution.jobName || `attempt ${selectedExecution.attempt}`,
      metrics: {
        executionStatus: selectedExecution.status,
        attempt: selectedExecution.attempt,
        podName: selectedExecution.podName,
        workerNode: selectedExecution.workerNode
      }
    });

    if (selectedExecution.status === "bootstrapping") {
      addBadge(nodeMap, "worker-bootstrap", {
        tone: "active",
        active: true,
        badge: "bootstrapping"
      });
    }

    if (selectedExecution.status === "running") {
      addBadge(nodeMap, "codex-executor", {
        tone: "active",
        active: true,
        badge: selectedPrompt?.status || "running",
        metrics: {
          jobName: selectedExecution.jobName,
          podName: selectedExecution.podName,
          workerNode: selectedExecution.workerNode,
          attempt: selectedExecution.attempt,
          agentWorkMs: timingTelemetry.agentWorkMs
        }
      });
    }

    if (selectedExecution.status === "publishing") {
      addBadge(nodeMap, "publisher-phase", {
        tone: "active",
        active: true,
        badge: "publishing"
      });
    }

    if (selectedExecution.status === "failed") {
      addBadge(nodeMap, "worker-bootstrap", {
        tone: failureStage === "bootstrapping" ? "error" : "idle",
        badge: failureStage === "bootstrapping" ? "failed" : null
      });
      addBadge(nodeMap, "codex-executor", {
        tone: failureStage === "writing" || failureStage === "scanning" || failureStage === "deciding"
          ? "error"
          : "idle",
        badge:
          failureStage === "writing" || failureStage === "scanning" || failureStage === "deciding"
            ? "failed"
            : null
      });
    }
  }

  const nodes = Array.from(nodeMap.values());
  const edges = Array.from(edgeMap.values());

  return {
    generatedAt,
    nodes,
    edges,
    focusNodeIds: nodes.filter((node) => node.active).map((node) => node.id),
    focusEdgeIds: edges.filter((edge) => edge.active).map((edge) => edge.id),
    summary: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      queuedPromptCount,
      activePromptCount,
      failedPromptCount,
      completedPromptCount,
      activeExecutionCount
    },
    selectedPrompt: selectedPrompt
      ? {
          id: selectedPrompt.id,
          status: selectedPrompt.status,
          executionStatus: selectedExecution?.status || null,
          currentStageNodeId: getCurrentStageNodeId(selectedPrompt, failureStage),
          branch: promptGit.branch,
          sha: promptGit.sha,
          failureStage,
          routeNodeIds: promptStageToRouteNodeIds[selectedPrompt.status],
          routeEdgeIds: promptStageToRouteEdgeIds[selectedPrompt.status],
          workerAttempt: selectedExecution?.attempt || null,
          jobName: selectedExecution?.jobName || null,
          podName: selectedExecution?.podName || null,
          workerNode: selectedExecution?.workerNode || null,
          latestGitOperation: latestGitOperation.command,
          latestGitOperationAt: latestGitOperation.at,
          latestGitOperationRepoRoot: latestGitOperation.repoRoot,
          queueWaitMs: timingTelemetry.queueWaitMs,
          processingMs: timingTelemetry.processingMs,
          totalRuntimeMs: timingTelemetry.totalRuntimeMs,
          gitOperationsMs: timingTelemetry.gitOperationsMs,
          agentWorkMs: timingTelemetry.agentWorkMs,
          canvasRearrangeMs: timingTelemetry.canvasRearrangeMs,
          gitCommitMs: timingTelemetry.gitCommitMs,
          gitPushMs: timingTelemetry.gitPushMs,
          auditSyncMs: timingTelemetry.auditSyncMs
        }
      : null
  };
};
