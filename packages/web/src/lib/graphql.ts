import { gql } from "@apollo/client";

export type RuntimeConfigShape = {
  appTitle: string;
  graphTitle: string;
  graphSubtitle: string;
  defaultTheme: string;
  availableThemes: string[];
  canvasRefreshMs: number;
  graphqlEndpoint: string;
  graphqlWsEndpoint: string;
};

export type IdeaNode = {
  id: string;
  title: string;
  description: string;
  cluster: string;
  x: number;
  y: number;
  radius: number;
  weight: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type Connection = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  strength: number;
  createdAt: string;
};

export type GraphSnapshot = {
  generatedAt: string;
  ideas: IdeaNode[];
  connections: Connection[];
};

export type CanvasGraphNodeRecord = {
  id: string;
  notePath: string | null;
  canvasNodeId: string | null;
  label: string;
  kind: string;
  category: string;
  canvasFile: string;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  degree: number;
  inboundLinkCount: number;
  outboundLinkCount: number;
  tags: string[];
};

export type CanvasGraphEdgeRecord = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: string;
  label: string | null;
  weight: number;
  tentative: boolean;
};

export type CanvasGraphSnapshotRecord = {
  generatedAt: string;
  canvasPath: string;
  nodes: CanvasGraphNodeRecord[];
  edges: CanvasGraphEdgeRecord[];
};

export type CanvasGraphQueryResponse = {
  canvasFiles: string[];
  canvasGraph: CanvasGraphSnapshotRecord | null;
};

export type SystemCanvasNodeRecord = {
  id: string;
  label: string;
  kind: string;
  lane: string;
  description: string;
  owner: string;
  codeRefs: string[];
  defaultX: number;
  defaultY: number;
  tags: string[];
  tone: string;
  active: boolean;
  badge: string | null;
  metrics: Record<string, unknown>;
};

export type SystemCanvasEdgeRecord = {
  id: string;
  sourceId: string;
  targetId: string;
  interaction: string;
  description: string;
  importance: string;
  codeRefs: string[];
  active: boolean;
  badge: string | null;
};

export type SystemCanvasSummaryRecord = {
  totalNodes: number;
  totalEdges: number;
  queuedPromptCount: number;
  activePromptCount: number;
  failedPromptCount: number;
  completedPromptCount: number;
  activeExecutionCount: number;
};

