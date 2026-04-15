import Link from "next/link";
import type { BrandListFilters } from "@/lib/validators/brands";
import { Button } from "@/components/ui/button";

type BrandsFiltersProps = {
  filters: BrandListFilters;
};

export function BrandsFilters({ filters }: BrandsFiltersProps) {
  return (
    <form
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      method="get"
    >
      <input name="page" type="hidden" value="1" />
      <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

      <div className="grid gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Search</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.query}
            name="query"
            placeholder="Search by brand name or description"
            type="search"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Brands help classify products by manufacturer, label, or house line across
          the shared catalog.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/categories/brands">
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
