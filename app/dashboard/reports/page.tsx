import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getBranchActivityReportData,
  getBranchSalesOrdersReportData,
  getActiveBranchReportOptions,
  DEFAULT_ANALYTICS_WINDOW_DAYS,
  DEFAULT_QUOTA_WINDOW_DAYS,
  REPORT_OVERVIEW_WINDOW_DAYS,
  getReportsAnalyticsData,
  getReportsOverviewData,
  getReportsQuotaData,
  type QuotaMetric,
  type SalesTrendPoint,
} from "@/lib/dal/reports";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { formatCurrency } from "@/lib/products";
import { formatShortDateMNL } from "@/lib/timezone";
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
import { AnalyticsStatCardsCarousel } from "@/components/reports/analytics-stat-cards-carousel";
import { BranchActivityFilters } from "@/components/reports/branch-activity-filters";
import { BranchActivityTable } from "@/components/reports/branch-activity-table";
import { BranchActivityTrendChart } from "@/components/reports/branch-activity-trend-chart";
import { BranchSalesOrdersFilters } from "@/components/reports/branch-sales-orders-filters";
import { BranchSalesOrdersTable } from "@/components/reports/branch-sales-orders-table";
import { SaveReportsPdfButton } from "@/components/reports/save-reports-pdf-button";
import { isReportsPdfExportEnabled } from "@/lib/feature-flags";
import {
  canAccessAllBranchActivityReport,
  canAccessBranchSalesOrdersReport,
  canFilterReportsAnalyticsByBranch,
  hasPermission,
} from "@/lib/permissions";
import {
  parseBranchActivityFilters,
  parseBranchSalesOrdersFilters,
  parseReportsAnalyticsFilters,
} from "@/lib/validators/reports";

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ReportView =
  | "overview"
  | "analytics"
  | "quota"
  | "branch-activity"
  | "branch-sales-orders";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseView(value: string | undefined): ReportView {
  if (
    value === "analytics" ||
    value === "quota" ||
    value === "branch-activity" ||
    value === "branch-sales-orders"
  ) {
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
  return formatShortDateMNL(dateString);
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

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

  if (view === "branch-activity") {
    return "Track daily branch health across sales, stock movement, count completion, discrepancies, and issue reports.";
  }

  if (view === "branch-sales-orders") {
    return "Review branch-attributed sales order movement with item-level branch totals and expandable order details.";
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
    {
      label: "Branch Activity",
      href: "/dashboard/reports?view=branch-activity",
      active: activeView === "branch-activity",
    },
    {
      label: "Branch Sales Orders",
      href: "/dashboard/reports?view=branch-sales-orders",
      active: activeView === "branch-sales-orders",
    },
  ];
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user = await requirePermission("reports", "read");

  const resolvedSearchParams = await searchParams;
  const view = parseView(getSingleParam(resolvedSearchParams.view));
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: `/dashboard/reports?view=${view}`,
  });
  const rawBranchFilter = getSingleParam(resolvedSearchParams.branchId);
  const tabs = getViewTabs(view);
  const canManageBranchQuotas = hasPermission(user.role, "reports", "update");
  const headerAction = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <TabToggle tabs={tabs} />
      {isReportsPdfExportEnabled &&
      view !== "branch-activity" &&
      view !== "branch-sales-orders" &&
      !(view === "analytics" && rawBranchFilter && rawBranchFilter !== "all") ? (
        <SaveReportsPdfButton view={view} />
      ) : null}
    </div>
  );

  if (view === "branch-sales-orders") {
    if (!canAccessBranchSalesOrdersReport(user.role)) {
      redirect("/dashboard/reports?view=overview");
    }

    const filters = parseBranchSalesOrdersFilters(resolvedSearchParams);
    const report = await getBranchSalesOrdersReportData(filters);
    const activeBranchLabel = report.filters.branchId
      ? report.branchOptions.find((branch) => branch.id === report.filters.branchId)?.name ??
        "Selected branch"
      : "All active branches";
    const statusMix = report.summary.statusCounts
      .filter((statusCount) => statusCount.count > 0)
      .map((statusCount) => `${formatStatusLabel(statusCount.status)} ${statusCount.count}`)
      .join(" / ");

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Decision Support"
          title="Reports"
          description={getHeaderDescription(view)}
          action={headerAction}
        />

        <BranchSalesOrdersFilters
          branches={report.branchOptions}
          filters={report.filters}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Filtered sales value"
            value={formatCurrency(report.summary.filteredSalesValue)}
            tone="primary"
            description={`${activeBranchLabel} from ${report.filters.dateFrom} to ${report.filters.dateTo}.`}
          />
          <StatCard
            label="Units in filtered orders"
            value={formatUnits(report.summary.unitsInFilteredOrders)}
            tone="success"
            description="Branch-attributed item quantities in the selected filter."
          />
          <StatCard
            label="Sales order rows"
            value={formatUnits(report.summary.salesOrderRows)}
            description="One row means one sales order at one branch."
          />
          <StatCard
            label="Average branch order value"
            value={formatCurrency(report.summary.averageBranchOrderValue)}
            description="Filtered sales value divided by branch-order rows."
          />
          <StatCard
            label="Status mix"
            value={statusMix || "No orders"}
            tone={report.filters.status ? "warning" : "default"}
            description={
              report.filters.status
                ? `Filtered to ${formatStatusLabel(report.filters.status)}.`
                : "All sales order statuses are included."
            }
          />
        </section>

        <BranchSalesOrdersTable
          filters={report.filters}
          pagination={report.pagination}
          rows={report.rows}
        />
      </div>
    );
  }

  if (view === "branch-activity") {
    if (!canAccessAllBranchActivityReport(user.role)) {
      redirect("/dashboard/reports?view=overview");
    }

    const filters = parseBranchActivityFilters(resolvedSearchParams);
    const activity = await getBranchActivityReportData(filters);
    const activeBranchLabel = activity.filters.branchId
      ? activity.branchOptions.find((branch) => branch.id === activity.filters.branchId)?.name ??
        "Selected branch"
      : "All active branches";

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Decision Support"
          title="Reports"
          description={getHeaderDescription(view)}
          action={headerAction}
        />

        <BranchActivityFilters
          branches={activity.branchOptions}
          filters={activity.filters}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Revenue"
            value={formatCurrency(activity.summary.totalRevenue)}
            tone="primary"
            description={`${activeBranchLabel} from ${activity.filters.dateFrom} to ${activity.filters.dateTo}.`}
          />
          <StatCard
            label="Units sold"
            value={formatUnits(activity.summary.totalUnitsSold)}
            tone="success"
            description={`${activity.summary.salesOrderCount.toLocaleString("en-US")} sales order${activity.summary.salesOrderCount === 1 ? "" : "s"} in the filter.`}
          />
          <StatCard
            label="Stock movements"
            value={formatUnits(activity.summary.movementCount)}
            description="Inventory movement entries recorded in the selected window."
          />
          <StatCard
            label="Unresolved issues"
            value={formatUnits(activity.summary.unresolvedIssueCount)}
            tone={activity.summary.unresolvedIssueCount > 0 ? "warning" : "success"}
            description={`${formatUnits(activity.summary.openIssueCount)} open and ${formatUnits(activity.summary.acknowledgedIssueCount)} acknowledged issue reports.`}
          />
        </section>

        {activity.summary.branchesWithDiscrepancies > 0 ? (
          <div className="rounded-lg border border-warning/40 bg-warning/5 px-5 py-4 text-sm text-warning">
            <strong>{activity.summary.branchesWithDiscrepancies}</strong>{" "}
            {activity.summary.branchesWithDiscrepancies === 1 ? "branch has" : "branches have"}{" "}
            stock count discrepancies in this report window.
          </div>
        ) : null}

        <BranchActivityTable rows={activity.rows} />

        <BranchActivityTrendChart data={activity.dailyTrend} />
      </div>
    );
  }

  if (view === "analytics") {
    const analyticsFilters = parseReportsAnalyticsFilters(
      resolvedSearchParams,
      DEFAULT_ANALYTICS_WINDOW_DAYS
    );
    const canFilterAnalyticsBranches = canFilterReportsAnalyticsByBranch(user.role);
    const analyticsBranchOptions = canFilterAnalyticsBranches
      ? await getActiveBranchReportOptions()
      : [];
    const selectedAnalyticsBranchId =
      canFilterAnalyticsBranches &&
      analyticsFilters.branchId &&
      analyticsBranchOptions.some((branch) => branch.id === analyticsFilters.branchId)
        ? analyticsFilters.branchId
        : null;
    const analyticsLocationId = canFilterAnalyticsBranches
      ? selectedAnalyticsBranchId
      : activeLocationId;
    const analyticsBranchLabel = selectedAnalyticsBranchId
      ? analyticsBranchOptions.find((branch) => branch.id === selectedAnalyticsBranchId)?.name ??
        "Selected branch"
      : canFilterAnalyticsBranches
        ? "All active branches"
        : "Your active branch";
    const analytics = await getReportsAnalyticsData(analyticsFilters.analyticsDays, {
      locationId: analyticsLocationId,
    });
    const filteredRevenue = analytics.financialSummary.totalRevenue;
    const filteredUnits = analytics.financialSummary.totalUnitsSold;
    const analyticsStatCards = [
      {
        label: `Revenue (${analytics.analyticsDays} days)`,
        value: formatCurrency(filteredRevenue),
        tone: "primary" as const,
        description: `${analyticsBranchLabel} sales revenue inside the selected analytics window.`,
      },
      {
        label: `COGS (${analytics.analyticsDays} days)`,
        value: formatCurrency(analytics.financialSummary.totalCogs),
        tone: "default" as const,
        description: "Cost of goods sold based on per-location moving average at sale time.",
      },
      {
        label: `Gross profit (${analytics.analyticsDays} days)`,
        value: formatCurrency(analytics.financialSummary.totalGrossProfit),
        tone: "success" as const,
        description: "Revenue minus COGS in the selected analytics window.",
      },
      {
        label: `Gross margin (${analytics.analyticsDays} days)`,
        value: formatPercent(analytics.financialSummary.grossMarginPct),
        tone:
          analytics.financialSummary.grossMarginPct !== null &&
          analytics.financialSummary.grossMarginPct < 15
            ? ("warning" as const)
            : ("default" as const),
        description: "Gross profit divided by revenue.",
      },
      {
        label: `Units sold (${analytics.analyticsDays} days)`,
        value: formatUnits(filteredUnits),
        tone: "success" as const,
        description: `${analyticsBranchLabel} units sold in the selected analytics window.`,
      },
      {
        label: "Low / out of stock",
        value: String(analytics.inventorySummary.lowStockCount),
        tone: "warning" as const,
        description: "Products that are already at or below their reorder threshold.",
      },
      {
        label: "Cost shock events",
        value: String(analytics.metricContext.costShockEventsInWindow),
        tone:
          analytics.metricContext.costShockEscalationsInWindow > 0
            ? ("warning" as const)
            : ("default" as const),
        description: "Inbound supplier/transfer cost changes beyond warning threshold.",
      },
    ];

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Decision Support"
          title="Reports"
          description={getHeaderDescription(view)}
          action={headerAction}
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

              {canFilterAnalyticsBranches ? (
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Branch
                  </span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                    defaultValue={selectedAnalyticsBranchId ?? "all"}
                    name="branchId"
                  >
                    <option value="all">All active branches</option>
                    {analyticsBranchOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

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
          <p className="mt-4 text-sm text-slate-500">
            Showing analytics for <span className="font-medium text-slate-700">{analyticsBranchLabel}</span>.
          </p>
        </section>

        <MetricContextStrip context={analytics.metricContext} />

        <AnalyticsStatCardsCarousel cards={analyticsStatCards} />

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
            {selectedAnalyticsBranchId
              ? "This section is narrowed to the selected branch for focused planning context."
              : "Compare recent branch performance, then use the all-time seasonal view for longer planning context."}
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
      locationId: activeLocationId,
    });

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Decision Support"
          title="Reports"
          description={getHeaderDescription(view)}
          action={headerAction}
        />

        {canManageBranchQuotas ? (
          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Need saved branch quotas?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Move from temporary target checks to persistent per-branch quotas with branch-specific
              rolling windows and 3-color attainment indicators.
            </p>
            <Link
              className="mt-5 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              href={`/dashboard/reports/branch-quotas?metric=${quotaMetric}`}
            >
              Open Branch Quotas
            </Link>
          </section>
        ) : null}

        <QuotaTracker data={quotaData} />
      </div>
    );
  }

  const overview = await getReportsOverviewData({
    locationId: activeLocationId,
  });
  const highestDay = getDayCardCopy(overview.summary.highestDay, "highest");
  const lowestDay = getDayCardCopy(overview.summary.lowestDay, "lowest");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Decision Support"
        title="Reports"
        description={getHeaderDescription(view)}
        action={headerAction}
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
