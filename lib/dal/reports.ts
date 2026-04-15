import "server-only";

import { Prisma, type MovementType, type SalesOrderStatus } from "@prisma/client";
import {
  COST_SHOCK_ESCALATION_THRESHOLD,
  COST_SHOCK_WARNING_THRESHOLD,
  isCostingPersistenceAvailable,
  isMissingCostingTableError,
  MOVING_AVERAGE_VALUATION_METHOD,
} from "@/lib/costing";
import { prisma } from "@/lib/prisma";
import {
  computeBranchQuotaRows,
  type BranchQuotaComputedRow,
  type QuotaAttainmentBand,
} from "@/lib/reports/branch-quotas";

export const REPORT_OVERVIEW_WINDOW_DAYS = 30;
export const DEFAULT_ANALYTICS_WINDOW_DAYS = 90;
export const DEFAULT_QUOTA_WINDOW_DAYS = 30;
export const REPORT_INCLUDED_SALES_STATUSES: SalesOrderStatus[] = [
  "CONFIRMED",
  "DELIVERED",
  "COMPLETED",
];

export type SalesTrendPoint = {
  date: string;
  revenue: number;
  orderCount: number;
  unitsSold: number;
};

export type InventoryHealthRow = {
  productName: string;
  sku: string;
  totalStock: number;
  totalReserved: number;
  available: number;
  reorderLevel: number;
  status: "healthy" | "low" | "out";
};

type RevenueByCategoryRow = {
  category: string;
  revenue: number;
};

type TopProductRow = {
  name: string;
  sku: string;
  revenue: number;
  unitsSold: number;
};

type OrderStatusRow = {
  status: string;
  count: number;
};

type LocationUtilizationRow = {
  name: string;
  code: string;
  type: string;
  totalUnits: number;
  reservedUnits: number;
  productCount: number;
  availableUnits: number;
};

type BranchComparisonRow = {
  name: string;
  code: string;
  totalRevenue: number;
  orderCount: number;
  totalUnits: number;
  avgOrderValue: number;
  topProduct: string;
};

type BranchSeries = {
  data: Array<Record<string, string | number>>;
  branches: string[];
};
type ReportsScopeOptions = {
  locationId?: string | null;
};

export type QuotaMetric = "revenue" | "units";

export type QuotaTrackerRow = {
  id: string;
  name: string;
  code: string;
  totalRevenue: number;
  totalUnits: number;
  currentValue: number;
  averagePerDay: number;
  bestDayValue: number;
  activeSalesDays: number;
  attainmentRatio: number | null;
  remainingToTarget: number | null;
  reached: boolean | null;
};

export type ReportConfidence = "high" | "medium" | "low";

export type ReportMetricContext = {
  valuationMethod: string;
  includedStatuses: SalesOrderStatus[];
  archivedOrdersPolicy: "included" | "excluded";
  costShockWarningThresholdPct: number;
  costShockEscalationThresholdPct: number;
  totalSalesLines: number;
  estimatedCostLineCount: number;
  costShockEventsInWindow: number;
  costShockEscalationsInWindow: number;
  confidence: ReportConfidence;
  recalculatedAt: string;
};

export type FinancialSummary = {
  totalRevenue: number;
  totalCogs: number;
  totalGrossProfit: number;
  grossMarginPct: number | null;
  totalUnitsSold: number;
  totalSalesLines: number;
  estimatedCostLineCount: number;
};

export type ReportsOverviewData = {
  salesTrend: SalesTrendPoint[];
  summary: {
    totalRevenue: number;
    totalCogs: number;
    totalGrossProfit: number;
    grossMarginPct: number | null;
    totalUnitsSold: number;
    highestDay: SalesTrendPoint | null;
    lowestDay: SalesTrendPoint | null;
    noSalesDays: number;
  };
  metricContext: ReportMetricContext;
};

export type ReportsAnalyticsData = {
  analyticsDays: number;
  salesTrend: SalesTrendPoint[];
  financialSummary: FinancialSummary;
  revenueByCategory: RevenueByCategoryRow[];
  topProducts: TopProductRow[];
  inventoryHealth: InventoryHealthRow[];
  inventorySummary: {
    activeProductCount: number;
    lowStockCount: number;
  };
  movementTrends: Array<Record<string, string | number>>;
  orderStatusDistribution: OrderStatusRow[];
  locationUtilization: LocationUtilizationRow[];
  revenueByBranch: BranchSeries;
  branchComparison: BranchComparisonRow[];
  seasonalTrends: BranchSeries;
  metricContext: ReportMetricContext;
};

