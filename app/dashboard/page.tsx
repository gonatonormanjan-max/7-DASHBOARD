import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { MockDataPanel } from "@/components/dashboard/mock-data-panel";
import { requireUser } from "@/lib/dal/auth";
import { getRoleLabel, hasPermission, type PermissionResource } from "@/lib/permissions";

const roleCopy = {
  ADMIN: {
    title: "Enterprise inventory command center",
    description:
      "You have full control across operations, stock governance, reporting, and ownership-level configuration.",
  },
  SYSTEM_MANAGER: {
    title: "Operational control and oversight",
    description:
      "You can manage daily inventory operations, monitor risk, and coordinate teams without ownership-only settings.",
  },
  SALES_STAFF: {
    title: "Sales execution workspace",
    description:
      "You can monitor product availability, create sales orders, and follow delivery progress without direct stock edits.",
  },
} as const;

const capabilityCards: Array<{
  title: string;
  resource: PermissionResource;
  primaryAction: "read" | "create";
  detail: string;
}> = [
  {
    title: "Products and Catalog",
    resource: "products",
    primaryAction: "read",
    detail: "Track SKUs, categories, suppliers, pricing, and product catalog records.",
  },
  {
    title: "Warehouse Operations",
    resource: "warehouses",
    primaryAction: "read",
    detail: "Review stock by warehouse, transfer readiness, and threshold-driven replenishment points.",
  },
  {
    title: "Orders and Movements",
    resource: "sales_orders",
    primaryAction: "create",
    detail: "Process sales flow through controlled inventory effects rather than freeform stock edits.",
  },
  {
    title: "Reporting and Controls",
    resource: "reports",
    primaryAction: "read",
    detail: "Analyze valuation, low stock, movement history, and operational performance over time.",
  },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const copy = roleCopy[user.role];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory MVP"
        title={copy.title}
        description={copy.description}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Role Access"
          value={getRoleLabel(user.role)}
          tone="primary"
          description="Role-aware session and navigation are now enforced from the server."
        />
        <StatCard
          label="Direct Stock Edits"
          value={user.role === "SALES_STAFF" ? "Blocked" : "Controlled"}
          tone={user.role === "SALES_STAFF" ? "warning" : "success"}
          description="Inventory changes will flow through purchase receipts, sales fulfillment, transfers, and adjustments."
        />
        <StatCard
          label="Protected Modules"
          value="11 Areas"
          description="Dashboard, products, warehouses, inventory, suppliers, orders, reports, users, audit logs, and settings."
        />
        <StatCard
          label="Audit Scope"
          value={user.role === "SALES_STAFF" ? "Limited" : "Operational"}
          description="Critical actions are prepared for structured audit logging and role-based review."
        />
      </section>

      {user.role === "ADMIN" ? <MockDataPanel /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Accessible workstreams</h2>
              <p className="mt-1 text-sm text-slate-500">
                This workspace is now gated by the shared permission matrix rather than UI-only hiding.
              </p>
            </div>
            <StatusBadge status="active" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {capabilityCards.map((card) => {
              const allowed = hasPermission(user.role, card.resource, card.primaryAction);

              return (
                <div
                  key={card.title}
                  className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-slate-900">{card.title}</h3>
                    <StatusBadge status={allowed ? "active" : "locked"} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{card.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
          <h2 className="text-lg font-semibold text-slate-950">Implementation baseline</h2>
          <p className="mt-1 text-sm text-slate-500">
            The foundation layer is in place for the next build slices.
          </p>

          <div className="mt-6 space-y-4">
            {[
              "Expanded Prisma domain models for inventory, warehouses, orders, movements, and audit logs.",
              "Role-aware auth sessions now carry server-verifiable access metadata.",
              "Shared navigation and authorization rules are centralized for future modules.",
              "Dashboard shell is ready for live KPIs, charts, tables, and module routes.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
