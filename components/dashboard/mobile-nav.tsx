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
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import type { NavIcon, NavItem } from "@/lib/permissions";
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

type MobileBottomNavProps = {
  navItems: NavItem[];
};

export function MobileBottomNav({ navItems }: MobileBottomNavProps) {
  const pathname = usePathname();
  const visibleItems = navItems.slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="flex items-center justify-around">
        {visibleItems.map((item) => {
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
                "flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all duration-200 active:scale-90",
                isActive ? "text-[var(--primary)]" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="text-[10px] font-medium leading-none">
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