export type ReportsQuotaData = {
  days: number;
  metric: QuotaMetric;
  target: number | null;
  branchCount: number;
  reachedCount: number;
  averageAttainment: number | null;
  bestPerformer: {
    name: string;
    value: number;
  } | null;
  rows: QuotaTrackerRow[];
};

export type BranchQuotaProgressRow = BranchQuotaComputedRow;

export type BranchQuotaPageData = {
  metric: QuotaMetric;
  storageReady: boolean;
  rows: BranchQuotaProgressRow[];
  summary: {
    branchCount: number;
    configuredCount: number;
    reachedCount: number;
    averageAttainment: number | null;
    bands: Record<QuotaAttainmentBand, number>;
    bestPerformer: {
      name: string;
      value: number;
    } | null;
  };
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getWindowStart(days: number) {
  const safeDays = Math.max(1, Math.floor(days));
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (safeDays - 1));
  return date;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function buildDateRange(startDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  while (current <= today) {
    dates.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function getMaxValue(values: Iterable<number>) {
  let highest = 0;

  for (const value of values) {
    if (value > highest) {
      highest = value;
    }
  }

  return highest;
}

function getSalesStatusWhere() {
  return {
    in: REPORT_INCLUDED_SALES_STATUSES,
  } as const;
}

function normalizeScopeLocationId(locationId?: string | null) {
  const normalized = locationId?.trim();
  return normalized ? normalized : null;
}

function isMissingBranchQuotaSettingsTableError(error: unknown) {
  const errorLike = error as
    | {
        code?: unknown;
        message?: unknown;
        meta?: unknown;
      }
    | undefined;
  const code = typeof errorLike?.code === "string" ? errorLike.code : "";
  const message = typeof errorLike?.message === "string" ? errorLike.message : "";
  const metaCode =
    typeof errorLike?.meta === "object" &&
    errorLike.meta !== null &&
    "code" in errorLike.meta &&
    typeof errorLike.meta.code === "string"
      ? errorLike.meta.code
      : "";

  if (code === "P2021" || code === "42P01") {
    return true;
  }

  if (code === "P2010" && metaCode === "42P01") {
    return true;
  }

  if (metaCode === "42P01") {
    return true;
  }

  return (
    message.includes('relation "BranchQuotaSetting" does not exist') ||
    message.includes('relation "branchquotasetting" does not exist')
  );
}

function getReportConfidence(input: {
  totalSalesLines: number;
  estimatedCostLineCount: number;
}): ReportConfidence {
  if (input.totalSalesLines <= 0) {
    return "high";
  }

  const estimatedRatio = input.estimatedCostLineCount / input.totalSalesLines;

  if (estimatedRatio === 0) {
    return "high";
  }

  if (estimatedRatio <= 0.1) {
    return "medium";
  }

  return "low";
}

async function getSalesTrendData(
  days: number = REPORT_OVERVIEW_WINDOW_DAYS,
  locationId?: string | null
): Promise<SalesTrendPoint[]> {
  const since = getWindowStart(days);

  const salesItems = await prisma.salesOrderItem.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
      salesOrder: {
        createdAt: { gte: since },
        status: getSalesStatusWhere(),
      },
    },
    select: {
      quantity: true,
      unitPrice: true,
      salesOrderId: true,
      salesOrder: {
        select: {
          createdAt: true,
        },
      },
    },
  });

  const byDate = new Map<
    string,
    {
      revenue: number;
      unitsSold: number;
      orderIds: Set<string>;
    }
  >();

  for (const item of salesItems) {
    const key = toDateKey(item.salesOrder.createdAt);
    const existing = byDate.get(key) ?? {
      revenue: 0,
      unitsSold: 0,
      orderIds: new Set<string>(),
    };
    existing.revenue += item.quantity * item.unitPrice.toNumber();
    existing.unitsSold += item.quantity;
    existing.orderIds.add(item.salesOrderId);
    byDate.set(key, existing);
  }

  return buildDateRange(since).map((date) => ({
    date,
    revenue: roundCurrency(byDate.get(date)?.revenue ?? 0),
    orderCount: byDate.get(date)?.orderIds.size ?? 0,
    unitsSold: byDate.get(date)?.unitsSold ?? 0,
  }));
}

