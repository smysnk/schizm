export const themeOptions = [
  { id: "signal", label: "Signal" },
  { id: "paper", label: "Paper" },
  { id: "midnight", label: "Midnight" },
  { id: "workflow-analysis", label: "Workflow" }
] as const;

export const defaultThemeId = "signal" as const;

export type ThemeOption = (typeof themeOptions)[number];
export type ThemeId = (typeof themeOptions)[number]["id"];

export const isThemeId = (value: string): value is ThemeId =>
  themeOptions.some((theme) => theme.id === value);

export const getAvailableThemeOptions = (availableThemeIds?: readonly string[]) => {
  if (!availableThemeIds?.length) {
    return themeOptions;
  }

  const allowed = new Set(availableThemeIds.filter(isThemeId));
  const filtered = themeOptions.filter((theme) => allowed.has(theme.id));

  return filtered.length > 0 ? filtered : themeOptions;
};

export const resolveThemeId = (
  value: string | null | undefined,
  availableThemeIds?: readonly string[]
): ThemeId => {
  const availableThemes = getAvailableThemeOptions(availableThemeIds);

  if (value && availableThemes.some((theme) => theme.id === value)) {
    return value as ThemeId;
  }

  return availableThemes[0]?.id || defaultThemeId;
};
