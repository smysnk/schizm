import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBrowserFallbackConfig,
  normalizeBrowserRuntimeConfig,
  type PublicRuntimeConfig
} from "./runtime-config";

const browserLocation = {
  origin: "https://schizm.smysnk.com",
  hostname: "schizm.smysnk.com"
};

const createConfig = (
  overrides: Partial<PublicRuntimeConfig> = {}
): PublicRuntimeConfig => ({
  appTitle: "Schizm",
  graphTitle: "Connection Field",
  graphSubtitle: "Map how fragments attract, collide, and reshape each other.",
  defaultTheme: "signal",
  availableThemes: ["signal", "paper", "midnight", "workflow-analysis"],
  canvasRefreshMs: 30_000,
  graphqlEndpoint: "/graphql",
  graphqlWsEndpoint: "",
  ...overrides
});

test("buildBrowserFallbackConfig uses the current origin for subscriptions", () => {
  const config = buildBrowserFallbackConfig(browserLocation);

  assert.equal(config.graphqlEndpoint, "/graphql");
  assert.equal(config.graphqlWsEndpoint, "wss://schizm.smysnk.com/graphql");
});

test("normalizeBrowserRuntimeConfig replaces loopback websocket URLs on public origins", () => {
  const config = normalizeBrowserRuntimeConfig(
    createConfig({
      graphqlWsEndpoint: "ws://127.0.0.1:4000/graphql"
    }),
    browserLocation
  );

  assert.equal(config.graphqlWsEndpoint, "wss://schizm.smysnk.com/graphql");
});

test("normalizeBrowserRuntimeConfig preserves explicit public websocket URLs", () => {
  const config = normalizeBrowserRuntimeConfig(
    createConfig({
      graphqlWsEndpoint: "wss://schizm.smysnk.com/graphql"
    }),
    browserLocation
  );

  assert.equal(config.graphqlWsEndpoint, "wss://schizm.smysnk.com/graphql");
});
