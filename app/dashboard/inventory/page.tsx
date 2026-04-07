import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { adjustInventoryAction, transferInventoryAction } from "@/lib/actions/inventory";
import { getInventoryPageData } from "@/lib/dal/inventory";
import { parseInventoryFilters } from "@/lib/validators/inventory";
import { InventoryAdjustmentForm } from "@/components/inventory/inventory-adjustment-form";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { LowStockTable } from "@/components/inventory/low-stock-table";
import { InventoryMovementTable } from "@/components/inventory/movement-table";
import { InventoryStockTable } from "@/components/inventory/stock-table";
import { InventoryTransferForm } from "@/components/inventory/inventory-transfer-form";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

type InventoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const user = await requirePermission("inventory", "read");
  const filters = parseInventoryFilters(await searchParams);
  const { stockRows, lowStockRows, movements, options, summary } =
    await getInventoryPageData(filters);
  const canManage = hasPermission(user.role, "inventory", "update");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory Control"
        title="Inventory"
        description="Monitor warehouse stock, review movement history, correct counts, and move available inventory between active locations."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Unique products with available stock in the current filtered view."
          label="SKUs in stock"
          tone="primary"
          value={String(summary.skuCount)}
        />
        <StatCard
          description="Rows at or below their reorder level after reserved stock is considered."
          label="Low-stock rows"
          tone="warning"
          value={String(summary.lowStockCount)}
        />
        <StatCard
          description="Rows with no available stock remaining in the filtered overview."
          label="Out of stock"
          value={String(summary.outOfStockCount)}
        />
        <StatCard
          description="Total on-hand units across the visible stock rows."
          label="On-hand units"
          tone="success"
          value={summary.onHandUnits.toLocaleString("en-US")}
        />
      </section>

      <InventoryFilters
        categories={options.categories}
        filters={filters}
        suppliers={options.suppliers}
        locations={options.locations}
      />

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Stock overview</h2>
            <p className="mt-1 text-sm text-slate-500">
              Warehouse-level stock posture with reserved and available quantities shown side by
              side.
            </p>
          </div>
          <InventoryStockTable stockRows={stockRows} />
        </div>

        <div className="space-y-6">
          {canManage ? (
            <>
              <InventoryAdjustmentForm
                action={adjustInventoryAction}
                products={options.products}
                locations={options.locations}
              />
              <InventoryTransferForm
                action={transferInventoryAction}
                products={options.products}
                locations={options.locations}
              />
            </>
          ) : (
            <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
              <h2 className="text-lg font-semibold text-slate-950">Read-only access</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Your role can review stock posture and the movement ledger, but only Admin and
                System Manager accounts can record adjustments or transfers.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Low-stock view</h2>
          <p className="mt-1 text-sm text-slate-500">
            Rows needing attention first, sorted by shortage severity after reserved stock is
            applied.
          </p>
        </div>
        <LowStockTable lowStockRows={lowStockRows} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Movement ledger</h2>
          <p className="mt-1 text-sm text-slate-500">
            The 40 most recent inventory movements for the current filter set.
          </p>
        </div>
        <InventoryMovementTable movements={movements} />
      </section>
    </div>
  );
}
