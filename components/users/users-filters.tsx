import Link from "next/link";
import type { UserListFilters } from "@/lib/validators/users";

type UsersFiltersProps = {
  filters: UserListFilters;
};

export function UsersFilters({ filters }: UsersFiltersProps) {
  return (
    <form
      className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]"
      method="get"
    >
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Search</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={filters.query}
            name="query"
            placeholder="Search by name or email"
            type="search"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Role</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
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
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={filters.status}
            name="status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Admins can assign all roles. System Managers can manage users but cannot create or edit Admin accounts.
        </p>
        <div className="flex items-center gap-3">
          <Link
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            href="/dashboard/users"
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
