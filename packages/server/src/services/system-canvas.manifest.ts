export const systemCanvasNodeKinds = [
  "human",
  "surface",
  "client",
  "transport",
  "service",
  "storage",
  "worker",
  "artifact",
  "external",
  "infrastructure"
] as const;

export const systemCanvasLanes = [
  "user",
  "browser",
  "transport",
  "api",
  "persistence",
  "worker",
  "document-store",
  "infrastructure"
] as const;

export const systemCanvasInteractionKinds = [
  "submits",
  "queries",
  "mutates",
  "subscribes",
  "publishes",
  "claims",
  "dispatches",
  "tracks",
  "launches",
  "bootstraps",
  "prepares",
  "executes",
  "writes",
  "rearranges",
  "commits",
  "pushes",
  "syncs",
  "persists",
  "renders"
] as const;

export type SystemCanvasNodeKind = (typeof systemCanvasNodeKinds)[number];
export type SystemCanvasLane = (typeof systemCanvasLanes)[number];
export type SystemCanvasInteractionKind = (typeof systemCanvasInteractionKinds)[number];

export type SystemCanvasTopologyNode = {
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
};

export type SystemCanvasTopologyEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  interaction: SystemCanvasInteractionKind;
  description: string;
  importance: "primary" | "secondary";
  codeRefs: string[];
};

