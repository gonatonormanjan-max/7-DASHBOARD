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
    <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab.active
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
          href={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
