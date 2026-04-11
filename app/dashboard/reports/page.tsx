import Link from "next/link";
import { requirePermission } from "@/lib/dal/auth";
import {
  DEFAULT_ANALYTICS_WINDOW_DAYS,
  DEFAULT_QUOTA_WINDOW_DAYS,
  REPORT_OVERVIEW_WINDOW_DAYS,
  getReportsAnalyticsData,
  getReportsOverviewData,
  getReportsQuotaData,
  type QuotaMetric,
  type SalesTrendPoint,
} from "@/lib/dal/reports";
import { formatCurrency } from "@/lib/products";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TabToggle } from "@/components/ui/tab-toggle";
import { Button } from "@/components/ui/button";
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
import { QuotaTracker } from "@/components/reports/quota-tracker";
import { MetricContextStrip } from "@/components/reports/metric-context-strip";

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ReportView = "overview" | "analytics" | "quota";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseView(value: string | undefined): ReportView {
  if (value === "analytics" || value === "quota") {
    return value;
  }

  return "overview";
}

function parsePositiveInt(value: string | undefined, fallback: number, max = 365) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function parsePositiveNumber(value: string | undefined) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseQuotaMetric(value: string | undefined): QuotaMetric {
  return value === "units" ? "units" : "revenue";
}

function formatShortDate(dateString: string) {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatUnits(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}%`;
}

function getDayCardCopy(day: SalesTrendPoint | null, type: "highest" | "lowest") {
  if (!day) {
    return {
      value: "No sales yet",
      description:
        type === "highest"
          ? "There are no recorded sales days in this 30-day window yet."
          : "There are no non-zero sales days to compare yet.",
    };
  }

  return {
    value: formatCurrency(day.revenue),
    description:
      type === "highest"
        ? `${formatShortDate(day.date)} was the strongest sales day in this 30-day window.`
        : `${formatShortDate(day.date)} was the softest non-zero sales day in this 30-day window.`,
  };
}

function getHeaderDescription(view: ReportView) {
  if (view === "analytics") {
    return "Use deeper charts when you need branch comparisons, product mix, stock movement patterns, and longer-term sales context.";
  }

  if (view === "quota") {
    return "Check whether each branch is hitting a temporary revenue or unit quota over any day range, without changing stored settings.";
  }

  return "Start with the essentials first: revenue, units sold, and the strongest and weakest sales days from the last 30 days.";
}

function getViewTabs(activeView: ReportView) {
  return [
    {
      label: "Overview",
      href: "/dashboard/reports?view=overview",
      active: activeView === "overview",
    },
    {
      label: "Analytics",
      href: `/dashboard/reports?view=analytics&analyticsDays=${DEFAULT_ANALYTICS_WINDOW_DAYS}`,
      active: activeView === "analytics",
    },
    {
      label: "Quota Tracker",
      href: `/dashboard/reports?view=quota&quotaDays=${DEFAULT_QUOTA_WINDOW_DAYS}&quotaMetric=revenue`,
      active: activeView === "quota",
    },
  ];
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requirePermission("reports", "read");

  const resolvedSearchParams = await searchParams;
  const view = parseView(getSingleParam(resolvedSearchParams.view));
  const tabs = getViewTabs(view);

  if (view === "analytics") {
    const analyticsDays = parsePositiveInt(
      getSingleParam(resolvedSearchParams.analyticsDays),
      DEFAULT_ANALYTICS_WINDOW_DAYS
    );
    const analytics = await getReportsAnalyticsData(analyticsDays);
    const filteredRevenue = analytics.financialSummary.totalRevenue;
    const filteredUnits = analytics.financialSummary.totalUnitsSold;

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Decision Support"
          title="Reports"
          description={getHeaderDescription(view)}
          action={<TabToggle tabs={tabs} />}
        />

        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Analytics controls</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Adjust the reporting window for short-term charts. Seasonal trends stay
                all-time so the longer sales pattern remains visible.
              </p>
            </div>

            <form action="/dashboard/reports" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <input name="view" type="hidden" value="analytics" />

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Reporting window
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                  defaultValue={String(analytics.analyticsDays)}
                  name="analyticsDays"
                >
                  <option value="30">Last 30 days</option>
                  <option value="60">Last 60 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="180">Last 180 days</option>
                  <option value="365">Last 365 days</option>
                </select>
              </label>

              <Button type="submit">Apply filter</Button>
            </form>
          </div>
        </section>

        <MetricContextStrip context={analytics.metricContext} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label={`Revenue (${analytics.analyticsDays} days)`}
            value={formatCurrency(filteredRevenue)}
            tone="primary"
            description="Combined sales revenue inside the selected analytics window."
          />
          <StatCard
            label={`COGS (${analytics.analyticsDays} days)`}
            value={formatCurrency(analytics.financialSummary.totalCogs)}
            description="Cost of goods sold based on per-location moving average at sale time."
          />
          <StatCard
            label={`Gross profit (${analytics.analyticsDays} days)`}
            value={formatCurrency(analytics.financialSummary.totalGrossProfit)}
            tone="success"
            description="Revenue minus COGS in the selected analytics window."
          />
          <StatCard
            label={`Gross margin (${analytics.analyticsDays} days)`}
            value={formatPercent(analytics.financialSummary.grossMarginPct)}
            tone={analytics.financialSummary.grossMarginPct !== null && analytics.financialSummary.grossMarginPct < 15 ? "warning" : "default"}
            description="Gross profit divided by revenue."
          />
          <StatCard
            label={`Units sold (${analytics.analyticsDays} days)`}
            value={formatUnits(filteredUnits)}
            tone="success"
            description="All units sold in the selected analytics window, regardless of brand."
          />
          <StatCard
            label="Low / out of stock"
            value={String(analytics.inventorySummary.lowStockCount)}
            tone="warning"
            description="Products that are already at or below their reorder threshold."
          />
          <StatCard
            label="Cost shock events"
            value={String(analytics.metricContext.costShockEventsInWindow)}
            tone={
              analytics.metricContext.costShockEscalationsInWindow > 0 ? "warning" : "default"
            }
            description="Inbound supplier/transfer cost changes beyond warning threshold."
          />
        </section>

        <SalesTrendChart
          data={analytics.salesTrend}
          days={analytics.analyticsDays}
          title={`Revenue and Units (${analytics.analyticsDays} days)`}
          description="Daily sales trend for the selected reporting window."
        />

        <section className="grid gap-6 xl:grid-cols-2">
          <RevenueByCategoryChart data={analytics.revenueByCategory} />
          <OrderStatusChart data={analytics.orderStatusDistribution} />
        </section>

        <TopProductsChart data={analytics.topProducts} />

        <section className="grid gap-6 xl:grid-cols-2">
          <InventoryHealthChart data={analytics.inventoryHealth} />
          <WarehouseUtilizationChart data={analytics.locationUtilization} />
        </section>

        <StockMovementChart data={analytics.movementTrends} />

        <div className="border-t border-slate-200 pt-8">
          <h2 className="text-lg font-semibold text-slate-950">Branch Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">
            Compare recent branch performance, then use the all-time seasonal view for
            longer planning context.
          </p>
        </div>

        <RevenueByBranchChart
          data={analytics.revenueByBranch.data}
          branches={analytics.revenueByBranch.branches}
        />

        <BranchComparisonChart data={analytics.branchComparison} />

        <SeasonalTrendsChart
          data={analytics.seasonalTrends.data}
          branches={analytics.seasonalTrends.branches}
        />
      </div>
    );
  }

  if (view === "quota") {
    const quotaDays = parsePositiveInt(
      getSingleParam(resolvedSearchParams.quotaDays),
      DEFAULT_QUOTA_WINDOW_DAYS
    );
    const quotaMetric = parseQuotaMetric(getSingleParam(resolvedSearchParams.quotaMetric));
    const quotaTarget = parsePositiveNumber(getSingleParam(resolvedSearchParams.quotaTarget));
    const quotaData = await getReportsQuotaData({
      days: quotaDays,
      metric: quotaMetric,
      target: quotaTarget,
    });

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Decision Support"
          title="Reports"
          description={getHeaderDescription(view)}
          action={<TabToggle tabs={tabs} />}
        />

        <QuotaTracker data={quotaData} />
      </div>
    );
  }

  const overview = await getReportsOverviewData();
  const highestDay = getDayCardCopy(overview.summary.highestDay, "highest");
  const lowestDay = getDayCardCopy(overview.summary.lowestDay, "lowest");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Decision Support"
        title="Reports"
        description={getHeaderDescription(view)}
        action={<TabToggle tabs={tabs} />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Revenue (${REPORT_OVERVIEW_WINDOW_DAYS} days)`}
          value={formatCurrency(overview.summary.totalRevenue)}
          tone="primary"
          description="Combined sales revenue from the last 30 days."
        />
        <StatCard
          label={`COGS (${REPORT_OVERVIEW_WINDOW_DAYS} days)`}
          value={formatCurrency(overview.summary.totalCogs)}
          description="Cost of goods sold based on moving-average unit cost at sale time."
        />
        <StatCard
          label={`Gross profit (${REPORT_OVERVIEW_WINDOW_DAYS} days)`}
          value={formatCurrency(overview.summary.totalGrossProfit)}
          tone="success"
          description="Revenue less COGS for the last 30 days."
        />
        <StatCard
          label={`Gross margin (${REPORT_OVERVIEW_WINDOW_DAYS} days)`}
          value={formatPercent(overview.summary.grossMarginPct)}
          tone="warning"
          description="Gross profit percentage for this window."
        />
      </section>

      <MetricContextStrip context={overview.metricContext} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={`Units sold (${REPORT_OVERVIEW_WINDOW_DAYS} days)`}
          value={formatUnits(overview.summary.totalUnitsSold)}
          tone="success"
          description="Every product unit sold in the last 30 days, regardless of brand."
        />
        <StatCard
          label="Highest grossing day"
          value={highestDay.value}
          description={highestDay.description}
        />
        <StatCard
          label="Lowest non-zero day"
          value={lowestDay.value}
          tone="warning"
          description={lowestDay.description}
        />
      </section>

      {overview.summary.noSalesDays > 0 ? (
        <div className="rounded-lg border border-[#f2d2a2] bg-[#fff4e4] px-5 py-4 text-sm text-[#8a5610]">
          There {overview.summary.noSalesDays === 1 ? "was" : "were"}{" "}
          <strong>{overview.summary.noSalesDays}</strong>{" "}
          {overview.summary.noSalesDays === 1 ? "day" : "days"} with no recorded sales in
          this 30-day window. That is useful context when reading the lowest-day metric.
        </div>
      ) : null}

      <SalesTrendChart
        data={overview.salesTrend}
        days={REPORT_OVERVIEW_WINDOW_DAYS}
        title="Sales pulse"
        description="Keep the opening view focused: one chart for daily revenue and units sold."
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Need deeper analysis?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Move into the Analytics view when you need category mix, top products, stock
            movements, branch comparisons, and longer-term seasonality.
          </p>
          <Link
            className="mt-5 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            href={`/dashboard/reports?view=analytics&analyticsDays=${DEFAULT_ANALYTICS_WINDOW_DAYS}`}
          >
            Open Analytics
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Need branch target checks?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Use the Quota Tracker to test branch revenue or unit targets over any day
            range, then quickly see which branches have already hit the goal.
          </p>
          <Link
            className="mt-5 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            href={`/dashboard/reports?view=quota&quotaDays=${DEFAULT_QUOTA_WINDOW_DAYS}&quotaMetric=revenue`}
          >
            Open Quota Tracker
          </Link>
        </div>
      </section>
    </div>
  );
}