export const systemCanvasTopologyNodes: readonly SystemCanvasTopologyNode[] = [
  {
    id: "user",
    label: "User",
    kind: "human",
    lane: "user",
    description: "Human operator submitting prompts and inspecting the workspace.",
    owner: "smysnk",
    codeRefs: ["/README.md"],
    defaultX: 120,
    defaultY: 220,
    tags: ["entrypoint"]
  },
  {
    id: "prompt-composer",
    label: "Prompt composer",
    kind: "surface",
    lane: "browser",
    description: "Retro LCD prompt input and terminal transition surface.",
    owner: "smysnk",
    codeRefs: ["/packages/web/src/components/canvas/idea-canvas.tsx"],
    defaultX: 320,
    defaultY: 120,
    tags: ["ui", "prompt"]
  },
  {
    id: "prompt-terminal",
    label: "Prompt terminal",
    kind: "surface",
    lane: "browser",
    description: "Live teletype view of prompt lifecycle updates and git/runtime output.",
    owner: "smysnk",
    codeRefs: [
      "/packages/web/src/components/canvas/idea-canvas.tsx",
      "/packages/web/src/components/canvas/prompt-terminal.ts"
    ],
    defaultX: 320,
    defaultY: 220,
    tags: ["ui", "prompt"]
  },
  {
    id: "prompt-history",
    label: "Prompt history",
    kind: "surface",
    lane: "browser",
    description: "Prompt list, detail pane, lifecycle history, and execution metadata.",
    owner: "smysnk",
    codeRefs: ["/packages/web/src/components/canvas/idea-canvas.tsx"],
    defaultX: 320,
    defaultY: 320,
    tags: ["ui", "history"]
  },
  {
    id: "canvas-graph-view",
    label: "Canvas graph",
    kind: "surface",
    lane: "browser",
    description: "Interactive note/canvas relationship view for the document store.",
    owner: "smysnk",
    codeRefs: [
      "/packages/web/src/components/canvas/canvas-graph-tab.tsx",
      "/packages/web/src/components/canvas/canvas-force-graph.tsx"
    ],
    defaultX: 320,
    defaultY: 420,
    tags: ["ui", "graph"]
  },
  {
    id: "system-canvas-view",
    label: "System canvas",
    kind: "surface",
    lane: "browser",
    description: "Planned architecture view that explains the moving parts and their interactions.",
    owner: "smysnk",
    codeRefs: ["/interactive-system-canvas-view-plan.md"],
    defaultX: 320,
    defaultY: 520,
    tags: ["ui", "system"]
  },
  {
    id: "apollo-client",
    label: "Apollo client",
    kind: "client",
    lane: "browser",
    description: "Browser-side GraphQL query, mutation, and subscription client.",
    owner: "smysnk",
    codeRefs: [
      "/packages/web/src/lib/apollo.tsx",
      "/packages/web/src/lib/graphql.ts"
    ],
    defaultX: 520,
    defaultY: 220,
    tags: ["browser", "graphql"]
  },
  {
    id: "websocket-transport",
    label: "WebSocket transport",
    kind: "transport",
    lane: "transport",
    description: "Realtime subscription channel carrying prompt workspace updates.",
    owner: "smysnk",
    codeRefs: [
      "/packages/web/src/lib/apollo.tsx",
      "/packages/server/src/index.ts"
    ],
    defaultX: 700,
    defaultY: 220,
    tags: ["transport", "realtime"]
  },
  {
    id: "graphql-api",
    label: "GraphQL API",
    kind: "service",
    lane: "api",
    description: "Express + Apollo server exposing runtime config, prompt state, graph data, and subscriptions.",
    owner: "smysnk",
    codeRefs: [
      "/packages/server/src/index.ts",
      "/packages/server/src/graphql/schema.ts",
      "/packages/server/src/graphql/resolvers.ts"
    ],
    defaultX: 880,
    defaultY: 140,
    tags: ["api", "graphql"]
  },
  {
    id: "prompt-runner",
    label: "Prompt runner",
    kind: "service",
    lane: "api",
    description: "Control-plane service that claims prompts, dispatches work, and maintains lifecycle state.",
    owner: "smysnk",
    codeRefs: ["/packages/server/src/services/prompt-runner.ts"],
    defaultX: 880,
    defaultY: 280,
    tags: ["runner", "control-plane"]
  },
  {
    id: "kube-dispatcher",
    label: "Kube dispatcher",
    kind: "service",
    lane: "api",
    description: "Creates prompt execution records and launches Kubernetes Jobs for prompt work.",
    owner: "smysnk",
    codeRefs: [
      "/packages/server/src/services/prompt-dispatcher.ts",
      "/packages/server/src/services/kube-prompt-jobs.ts"
    ],
    defaultX: 880,
    defaultY: 420,
    tags: ["runner", "kubernetes"]
  },
  {
    id: "prompt-repository",
    label: "Prompt repository",
    kind: "storage",
    lane: "persistence",
    description: "Repository layer for the prompts table and prompt lifecycle updates.",
    owner: "smysnk",
    codeRefs: ["/packages/server/src/repositories/prompt-repository.ts"],
    defaultX: 1080,
    defaultY: 140,
    tags: ["db", "prompt"]
  },
  {
    id: "prompt-execution-repository",
    label: "Prompt execution repository",
    kind: "storage",
    lane: "persistence",
    description: "Repository layer for per-attempt worker execution records.",
    owner: "smysnk",
    codeRefs: ["/packages/server/src/repositories/prompt-execution-repository.ts"],
    defaultX: 1080,
    defaultY: 300,
    tags: ["db", "execution"]
  },
  {
    id: "postgres",
    label: "Postgres",
    kind: "storage",
    lane: "persistence",
    description: "Primary persistence for prompts, executions, and graph seed data.",
    owner: "smysnk",
    codeRefs: [
      "/packages/server/src/db/pool.ts",
      "/packages/server/src/db/migrations.ts"
    ],
    defaultX: 1080,
    defaultY: 470,
    tags: ["database"]
  },
  {
    id: "worker-job",
    label: "Worker job",
    kind: "worker",
    lane: "worker",
    description: "Ephemeral Kubernetes Job responsible for processing one prompt attempt.",
    owner: "smysnk",
    codeRefs: [
      "/packages/server/src/services/kube-prompt-jobs.ts",
      "/packages/server/src/worker/index.ts"
    ],
    defaultX: 1280,
    defaultY: 120,
    tags: ["worker", "kubernetes"]
  },
  {
    id: "worker-bootstrap",
    label: "Worker bootstrap",
    kind: "worker",
    lane: "worker",
    description: "Startup logic that prepares auth, repo state, and execution inputs inside the worker.",
    owner: "smysnk",
    codeRefs: [
      "/packages/server/src/worker/bootstrap.ts",
      "/docker/container-bootstrap.sh"
    ],
    defaultX: 1280,
    defaultY: 240,
    tags: ["worker", "bootstrap"]
  },
  {
    id: "codex-executor",
    label: "Codex executor",
    kind: "worker",
    lane: "worker",
    description: "Phase that runs Codex CLI against the document store using the prompt contract.",
    owner: "smysnk",
    codeRefs: [
      "/packages/server/src/worker/executor-runtime.ts",
      "/program.md"
    ],
    defaultX: 1280,
    defaultY: 360,
    tags: ["worker", "codex"]
  },
  {
    id: "canvas-rearrange",
    label: "Canvas rearrange",
    kind: "worker",
    lane: "worker",
    description: "Optional post-Codex canvas repositioning step before final verification and commit.",
    owner: "smysnk",
    codeRefs: ["/packages/server/src/services/canvas-rearrange.ts"],
    defaultX: 1280,
    defaultY: 480,
    tags: ["worker", "canvas"]
  },
  {
    id: "publisher-phase",
    label: "Publisher phase",
    kind: "worker",
    lane: "worker",
    description: "Final audit timing write, git commit, push, and prompt metadata synchronization step.",
    owner: "smysnk",
    codeRefs: [
      "/packages/server/src/worker/publisher-runtime.ts",
      "/packages/server/src/services/prompt-audit-timing.ts"
    ],
    defaultX: 1280,
    defaultY: 600,
    tags: ["worker", "git", "audit"]
  },
  {
    id: "document-store-repo",
    label: "Document-store repo",
    kind: "artifact",
    lane: "document-store",
    description: "Writable Obsidian-style knowledge repository operated on by prompt runs.",
    owner: "smysnk",
    codeRefs: [
      "/obsidian-repository",
      "/packages/server/src/services/git-worktree.ts"
    ],
    defaultX: 1480,
    defaultY: 180,
    tags: ["repo", "document-store"]
  },
  {
    id: "main-canvas-artifact",
    label: "main.canvas",
    kind: "artifact",
    lane: "document-store",
    description: "Canonical Obsidian canvas that represents the current concept map.",
    owner: "smysnk",
    codeRefs: [
      "/obsidian-repository/main.canvas",
      "/packages/server/src/services/canvas-validator.ts"
    ],
    defaultX: 1480,
    defaultY: 340,
    tags: ["canvas", "artifact"]
  },
  {
    id: "audit-log-artifact",
    label: "audit.md",
    kind: "artifact",
    lane: "document-store",
    description: "Append-only audit file for prompt runs, including timing and structured outcome data.",
    owner: "smysnk",
    codeRefs: [
      "/obsidian-repository/audit.md",
      "/scripts/sync-prompt-audit.ts"
    ],
    defaultX: 1480,
    defaultY: 500,
    tags: ["audit", "artifact"]
  },
  {
    id: "git-remote",
    label: "Git remote",
    kind: "external",
    lane: "document-store",
    description: "Remote Git host receiving committed document-store changes.",
    owner: "smysnk",
    codeRefs: ["/README.md"],
    defaultX: 1480,
    defaultY: 650,
    tags: ["git", "remote"]
  },
  {
    id: "fleet-rancher",
    label: "Fleet / Rancher",
    kind: "infrastructure",
    lane: "infrastructure",
    description: "Cluster deployment and operational environment for the API and workers.",
    owner: "smysnk",
    codeRefs: [
      "/fleet/README.md",
      "/fleet/schizm/values.yaml",
      "/docker/docker-entrypoint.sh"
    ],
    defaultX: 1680,
    defaultY: 260,
    tags: ["deploy", "infra"]
  }
] as const;

