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