async function getSalesItemAnalytics(days?: number, locationId?: string | null) {
  const since = typeof days === "number" ? getWindowStart(days) : undefined;

  const items = await prisma.salesOrderItem.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
      salesOrder: {
        status: getSalesStatusWhere(),
        ...(since ? { createdAt: { gte: since } } : {}),
      },
    },
    select: {
      quantity: true,
      unitPrice: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          category: {
            select: { name: true },
          },
        },
      },
    },
  });

  const categoryMap = new Map<string, number>();
  const productMap = new Map<
    string,
    { name: string; sku: string; revenue: number; unitsSold: number }
  >();

  for (const item of items) {
    const lineRevenue = item.quantity * item.unitPrice.toNumber();
    const categoryName = item.product.category.name;

    categoryMap.set(categoryName, (categoryMap.get(categoryName) ?? 0) + lineRevenue);

    const existing = productMap.get(item.product.id);

    if (existing) {
      existing.revenue += lineRevenue;
      existing.unitsSold += item.quantity;
    } else {
      productMap.set(item.product.id, {
        name: item.product.name,
        sku: item.product.sku,
        revenue: lineRevenue,
        unitsSold: item.quantity,
      });
    }
  }

  const revenueByCategory = Array.from(categoryMap, ([category, revenue]) => ({
    category,
    revenue: roundCurrency(revenue),
  })).sort((a, b) => b.revenue - a.revenue);

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((product) => ({
      ...product,
      revenue: roundCurrency(product.revenue),
    }));

  return { revenueByCategory, topProducts };
}

async function getFinancialSummary(
  days: number,
  locationId?: string | null
): Promise<FinancialSummary> {
  const since = getWindowStart(days);

  const salesItems = await prisma.salesOrderItem.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
      salesOrder: {
        createdAt: { gte: since },
        status: getSalesStatusWhere(),
      },
    },
    select: {
      quantity: true,
      unitPrice: true,
      lineCogs: true,
      lineGrossProfit: true,
      isEstimatedCost: true,
    },
  });

  let totalRevenue = 0;
  let totalCogs = 0;
  let totalGrossProfit = 0;
  let totalUnitsSold = 0;
  let estimatedCostLineCount = 0;

  for (const item of salesItems) {
    totalRevenue += item.quantity * item.unitPrice.toNumber();
    totalCogs += item.lineCogs.toNumber();
    totalGrossProfit += item.lineGrossProfit.toNumber();
    totalUnitsSold += item.quantity;

    if (item.isEstimatedCost) {
      estimatedCostLineCount += 1;
    }
  }

  return {
    totalRevenue: roundCurrency(totalRevenue),
    totalCogs: roundCurrency(totalCogs),
    totalGrossProfit: roundCurrency(totalGrossProfit),
    grossMarginPct: totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : null,
    totalUnitsSold,
    totalSalesLines: salesItems.length,
    estimatedCostLineCount,
  };
}

async function getCostShockSummary(days: number, locationId?: string | null) {
  const since = getWindowStart(days);
  const warningThreshold = new Prisma.Decimal(COST_SHOCK_WARNING_THRESHOLD);
  const escalationThreshold = new Prisma.Decimal(COST_SHOCK_ESCALATION_THRESHOLD);
  const negativeWarningThreshold = new Prisma.Decimal(-COST_SHOCK_WARNING_THRESHOLD);
  const negativeEscalationThreshold = new Prisma.Decimal(-COST_SHOCK_ESCALATION_THRESHOLD);

  if (!(await isCostingPersistenceAvailable(prisma))) {
    return {
      warningCount: 0,
      escalationCount: 0,
    };
  }

  let warningCount = 0;
  let escalationCount = 0;

  try {
    [warningCount, escalationCount] = await Promise.all([
      prisma.productCostHistory.count({
        where: {
          createdAt: { gte: since },
          ...(locationId ? { locationId } : {}),
          OR: [
            { changePct: { gte: warningThreshold } },
            { changePct: { lte: negativeWarningThreshold } },
          ],
        },
      }),
      prisma.productCostHistory.count({
        where: {
          createdAt: { gte: since },
          ...(locationId ? { locationId } : {}),
          OR: [
            { changePct: { gte: escalationThreshold } },
            { changePct: { lte: negativeEscalationThreshold } },
          ],
        },
      }),
    ]);
  } catch (error) {
    if (!isMissingCostingTableError(error)) {
      throw error;
    }
    return {
      warningCount: 0,
      escalationCount: 0,
    };
  }

  return {
    warningCount,
    escalationCount,
  };
}

function buildMetricContext(input: {
  financialSummary: FinancialSummary;
  costShockSummary: {
    warningCount: number;
    escalationCount: number;
  };
}): ReportMetricContext {
  return {
    valuationMethod: MOVING_AVERAGE_VALUATION_METHOD,
    includedStatuses: REPORT_INCLUDED_SALES_STATUSES,
    archivedOrdersPolicy: "included",
    costShockWarningThresholdPct: COST_SHOCK_WARNING_THRESHOLD * 100,
    costShockEscalationThresholdPct: COST_SHOCK_ESCALATION_THRESHOLD * 100,
    totalSalesLines: input.financialSummary.totalSalesLines,
    estimatedCostLineCount: input.financialSummary.estimatedCostLineCount,
    costShockEventsInWindow: input.costShockSummary.warningCount,
    costShockEscalationsInWindow: input.costShockSummary.escalationCount,
    confidence: getReportConfidence({
      totalSalesLines: input.financialSummary.totalSalesLines,
      estimatedCostLineCount: input.financialSummary.estimatedCostLineCount,
    }),
    recalculatedAt: new Date().toISOString(),
  };
}

