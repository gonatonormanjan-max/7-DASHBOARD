import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { upsertCashOutAccountAction } from "@/lib/actions/cash-out";
import { formatCashOutServiceVaultType } from "@/lib/cash-out";
import { requirePermission } from "@/lib/dal/auth";
import { getCashOutServiceVaultData } from "@/lib/dal/cash-out";
import { formatCurrency } from "@/lib/products";
import { formatDateTimeMNL } from "@/lib/timezone";
import { parseCashOutListFilters } from "@/lib/validators/cash-out";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { CashOutAccountManager } from "@/components/cash-out/cash-out-account-manager";

type CashOutServiceVaultPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildQuery(filters: ReturnType<typeof parseCashOutListFilters>) {
  const query: Record<string, string> = {
    pageSize: String(filters.pageSize),
  };

  if (filters.accountId !== "all") query.accountId = filters.accountId;
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  return query;
}

export default async function CashOutServiceVaultPage({
  searchParams,
}: CashOutServiceVaultPageProps) {
  const user = await requirePermission("vault", "read");

  if (user.role !== "ADMIN" && user.role !== "SYSTEM_MANAGER") {
    redirect("/dashboard/vault");
  }

  const filters = parseCashOutListFilters(await searchParams);
  const data = await getCashOutServiceVaultData(filters, user);
  const hasFilters = Boolean(
    data.filters.accountId !== "all" || data.filters.dateFrom || data.filters.dateTo
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Finance"
        title="Cash Out Service Vault"
        description="Shared online wallet balance for cash-out service transactions across all branches."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/dashboard/vault">
              <Button type="button" variant="outline">
                Branch Vault
              </Button>
            </Link>
            <Link href="/dashboard/sales-orders/cash-out">
              <Button type="button" variant="outline">
                Cash Out Records
              </Button>
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Service vault balance"
          value={formatCurrency(data.totalServiceVaultBalance)}
          tone="primary"
          description="Total shared online balance across active and inactive accounts."
        />
        <StatCard
          label="Completed cash out"
          value={formatCurrency(data.summary.cashPaidOut)}
          tone="warning"
          description="Physical cash paid out in the selected transaction filter."
        />
        <StatCard
          label="Online received"
          value={formatCurrency(data.summary.onlineReceived)}
          tone="primary"
          description="Online money received from customers in completed transactions."
        />
        <StatCard
          label="Service fee revenue"
          value={formatCurrency(data.summary.feeRevenue)}
          tone="success"
          description="Fees earned by the cash-out service in completed transactions."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.accountBalances.map((account) => (
          <StatCard
            key={account.id}
            label={account.name}
            value={formatCurrency(account.balance)}
            tone={account.isActive ? "default" : "warning"}
            description={account.isActive ? "Active wallet account." : "Inactive wallet account."}
          />
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Service vault ledger
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Every online credit and void reversal for the shared cash-out
              service vault.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Showing {data.ledger.pagination.from}-{data.ledger.pagination.to} of{" "}
            {data.ledger.pagination.totalCount} entries
          </p>
        </div>

        <Form
          action="/dashboard/vault/cash-out-service"
          className="mt-6 grid gap-4 lg:grid-cols-[220px_repeat(2,180px)_auto]"
        >
          <input name="page" type="hidden" value="1" />
          <input name="pageSize" type="hidden" value={String(data.filters.pageSize)} />

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
              <Link href="/dashboard/vault/cash-out-service">
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
              <th className="px-4 py-3 font-medium">Date / Time</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 font-medium">Performed By</th>
            </tr>
          </thead>
          <tbody>
            {data.ledger.rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                  colSpan={7}
                >
                  No service vault ledger entries found.
                </td>
              </tr>
            ) : (
              data.ledger.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border align-top transition hover:bg-muted/30"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {formatDateTimeMNL(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatCashOutServiceVaultType(row.type)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.accountName}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-primary hover:underline"
                      href={`/dashboard/sales-orders/cash-out/${row.transactionId}`}
                    >
                      {row.transactionNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.branchName} ({row.branchCode})
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.performedByName}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/dashboard/vault/cash-out-service"
        pagination={data.ledger.pagination}
        query={buildQuery(data.filters)}
        itemLabel="service vault ledger entries"
      />

      <CashOutAccountManager
        accounts={data.accountBalances}
        action={upsertCashOutAccountAction}
      />
    </div>
  );
}
