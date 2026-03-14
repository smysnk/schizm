"use client";

import { useTheme } from "../../theme/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="theme-toggle">
      {themes.map((option) => (
        <button
          key={option.id}
          type="button"
          data-active={theme === option.id}
          onClick={() => setTheme(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
