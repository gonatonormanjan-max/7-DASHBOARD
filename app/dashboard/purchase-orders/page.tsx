import Form from "next/form";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getPurchaseOrderListData } from "@/lib/dal/purchase-orders";
import { parsePurchaseOrderListFilters } from "@/lib/validators/purchase-orders";
import { formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { PurchaseOrderStatusBadge } from "@/components/purchase-orders/po-status-badge";

type PurchaseOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PurchaseOrdersPage({
  searchParams,
}: PurchaseOrdersPageProps) {
  const user = await requirePermission("purchase_orders", "read");
  const filters = parsePurchaseOrderListFilters(await searchParams);
  const { orders, pagination, summary } = await getPurchaseOrderListData(filters);
  const canCreate = hasPermission(user.role, "purchase_orders", "create");
  const hasFilters = Boolean(
    filters.query || filters.status !== "all" || filters.dateFrom || filters.dateTo
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title="Purchase Orders"
        description="Track incoming supplier orders from draft through receiving while keeping warehouse stock changes tightly controlled."
        action={
          canCreate ? (
            <Link href="/dashboard/purchase-orders/new">
              <Button>New Purchase Order</Button>
            </Link>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Orders in the current search and date window."
          label="Total"
          tone="primary"
          value={String(summary.total)}
        />
        <StatCard
          description="Draft orders waiting for approval."
          label="Draft"
          value={String(summary.draft)}
        />
        <StatCard
          description="Approved orders ready for receiving."
          label="Approved"
          tone="warning"
          value={String(summary.approved)}
        />
        <StatCard
          description="Fully received orders already added to stock."
          label="Received"
          tone="success"
          value={String(summary.received)}
        />
      </section>

      <section className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Find purchase orders</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by order number or supplier, filter by workflow status, and narrow to a
              date range.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Showing {pagination.from}-{pagination.to} of {pagination.totalCount} orders
          </p>
        </div>

        <Form
          action="/dashboard/purchase-orders"
          className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_220px_repeat(2,190px)_auto]"
        >
          <input name="page" type="hidden" value="1" />
          <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={filters.query}
              name="query"
              placeholder="Search order number or supplier"
              type="search"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={filters.status}
              name="status"
            >
              <option value="all">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date from</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={filters.dateFrom ?? ""}
              name="dateFrom"
              type="date"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date to</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={filters.dateTo ?? ""}
              name="dateTo"
              type="date"
            />
          </label>

          <div className="flex items-end gap-2">
            <Button className="flex-1" type="submit">
              Filter
            </Button>
            {hasFilters ? (
              <Link href="/dashboard/purchase-orders">
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
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {orders.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link
                        className="text-sm font-semibold text-primary hover:underline"
                        href={`/dashboard/purchase-orders/${order.id}`}
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {order.supplier.name}
                    </td>
                    <td className="px-4 py-3">
                      <PurchaseOrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {order._count.items}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {formatCurrency(order.totalAmount.toString())}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {order.createdAt.toLocaleDateString("en-PH", {
                        dateStyle: "medium",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Pagination basePath="/dashboard/purchase-orders" pagination={pagination} query={filters} />
    </div>
  );
}
