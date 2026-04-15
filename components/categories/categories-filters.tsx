import Link from "next/link";
import type { CategoryListFilters } from "@/lib/validators/categories";
import { Button } from "@/components/ui/button";

type CategoriesFiltersProps = {
  filters: CategoryListFilters;
};

export function CategoriesFilters({ filters }: CategoriesFiltersProps) {
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
            placeholder="Search by category name or description"
            type="search"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Sort by</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.sortBy}
            name="sortBy"
          >
            <option value="updatedAt">Last updated</option>
            <option value="createdAt">Created</option>
            <option value="name">Name</option>
            <option value="productCount">Product count</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Order</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.sortOrder}
            name="sortOrder"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Categories organize the shared catalog and should stay clean before supplier and order flows expand.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/categories">
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
