import Link from "next/link";
import type { LocationListFilters } from "@/lib/validators/locations";

type LocationsFiltersProps = {
  filters: LocationListFilters;
};

export function LocationsFilters({ filters }: LocationsFiltersProps) {
  return (
    <form
      className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]"
      method="get"
    >
      <input name="page" type="hidden" value="1" />
      <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
      <input name="sortBy" type="hidden" value={filters.sortBy} />
      <input name="sortOrder" type="hidden" value={filters.sortOrder} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Search</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={filters.query}
            name="query"
            placeholder="Search by location name, code, manager, or address"
            type="search"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Type</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={filters.type}
            name="type"
          >
            <option value="all">All locations</option>
            <option value="WAREHOUSE">Warehouse</option>
            <option value="BRANCH">Branch</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={filters.isActive}
            name="isActive"
          >
            <option value="all">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Keep location records current so stock movement, user assignment, and sales routing stay
          grounded in real operating sites.
        </p>
        <div className="flex items-center gap-3">
          <Link
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            href="/dashboard/locations"
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
