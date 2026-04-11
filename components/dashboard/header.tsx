import { Search } from "lucide-react";
import { signOut } from "@/lib/auth";
import type { CurrentUser } from "@/lib/dal/auth";
import { getRoleLabel } from "@/lib/permissions";
import { DashboardTutorial } from "@/components/dashboard/tutorial";
import { Button } from "@/components/ui/button";

export function DashboardHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <p className="tracking-label text-[10px] text-muted-foreground">
            Internal control center
          </p>
          <h2 className="text-lg font-semibold text-foreground leading-tight">
            Welcome back, {user.firstName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor inventory, coordinate stock movements, and keep operations aligned.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <DashboardTutorial firstName={user.firstName} role={user.role} />

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Search className="size-4" />
            Global search coming next
          </button>

          <div className="rounded-lg border border-border bg-background px-4 py-2">
            <p className="tracking-label text-[10px] text-muted-foreground">
              {getRoleLabel(user.role)}
            </p>
            <p className="mt-1 text-sm text-foreground">{user.email}</p>
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
