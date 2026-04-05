import path from "node:path";

const rootDir = import.meta.dirname;
const outputDir = path.join(rootDir, ".test-results", "schizm-test-report");

export default {
  schemaVersion: "1",
  project: {
    name: "schizm",
    rootDir,
    outputDir,
    rawDir: path.join(outputDir, "raw")
  },
  workspaceDiscovery: {
    provider: "explicit",
    packages: ["repo", "server", "web"]
  },
  execution: {
    continueOnError: true,
    defaultCoverage: true
  },
  manifests: {
    classification: "./test-modules.json",
    coverageAttribution: "./test-modules.json",
    ownership: "./test-modules.json"
  },
  enrichers: {
    sourceAnalysis: {
      enabled: true
    }
  },
  render: {
    html: true,
    console: true,
    defaultView: "module",
    includeDetailedAnalysisToggle: true
  },
  suites: [
    {
      id: "server-system-canvas",
      label: "System canvas",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/system-canvas.test.ts",
        "packages/server/src/graphql/system-canvas-query.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-canvas-lanes",
      label: "Canvas lanes",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/canvas-lanes.test.ts",
        "packages/server/src/graphql/canvas-lanes-query.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-canvas-tree",
      label: "Canvas tree",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/canvas-tree.test.ts",
        "packages/server/src/graphql/canvas-tree-query.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "web-canvas-lanes-navigation",
      label: "Canvas lanes navigation",
      adapter: "node-test",
      package: "web",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/web/src/components/canvas/canvas-lanes-navigation.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "web-canvas-lanes",
      label: "Canvas lanes UI",
      adapter: "node-test",
      package: "web",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/web/src/components/canvas/canvas-lanes-tab.test.tsx"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "web-canvas-tree",
      label: "Canvas tree UI",
      adapter: "node-test",
      package: "web",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/web/src/components/canvas/canvas-tree-layout.test.ts",
        "packages/web/src/components/canvas/canvas-tree-presentation.test.ts",
        "packages/web/src/components/canvas/canvas-tree-playback.test.ts",
        "packages/web/src/components/canvas/canvas-tree-tab.test.tsx"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-canvas-graph",
      label: "Canvas graph",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: ["node", "--import", "tsx", "--test", "packages/server/src/services/canvas-graph.test.ts"],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-canvas-validator",
      label: "Canvas validator",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: ["node", "--import", "tsx", "--test", "packages/server/src/services/canvas-validator.test.ts"],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-git-worktree",
      label: "Git worktree",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: ["node", "--import", "tsx", "--test", "packages/server/src/services/git-worktree.test.ts"],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-container-document-repo",
      label: "Container document repo",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/container-document-repo.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-kube-prompt-jobs",
      label: "Kubernetes prompt jobs",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/kube-prompt-jobs.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-prompt-dispatcher",
      label: "Prompt dispatcher",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/prompt-dispatcher.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-prompt-worker-observer",
      label: "Prompt worker observer",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/prompt-worker-observer.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-prompt-workspace-events",
      label: "Prompt workspace events",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/prompt-workspace-events.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-worker-contract",
      label: "Worker contract",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/worker/contract.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-worker-executor-runtime",
      label: "Worker executor runtime",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/worker/executor-runtime.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-worker-metadata",
      label: "Worker metadata",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/prompt-worker-metadata.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-program-battletest-scenarios",
      label: "Program battletest scenarios",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/program-battletest/scenario-pack.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-program-battletest-harness",
      label: "Program battletest harness",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/program-battletest/harness.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-program-battletest-evaluator",
      label: "Program battletest evaluator",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/program-battletest/evaluator.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-program-battletest-suite",
      label: "Program battletest suite",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/program-battletest/suite.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-program-battletest-reporting",
      label: "Program battletest reporting",
      adapter: "node-test",
      package: "server",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/server/src/services/program-battletest/reporting.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "server-program-battletest-report-artifacts",
      label: "Program battletest report artifacts",
      adapter: "shell",
      package: "server",
      cwd: rootDir,
      command: ["yarn", "test:battletest:report"],
      coverage: {
        enabled: false
      }
    },
    {
      id: "demo-renderer-tests",
      label: "Demo renderer tests",
      adapter: "shell",
      package: "repo",
      cwd: rootDir,
      command: ["python3", "-m", "unittest", "discover", "-s", "docs/demo", "-p", "test_*.py"],
      coverage: {
        enabled: false
      }
    },
    {
      id: "container-bootstrap-tests",
      label: "Container bootstrap",
      adapter: "node-test",
      package: "repo",
      cwd: rootDir,
      command: ["node", "--import", "tsx", "--test", "docker/container-bootstrap.test.ts"],
      coverage: {
        enabled: false
      }
    },
    {
      id: "audit-sync-tests",
      label: "Audit sync",
      adapter: "node-test",
      package: "repo",
      cwd: rootDir,
      command: ["node", "--import", "tsx", "--test", "scripts/sync-prompt-audit.test.ts"],
      coverage: {
        enabled: false
      }
    },
    {
      id: "web-prompt-terminal-unit",
      label: "Prompt terminal unit",
      adapter: "node-test",
      package: "web",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/web/src/components/canvas/prompt-terminal.test.ts",
        "packages/web/src/lib/runtime-config.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "web-canvas-graph-layout-unit",
      label: "Canvas graph layout unit",
      adapter: "node-test",
      package: "web",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/web/src/components/canvas/canvas-graph-layout.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "web-system-canvas-layout-unit",
      label: "System canvas layout unit",
      adapter: "node-test",
      package: "web",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/web/src/components/canvas/system-canvas-layout.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "web-system-canvas-focus-unit",
      label: "System canvas focus unit",
      adapter: "node-test",
      package: "web",
      cwd: rootDir,
      command: [
        "node",
        "--import",
        "tsx",
        "--test",
        "packages/web/src/components/canvas/system-canvas-focus.test.ts"
      ],
      coverage: {
        enabled: true,
        mode: "same-run"
      }
    },
    {
      id: "prompt-terminal-e2e",
      label: "Prompt terminal e2e",
      adapter: "playwright",
      package: "web",
      cwd: rootDir,
      command: ["yarn", "test:e2e", "e2e/prompt-terminal.spec.ts"],
      coverage: {
        enabled: false
      }
    }
  ]
};
