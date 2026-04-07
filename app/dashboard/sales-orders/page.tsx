import Form from "next/form";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getSalesOrderListData } from "@/lib/dal/sales-orders";
import { formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SalesOrdersTable } from "@/components/sales-orders/sales-orders-table";
import { BulkArchiveButton } from "@/components/sales-orders/archive-actions";

type SalesOrdersPageProps = {
  searchParams: Promise<{
    query?: string | string[];
    window?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesOrdersPage({
  searchParams,
}: SalesOrdersPageProps) {
  const user = await requirePermission("sales_orders", "read");
  const resolvedSearchParams = await searchParams;
  const query = readParam(resolvedSearchParams.query) ?? "";
  const windowFilter = readParam(resolvedSearchParams.window) ?? "all";
  const { orders, summary, filteredCount } = await getSalesOrderListData({
    query,
    window:
      windowFilter === "today" || windowFilter === "7d" || windowFilter === "30d"
        ? windowFilter
        : "all",
  });
  const canCreate = hasPermission(user.role, "sales_orders", "create");
  const hasFilters = query.trim().length > 0 || windowFilter !== "all";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Daily Transactions"
        title="Sales Orders"
        description="Record customer purchases here so completed sales immediately reduce warehouse inventory and create a permanent movement trail."
        action={
          canCreate ? (
            <Link href="/dashboard/sales-orders/new">
              <Button>Record sale</Button>
            </Link>
          ) : null
        }
      />

      <section className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <div className="grid grid-cols-2 gap-3 lg:flex lg:items-center lg:gap-0">
          <div className="lg:border-r lg:border-slate-200 lg:pr-5 lg:mr-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">All sales</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{String(summary.total)}</p>
          </div>
          <div className="lg:border-r lg:border-slate-200 lg:pr-5 lg:mr-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Today</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{String(summary.today)}</p>
          </div>
          <div className="lg:border-r lg:border-slate-200 lg:pr-5 lg:mr-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Revenue</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatCurrency(summary.revenue.toString())}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Recent</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{String(summary.recent)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Find recent sales faster</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by order number, customer, or SKU, or narrow to a recent time window.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            Showing {orders.length} of {filteredCount} result{filteredCount === 1 ? "" : "s"}
            {hasFilters ? " with filters applied." : "."}
          </div>
        </div>

        <Form
          action="/dashboard/sales-orders"
          className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"
        >
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={query}
            name="query"
            placeholder="Search order, customer, or SKU"
            type="search"
          />
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[var(--ring)]"
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
              <Link className="flex-1" href="/dashboard/sales-orders">
                <Button className="w-full" type="button" variant="ghost">
                  Reset
                </Button>
              </Link>
            ) : null}
          </div>
        </Form>
      </section>

      <SalesOrdersTable orders={orders} canCreate={canCreate} hasFilters={hasFilters} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/85 px-5 py-4">
        <div className="flex items-center gap-4">
          <BulkArchiveButton />
          <Link href="/dashboard/sales-orders/archive">
            <Button variant="ghost" className="text-xs text-slate-500 underline">
              View archived orders
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
