import Link from "next/link";
import type { LocationListFilters } from "@/lib/validators/locations";
import { Button } from "@/components/ui/button";

type LocationsFiltersProps = {
  filters: LocationListFilters;
};

export function LocationsFilters({ filters }: LocationsFiltersProps) {
  return (
    <form
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      method="get"
    >
      <input name="page" type="hidden" value="1" />
      <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
      <input name="sortBy" type="hidden" value={filters.sortBy} />
      <input name="sortOrder" type="hidden" value={filters.sortOrder} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Search</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.query}
            name="query"
            placeholder="Search by location name, code, manager, or address"
            type="search"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Type</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.type}
            name="type"
          >
            <option value="all">All locations</option>
            <option value="WAREHOUSE">Warehouse</option>
            <option value="BRANCH">Branch</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Status</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.isActive}
            name="isActive"
          >
            <option value="all">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Keep location records current so stock movement, user assignment, and sales routing stay
          grounded in real operating sites.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/locations">
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