export type SystemCanvasSelectedPromptRecord = {
  id: string;
  status: PromptStatus;
  executionStatus: string | null;
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

export type SystemCanvasSnapshotRecord = {
  generatedAt: string;
  nodes: SystemCanvasNodeRecord[];
  edges: SystemCanvasEdgeRecord[];
  focusNodeIds: string[];
  focusEdgeIds: string[];
  summary: SystemCanvasSummaryRecord;
  selectedPrompt: SystemCanvasSelectedPromptRecord | null;
};

export type SystemCanvasQueryResponse = {
  systemCanvas: SystemCanvasSnapshotRecord;
};

export type PromptStatus =
  | "queued"
  | "cancelled"
  | "scanning"
  | "deciding"
  | "writing"
  | "updating_canvas"
  | "auditing"
  | "committing"
  | "pushing"
  | "syncing_audit"
  | "completed"
  | "failed";

export type PromptRunnerStateRecord = {
  paused: boolean;
  inFlight: boolean;
  activePromptId: string | null;
  activePromptStatus: PromptStatus | null;
  pollMs: number;
  automationBranch: string;
  worktreeRoot: string;
  runnerSessionId: string;
};

export type PromptExecutionRecord = {
  id: string;
  promptId: string;
  attempt: number;
  status: string;
  executionMode: string;
  jobName: string | null;
  podName: string | null;
  namespace: string | null;
  image: string | null;
  workerNode: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type PromptRecord = {
  id: string;
  content: string;
  status: PromptStatus;
  metadata: Record<string, unknown>;
  audit: Record<string, unknown>;
  promptExecutions: PromptExecutionRecord[];
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromptWorkspaceUpdateRecord = {
  emittedAt: string;
  reason: string;
  promptId: string | null;
  promptRunnerState: PromptRunnerStateRecord;
  prompts: PromptRecord[];
};

export const CANVAS_BOOTSTRAP_QUERY = gql`
  query CanvasBootstrap {
    runtimeConfig {
      appTitle
      graphTitle
      graphSubtitle
      defaultTheme
      availableThemes
      canvasRefreshMs
      graphqlEndpoint
      graphqlWsEndpoint
    }
    graphSnapshot {
      generatedAt
      ideas {
        id
        title
        description
        cluster
        x
        y
        radius
        weight
        tags
        createdAt
        updatedAt
      }
      connections {
        id
        sourceId
        targetId
        label
        strength
        createdAt
      }
    }
  }
`;

export const MOVE_IDEA_MUTATION = gql`
  mutation MoveIdea($input: MoveIdeaInput!) {
    moveIdea(input: $input) {
      id
      x
      y
      updatedAt
    }
  }
`;

export const CANVAS_GRAPH_QUERY = gql`
  query CanvasGraph($canvasPath: String) {
    canvasFiles
    canvasGraph(canvasPath: $canvasPath) {
      generatedAt
      canvasPath
      nodes {
        id
        notePath
        canvasNodeId
        label
        kind
        category
        canvasFile
        x
        y
        width
        height
        degree
        inboundLinkCount
        outboundLinkCount
        tags
      }
      edges {
        id
        sourceId
        targetId
        kind
        label
        weight
        tentative
      }
    }
  }
`;

export const SYSTEM_CANVAS_QUERY = gql`
  query SystemCanvas($selectedPromptId: ID) {
    systemCanvas(selectedPromptId: $selectedPromptId) {
      generatedAt
      focusNodeIds
      focusEdgeIds
      summary {
        totalNodes
        totalEdges
        queuedPromptCount
        activePromptCount
        failedPromptCount
        completedPromptCount
        activeExecutionCount
      }
      selectedPrompt {
        id
        status
        executionStatus
        currentStageNodeId
        branch
        sha
        failureStage
        routeNodeIds
        routeEdgeIds
        workerAttempt
        jobName
        podName
        workerNode
        latestGitOperation
        latestGitOperationAt
        latestGitOperationRepoRoot
        queueWaitMs
        processingMs
        totalRuntimeMs
        gitOperationsMs
        agentWorkMs
        canvasRearrangeMs
        gitCommitMs
        gitPushMs
        auditSyncMs
      }
      nodes {
        id
        label
        kind
        lane
        description
        owner
        codeRefs
        defaultX
        defaultY
        tags
        tone
        active
        badge
        metrics
      }
      edges {
        id
        sourceId
        targetId
        interaction
        description
        importance
        codeRefs
        active
        badge
      }
    }
  }
`;

const promptFields = `
  id
  content
  status
  metadata
  audit
  promptExecutions {
    id
    promptId
    attempt
    status
    executionMode
    jobName
    podName
    namespace
    image
    workerNode
    startedAt
    finishedAt
    exitCode
    errorMessage
    metadata
    createdAt
    updatedAt
  }
  startedAt
  finishedAt
  errorMessage
  createdAt
  updatedAt
`;

export const PROMPTS_QUERY = gql`
  query Prompts($limit: Int) {
    promptRunnerState {
      paused
      inFlight
      activePromptId
      activePromptStatus
      pollMs
      automationBranch
      worktreeRoot
      runnerSessionId
    }
    prompts(limit: $limit) {
      ${promptFields}
    }
  }
`;

export const PROMPT_WORKSPACE_SUBSCRIPTION = gql`
  subscription PromptWorkspace($limit: Int) {
    promptWorkspace(limit: $limit) {
      emittedAt
      reason
      promptId
      promptRunnerState {
        paused
        inFlight
        activePromptId
        activePromptStatus
        pollMs
        automationBranch
        worktreeRoot
        runnerSessionId
      }
      prompts {
        ${promptFields}
      }
    }
  }
`;

export const CREATE_PROMPT_MUTATION = gql`
  mutation CreatePrompt($input: CreatePromptInput!) {
    createPrompt(input: $input) {
      ${promptFields}
    }
  }
`;

export const CANCEL_PROMPT_MUTATION = gql`
  mutation CancelPrompt($id: ID!) {
    cancelPrompt(id: $id) {
      ${promptFields}
    }
  }
`;

export const RETRY_PROMPT_MUTATION = gql`
  mutation RetryPrompt($id: ID!) {
    retryPrompt(id: $id) {
      ${promptFields}
    }
  }
`;

export const PAUSE_PROMPT_RUNNER_MUTATION = gql`
  mutation PausePromptRunner {
    pausePromptRunner {
      paused
      inFlight
      activePromptId
      activePromptStatus
      pollMs
      automationBranch
      worktreeRoot
      runnerSessionId
    }
  }
`;

export const RESUME_PROMPT_RUNNER_MUTATION = gql`
  mutation ResumePromptRunner {
    resumePromptRunner {
      paused
      inFlight
      activePromptId
      activePromptStatus
      pollMs
      automationBranch
      worktreeRoot
      runnerSessionId
    }
  }
`;
