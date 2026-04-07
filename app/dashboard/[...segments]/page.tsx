import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/dal/auth";
import type { PermissionResource } from "@/lib/permissions";

const moduleConfig: Record<
  string,
  { title: string; description: string; resource: PermissionResource }
> = {
  products: {
    title: "Products",
    description:
      "Product catalog management will live here, including SKU details, supplier links, pricing, stock posture, and reorder controls.",
    resource: "products",
  },
  suppliers: {
    title: "Suppliers",
    description:
      "Supplier records, contact details, and procurement relationships will be managed here.",
    resource: "suppliers",
  },
  warehouses: {
    title: "Warehouses",
    description:
      "Warehouse-level stock visibility, location details, and transfer workflows will be built into this module.",
    resource: "locations",
  },
  "purchase-orders": {
    title: "Purchase Orders",
    description:
      "Draft, approval, and receiving workflows will connect supplier activity to controlled stock increases.",
    resource: "purchase_orders",
  },
  "sales-orders": {
    title: "Sales Orders",
    description:
      "Sales order creation, confirmation, delivery, and completion will route stock changes through approved workflow stages.",
    resource: "sales_orders",
  },
  "audit-logs": {
    title: "Audit Logs",
    description:
      "Critical operational actions and account changes will be tracked here for Admin and System Manager review.",
    resource: "audit_logs",
  },
  settings: {
    title: "Settings",
    description:
      "System configuration, business defaults, and internal operating thresholds will be managed here.",
    resource: "settings",
  },
};

export default async function DashboardModulePlaceholder({
  params,
}: PageProps<"/dashboard/[...segments]">) {
  const { segments } = await params;
  const key = segments[0];
  const selectedModule = moduleConfig[key];

  if (!selectedModule) {
    notFound();
  }

  await requirePermission(selectedModule.resource, "read");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module Scaffold"
        title={selectedModule.title}
        description={selectedModule.description}
        action={
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        }
      />

      <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <h2 className="text-lg font-semibold text-slate-950">Queued for the next phase</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          This route is intentionally scaffolded so the new role-based navigation works
          today while the underlying module screens, DAL, actions, and table flows are
          implemented in the next slices.
        </p>
      </div>
    </div>
  );
}
