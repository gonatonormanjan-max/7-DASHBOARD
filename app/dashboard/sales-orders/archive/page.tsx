import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getSalesOrderListData } from "@/lib/dal/sales-orders";
import { formatCurrency } from "@/lib/products";
import { canManageSalesOrderArchive } from "@/lib/sales-orders";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SalesOrdersTable } from "@/components/sales-orders/sales-orders-table";

type ArchivePageProps = {
  searchParams: Promise<{
    query?: string | string[];
    window?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesOrdersArchivePage({
  searchParams,
}: ArchivePageProps) {
  const user = await requirePermission("sales_orders", "read");

  if (!canManageSalesOrderArchive(user.role)) {
    redirect("/dashboard/sales-orders");
  }

  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: "/dashboard/sales-orders/archive",
  });
  const resolvedSearchParams = await searchParams;
  const query = readParam(resolvedSearchParams.query) ?? "";
  const windowFilter = readParam(resolvedSearchParams.window) ?? "all";
  const { orders, summary, filteredCount } = await getSalesOrderListData({
    query,
    window:
      windowFilter === "today" || windowFilter === "7d" || windowFilter === "30d"
        ? windowFilter
        : "all",
    archived: true,
  }, {
    locationId: activeLocationId,
  });
  const hasFilters = query.trim().length > 0 || windowFilter !== "all";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Order History"
        title="Archived Sales"
        description="Previously archived sales orders. These orders still count in reports and analytics but are hidden from the active sales view."
        action={
          <Link href="/dashboard/sales-orders">
            <Button variant="outline">Back to active sales</Button>
          </Link>
        }
      />

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-3 lg:flex lg:items-center lg:gap-0">
          <div className="lg:border-r lg:border-slate-200 lg:pr-5 lg:mr-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Archived</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{String(summary.total)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Archived revenue</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatCurrency(summary.revenue.toString())}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Search archived orders</h2>
            <p className="mt-1 text-sm text-slate-500">
              Find archived orders by order number, customer, or SKU.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            Showing {orders.length} of {filteredCount} result{filteredCount === 1 ? "" : "s"}
            {hasFilters ? " with filters applied." : "."}
          </div>
        </div>

        <Form
          action="/dashboard/sales-orders/archive"
          className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"
        >
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={query}
            name="query"
            placeholder="Search order, customer, or SKU"
            type="search"
          />
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={windowFilter}
            name="window"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <div className="flex gap-2">
            <Button className="flex-1" type="submit" variant="outline">
              Apply filters
            </Button>
            {hasFilters ? (
              <Link className="flex-1" href="/dashboard/sales-orders/archive">
                <Button className="w-full" type="button" variant="ghost">
                  Reset
                </Button>
              </Link>
            ) : null}
          </div>
        </Form>
      </section>

      <SalesOrdersTable
        canManageArchive
        orders={orders}
        canCreate={false}
        hasFilters={hasFilters}
        isArchiveView
      />
    </div>
  );
}
