import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { BranchActivityBranchOption } from "@/lib/dal/reports";
import type { BranchActivityFilters } from "@/lib/validators/reports";

type BranchActivityFiltersProps = {
  filters: BranchActivityFilters;
  branches: BranchActivityBranchOption[];
};

export function BranchActivityFilters({
  filters,
  branches,
}: BranchActivityFiltersProps) {
  return (
    <form
      action="/dashboard/reports"
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      method="get"
    >
      <input name="view" type="hidden" value="branch-activity" />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Branch</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.branchId ?? "all"}
            name="branchId"
          >
            <option value="all">All active branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">From date</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.dateFrom}
            name="dateFrom"
            type="date"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">To date</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.dateTo}
            name="dateTo"
            type="date"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Date filters use Manila business days. Reports are capped at 90 days.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports?view=branch-activity">
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
