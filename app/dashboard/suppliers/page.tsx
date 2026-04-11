import Form from "next/form";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getSupplierListData } from "@/lib/dal/suppliers";
import { parseSupplierListFilters } from "@/lib/validators/suppliers";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";

type SuppliersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuppliersPage({
  searchParams,
}: SuppliersPageProps) {
  const user = await requirePermission("suppliers", "read");
  const filters = parseSupplierListFilters(await searchParams);
  const { suppliers, pagination, summary } = await getSupplierListData(filters);
  const canCreate = hasPermission(user.role, "suppliers", "create");
  const hasFilters = Boolean(filters.query || filters.status !== "all");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title="Suppliers"
        description="Manage the supplier directory used for purchase orders. Keep contact details current and deactivate suppliers no longer in use."
        action={
          canCreate ? (
            <Link href="/dashboard/suppliers/new">
              <Button>New Supplier</Button>
            </Link>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          description="Total supplier records in the directory."
          label="Total"
          tone="primary"
          value={String(summary.total)}
        />
        <StatCard
          description="Active suppliers available for purchase orders."
          label="Active"
          tone="success"
          value={String(summary.active)}
        />
        <StatCard
          description="Inactive suppliers excluded from new orders."
          label="Inactive"
          tone="warning"
          value={String(summary.inactive)}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Find suppliers</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by name, contact, or email address. Filter by active status.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Showing {pagination.from}–{pagination.to} of {pagination.totalCount} suppliers
          </p>
        </div>

        <Form
          action="/dashboard/suppliers"
          className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px_auto]"
        >
          <input name="page" type="hidden" value="1" />
          <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={filters.query}
              name="query"
              placeholder="Name, contact, or email"
              type="search"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={filters.status}
              name="status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <Button className="flex-1" type="submit">
              Filter
            </Button>
            {hasFilters ? (
              <Link href="/dashboard/suppliers">
                <Button type="button" variant="outline">
                  Clear
                </Button>
              </Link>
            ) : null}
          </div>
        </Form>

        <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {suppliers.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-sm text-slate-500"
                    colSpan={7}
                  >
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link
                        className="text-sm font-semibold text-primary hover:underline"
                        href={`/dashboard/suppliers/${supplier.id}`}
                      >
                        {supplier.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {supplier.contactName ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {supplier.email ? (
                        <a
                          className="hover:underline"
                          href={`mailto:${supplier.email}`}
                        >
                          {supplier.email}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {supplier.phone ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {supplier._count.purchaseOrders}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {supplier._count.productLinks}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          supplier.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {supplier.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Pagination
        basePath="/dashboard/suppliers"
        pagination={pagination}
        query={filters}
      />
    </div>
  );
}
