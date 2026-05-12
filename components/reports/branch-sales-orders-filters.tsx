import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { BranchActivityBranchOption } from "@/lib/dal/reports";
import {
  BRANCH_SALES_ORDER_STATUS_OPTIONS,
  type BranchSalesOrdersFilters,
} from "@/lib/validators/reports";

type BranchSalesOrdersFiltersProps = {
  filters: BranchSalesOrdersFilters;
  branches: BranchActivityBranchOption[];
};

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function BranchSalesOrdersFilters({
  filters,
  branches,
}: BranchSalesOrdersFiltersProps) {
  return (
    <form
      action="/dashboard/reports"
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      method="get"
    >
      <input name="view" type="hidden" value="branch-sales-orders" />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr_1fr_1fr]">
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
          <span className="text-sm font-medium text-foreground">Status</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.status ?? "all"}
            name="status"
          >
            <option value="all">All statuses</option>
            {BRANCH_SALES_ORDER_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
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

      <div className="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Search</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.query}
            name="query"
            placeholder="Order number or customer name"
            type="search"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            Manila business days. Max 90 days.
          </p>
          <Link href="/dashboard/reports?view=branch-sales-orders">
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
