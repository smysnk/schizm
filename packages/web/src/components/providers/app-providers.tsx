"use client";

import type { ReactNode } from "react";
import { ApolloRuntimeProvider } from "../../lib/apollo";
import type { PublicRuntimeConfig } from "../../lib/runtime-config";
import { ThemeProvider } from "../../theme/theme-provider";

export function AppProviders({
  children,
  runtimeConfig
}: {
  children: ReactNode;
  runtimeConfig: PublicRuntimeConfig;
}) {
  return (
    <ThemeProvider initialTheme={runtimeConfig.defaultTheme}>
      <ApolloRuntimeProvider runtimeConfig={runtimeConfig}>{children}</ApolloRuntimeProvider>
    </ThemeProvider>
  );
}
