"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  resolveThemeId,
  type ThemeId,
  type ThemeOption
} from "./themes";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: readonly ThemeOption[];
};

const THEME_STORAGE_KEY = "schizm-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme,
  themes
}: {
  children: ReactNode;
  initialTheme: ThemeId;
  themes: readonly ThemeOption[];
}) {
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const availableThemeIds = themes.map((themeOption) => themeOption.id);
  const availableThemesKey = availableThemeIds.join("|");

  useEffect(() => {
    const normalized = resolveThemeId(theme, availableThemeIds);

    if (normalized !== theme) {
      setTheme(normalized);
    }
  }, [theme, availableThemesKey]);

  useEffect(() => {
    const fallbackTheme = resolveThemeId(initialTheme, availableThemeIds);

    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      const nextTheme = stored
        ? resolveThemeId(stored, availableThemeIds)
        : fallbackTheme;

      setTheme(nextTheme);
      return;
    } catch (_error) {
      // ignore storage failures
    }

    setTheme(fallbackTheme);
  }, [initialTheme, availableThemesKey]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_error) {
      // ignore storage failures
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
};
