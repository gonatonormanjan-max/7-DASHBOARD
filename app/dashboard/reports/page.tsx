import { requirePermission } from "@/lib/dal/auth";
import { getReportsPageData } from "@/lib/dal/reports";
import { formatCurrency } from "@/lib/products";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { SalesTrendChart } from "@/components/reports/sales-trend-chart";
import { RevenueByCategoryChart } from "@/components/reports/revenue-by-category-chart";
import { TopProductsChart } from "@/components/reports/top-products-chart";
import { InventoryHealthChart } from "@/components/reports/inventory-health-chart";
import { OrderStatusChart } from "@/components/reports/order-status-chart";
import { WarehouseUtilizationChart } from "@/components/reports/warehouse-utilization-chart";
import { StockMovementChart } from "@/components/reports/stock-movement-chart";
import { RevenueByBranchChart } from "@/components/reports/revenue-by-branch-chart";
import { BranchComparisonChart } from "@/components/reports/branch-comparison-chart";
import { SeasonalTrendsChart } from "@/components/reports/seasonal-trends-chart";

export default async function ReportsPage() {
  await requirePermission("reports", "read");

  const {
    salesTrend,
    revenueByCategory,
    topProducts,
    inventoryHealth,
    movementTrends,
    orderStatusDistribution,
    locationUtilization,
    revenueByBranch,
    branchComparison,
    seasonalTrends,
    summary,
  } = await getReportsPageData();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Decision Support"
        title="Reports"
        description="Analyze sales trends, inventory health, product performance, and revenue breakdown to support informed operational decisions."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (30 days)"
          value={formatCurrency(summary.totalRevenue)}
          tone="primary"
          description="Combined sales revenue from the last 30 days."
        />
        <StatCard
          label="Orders (30 days)"
          value={String(summary.totalOrders)}
          tone="success"
          description="Non-cancelled orders placed in the last 30 days."
        />
        <StatCard
          label="Active products"
          value={String(summary.activeProductCount)}
          description="Products currently stocked across warehouses."
        />
        <StatCard
          label="Low / out of stock"
          value={String(summary.lowStockCount)}
          tone="warning"
          description="Products at or below their reorder threshold."
        />
      </section>

      <SalesTrendChart data={salesTrend} />

      <section className="grid gap-6 xl:grid-cols-2">
        <RevenueByCategoryChart data={revenueByCategory} />
        <OrderStatusChart data={orderStatusDistribution} />
      </section>

      <TopProductsChart data={topProducts} />

      <section className="grid gap-6 xl:grid-cols-2">
        <InventoryHealthChart data={inventoryHealth} />
        <WarehouseUtilizationChart data={locationUtilization} />
      </section>

      <StockMovementChart data={movementTrends} />

      <div className="border-t border-slate-200 pt-8">
        <h2 className="text-lg font-semibold text-slate-950">Branch Analytics</h2>
        <p className="mt-1 text-sm text-slate-500">
          Performance data across all store branches (warehouses), including archived orders.
        </p>
      </div>

      <RevenueByBranchChart data={revenueByBranch.data} branches={revenueByBranch.branches} />

      <BranchComparisonChart data={branchComparison} />

      <SeasonalTrendsChart data={seasonalTrends.data} branches={seasonalTrends.branches} />
    </div>
  );
}
