export const themeOptions = [
  { id: "signal", label: "Signal" },
  { id: "paper", label: "Paper" },
  { id: "midnight", label: "Midnight" }
] as const;

export type ThemeId = (typeof themeOptions)[number]["id"];

export const isThemeId = (value: string): value is ThemeId =>
  themeOptions.some((theme) => theme.id === value);
