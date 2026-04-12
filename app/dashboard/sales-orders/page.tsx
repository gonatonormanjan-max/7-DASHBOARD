import Form from "next/form";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getSalesOrderListData } from "@/lib/dal/sales-orders";
import { parseSalesOrderListFilters } from "@/lib/validators/sales-orders";
import { formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { SalesOrderStatusBadge } from "@/components/sales-orders/sales-order-status-badge";

type SalesOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesOrdersPage({
  searchParams,
}: SalesOrdersPageProps) {
  const user = await requirePermission("sales_orders", "read");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: "/dashboard/sales-orders",
  });
  const filters = parseSalesOrderListFilters(await searchParams);
  const { orders, pagination, summary } = await getSalesOrderListData(filters, {
    locationId: activeLocationId,
  });
  const canCreate = hasPermission(user.role, "sales_orders", "create");
  const hasFilters = Boolean(
    filters.query || filters.status !== "all" || filters.dateFrom || filters.dateTo
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sales"
        title="Sales Orders"
        description="Track branch sales from draft through delivery and completion while keeping stock movements tied to the right status change."
        action={
          canCreate ? (
            <Link href="/dashboard/sales-orders/new">
              <Button>New Sale</Button>
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
          description="Draft orders still being prepared."
          label="Draft"
          value={String(summary.draft)}
        />
        <StatCard
          description="Confirmed orders waiting for branch fulfillment."
          label="Confirmed"
          tone="warning"
          value={String(summary.confirmed)}
        />
        <StatCard
          description="Delivered orders that have already reduced stock."
          label="Delivered"
          tone="success"
          value={String(summary.delivered)}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Find orders quickly</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by order number or customer, filter by workflow status, and narrow
              to a date range.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Showing {pagination.from}-{pagination.to} of {pagination.totalCount} orders
          </p>
        </div>

        <Form
          action="/dashboard/sales-orders"
          className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_220px_repeat(2,190px)_auto]"
        >
          <input name="page" type="hidden" value="1" />
          <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={filters.query}
              name="query"
              placeholder="Search order number or customer"
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
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="DELIVERED">Delivered</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date from</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={filters.dateFrom ?? ""}
              name="dateFrom"
              type="date"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date to</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
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
              <Link href="/dashboard/sales-orders">
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
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {orders.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-sm text-slate-500"
                    colSpan={6}
                  >
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link
                        className="text-sm font-semibold text-primary hover:underline"
                        href={`/dashboard/sales-orders/${order.id}`}
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {order.customerName.trim() || "Customer not set yet"}
                    </td>
                    <td className="px-4 py-3">
                      <SalesOrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {order._count.items}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {formatCurrency(order.totalAmount)}
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

      <Pagination basePath="/dashboard/sales-orders" pagination={pagination} query={filters} />
    </div>
  );
}
