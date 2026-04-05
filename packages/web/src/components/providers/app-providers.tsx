"use client";

import type { ReactNode } from "react";
import { ApolloRuntimeProvider } from "../../lib/apollo";
import type { PublicRuntimeConfig } from "../../lib/runtime-config";
import { getAvailableThemeOptions, resolveThemeId } from "../../theme/themes";
import { ThemeProvider } from "../../theme/theme-provider";

export function AppProviders({
  children,
  runtimeConfig
}: {
  children: ReactNode;
  runtimeConfig: PublicRuntimeConfig;
}) {
  const availableThemes = getAvailableThemeOptions(runtimeConfig.availableThemes);
  const initialTheme = resolveThemeId(
    runtimeConfig.defaultTheme,
    runtimeConfig.availableThemes
  );

  return (
    <ThemeProvider initialTheme={initialTheme} themes={availableThemes}>
      <ApolloRuntimeProvider runtimeConfig={runtimeConfig}>{children}</ApolloRuntimeProvider>
    </ThemeProvider>
  );
}
