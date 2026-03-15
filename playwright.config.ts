import { defineConfig, devices } from "@playwright/test";

const port = 3101;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry"
  },
  webServer: {
    command: "yarn workspace web dev",
    cwd: "/Users/josh/play/schizm",
    env: {
      ...process.env,
      WEB_PORT: String(port),
      NEXT_TELEMETRY_DISABLED: "1"
    },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});
