"use client";

import { Check, ChevronDown, MonitorCog, Palette, Settings, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  DASHBOARD_THEME_OPTIONS,
  type DashboardTheme,
  useDashboardTheme,
} from "@/components/theme/dashboard-theme-provider";
import { cn } from "@/lib/utils";

const themeIconMap: Record<DashboardTheme, typeof Palette> = {
  dispoz: Palette,
  light: Sun,
  system: MonitorCog,
};

type ThemeSettingsMenuProps = {
  collapsed?: boolean;
};

export function ThemeSettingsMenu({ collapsed = false }: ThemeSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useDashboardTheme();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const currentThemeLabel =
    DASHBOARD_THEME_OPTIONS.find((option) => option.value === theme)?.label ??
    "Dispoz (Latest)";

  return (
    <div className="relative mt-3" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex w-full items-center rounded-lg border border-sidebar-border bg-sidebar-background/30 px-3 py-2 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary",
          collapsed ? "justify-center gap-0 px-2" : "gap-2.5"
        )}
        onClick={() => setOpen((previous) => !previous)}
        type="button"
      >
        <Settings className="size-4 shrink-0" strokeWidth={2.2} />
        <span className={cn("min-w-0 flex-1", collapsed && "hidden")}>
          <span className="block text-xs font-medium">Settings</span>
          <span className="block truncate text-[10px] text-sidebar-muted">
            Theme: {currentThemeLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            open ? "rotate-180" : "rotate-0",
            collapsed && "hidden"
          )}
          strokeWidth={2.2}
        />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute z-50 w-64 rounded-xl border border-sidebar-border bg-sidebar-background p-3 shadow-2xl",
            collapsed ? "bottom-0 left-full ml-2" : "bottom-[calc(100%+0.5rem)] left-0"
          )}
        >
          <p className="tracking-label text-[10px] text-sidebar-label">Settings</p>
          <p className="mt-1 text-sm font-medium text-sidebar-primary">Theme</p>
          <p className="mt-1 text-xs leading-5 text-sidebar-muted">
            Pick one of three UI themes. Dispoz is the latest default design.
          </p>

          <div className="mt-3 space-y-1.5">
            {DASHBOARD_THEME_OPTIONS.map((option) => {
              const Icon = themeIconMap[option.value];
              const isSelected = option.value === theme;

              return (
                <button
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    isSelected
                      ? "border-sidebar-primary bg-sidebar-accent text-sidebar-primary"
                      : "border-sidebar-border bg-sidebar-background/50 text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                  key={option.value}
                  onClick={() => {
                    setTheme(option.value);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">{option.label}</span>
                    <span className="block text-[10px] leading-4 text-sidebar-muted">
                      {option.value === "system"
                        ? `${option.description} (Now: ${resolvedTheme})`
                        : option.description}
                    </span>
                  </span>
                  {isSelected ? (
                    <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
