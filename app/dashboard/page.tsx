import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getDashboardData } from "@/lib/dal/dashboard";
import { hasPermission, type PermissionResource } from "@/lib/permissions";

const roleCopy = {
  ADMIN: {
    eyebrow: "Welcome back",
    title: "Admin Dashboard",
    description:
      "",
  },
  SYSTEM_MANAGER: {
    eyebrow: "Welcome back",
    title: "Operations Dashboard",
    description:
      "Manage daily inventory operations, monitor stock health, and coordinate across locations.",
  },
  SALES_STAFF: {
    eyebrow: "Welcome back",
    title: "Sales Workspace",
    description:
      "Monitor product availability and record sales orders for your selected branch.",
  },
} as const;

const moduleLinks: Array<{
  title: string;
  description: string;
  href: string;
  resource: PermissionResource;
  action: "read" | "create";
}> = [
  {
    title: "Products",
    description: "Browse and manage the product catalog — SKUs, pricing, categories, and brands.",
    href: "/dashboard/products",
    resource: "products",
    action: "read",
  },
  {
    title: "Inventory",
    description: "View live stock by location, record movements, and adjust counts.",
    href: "/dashboard/inventory",
    resource: "inventory",
    action: "read",
  },
  {
    title: "Sales Orders",
    description: "Record new sales and view completed transaction history.",
    href: "/dashboard/sales-orders",
    resource: "sales_orders",
    action: "read",
  },
  {
    title: "Locations",
    description: "Manage warehouse and branch locations for your business.",
    href: "/dashboard/locations",
    resource: "locations",
    action: "read",
  },
  {
    title: "Categories",
    description: "Organize products using categories and brands.",
    href: "/dashboard/categories",
    resource: "categories",
    action: "read",
  },
  {
    title: "Reports",
    description: "Analyze sales trends, stock health, and operational performance.",
    href: "/dashboard/reports",
    resource: "reports",
    action: "read",
  },
];

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

type DashboardStatLinkCardProps = {
  label: string;
  value: string;
  description?: string;
  tone?: "default" | "primary" | "success" | "warning";
  href?: string;
};

function DashboardStatLinkCard({
  href,
  label,
  value,
  description,
  tone,
}: DashboardStatLinkCardProps) {
  const content = (
    <StatCard
      description={description}
      label={label}
      tone={tone}
      value={value}
    />
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      href={href}
    >
      {content}
    </Link>
  );
}

function formatLocationCount(count: number, singular: string, plural: string) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

export default async function DashboardPage() {
  const user = await requirePermission("dashboard", "read");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: "/dashboard",
  });
  const copy = roleCopy[user.role];
  const dashboardData = await getDashboardData(
    user.id,
    user.role,
    activeLocationId
  );
  const revenueToday = currencyFormatter.format(dashboardData.revenueToday);
  const warehouses = dashboardData.locationHealth.filter(
    (location) => location.type === "WAREHOUSE"
  ).length;
  const branches = dashboardData.locationHealth.filter(
    (location) => location.type === "BRANCH"
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${copy.eyebrow}, ${user.firstName}`}
        title={copy.title}
        description={copy.description}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {user.role === "SALES_STAFF" ? (
          <>
            <DashboardStatLinkCard
              description={`${revenueToday} revenue`}
              label="My Orders Today"
              tone="primary"
              value={dashboardData.ordersToday.toLocaleString("en-US")}
            />
            <DashboardStatLinkCard
              description="Confirmed orders pending delivery"
              label="Awaiting Delivery"
              tone={dashboardData.ordersAwaitingDelivery > 0 ? "warning" : "success"}
              value={dashboardData.ordersAwaitingDelivery.toLocaleString("en-US")}
            />
            <DashboardStatLinkCard
              description={
                activeLocationId ? "At your selected branch today" : "Select a branch to continue"
              }
              href="/dashboard/inventory"
              label="Low Stock"
              tone={dashboardData.lowStockAlerts > 0 ? "warning" : "success"}
              value={dashboardData.lowStockAlerts.toLocaleString("en-US")}
            />
            <DashboardStatLinkCard
              description="Open the sales order form to record a new transaction."
              href="/dashboard/sales-orders/create/new"
              label="Quick Action"
              tone="primary"
              value="New Sale"
            />
          </>
        ) : (
          <>
            <DashboardStatLinkCard
              description={`${revenueToday} total revenue`}
              label="Orders Today"
              tone="primary"
              value={dashboardData.ordersToday.toLocaleString("en-US")}
            />
            <DashboardStatLinkCard
              description="Confirmed orders pending delivery"
              label="Awaiting Delivery"
              tone={dashboardData.ordersAwaitingDelivery > 0 ? "warning" : "success"}
              value={dashboardData.ordersAwaitingDelivery.toLocaleString("en-US")}
            />
            <DashboardStatLinkCard
              description="Products at or below reorder level"
              href="/dashboard/inventory"
              label="Low Stock Alerts"
              tone={dashboardData.lowStockAlerts > 0 ? "warning" : "success"}
              value={dashboardData.lowStockAlerts.toLocaleString("en-US")}
            />
            <DashboardStatLinkCard
              description={`${formatLocationCount(warehouses, "warehouse", "warehouses")}, ${formatLocationCount(branches, "branch", "branches")}`}
              label="Locations Active"
              tone="primary"
              value={dashboardData.locationHealth.length.toLocaleString("en-US")}
            />
          </>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Modules</h2>
          <p className="mt-1 text-sm text-slate-500">
            Jump directly to the tools you need.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {moduleLinks
            .filter((link) => hasPermission(user.role, link.resource, link.action))
            .map((link) => (
              <Link
                key={link.href}
                className="rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
                href={link.href}
              >
                <h3 className="font-semibold text-slate-950">{link.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{link.description}</p>
              </Link>
            ))}
        </div>
      </section>

      <RecentActivity movements={dashboardData.recentMovements} />
    </div>
  );
}
