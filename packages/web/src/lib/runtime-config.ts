export type PublicRuntimeConfig = {
  appTitle: string;
  graphTitle: string;
  graphSubtitle: string;
  defaultTheme: string;
  availableThemes: string[];
  canvasRefreshMs: number;
  graphqlEndpoint: string;
  graphqlWsEndpoint: string;
};

declare global {
  interface Window {
    __SCHIZM_RUNTIME__?: PublicRuntimeConfig;
  }
}

const fallbackConfig: PublicRuntimeConfig = {
  appTitle: "Schizm",
  graphTitle: "Connection Field",
  graphSubtitle: "Map how fragments attract, collide, and reshape each other.",
  defaultTheme: "signal",
  availableThemes: ["signal", "paper", "midnight"],
  canvasRefreshMs: 30_000,
  graphqlEndpoint: "/graphql",
  graphqlWsEndpoint: ""
};

export const getRuntimeConfig = (): PublicRuntimeConfig => fallbackConfig;

const toWebSocketUrl = (value: string) =>
  value.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");

const isLoopbackHost = (host: string) =>
  ["127.0.0.1", "localhost", "0.0.0.0", "::1", "[::1]"].includes(
    host.toLowerCase()
  );

const resolveGraphqlPath = (endpoint: string) =>
  endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

const buildSameOriginWsUrl = (endpoint: string, origin: string) =>
  toWebSocketUrl(new URL(resolveGraphqlPath(endpoint), origin).toString());

export const buildBrowserFallbackConfig = (
  location: Pick<Location, "origin">
): PublicRuntimeConfig => ({
  ...fallbackConfig,
  graphqlWsEndpoint: buildSameOriginWsUrl(fallbackConfig.graphqlEndpoint, location.origin)
});

export const normalizeBrowserRuntimeConfig = (
  config: PublicRuntimeConfig,
  location: Pick<Location, "origin" | "hostname">
): PublicRuntimeConfig => {
  const graphqlEndpoint = config.graphqlEndpoint?.trim() || fallbackConfig.graphqlEndpoint;
  const normalizedFallbackWs = buildSameOriginWsUrl(graphqlEndpoint, location.origin);
  const rawWsEndpoint = config.graphqlWsEndpoint?.trim();

  if (!rawWsEndpoint) {
    return {
      ...config,
      graphqlEndpoint,
      graphqlWsEndpoint: normalizedFallbackWs
    };
  }

  try {
    const resolved = new URL(rawWsEndpoint, location.origin);

    if (isLoopbackHost(resolved.hostname) && !isLoopbackHost(location.hostname)) {
      return {
        ...config,
        graphqlEndpoint,
        graphqlWsEndpoint: normalizedFallbackWs
      };
    }

    if (!/^wss?:$/i.test(resolved.protocol)) {
      return {
        ...config,
        graphqlEndpoint,
        graphqlWsEndpoint: toWebSocketUrl(resolved.toString())
      };
    }

    return {
      ...config,
      graphqlEndpoint,
      graphqlWsEndpoint: resolved.toString()
    };
  } catch {
    return {
      ...config,
      graphqlEndpoint,
      graphqlWsEndpoint: normalizedFallbackWs
    };
  }
};

export const readRuntimeConfig = (): PublicRuntimeConfig => {
  if (typeof window === "undefined") {
    return fallbackConfig;
  }

  return normalizeBrowserRuntimeConfig(
    window.__SCHIZM_RUNTIME__ || buildBrowserFallbackConfig(window.location),
    window.location
  );
};
