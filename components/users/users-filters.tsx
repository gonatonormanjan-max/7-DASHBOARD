import Link from "next/link";
import type { UserListFilters } from "@/lib/validators/users";
import { Button } from "@/components/ui/button";

type UsersFiltersProps = {
  filters: UserListFilters;
};

export function UsersFilters({ filters }: UsersFiltersProps) {
  return (
    <form
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      method="get"
    >
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Search</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.query}
            name="query"
            placeholder="Search by name or email"
            type="search"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Role</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.role}
            name="role"
          >
            <option value="all">All roles</option>
            <option value="ADMIN">Admin</option>
            <option value="SYSTEM_MANAGER">System Manager</option>
            <option value="SALES_STAFF">Sales Staff</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Status</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.status}
            name="status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Admins can assign all roles. System Managers can manage users but cannot create or edit Admin accounts.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/users">
            <Button type="button" variant="outline">
              Clear
            </Button>
          </Link>
          <Button type="submit">Apply filters</Button>
        </div>
      </div>
    </form>
  );
}
