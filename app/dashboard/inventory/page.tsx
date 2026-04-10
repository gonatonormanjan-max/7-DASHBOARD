import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, Database, Globe2, Store, Truck } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getInventoryLandingData, type InventoryLocationCard } from "@/lib/dal/inventory";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

function InventoryLocationCardLink({ location }: { location: InventoryLocationCard }) {
  const Icon = location.type === "WAREHOUSE" ? Building2 : Store;
  const lowStockLabel =
    location.lowStockCount > 0
      ? `${location.lowStockCount.toLocaleString("en-US")} low-stock alerts`
      : "All stocked";

  return (
    <Link
      className="group block rounded-[20px] border border-slate-200 bg-slate-50/70 p-5 transition hover:border-slate-300 hover:bg-white hover:shadow-sm cursor-pointer"
      href={`/dashboard/inventory/${location.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600">
              <Icon className="size-4" strokeWidth={2.1} />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">{location.name}</h3>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {location.code}
              </p>
            </div>
          </div>
        </div>

        <ArrowRight className="mt-1 size-4 text-slate-400 transition group-hover:text-slate-600" />
      </div>

      <p className="mt-5 text-sm text-slate-600">
        {location.skuCount.toLocaleString("en-US")} SKUs /{" "}
        {location.totalOnHand.toLocaleString("en-US")} units on hand
      </p>
      <p
        className={`mt-3 text-sm font-semibold ${
          location.lowStockCount > 0 ? "text-[#8a5610]" : "text-[#11664b]"
        }`}
      >
        {lowStockLabel}
      </p>
      <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        View Inventory
        <ArrowRight className="size-4" strokeWidth={2.2} />
      </p>
    </Link>
  );
}

export default async function InventoryPage() {
  const user = await requirePermission("inventory", "read");
  const { locationCards, globalSummary } = await getInventoryLandingData();
  const canManage = hasPermission(user.role, "inventory", "update");
  const warehouses = locationCards.filter((location) => location.type === "WAREHOUSE");
  const branches = locationCards.filter((location) => location.type === "BRANCH");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory Control"
        title="Inventory"
        description="Monitor stock by location, record movements, and manage stock health across all warehouses and branches."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Distinct products with positive on-hand quantity across active locations."
          label="Total SKUs in stock"
          tone="primary"
          value={String(globalSummary.totalSkus)}
        />
        <StatCard
          description="Units currently recorded on hand across every active warehouse and branch."
          label="Total on-hand units"
          tone="success"
          value={globalSummary.totalOnHand.toLocaleString("en-US")}
        />
        <StatCard
          description="Product-location rows at or below reorder level after reserved stock is applied."
          label="Low-stock alerts"
          tone="warning"
          value={String(globalSummary.totalLowStock)}
        />
        <StatCard
          description="Product-location rows with no available stock remaining."
          label="Out of stock"
          value={String(globalSummary.totalOutOfStock)}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Quick Actions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Open dedicated inventory workflows for receipts and opening balances.
          </p>
        </div>

        {canManage ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Link
              className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)] transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
              href="/dashboard/inventory/receive"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf5ff] text-[#16324b]">
                  <Truck className="size-5" strokeWidth={2.1} />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-950">Receive from Supplier</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Record a new delivery from a supplier and update location stock immediately.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)] transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
              href="/dashboard/inventory/initial-stock"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edfff5] text-[#0a4429]">
                  <Database className="size-5" strokeWidth={2.1} />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-950">Set Opening Balance</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Record the initial stock quantity for a product at a location.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)] transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
              href="/dashboard/inventory/stock-setup"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f5f0ff] text-[#3b1f6e]">
                  <ClipboardList className="size-5" strokeWidth={2.1} />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-950">Stock Setup</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Set stock quantities in bulk for a warehouse or branch — ideal for new locations and migrations.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-500">
            Quick actions are only available to users with inventory management permissions.
          </div>
        )}
      </section>

      {warehouses.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-slate-500" strokeWidth={2.1} />
            <h2 className="text-lg font-semibold text-slate-950">Warehouses</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {warehouses.map((location) => (
              <InventoryLocationCardLink key={location.id} location={location} />
            ))}
          </div>
        </section>
      )}

      {branches.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Store className="size-4 text-slate-500" strokeWidth={2.1} />
            <h2 className="text-lg font-semibold text-slate-950">Branches</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((location) => (
              <InventoryLocationCardLink key={location.id} location={location} />
            ))}
          </div>
        </section>
      )}

      {locationCards.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-8 text-center text-sm leading-6 text-slate-500">
          <Globe2 className="mx-auto mb-3 size-8 text-slate-300" strokeWidth={1.5} />
          No active locations found. Create a warehouse or branch to begin tracking inventory.
        </div>
      )}
    </div>
  );
}