"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  Layers3,
  LogOut,
  MoveRight,
  Plus,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import type { CurrentUser } from "@/lib/dal/auth";
import type { NavIcon } from "@/lib/permissions";
import { getRoleDescription, getRoleLabel, hasPermission, type NavItem } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeSettingsMenu } from "@/components/theme/theme-settings-menu";

const SIDEBAR_COLLAPSE_STORAGE_KEY = "dashboard:sidebar-collapsed";
const SIDEBAR_COLLAPSE_EVENT = "dashboard:sidebar-collapse-change";

function readCollapsedPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsedPreference(onStoreChange: () => void) {
  const handleChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(SIDEBAR_COLLAPSE_EVENT, handleChange as EventListener);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(SIDEBAR_COLLAPSE_EVENT, handleChange as EventListener);
  };
}

const iconMap: Record<NavIcon, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  boxes: Boxes,
  layers: Layers3,
  truck: Truck,
  warehouse: Warehouse,
  move: MoveRight,
  clipboard: ClipboardList,
  "shopping-cart": ShoppingCart,
  chart: ChartNoAxesCombined,
  users: Users,
  shield: ShieldCheck,
  settings: Settings,
};

type DashboardSidebarProps = {
  navItems: NavItem[];
  user: CurrentUser;
};

export function DashboardSidebar({ navItems, user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const isCollapsed = useSyncExternalStore(
    subscribeCollapsedPreference,
    readCollapsedPreference,
    () => false
  );
  const sections = Array.from(new Set(navItems.map((item) => item.section)));
  const roleLabel = getRoleLabel(user.role);

  function toggleCollapsed() {
    const next = !isCollapsed;

    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      window.dispatchEvent(new Event(SIDEBAR_COLLAPSE_EVENT));
    } catch {}
  }

  return (
    <aside
      className={cn(
        "hidden bg-sidebar-background text-sidebar-foreground transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-sidebar-border",
        isCollapsed ? "lg:w-20" : "lg:w-72"
      )}
    >
      <div className={cn("pt-5 pb-4", isCollapsed ? "px-3" : "px-5")}>
        <div className="flex items-start justify-between gap-2">
          <div className={cn("min-w-0", isCollapsed && "flex-1")}>
            <p
              className={cn(
                "tracking-label text-sidebar-label text-[10px]",
                isCollapsed && "text-center"
              )}
            >
              {isCollapsed ? "7D" : "7-Dashboard"}
            </p>
            <h1
              className={cn(
                "mt-1 text-sm font-semibold text-sidebar-primary",
                isCollapsed && "hidden"
              )}
            >
              Operations Core
            </h1>
          </div>

          <button
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-lg border border-sidebar-border p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary"
            onClick={toggleCollapsed}
            type="button"
          >
            {isCollapsed ? (
              <ChevronRight className="size-4" strokeWidth={2.4} />
            ) : (
              <ChevronLeft className="size-4" strokeWidth={2.4} />
            )}
          </button>
        </div>
      </div>

      {hasPermission(user.role, "sales_orders", "create") ? (
        <div className={cn("hidden pb-4 lg:block", isCollapsed ? "px-2" : "px-4")}>
          <Link
            href="/dashboard/sales-orders/create/new"
            className={cn(
              "flex h-10 w-full items-center justify-center rounded-lg border border-sidebar-border text-sidebar-primary text-sm font-medium transition-colors hover:bg-sidebar-accent",
              isCollapsed ? "gap-0" : "gap-2"
            )}
            title="Record Sale"
          >
            <Plus className="size-4" strokeWidth={2.4} />
            <span className={cn(isCollapsed && "hidden")}>Record Sale</span>
          </Link>
        </div>
      ) : null}

      <div className={cn("overflow-y-auto scrollbar-hide py-4 lg:flex-1", isCollapsed ? "px-2" : "px-3")}>
        <div className="flex gap-4 lg:block lg:space-y-6">
          {sections.map((section) => (
            <div key={section} className="min-w-[220px] lg:min-w-0">
              {isCollapsed ? null : (
                <p className="tracking-label px-3 text-[10px] text-sidebar-label">
                  {section}
                </p>
              )}
              <nav className="mt-3 space-y-1.5">
                {navItems
                  .filter((item) => item.section === section)
                  .map((item) => {
                    const isActive =
                      item.href === "/dashboard"
                        ? pathname === item.href
                        : pathname.startsWith(item.href);
                    const Icon = iconMap[item.icon];

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isCollapsed ? "justify-center gap-0" : "gap-3",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-primary"
                        )}
                        title={item.title}
                      >
                        <Icon className="size-4" strokeWidth={2.2} />
                        <span className={cn(isCollapsed && "hidden")}>{item.title}</span>
                      </Link>
                    );
                  })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      <div className={cn("border-t border-sidebar-border py-5", isCollapsed ? "px-2" : "px-5")}>
        <p className={cn("text-sm font-medium text-sidebar-primary", isCollapsed && "text-center")}>
          {isCollapsed ? user.firstName[0] : `${user.firstName} ${user.lastName}`}
        </p>
        <p className={cn("mt-1 text-xs text-sidebar-muted", isCollapsed && "hidden")}>
          {user.email}
        </p>
        <p className={cn("tracking-label mt-3 text-sidebar-label text-[10px]", isCollapsed && "text-center")}>
          {isCollapsed ? roleLabel.slice(0, 3) : roleLabel}
        </p>
        {user.role === "SALES_STAFF" ? (
          <Link
            className={cn(
              "mt-2 inline-flex text-xs font-medium text-sidebar-primary/90 hover:underline",
              isCollapsed && "hidden"
            )}
            href="/auth/select-location?next=/dashboard"
          >
            Switch working branch
          </Link>
        ) : null}
        <ThemeSettingsMenu collapsed={isCollapsed} />
        <form action={signOutAction} className="mt-3">
          <Button
            className={cn("w-full", isCollapsed && "px-0")}
            size="sm"
            type="submit"
            variant="outline"
          >
            <LogOut className="size-4" strokeWidth={2.2} />
            <span className={cn("ml-2", isCollapsed && "hidden")}>Sign out</span>
          </Button>
        </form>
        <p className={cn("mt-2 text-sm leading-6 text-sidebar-muted", isCollapsed && "hidden")}>
          {getRoleDescription(user.role)}
        </p>
      </div>
    </aside>
  );
}
