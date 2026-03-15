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
    defaultCoverage: false
  },
  render: {
    html: true,
    console: true,
    defaultView: "package"
  },
  suites: [
    {
      id: "server-tests",
      label: "Server tests",
      adapter: "shell",
      package: "server",
      cwd: rootDir,
      command: ["yarn", "workspace", "server", "test"],
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
