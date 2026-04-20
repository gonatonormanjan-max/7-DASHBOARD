import { Wallet } from "lucide-react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal/auth";
import {
  getAccessibleVaultBranches,
  getBranchVaultBalance,
  getVaultLedger,
} from "@/lib/dal/vault";
import { parseVaultFilters } from "@/lib/validators/vault";
import { businessDayEnd, businessDayStart, formatDateTimeMNL } from "@/lib/timezone";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Pagination } from "@/components/ui/pagination";
import { VaultFiltersForm } from "@/components/vault/vault-filters";
import { VaultLedgerTable } from "@/components/vault/ledger-table";
import { CashDropModal } from "@/components/vault/cash-drop-modal";
import { VaultTransactionType, VaultPaymentMethod } from "@prisma/client";

type VaultPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

function formatPHP(value: { toString(): string }) {
  return PHP.format(Number(value.toString()));
}

export default async function VaultPage({ searchParams }: VaultPageProps) {
  const user = await requirePermission("vault", "read");

  const filters = parseVaultFilters(await searchParams);

  const branches = await getAccessibleVaultBranches(user);

  // No accessible branches → nothing to show. MANAGERs without an assigned
  // branch land here; treat as a soft 404.
  if (branches.length === 0) {
    notFound();
  }

  // Resolve which branch to display. If the URL's branchId isn't in the user's
  // allowed list, silently fall back to the first one (defensive, not an
  // error screen — the URL may be stale after a role change).
  const selectedBranch =
    branches.find((b) => b.id === filters.branchId) ?? branches[0];

  const canSwitchBranch =
    user.role === "ADMIN" || user.role === "SYSTEM_MANAGER";

  // Only MANAGER and ADMIN can create cash drops.
  // SYSTEM_MANAGER has vault: ["read"] only — no "create" permission.
  const canCashDrop = user.role === "ADMIN" || user.role === "MANAGER";

  // Convert YYYY-MM-DD filter strings → UTC boundaries at Manila midnight.
  const dateFrom = filters.dateFrom ? businessDayStart(filters.dateFrom) : undefined;
  const dateTo = filters.dateTo ? businessDayEnd(filters.dateTo) : undefined;

  const typeFilter =
    filters.type && filters.type !== "all"
      ? (filters.type as VaultTransactionType)
      : undefined;
  const methodFilter =
    filters.method && filters.method !== "all"
      ? (filters.method as VaultPaymentMethod)
      : undefined;

  const [balance, ledger] = await Promise.all([
    getBranchVaultBalance(selectedBranch.id),
    getVaultLedger({
      branchId: selectedBranch.id,
      dateFrom,
      dateTo,
      type: typeFilter,
      paymentMethod: methodFilter,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  ]);

  const lastUpdatedText = balance.lastUpdatedAt
    ? `Last activity: ${formatDateTimeMNL(balance.lastUpdatedAt)}`
    : "No activity yet.";

  // Preserve active filters in pagination links.
  const paginationQuery: Record<string, string> = {
    branchId: selectedBranch.id,
  };
  if (filters.type && filters.type !== "all") paginationQuery.type = filters.type;
  if (filters.method && filters.method !== "all")
    paginationQuery.method = filters.method;
  if (filters.dateFrom) paginationQuery.dateFrom = filters.dateFrom;
  if (filters.dateTo) paginationQuery.dateTo = filters.dateTo;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Finance"
        title="Branch Vault"
        description="Running cash and online balances per branch, with the full append-only ledger of every credit and debit."
        action={
          <div className="flex items-center gap-3">
            {canCashDrop ? (
              <CashDropModal
                branchId={selectedBranch.id}
                branchName={selectedBranch.name}
              />
            ) : null}
            <div className="flex items-center gap-2 rounded-full border border-[#c5e7db] bg-[#edf8f4] px-3 py-1.5">
              <Wallet className="size-4 text-[#11664b]" strokeWidth={2.2} />
              <span className="text-xs font-semibold text-[#11664b] uppercase tracking-[0.18em]">
                {selectedBranch.name}
              </span>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <StatCard
          label="Cash balance"
          value={formatPHP(balance.cashBalance)}
          description={lastUpdatedText}
          tone={
            Number(balance.cashBalance.toString()) < 0 ? "warning" : "primary"
          }
        />
        <StatCard
          label="Online balance"
          value={formatPHP(balance.onlineBalance)}
          description={lastUpdatedText}
          tone={
            Number(balance.onlineBalance.toString()) < 0 ? "warning" : "primary"
          }
        />
      </section>

      <VaultFiltersForm
        filters={filters}
        branches={branches}
        selectedBranchId={selectedBranch.id}
        canSwitchBranch={canSwitchBranch}
      />

      <VaultLedgerTable rows={ledger.rows} />

      <Pagination
        basePath="/dashboard/vault"
        pagination={ledger.pagination}
        query={paginationQuery}
        itemLabel="ledger entries"
      />
    </div>
  );
}
