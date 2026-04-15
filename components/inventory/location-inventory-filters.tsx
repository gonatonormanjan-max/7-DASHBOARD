import Link from "next/link";
import type { InventoryPageFilters, InventoryTab } from "@/lib/validators/inventory";

type LocationInventoryFiltersProps = {
  actionPath: string;
  clearHref: string;
  tab: InventoryTab;
  filters: InventoryPageFilters;
  categories: Array<{
    id: string;
    name: string;
  }>;
  brands: Array<{
    id: string;
    name: string;
  }>;
};

export function LocationInventoryFilters({
  actionPath,
  clearHref,
  tab,
  filters,
  categories,
  brands,
}: LocationInventoryFiltersProps) {
  return (
    <form
      action={actionPath}
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      method="get"
    >
      <input name="tab" type="hidden" value={tab} />
      <input name="page" type="hidden" value="1" />
      <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
      <input name="sortBy" type="hidden" value={filters.sortBy} />
      <input name="sortOrder" type="hidden" value={filters.sortOrder} />

      {tab !== "movements" ? (
        <>
          <input name="movementType" type="hidden" value={filters.movementType} />
          <input name="dateFrom" type="hidden" value={filters.dateFrom ?? ""} />
          <input name="dateTo" type="hidden" value={filters.dateTo ?? ""} />
        </>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <label className="space-y-2 xl:col-span-2">
          <span className="text-sm font-medium text-slate-700">Search product</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.query}
            name="query"
            placeholder="Search by product name or SKU"
            type="search"
          />
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

        {tab === "movements" ? (
          <>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Movement type</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                defaultValue={filters.movementType}
                name="movementType"
              >
                <option value="all">All movements</option>
                <option value="PURCHASE_RECEIVED">Purchase received</option>
                <option value="TRANSFER_OUT">Transfer out</option>
                <option value="TRANSFER_IN">Transfer in</option>
                <option value="SALES_FULFILLED">Sales fulfilled</option>
                <option value="CUSTOMER_RETURN">Customer return</option>
                <option value="MANUAL_ADJUSTMENT">Manual adjustment</option>
                <option value="DAMAGED_LOST">Damaged or lost</option>
                <option value="INITIAL_STOCK">Opening stock</option>
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
          </>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
        <Link
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          href={clearHref}
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
    </form>
  );
}
