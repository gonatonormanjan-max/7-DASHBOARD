import Link from "next/link";
import type { BrandListFilters } from "@/lib/validators/brands";

type BrandsFiltersProps = {
  filters: BrandListFilters;
};

export function BrandsFilters({ filters }: BrandsFiltersProps) {
  return (
    <form
      className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]"
      method="get"
    >
      <input name="page" type="hidden" value="1" />
      <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

      <div className="grid gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Search</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={filters.query}
            name="query"
            placeholder="Search by brand name or description"
            type="search"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Brands help classify products by manufacturer, label, or house line across
          the shared catalog.
        </p>
        <div className="flex items-center gap-3">
          <Link
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            href="/dashboard/categories/brands"
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
