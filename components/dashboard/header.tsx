import { Search } from "lucide-react";
import { signOut } from "@/lib/auth";
import type { CurrentUser } from "@/lib/dal/auth";
import { getRoleLabel } from "@/lib/permissions";
import { DashboardTutorial } from "@/components/dashboard/tutorial";
import { Button } from "@/components/ui/button";

export function DashboardHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-[rgba(244,247,251,0.88)] px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Internal control center
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            Welcome back, {user.firstName}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitor inventory, coordinate stock movements, and keep operations aligned.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <DashboardTutorial firstName={user.firstName} role={user.role} />

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]"
          >
            <Search className="size-4" />
            Global search coming next
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {getRoleLabel(user.role)}
            </p>
            <p className="mt-1 text-sm text-slate-600">{user.email}</p>
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/auth/login" });
            }}
          >
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