async function getInventoryHealthSnapshot(locationId?: string | null) {
  const stockRows = await prisma.locationStock.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
      product: { status: "ACTIVE" },
    },
    select: {
      quantity: true,
      reservedQty: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          reorderLevel: true,
        },
      },
    },
  });

  const productMap = new Map<
    string,
    {
      name: string;
      sku: string;
      totalStock: number;
      totalReserved: number;
      reorderLevel: number;
    }
  >();

  for (const row of stockRows) {
    const existing = productMap.get(row.product.id);

    if (existing) {
      existing.totalStock += row.quantity;
      existing.totalReserved += row.reservedQty;
    } else {
      productMap.set(row.product.id, {
        name: row.product.name,
        sku: row.product.sku,
        totalStock: row.quantity,
        totalReserved: row.reservedQty,
        reorderLevel: row.product.reorderLevel,
      });
    }
  }

  const rows = Array.from(productMap.values())
    .map((p) => {
      const available = p.totalStock - p.totalReserved;
      let status: InventoryHealthRow["status"];

      if (available <= 0) {
        status = "out";
      } else if (p.reorderLevel > 0 && available <= p.reorderLevel) {
        status = "low";
      } else {
        status = "healthy";
      }

      return {
        productName: p.name,
        sku: p.sku,
        totalStock: p.totalStock,
        totalReserved: p.totalReserved,
        available,
        reorderLevel: p.reorderLevel,
        status,
      };
    })
    .sort((a, b) => {
      const priority = { out: 0, low: 1, healthy: 2 };
      return priority[a.status] - priority[b.status];
    });

  return {
    rows: rows.slice(0, 20),
    activeProductCount: rows.length,
    lowStockCount: rows.filter((row) => row.status === "low" || row.status === "out").length,
  };
}

const MOVEMENT_TYPES: MovementType[] = [
  "PURCHASE_RECEIVED",
  "SALES_FULFILLED",
  "MANUAL_ADJUSTMENT",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "CUSTOMER_RETURN",
  "DAMAGED_LOST",
];

async function getStockMovementTrends(days: number, locationId?: string | null) {
  const since = getWindowStart(days);

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      createdAt: { gte: since },
      ...(locationId ? { locationId } : {}),
    },
    select: {
      type: true,
      quantityChange: true,
      createdAt: true,
    },
  });

  const byDate = new Map<string, Record<string, number>>();

  for (const movement of movements) {
    const key = toDateKey(movement.createdAt);
    const existing = byDate.get(key) ?? {};
    existing[movement.type] =
      (existing[movement.type] ?? 0) + Math.abs(movement.quantityChange);
    byDate.set(key, existing);
  }

  return buildDateRange(since).map((date) => {
    const dayData = byDate.get(date) ?? {};
    const row: Record<string, string | number> = { date };

    for (const type of MOVEMENT_TYPES) {
      row[type] = dayData[type] ?? 0;
    }

    return row;
  });
}

async function getOrderStatusDistribution(days?: number, locationId?: string | null) {
  const since = typeof days === "number" ? getWindowStart(days) : undefined;

  const distribution = await prisma.salesOrder.groupBy({
    by: ["status"],
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(locationId
        ? {
            items: {
              some: {
                locationId,
              },
            },
          }
        : {}),
    },
    _count: { _all: true },
  });

  return distribution.map((row) => ({
    status: row.status.replace(/_/g, " "),
    count: row._count._all,
  }));
}

async function getLocationUtilization(locationId?: string | null) {
  const stockRows = await prisma.locationStock.findMany({
    where: {
      location: { isActive: true, ...(locationId ? { id: locationId } : {}) },
    },
    select: {
      quantity: true,
      reservedQty: true,
      location: {
        select: { id: true, name: true, code: true, type: true },
      },
    },
  });

  const locationMap = new Map<
    string,
    {
      name: string;
      code: string;
      type: string;
      totalUnits: number;
      reservedUnits: number;
      productCount: number;
    }
  >();

  for (const row of stockRows) {
    const existing = locationMap.get(row.location.id);

    if (existing) {
      existing.totalUnits += row.quantity;
      existing.reservedUnits += row.reservedQty;
      existing.productCount += 1;
    } else {
      locationMap.set(row.location.id, {
        name: row.location.name,
        code: row.location.code,
        type: row.location.type,
        totalUnits: row.quantity,
        reservedUnits: row.reservedQty,
        productCount: 1,
      });
    }
  }

  return Array.from(locationMap.values()).map((loc) => ({
    ...loc,
    availableUnits: loc.totalUnits - loc.reservedUnits,
  }));
}

