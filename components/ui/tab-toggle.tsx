"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type TabToggleProps = {
  tabs: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
};

export function TabToggle({ tabs }: TabToggleProps) {
  return (
    <div className="inline-flex gap-1 rounded-2xl bg-slate-100 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "inline-flex items-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
            tab.active
              ? "bg-primary text-primary-foreground"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
          href={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
