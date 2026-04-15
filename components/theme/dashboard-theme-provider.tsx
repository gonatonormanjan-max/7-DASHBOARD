"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const DASHBOARD_THEME_STORAGE_KEY = "northstar:dashboard-theme";
const DEFAULT_DASHBOARD_THEME: DashboardTheme = "dispoz";

export type DashboardTheme = "dispoz" | "light" | "system";
export type ResolvedDashboardTheme = Exclude<DashboardTheme, "system">;

export const DASHBOARD_THEME_OPTIONS = [
  {
    value: "dispoz",
    label: "Dispoz (Latest)",
    description: "Warm amber palette for the current main design.",
  },
  {
    value: "light",
    label: "Light",
    description: "Neutral daylight palette.",
  },
  {
    value: "system",
    label: "System",
    description: "Follows your device appearance.",
  },
] as const satisfies ReadonlyArray<{
  value: DashboardTheme;
  label: string;
  description: string;
}>;

type DashboardThemeContextValue = {
  theme: DashboardTheme;
  resolvedTheme: ResolvedDashboardTheme;
  setTheme: (theme: DashboardTheme) => void;
};

const DashboardThemeContext = createContext<DashboardThemeContextValue | null>(
  null
);

function isDashboardTheme(value: string | null): value is DashboardTheme {
  return value === "dispoz" || value === "light" || value === "system";
}

export function DashboardThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<DashboardTheme>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_DASHBOARD_THEME;
    }

    try {
      const storedTheme = window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);
      if (isDashboardTheme(storedTheme)) {
        return storedTheme;
      }
      // Users previously on removed themes (e.g. "dark") fall back to default.
      if (storedTheme !== null) {
        window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, DEFAULT_DASHBOARD_THEME);
      }
    } catch {}

    return DEFAULT_DASHBOARD_THEME;
  });

  // Dark mode is removed. `system` always resolves to the light palette.
  const resolvedTheme: ResolvedDashboardTheme =
    theme === "system" ? "light" : theme;

  const setTheme = useCallback((nextTheme: DashboardTheme) => {
    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = "light";

    try {
      window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, theme);
    } catch {}
  }, [resolvedTheme, theme]);

  useEffect(() => {
    return () => {
      const root = document.documentElement;
      root.dataset.theme = DEFAULT_DASHBOARD_THEME;
      root.style.colorScheme = "light";
    };
  }, []);

  const value = useMemo<DashboardThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme]
  );

  return (
    <DashboardThemeContext.Provider value={value}>
      {children}
    </DashboardThemeContext.Provider>
  );
}

export function useDashboardTheme() {
  const context = useContext(DashboardThemeContext);

  if (!context) {
    throw new Error("useDashboardTheme must be used within DashboardThemeProvider.");
  }

  return context;
}
