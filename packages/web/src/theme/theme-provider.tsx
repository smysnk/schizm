"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isThemeId, themeOptions, type ThemeId } from "./themes";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: typeof themeOptions;
};

const THEME_STORAGE_KEY = "schizm-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme
}: {
  children: ReactNode;
  initialTheme: string;
}) {
  const [theme, setTheme] = useState<ThemeId>(
    isThemeId(initialTheme) ? initialTheme : "signal"
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && isThemeId(stored)) {
        setTheme(stored);
        return;
      }
    } catch (_error) {
      // ignore storage failures
    }

    document.documentElement.dataset.theme = theme;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_error) {
      // ignore storage failures
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: themeOptions }}>
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
