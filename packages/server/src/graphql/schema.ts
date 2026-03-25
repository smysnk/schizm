export const typeDefs = `#graphql
  scalar JSON

  type RuntimeConfig {
    appTitle: String!
    graphTitle: String!
    graphSubtitle: String!
    defaultTheme: String!
    availableThemes: [String!]!
    canvasRefreshMs: Int!
    graphqlEndpoint: String!
    graphqlWsEndpoint: String!
  }

  type IdeaNode {
    id: ID!
    title: String!
    description: String!
    cluster: String!
    x: Float!
    y: Float!
    radius: Float!
    weight: Int!
    tags: [String!]!
    createdAt: String!
    updatedAt: String!
  }

  type Connection {
    id: ID!
    sourceId: ID!
    targetId: ID!
    label: String!
    strength: Float!
    createdAt: String!
  }

  type GraphSnapshot {
    generatedAt: String!
    ideas: [IdeaNode!]!
    connections: [Connection!]!
  }

  type CanvasGraphNode {
    id: ID!
    notePath: String
    canvasNodeId: String
    label: String!
    kind: String!
    category: String!
    canvasFile: String!
    x: Float
    y: Float
    width: Float
    height: Float
    degree: Int!
    inboundLinkCount: Int!
    outboundLinkCount: Int!
    tags: [String!]!
  }

  type CanvasGraphEdge {
    id: ID!
    sourceId: ID!
    targetId: ID!
    kind: String!
    label: String
    weight: Float!
    tentative: Boolean!
  }

  type CanvasGraphSnapshot {
    generatedAt: String!
    canvasPath: String!
    nodes: [CanvasGraphNode!]!
    edges: [CanvasGraphEdge!]!
  }

  type CanvasLaneCard {
    nodeId: ID!
    label: String!
    kind: String!
    category: String!
    notePath: String
    canvasNodeId: String
    canvasFile: String!
    reason: String!
    score: Float!
    tentative: Boolean!
    touchedByPrompt: Boolean!
  }

  type CanvasLane {
    id: String!
    label: String!
    description: String!
    cards: [CanvasLaneCard!]!
  }

  type CanvasLanesSnapshot {
    generatedAt: String!
    canvasPath: String!
    focusNodeId: ID!
    focusHistory: [ID!]!
    lanes: [CanvasLane!]!
  }

  type SystemCanvasNode {
    id: ID!
    label: String!
    kind: String!
    lane: String!
    description: String!
    owner: String!
    codeRefs: [String!]!
    defaultX: Float!
    defaultY: Float!
    tags: [String!]!
    tone: String!
    active: Boolean!
    badge: String
    metrics: JSON!
  }

  type SystemCanvasEdge {
    id: ID!
    sourceId: ID!
    targetId: ID!
    interaction: String!
    description: String!
    importance: String!
    codeRefs: [String!]!
    active: Boolean!
    badge: String
  }

  type SystemCanvasSummary {
    totalNodes: Int!
    totalEdges: Int!
    queuedPromptCount: Int!
    activePromptCount: Int!
    failedPromptCount: Int!
    completedPromptCount: Int!
    activeExecutionCount: Int!
  }

  type SystemCanvasSelectedPrompt {
    id: ID!
    status: PromptStatus!
    executionStatus: String
    currentStageNodeId: ID
    branch: String
    sha: String
    failureStage: String
    routeNodeIds: [ID!]!
    routeEdgeIds: [ID!]!
    workerAttempt: Int
    jobName: String
    podName: String
    workerNode: String
    latestGitOperation: String
    latestGitOperationAt: String
    latestGitOperationRepoRoot: String
    queueWaitMs: Int
    processingMs: Int
    totalRuntimeMs: Int
    gitOperationsMs: Int
    agentWorkMs: Int
    canvasRearrangeMs: Int
    gitCommitMs: Int
    gitPushMs: Int
    auditSyncMs: Int
  }

  type SystemCanvasSnapshot {
    generatedAt: String!
    nodes: [SystemCanvasNode!]!
    edges: [SystemCanvasEdge!]!
    focusNodeIds: [ID!]!
    focusEdgeIds: [ID!]!
    summary: SystemCanvasSummary!
    selectedPrompt: SystemCanvasSelectedPrompt
  }

  enum PromptStatus {
    queued
    cancelled
    scanning
    deciding
    writing
    updating_canvas
    auditing
    committing
    pushing
    syncing_audit
    completed
    failed
  }

  type Prompt {
    id: ID!
    content: String!
    status: PromptStatus!
    metadata: JSON!
    audit: JSON!
    promptExecutions: [PromptExecution!]!
    startedAt: String
    finishedAt: String
    errorMessage: String
    createdAt: String!
    updatedAt: String!
  }

  type PromptExecution {
    id: ID!
    promptId: ID!
    attempt: Int!
    status: String!
    executionMode: String!
    jobName: String
    podName: String
    namespace: String
    image: String
    workerNode: String
    startedAt: String
    finishedAt: String
    exitCode: Int
    errorMessage: String
    metadata: JSON!
    createdAt: String!
    updatedAt: String!
  }

  type PromptRunnerState {
    paused: Boolean!
    inFlight: Boolean!
    activePromptId: ID
    activePromptStatus: PromptStatus
    pollMs: Int!
    automationBranch: String!
    worktreeRoot: String!
    runnerSessionId: String!
  }

  type PromptWorkspaceUpdate {
    emittedAt: String!
    reason: String!
    promptId: ID
    promptRunnerState: PromptRunnerState!
    prompts: [Prompt!]!
  }

  input MoveIdeaInput {
    id: ID!
    x: Float!
    y: Float!
  }

  input CreatePromptInput {
    content: String!
  }

  type Query {
    health: String!
    runtimeConfig: RuntimeConfig!
    graphSnapshot: GraphSnapshot!
    canvasFiles: [String!]!
    canvasGraph(canvasPath: String): CanvasGraphSnapshot
    canvasLanes(
      canvasPath: String
      focusNodeId: ID
      focusHistory: [ID!]
      highlightedNotePaths: [String!]
    ): CanvasLanesSnapshot
    systemCanvas(selectedPromptId: ID): SystemCanvasSnapshot!
    prompt(id: ID!): Prompt
    prompts(limit: Int): [Prompt!]!
    promptRunnerState: PromptRunnerState!
  }

  type Mutation {
    moveIdea(input: MoveIdeaInput!): IdeaNode!
    seedDemoGraph: GraphSnapshot!
    createPrompt(input: CreatePromptInput!): Prompt!
    cancelPrompt(id: ID!): Prompt!
    retryPrompt(id: ID!): Prompt!
    pausePromptRunner: PromptRunnerState!
    resumePromptRunner: PromptRunnerState!
  }

  type Subscription {
    promptWorkspace(limit: Int): PromptWorkspaceUpdate!
  }
`;
