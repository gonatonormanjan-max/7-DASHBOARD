import Form from "next/form";
import Link from "next/link";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getCashOutListData } from "@/lib/dal/cash-out";
import { formatCurrency } from "@/lib/products";
import { formatDateTimeMNL } from "@/lib/timezone";
import { parseCashOutListFilters } from "@/lib/validators/cash-out";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { CashOutStatusBadge } from "@/components/cash-out/cash-out-status-badge";

type CashOutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatUnits(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildQuery(filters: ReturnType<typeof parseCashOutListFilters>) {
  const query: Record<string, string> = {
    pageSize: String(filters.pageSize),
  };

  if (filters.query) query.query = filters.query;
  if (filters.branchId !== "all") query.branchId = filters.branchId;
  if (filters.accountId !== "all") query.accountId = filters.accountId;
  if (filters.status !== "all") query.status = filters.status;
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  return query;
}

export default async function CashOutPage({ searchParams }: CashOutPageProps) {
  const user = await requirePermission("sales_orders", "read");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: "/dashboard/sales-orders/cash-out",
  });
  const filters = parseCashOutListFilters(await searchParams);
  const data = await getCashOutListData(filters, user, {
    locationId: activeLocationId,
  });
  const canCreate = user.role !== "SYSTEM_MANAGER";
  const canSwitchBranch = data.branches.length > 1;
  const hasFilters = Boolean(
    data.filters.query ||
      data.filters.branchId !== "all" ||
      data.filters.accountId !== "all" ||
      data.filters.status !== "all" ||
      data.filters.dateFrom ||
      data.filters.dateTo
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sales"
        title="Cash Out Service"
        description="Record non-inventory cash-out transactions, keep branch cash controlled, and audit the shared online wallet balance."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/dashboard/sales-orders">
              <Button type="button" variant="outline">
                Product Sales
              </Button>
            </Link>
            {canCreate ? (
              <Link href="/dashboard/sales-orders/cash-out/new">
                <Button type="button">New Cash Out</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cash paid out"
          value={formatCurrency(data.summary.cashPaidOut)}
          tone="warning"
          description="Completed cash-out amount deducted from branch cash vaults."
        />
        <StatCard
          label="Online received"
          value={formatCurrency(data.summary.onlineReceived)}
          tone="primary"
          description="Completed online amount credited to the shared cash-out service vault."
        />
        <StatCard
          label="Service fee revenue"
          value={formatCurrency(data.summary.feeRevenue)}
          tone="success"
          description="Completed cash-out fees only; voided records are excluded."
        />
        <StatCard
          label="Transactions"
          value={formatUnits(data.summary.transactionCount)}
          description={`${formatUnits(data.summary.completedCount)} completed / ${formatUnits(data.summary.voidedCount)} voided in this filter.`}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Find cash-out transactions
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by transaction number, online reference, customer, branch,
              wallet account, status, and date range.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Showing {data.pagination.from}-{data.pagination.to} of{" "}
            {data.pagination.totalCount} records
          </p>
        </div>

        <Form
          action="/dashboard/sales-orders/cash-out"
          className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_180px_180px_180px_repeat(2,170px)_auto]"
        >
          <input name="page" type="hidden" value="1" />
          <input name="pageSize" type="hidden" value={String(data.filters.pageSize)} />

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={data.filters.query}
              name="query"
              placeholder="Transaction, reference, customer"
              type="search"
            />
          </label>

          {canSwitchBranch ? (
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Branch</span>
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                defaultValue={data.filters.branchId}
                name="branchId"
              >
                <option value="all">All branches</option>
                {data.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Account</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={data.filters.accountId}
              name="accountId"
            >
              <option value="all">All accounts</option>
              {data.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={data.filters.status}
              name="status"
            >
              <option value="all">All statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="VOIDED">Voided</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date from</span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={data.filters.dateFrom ?? ""}
              name="dateFrom"
              type="date"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date to</span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={data.filters.dateTo ?? ""}
              name="dateTo"
              type="date"
            />
          </label>

          <div className="flex items-end gap-2">
            <Button className="flex-1" type="submit">
              Filter
            </Button>
            {hasFilters ? (
              <Link href="/dashboard/sales-orders/cash-out">
                <Button type="button" variant="outline">
                  Clear
                </Button>
              </Link>
            ) : null}
          </div>
        </Form>
      </section>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-4 py-3 font-medium">Transaction</th>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 text-right font-medium">Cash out</th>
              <th className="px-4 py-3 text-right font-medium">Fee</th>
              <th className="px-4 py-3 text-right font-medium">Online received</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                  colSpan={8}
                >
                  No cash-out transactions found.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border align-top transition hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-primary hover:underline"
                      href={`/dashboard/sales-orders/cash-out/${row.id}`}
                    >
                      {row.transactionNumber}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ref: {row.onlineReferenceNumber}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.branchName} ({row.branchCode})
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.accountName}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(row.cashOutAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {formatCurrency(row.feeAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(row.onlineReceivedAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <CashOutStatusBadge status={row.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDateTimeMNL(row.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/dashboard/sales-orders/cash-out"
        pagination={data.pagination}
        query={buildQuery(data.filters)}
        itemLabel="cash-out records"
      />
    </div>
  );
}
