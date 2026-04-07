"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  Layers3,
  MoveRight,
  Plus,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import type { CurrentUser } from "@/lib/dal/auth";
import type { NavIcon } from "@/lib/permissions";
import { getRoleDescription, getRoleLabel, hasPermission, type NavItem } from "@/lib/permissions";
import { cn } from "@/lib/utils";

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
  const sections = Array.from(new Set(navItems.map((item) => item.section)));

  return (
    <aside className="hidden bg-slate-950 text-slate-100 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:flex-col lg:border-r lg:border-slate-800">
      <div className="border-b border-slate-800 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Northstar Inventory
        </p>
        <h1 className="mt-1.5 text-xl font-semibold text-white">Operations Core</h1>
      </div>

      {hasPermission(user.role, "sales_orders", "create") ? (
        <div className="hidden border-b border-slate-800 px-5 py-4 lg:block">
          <Link
            href="/dashboard/sales-orders/new"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-slate-100 hover:shadow-md active:scale-[0.97]"
          >
            <Plus className="size-4" strokeWidth={2.4} />
            Record Sale
          </Link>
        </div>
      ) : null}

      <div className="overflow-x-auto px-3 py-4 lg:flex-1 lg:overflow-y-auto">
        <div className="flex gap-4 lg:block lg:space-y-6">
          {sections.map((section) => (
            <div key={section} className="min-w-[220px] lg:min-w-0">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {section}
              </p>
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
                          "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200",
                          isActive
                            ? "bg-white text-slate-950 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.7)]"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white active:scale-[0.98]"
                        )}
                      >
                        <Icon className="size-4" strokeWidth={2.2} />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800 px-5 py-5">
        <p className="text-sm font-semibold text-white">
          {user.firstName} {user.lastName}
        </p>
        <p className="mt-1 text-sm text-slate-400">{user.email}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          {getRoleLabel(user.role)}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {getRoleDescription(user.role)}
        </p>
      </div>
    </aside>
  );
}