export const systemCanvasTopologyEdges: readonly SystemCanvasTopologyEdge[] = [
  {
    id: "user-submits-prompt",
    sourceId: "user",
    targetId: "prompt-composer",
    interaction: "submits",
    description: "Human writes and submits a prompt.",
    importance: "primary",
    codeRefs: ["/packages/web/src/components/canvas/idea-canvas.tsx"]
  },
  {
    id: "prompt-composer-uses-apollo",
    sourceId: "prompt-composer",
    targetId: "apollo-client",
    interaction: "mutates",
    description: "Prompt submission is sent through the Apollo GraphQL client.",
    importance: "primary",
    codeRefs: [
      "/packages/web/src/components/canvas/idea-canvas.tsx",
      "/packages/web/src/lib/graphql.ts"
    ]
  },
  {
    id: "prompt-history-queries-apollo",
    sourceId: "prompt-history",
    targetId: "apollo-client",
    interaction: "queries",
    description: "Prompt history reads prompt and runner state through GraphQL.",
    importance: "secondary",
    codeRefs: [
      "/packages/web/src/components/canvas/idea-canvas.tsx",
      "/packages/web/src/lib/graphql.ts"
    ]
  },
  {
    id: "canvas-graph-queries-apollo",
    sourceId: "canvas-graph-view",
    targetId: "apollo-client",
    interaction: "queries",
    description: "Canvas graph loads graph snapshots and canvas file inventory via GraphQL.",
    importance: "secondary",
    codeRefs: [
      "/packages/web/src/components/canvas/canvas-graph-tab.tsx",
      "/packages/web/src/lib/graphql.ts"
    ]
  },
  {
    id: "system-canvas-queries-apollo",
    sourceId: "system-canvas-view",
    targetId: "apollo-client",
    interaction: "queries",
    description: "Planned system view will request the system canvas snapshot from GraphQL.",
    importance: "secondary",
    codeRefs: ["/interactive-system-canvas-view-plan.md"]
  },
  {
    id: "apollo-mutates-graphql",
    sourceId: "apollo-client",
    targetId: "graphql-api",
    interaction: "mutates",
    description: "Apollo sends prompt mutations and standard query traffic to the API.",
    importance: "primary",
    codeRefs: [
      "/packages/web/src/lib/apollo.tsx",
      "/packages/server/src/index.ts"
    ]
  },
  {
    id: "apollo-subscribes-websocket",
    sourceId: "apollo-client",
    targetId: "websocket-transport",
    interaction: "subscribes",
    description: "Apollo opens a GraphQL websocket subscription for workspace updates.",
    importance: "primary",
    codeRefs: ["/packages/web/src/lib/apollo.tsx"]
  },
  {
    id: "websocket-connects-graphql",
    sourceId: "websocket-transport",
    targetId: "graphql-api",
    interaction: "subscribes",
    description: "Realtime subscription traffic terminates at the GraphQL API websocket server.",
    importance: "primary",
    codeRefs: ["/packages/server/src/index.ts"]
  },
  {
    id: "graphql-publishes-terminal",
    sourceId: "graphql-api",
    targetId: "prompt-terminal",
    interaction: "publishes",
    description: "Prompt terminal receives live prompt workspace updates over GraphQL subscriptions.",
    importance: "secondary",
    codeRefs: [
      "/packages/server/src/graphql/schema.ts",
      "/packages/web/src/components/canvas/idea-canvas.tsx"
    ]
  },
  {
    id: "graphql-publishes-history",
    sourceId: "graphql-api",
    targetId: "prompt-history",
    interaction: "publishes",
    description: "Prompt history stays in sync with prompt lifecycle changes from the server.",
    importance: "secondary",
    codeRefs: [
      "/packages/server/src/graphql/schema.ts",
      "/packages/web/src/components/canvas/idea-canvas.tsx"
    ]
  },
  {
    id: "graphql-publishes-canvas-graph",
    sourceId: "graphql-api",
    targetId: "canvas-graph-view",
    interaction: "publishes",
    description: "Canvas graph responds to prompt completions and refetches graph state.",
    importance: "secondary",
    codeRefs: [
      "/packages/server/src/graphql/schema.ts",
      "/packages/web/src/components/canvas/canvas-graph-tab.tsx"
    ]
  },
  {
    id: "graphql-publishes-system-canvas",
    sourceId: "graphql-api",
    targetId: "system-canvas-view",
    interaction: "publishes",
    description: "Planned system view will reflect runtime updates from the API.",
    importance: "secondary",
    codeRefs: ["/interactive-system-canvas-view-plan.md"]
  },
  {
    id: "graphql-uses-prompt-repository",
    sourceId: "graphql-api",
    targetId: "prompt-repository",
    interaction: "queries",
    description: "Resolvers read and update prompt records through the prompt repository.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/graphql/resolvers.ts",
      "/packages/server/src/repositories/prompt-repository.ts"
    ]
  },
  {
    id: "graphql-uses-prompt-execution-repository",
    sourceId: "graphql-api",
    targetId: "prompt-execution-repository",
    interaction: "queries",
    description: "Resolvers expose prompt execution attempts through the execution repository.",
    importance: "secondary",
    codeRefs: [
      "/packages/server/src/graphql/resolvers.ts",
      "/packages/server/src/repositories/prompt-execution-repository.ts"
    ]
  },
  {
    id: "prompt-repository-persists-postgres",
    sourceId: "prompt-repository",
    targetId: "postgres",
    interaction: "persists",
    description: "Prompt repository stores prompt lifecycle, metadata, and audit state in Postgres.",
    importance: "primary",
    codeRefs: ["/packages/server/src/repositories/prompt-repository.ts"]
  },
  {
    id: "prompt-execution-repository-persists-postgres",
    sourceId: "prompt-execution-repository",
    targetId: "postgres",
    interaction: "persists",
    description: "Prompt execution repository stores per-attempt worker execution data in Postgres.",
    importance: "primary",
    codeRefs: ["/packages/server/src/repositories/prompt-execution-repository.ts"]
  },
  {
    id: "prompt-runner-claims-prompts",
    sourceId: "prompt-runner",
    targetId: "prompt-repository",
    interaction: "claims",
    description: "Prompt runner claims queued prompts and updates prompt lifecycle status.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/services/prompt-runner.ts",
      "/packages/server/src/repositories/prompt-repository.ts"
    ]
  },
  {
    id: "prompt-runner-dispatches-kube",
    sourceId: "prompt-runner",
    targetId: "kube-dispatcher",
    interaction: "dispatches",
    description: "Prompt runner delegates prompt work to the kube dispatcher in worker mode.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/services/prompt-runner.ts",
      "/packages/server/src/services/prompt-dispatcher.ts"
    ]
  },
  {
    id: "kube-dispatcher-tracks-executions",
    sourceId: "kube-dispatcher",
    targetId: "prompt-execution-repository",
    interaction: "tracks",
    description: "Dispatcher creates and updates prompt execution attempt records.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/services/prompt-dispatcher.ts",
      "/packages/server/src/repositories/prompt-execution-repository.ts"
    ]
  },
  {
    id: "kube-dispatcher-launches-worker-job",
    sourceId: "kube-dispatcher",
    targetId: "worker-job",
    interaction: "launches",
    description: "Dispatcher creates the Kubernetes Job that will execute the prompt.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/services/prompt-dispatcher.ts",
      "/packages/server/src/services/kube-prompt-jobs.ts"
    ]
  },
  {
    id: "worker-job-bootstraps-worker",
    sourceId: "worker-job",
    targetId: "worker-bootstrap",
    interaction: "bootstraps",
    description: "Worker container startup prepares auth, repo state, and execution context.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/worker/index.ts",
      "/packages/server/src/worker/bootstrap.ts"
    ]
  },
  {
    id: "worker-bootstrap-prepares-document-store",
    sourceId: "worker-bootstrap",
    targetId: "document-store-repo",
    interaction: "prepares",
    description: "Bootstrap syncs or clones the document-store working copy before execution.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/worker/bootstrap.ts",
      "/packages/server/src/services/container-document-repo.ts"
    ]
  },
  {
    id: "worker-bootstrap-starts-codex",
    sourceId: "worker-bootstrap",
    targetId: "codex-executor",
    interaction: "executes",
    description: "Bootstrap hands control to the Codex execution phase.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/worker/bootstrap.ts",
      "/packages/server/src/worker/executor-runtime.ts"
    ]
  },
  {
    id: "codex-writes-document-store",
    sourceId: "codex-executor",
    targetId: "document-store-repo",
    interaction: "writes",
    description: "Codex modifies the note repository in response to the prompt.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/worker/executor-runtime.ts",
      "/program.md"
    ]
  },
  {
    id: "codex-writes-main-canvas",
    sourceId: "codex-executor",
    targetId: "main-canvas-artifact",
    interaction: "writes",
    description: "Codex updates the Obsidian canvas representation of the knowledge graph.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/worker/executor-runtime.ts",
      "/packages/server/src/services/canvas-validator.ts"
    ]
  },
  {
    id: "codex-writes-audit-log",
    sourceId: "codex-executor",
    targetId: "audit-log-artifact",
    interaction: "writes",
    description: "Codex appends the prompt outcome to audit.md before the runner finalizes it.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/worker/executor-runtime.ts",
      "/program.md"
    ]
  },
  {
    id: "canvas-rearrange-updates-main-canvas",
    sourceId: "canvas-rearrange",
    targetId: "main-canvas-artifact",
    interaction: "rearranges",
    description: "Post-processing step repositions canvas nodes before final validation.",
    importance: "secondary",
    codeRefs: ["/packages/server/src/services/canvas-rearrange.ts"]
  },
  {
    id: "publisher-commits-document-store",
    sourceId: "publisher-phase",
    targetId: "document-store-repo",
    interaction: "commits",
    description: "Publisher writes final timing metadata and creates the single prompt commit.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/worker/publisher-runtime.ts",
      "/packages/server/src/services/prompt-audit-timing.ts"
    ]
  },
  {
    id: "publisher-pushes-remote",
    sourceId: "publisher-phase",
    targetId: "git-remote",
    interaction: "pushes",
    description: "Publisher pushes the prompt commit to the configured Git remote.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/worker/publisher-runtime.ts",
      "/packages/server/src/services/container-document-repo.ts"
    ]
  },
  {
    id: "publisher-syncs-prompt-metadata",
    sourceId: "publisher-phase",
    targetId: "prompt-repository",
    interaction: "syncs",
    description: "Publisher synchronizes git/audit outcome back into the prompt record.",
    importance: "primary",
    codeRefs: [
      "/packages/server/src/worker/publisher-runtime.ts",
      "/scripts/sync-prompt-audit.ts"
    ]
  },
  {
    id: "fleet-runs-api-and-workers",
    sourceId: "fleet-rancher",
    targetId: "graphql-api",
    interaction: "renders",
    description: "Fleet/Rancher deploys and supervises the API/control-plane workload.",
    importance: "secondary",
    codeRefs: [
      "/fleet/schizm/templates/api-deployment.yaml",
      "/kube-sidecar-prompt-runner-plan.md"
    ]
  },
  {
    id: "fleet-runs-worker-jobs",
    sourceId: "fleet-rancher",
    targetId: "worker-job",
    interaction: "renders",
    description: "The cluster environment hosts the per-prompt worker jobs.",
    importance: "secondary",
    codeRefs: [
      "/fleet/schizm/values.yaml",
      "/packages/server/src/services/kube-prompt-jobs.ts"
    ]
  }
] as const;
