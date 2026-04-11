import Link from "next/link";
import { getMovementTypeLabel } from "@/lib/inventory";
import type { InventoryPageFilters } from "@/lib/validators/inventory";

type InventoryFiltersProps = {
  filters: InventoryPageFilters;
  categories: Array<{
    id: string;
    name: string;
  }>;
  brands: Array<{
    id: string;
    name: string;
  }>;
  locations: Array<{
    id: string;
    name: string;
    code: string;
  }>;
};

const movementTypeOptions = [
  "PURCHASE_RECEIVED",
  "SALES_FULFILLED",
  "MANUAL_ADJUSTMENT",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "CUSTOMER_RETURN",
  "DAMAGED_LOST",
  "INITIAL_STOCK",
] as const;

export function InventoryFilters({
  filters,
  categories,
  brands,
  locations,
}: InventoryFiltersProps) {
  return (
    <form
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      method="get"
    >
      <div className="grid gap-4 xl:grid-cols-4">
        <label className="space-y-2 xl:col-span-2">
          <span className="text-sm font-medium text-slate-700">Search product</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.query}
            name="query"
            placeholder="Search by name or SKU"
            type="search"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Location</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.locationId ?? ""}
            name="locationId"
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Category</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.categoryId ?? ""}
            name="categoryId"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Brand</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.brandId ?? ""}
            name="brandId"
          >
            <option value="">All brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Movement type</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.movementType}
            name="movementType"
          >
            <option value="all">All movements</option>
            {movementTypeOptions.map((type) => (
              <option key={type} value={type}>
                {getMovementTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">From date</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.dateFrom ?? ""}
            name="dateFrom"
            type="date"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">To date</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.dateTo ?? ""}
            name="dateTo"
            type="date"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-4 border-t border-slate-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="inline-flex items-center gap-3 text-sm text-slate-600">
          <input
            className="h-4 w-4 rounded border-slate-300 text-primary focus-visible:ring-ring/30"
            defaultChecked={filters.lowStockOnly}
            name="lowStockOnly"
            type="checkbox"
            value="true"
          />
          Show only low-stock rows in the stock overview.
        </label>

        <div className="flex items-center gap-3">
          <Link
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            href="/dashboard/inventory"
          >
            Clear
          </Link>
          <button
            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-[#16304f]"
            type="submit"
          >
            Apply filters
          </button>
        </div>
      </div>
    </form>
  );
}