/* ------------------------------------------------------------------ */
/*  Branch (Warehouse) Analytics — uses ALL orders incl. archived      */
/* ------------------------------------------------------------------ */

async function getRevenueByBranchOverTime(
  days: number,
  locationId?: string | null
): Promise<BranchSeries> {
  const since = getWindowStart(days);

  const items = await prisma.salesOrderItem.findMany({
    where: {
      location: { type: "BRANCH", ...(locationId ? { id: locationId } : {}) },
      salesOrder: {
        status: getSalesStatusWhere(),
        createdAt: { gte: since },
      },
    },
    select: {
      quantity: true,
      unitPrice: true,
      location: {
        select: { id: true, name: true, code: true },
      },
      salesOrder: {
        select: { createdAt: true },
      },
    },
  });

  const locationNames = new Map<string, string>();
  const byDateAndBranch = new Map<string, Map<string, number>>();

  for (const item of items) {
    const date = toDateKey(item.salesOrder.createdAt);
    const branchId = item.location.id;
    const revenue = item.quantity * item.unitPrice.toNumber();

    locationNames.set(branchId, item.location.name);

    if (!byDateAndBranch.has(date)) {
      byDateAndBranch.set(date, new Map());
    }

    const dateMap = byDateAndBranch.get(date)!;
    dateMap.set(branchId, (dateMap.get(branchId) ?? 0) + revenue);
  }

  const branches = Array.from(locationNames, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const dateRange = buildDateRange(since);

  const data = dateRange.map((date) => {
    const dayData = byDateAndBranch.get(date);
    const row: Record<string, string | number> = { date };

    for (const branch of branches) {
      row[branch.name] = roundCurrency(dayData?.get(branch.id) ?? 0);
    }

    return row;
  });

  return { data, branches: branches.map((b) => b.name) };
}

async function getBranchComparison(days?: number, locationId?: string | null) {
  const since = typeof days === "number" ? getWindowStart(days) : undefined;

  const items = await prisma.salesOrderItem.findMany({
    where: {
      location: { type: "BRANCH", ...(locationId ? { id: locationId } : {}) },
      salesOrder: {
        status: getSalesStatusWhere(),
        ...(since ? { createdAt: { gte: since } } : {}),
      },
    },
    select: {
      quantity: true,
      unitPrice: true,
      salesOrderId: true,
      location: {
        select: { id: true, name: true, code: true },
      },
      product: {
        select: { id: true, name: true },
      },
    },
  });

  const branchMap = new Map<
    string,
    {
      name: string;
      code: string;
      totalRevenue: number;
      orderIds: Set<string>;
      totalUnits: number;
      productRevenue: Map<string, { name: string; revenue: number }>;
    }
  >();

  for (const item of items) {
    const branchId = item.location.id;
    const revenue = item.quantity * item.unitPrice.toNumber();

    if (!branchMap.has(branchId)) {
      branchMap.set(branchId, {
        name: item.location.name,
        code: item.location.code,
        totalRevenue: 0,
        orderIds: new Set(),
        totalUnits: 0,
        productRevenue: new Map(),
      });
    }

    const branch = branchMap.get(branchId)!;
    branch.totalRevenue += revenue;
    branch.orderIds.add(item.salesOrderId);
    branch.totalUnits += item.quantity;

    const existing = branch.productRevenue.get(item.product.id);

    if (existing) {
      existing.revenue += revenue;
    } else {
      branch.productRevenue.set(item.product.id, {
        name: item.product.name,
        revenue,
      });
    }
  }

  return Array.from(branchMap.values())
    .map((branch) => {
      const orderCount = branch.orderIds.size;
      const topProduct = Array.from(branch.productRevenue.values()).sort(
        (a, b) => b.revenue - a.revenue
      )[0];

      return {
        name: branch.name,
        code: branch.code,
        totalRevenue: roundCurrency(branch.totalRevenue),
        orderCount,
        totalUnits: branch.totalUnits,
        avgOrderValue: orderCount > 0 ? roundCurrency(branch.totalRevenue / orderCount) : 0,
        topProduct: topProduct?.name ?? "N/A",
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

async function getSeasonalTrends(locationId?: string | null): Promise<BranchSeries> {
  const items = await prisma.salesOrderItem.findMany({
    where: {
      location: { type: "BRANCH", ...(locationId ? { id: locationId } : {}) },
      salesOrder: {
        status: getSalesStatusWhere(),
      },
    },
    select: {
      quantity: true,
      unitPrice: true,
      location: {
        select: { id: true, name: true },
      },
      salesOrder: {
        select: { createdAt: true },
      },
    },
  });

  const byMonth = new Map<string, Map<string, number>>();
  const locationNames = new Map<string, string>();

  for (const item of items) {
    const month = toMonthKey(item.salesOrder.createdAt);
    const branchId = item.location.id;
    const revenue = item.quantity * item.unitPrice.toNumber();

    locationNames.set(branchId, item.location.name);

    if (!byMonth.has(month)) {
      byMonth.set(month, new Map());
    }

    const monthMap = byMonth.get(month)!;
    monthMap.set(branchId, (monthMap.get(branchId) ?? 0) + revenue);
  }

  const branches = Array.from(locationNames, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const months = Array.from(byMonth.keys()).sort();

  const data = months.map((month) => {
    const monthData = byMonth.get(month);
    const row: Record<string, string | number> = { month };

    for (const branch of branches) {
      row[branch.name] = roundCurrency(monthData?.get(branch.id) ?? 0);
    }

    return row;
  });

  return { data, branches: branches.map((b) => b.name) };
}

export async function getReportsOverviewData(
  options: ReportsScopeOptions = {}
): Promise<ReportsOverviewData> {
  const scopedLocationId = normalizeScopeLocationId(options.locationId);
  const [salesTrend, financialSummary, costShockSummary] = await Promise.all([
    getSalesTrendData(REPORT_OVERVIEW_WINDOW_DAYS, scopedLocationId),
    getFinancialSummary(REPORT_OVERVIEW_WINDOW_DAYS, scopedLocationId),
    getCostShockSummary(REPORT_OVERVIEW_WINDOW_DAYS, scopedLocationId),
  ]);

  const highestDay = salesTrend
    .filter((day) => day.revenue > 0)
    .reduce<SalesTrendPoint | null>((best, day) => {
      if (!best || day.revenue > best.revenue) {
        return day;
      }

      return best;
    }, null);

  const lowestDay = salesTrend
    .filter((day) => day.revenue > 0)
    .reduce<SalesTrendPoint | null>((best, day) => {
      if (!best || day.revenue < best.revenue) {
        return day;
      }

      return best;
    }, null);

  return {
    salesTrend,
    summary: {
      totalRevenue: financialSummary.totalRevenue,
      totalCogs: financialSummary.totalCogs,
      totalGrossProfit: financialSummary.totalGrossProfit,
      grossMarginPct: financialSummary.grossMarginPct,
      totalUnitsSold: financialSummary.totalUnitsSold,
      highestDay,
      lowestDay,
      noSalesDays: salesTrend.filter((day) => day.revenue === 0).length,
    },
    metricContext: buildMetricContext({
      financialSummary,
      costShockSummary,
    }),
  };
}

export async function getReportsAnalyticsData(
  days: number = DEFAULT_ANALYTICS_WINDOW_DAYS,
  options: ReportsScopeOptions = {}
): Promise<ReportsAnalyticsData> {
  const analyticsDays = Math.max(1, Math.floor(days));
  const scopedLocationId = normalizeScopeLocationId(options.locationId);
  const [
    salesTrend,
    financialSummary,
    salesItemAnalytics,
    inventorySnapshot,
    movementTrends,
    orderStatusDistribution,
    locationUtilization,
    revenueByBranch,
    branchComparison,
    seasonalTrends,
    costShockSummary,
  ] = await Promise.all([
    getSalesTrendData(analyticsDays, scopedLocationId),
    getFinancialSummary(analyticsDays, scopedLocationId),
    getSalesItemAnalytics(analyticsDays, scopedLocationId),
    getInventoryHealthSnapshot(scopedLocationId),
    getStockMovementTrends(analyticsDays, scopedLocationId),
    getOrderStatusDistribution(analyticsDays, scopedLocationId),
    getLocationUtilization(scopedLocationId),
    getRevenueByBranchOverTime(analyticsDays, scopedLocationId),
    getBranchComparison(analyticsDays, scopedLocationId),
    getSeasonalTrends(scopedLocationId),
    getCostShockSummary(analyticsDays, scopedLocationId),
  ]);

  return {
    analyticsDays,
    salesTrend,
    financialSummary,
    revenueByCategory: salesItemAnalytics.revenueByCategory,
    topProducts: salesItemAnalytics.topProducts,
    inventoryHealth: inventorySnapshot.rows,
    inventorySummary: {
      activeProductCount: inventorySnapshot.activeProductCount,
      lowStockCount: inventorySnapshot.lowStockCount,
    },
    movementTrends,
    orderStatusDistribution,
    locationUtilization,
    revenueByBranch,
    branchComparison,
    seasonalTrends,
    metricContext: buildMetricContext({
      financialSummary,
      costShockSummary,
    }),
  };
}

export async function getReportsQuotaData({
  days = DEFAULT_QUOTA_WINDOW_DAYS,
  metric = "revenue",
  target = null,
  locationId = null,
}: {
  days?: number;
  metric?: QuotaMetric;
  target?: number | null;
  locationId?: string | null;
} = {}): Promise<ReportsQuotaData> {
  const quotaDays = Math.max(1, Math.floor(days));
  const normalizedTarget = target && target > 0 ? target : null;
  const scopedLocationId = normalizeScopeLocationId(locationId);
  const since = getWindowStart(quotaDays);

  const [branches, items] = await Promise.all([
    prisma.stockLocation.findMany({
      where: {
        type: "BRANCH",
        isActive: true,
        ...(scopedLocationId ? { id: scopedLocationId } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.salesOrderItem.findMany({
      where: {
        location: {
          type: "BRANCH",
          ...(scopedLocationId ? { id: scopedLocationId } : {}),
        },
        salesOrder: {
          status: getSalesStatusWhere(),
          createdAt: { gte: since },
        },
      },
      select: {
        quantity: true,
        unitPrice: true,
        location: {
          select: {
            id: true,
          },
        },
        salesOrder: {
          select: {
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const branchMap = new Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      totalRevenue: number;
      totalUnits: number;
      dailyRevenue: Map<string, number>;
      dailyUnits: Map<string, number>;
    }
  >();

  for (const branch of branches) {
    branchMap.set(branch.id, {
      ...branch,
      totalRevenue: 0,
      totalUnits: 0,
      dailyRevenue: new Map(),
      dailyUnits: new Map(),
    });
  }

  for (const item of items) {
    const existing = branchMap.get(item.location.id);

    if (!existing) {
      continue;
    }

    const date = toDateKey(item.salesOrder.createdAt);
    const lineRevenue = item.quantity * item.unitPrice.toNumber();

    existing.totalRevenue += lineRevenue;
    existing.totalUnits += item.quantity;
    existing.dailyRevenue.set(date, (existing.dailyRevenue.get(date) ?? 0) + lineRevenue);
    existing.dailyUnits.set(date, (existing.dailyUnits.get(date) ?? 0) + item.quantity);
  }

  const rows = Array.from(branchMap.values())
    .map((branch) => {
      const currentValue = metric === "revenue" ? branch.totalRevenue : branch.totalUnits;
      const bestDayValue =
        metric === "revenue"
          ? getMaxValue(branch.dailyRevenue.values())
          : getMaxValue(branch.dailyUnits.values());
      const activeSalesDays =
        metric === "revenue"
          ? Array.from(branch.dailyRevenue.values()).filter((value) => value > 0).length
          : Array.from(branch.dailyUnits.values()).filter((value) => value > 0).length;
      const attainmentRatio = normalizedTarget ? currentValue / normalizedTarget : null;
      const remainingToTarget = normalizedTarget
        ? Math.max(normalizedTarget - currentValue, 0)
        : null;

      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        totalRevenue: roundCurrency(branch.totalRevenue),
        totalUnits: branch.totalUnits,
        currentValue: metric === "revenue" ? roundCurrency(currentValue) : currentValue,
        averagePerDay:
          metric === "revenue"
            ? roundCurrency(currentValue / quotaDays)
            : Math.round((currentValue / quotaDays) * 100) / 100,
        bestDayValue: metric === "revenue" ? roundCurrency(bestDayValue) : bestDayValue,
        activeSalesDays,
        attainmentRatio,
        remainingToTarget:
          metric === "revenue" && remainingToTarget !== null
            ? roundCurrency(remainingToTarget)
            : remainingToTarget,
        reached: normalizedTarget ? currentValue >= normalizedTarget : null,
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  const reachedCount = rows.filter((row) => row.reached).length;
  const averageAttainment =
    normalizedTarget && rows.length > 0
      ? rows.reduce((sum, row) => sum + (row.attainmentRatio ?? 0), 0) / rows.length
      : null;

  return {
    days: quotaDays,
    metric,
    target: normalizedTarget,
    branchCount: rows.length,
    reachedCount,
    averageAttainment,
    bestPerformer: rows[0]
      ? {
          name: rows[0].name,
          value: rows[0].currentValue,
        }
      : null,
    rows,
  };
}

export async function getDedicatedBranchQuotaData({
  metric = "revenue",
}: {
  metric?: QuotaMetric;
} = {}): Promise<BranchQuotaPageData> {
  const branches = await prisma.stockLocation.findMany({
    where: {
      type: "BRANCH",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  if (branches.length === 0) {
    return {
      metric,
      storageReady: true,
      rows: [],
      summary: {
        branchCount: 0,
        configuredCount: 0,
        reachedCount: 0,
        averageAttainment: null,
        bands: {
          unconfigured: 0,
          red: 0,
          amber: 0,
          green: 0,
        },
        bestPerformer: null,
      },
    };
  }

  const branchIds = branches.map((branch) => branch.id);
  let hasBranchQuotaSettingsTable = false;
  let storageReady = true;
  try {
    const tableCheckRows = await prisma.$queryRaw<Array<{ tableExists: boolean }>>(
      Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = current_schema()
            AND LOWER(table_name) = 'branchquotasetting'
        ) AS "tableExists"
      `
    );
    hasBranchQuotaSettingsTable = Boolean(tableCheckRows[0]?.tableExists);
    if (!hasBranchQuotaSettingsTable) {
      storageReady = false;
    }
  } catch (error) {
    if (!isMissingBranchQuotaSettingsTableError(error)) {
      throw error;
    }
    storageReady = false;
  }

  let settingsRows: Array<{
    branchId: string;
    rollingWindowDays: number;
    revenueTarget: Prisma.Decimal | number | string | null;
    unitsTarget: number | null;
  }> = [];

  if (branchIds.length > 0 && hasBranchQuotaSettingsTable) {
    try {
      settingsRows = await prisma.$queryRaw<
        Array<{
          branchId: string;
          rollingWindowDays: number;
          revenueTarget: Prisma.Decimal | number | string | null;
          unitsTarget: number | null;
        }>
      >(
        Prisma.sql`
          SELECT "branchId", "rollingWindowDays", "revenueTarget", "unitsTarget"
          FROM "BranchQuotaSetting"
          WHERE "branchId" IN (${Prisma.join(branchIds)})
        `
      );
    } catch (error) {
      if (!isMissingBranchQuotaSettingsTableError(error)) {
        throw error;
      }
      storageReady = false;
    }
  }

  const settingsByBranchId = new Map(settingsRows.map((setting) => [setting.branchId, setting]));

  const normalizedBranches = branches.map((branch) => {
    const setting = settingsByBranchId.get(branch.id);

    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      rollingWindowDays: setting?.rollingWindowDays ?? DEFAULT_QUOTA_WINDOW_DAYS,
      revenueTarget:
        setting?.revenueTarget === null || setting?.revenueTarget === undefined
          ? null
          : Number(setting.revenueTarget),
      unitsTarget: setting?.unitsTarget ?? null,
    };
  });

  const maxRollingWindowDays = normalizedBranches.reduce(
    (maxDays, branch) => Math.max(maxDays, branch.rollingWindowDays),
    DEFAULT_QUOTA_WINDOW_DAYS
  );
  const since = getWindowStart(maxRollingWindowDays);
  const items = await prisma.salesOrderItem.findMany({
    where: {
      locationId: {
        in: branchIds,
      },
      salesOrder: {
        status: getSalesStatusWhere(),
        createdAt: { gte: since },
      },
    },
    select: {
      locationId: true,
      quantity: true,
      unitPrice: true,
      salesOrder: {
        select: {
          createdAt: true,
        },
      },
    },
  });

  const rows = computeBranchQuotaRows({
    branches: normalizedBranches,
    sales: items.map((item) => ({
      branchId: item.locationId,
      dateKey: toDateKey(item.salesOrder.createdAt),
      revenue: item.quantity * item.unitPrice.toNumber(),
      units: item.quantity,
    })),
    metric,
  });

  const configuredRows = rows.filter((row) => row.targetValue !== null);
  const reachedRows = rows.filter((row) => row.reached);
  const bands: Record<QuotaAttainmentBand, number> = {
    unconfigured: 0,
    red: 0,
    amber: 0,
    green: 0,
  };

  for (const row of rows) {
    bands[row.band] += 1;
  }

  const averageAttainment =
    configuredRows.length > 0
      ? configuredRows.reduce((sum, row) => sum + (row.attainmentRatio ?? 0), 0) /
        configuredRows.length
      : null;

  return {
    metric,
    storageReady,
    rows,
    summary: {
      branchCount: rows.length,
      configuredCount: configuredRows.length,
      reachedCount: reachedRows.length,
      averageAttainment,
      bands,
      bestPerformer: rows[0]
        ? {
            name: rows[0].name,
            value: rows[0].currentValue,
          }
        : null,
    },
  };
}
