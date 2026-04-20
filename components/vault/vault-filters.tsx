import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  VAULT_PAYMENT_METHODS,
  VAULT_PAYMENT_METHOD_LABELS,
  VAULT_TRANSACTION_TYPES,
  VAULT_TRANSACTION_TYPE_LABELS,
  type VaultFilters,
} from "@/lib/validators/vault";
import type { VaultBranchOption } from "@/lib/dal/vault";

type VaultFiltersFormProps = {
  filters: VaultFilters;
  branches: VaultBranchOption[];
  selectedBranchId: string;
  /** True when ADMIN/SYSTEM_MANAGER — can switch branches. Managers are locked. */
  canSwitchBranch: boolean;
};

export function VaultFiltersForm({
  filters,
  branches,
  selectedBranchId,
  canSwitchBranch,
}: VaultFiltersFormProps) {
  const showBranchSelect = canSwitchBranch && branches.length > 1;

  return (
    <form
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      method="get"
    >
      <div
        className={
          showBranchSelect
            ? "grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]"
            : "grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr]"
        }
      >
        {showBranchSelect ? (
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Branch</span>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={selectedBranchId}
              name="branchId"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </label>
        ) : (
          // Preserve the currently-selected branchId through filter submit even
          // when the select is hidden (single-branch MANAGER case).
          <input type="hidden" name="branchId" value={selectedBranchId} />
        )}

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Type</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.type}
            name="type"
          >
            {VAULT_TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {VAULT_TRANSACTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Method</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.method}
            name="method"
          >
            {VAULT_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {VAULT_PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">From date</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.dateFrom ?? ""}
            name="dateFrom"
            type="date"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">To date</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.dateTo ?? ""}
            name="dateTo"
            type="date"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Ledger entries shown in Manila time. Balances are running totals — not
          historical snapshots.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/vault?branchId=${encodeURIComponent(selectedBranchId)}`}
          >
            <Button type="button" variant="outline">
              Clear
            </Button>
          </Link>
          <Button type="submit">Apply filters</Button>
        </div>
      </div>
    </form>
  );
}
