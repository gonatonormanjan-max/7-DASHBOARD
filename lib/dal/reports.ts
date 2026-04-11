import "server-only";

import type { MovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const REPORT_OVERVIEW_WINDOW_DAYS = 30;
export const DEFAULT_ANALYTICS_WINDOW_DAYS = 90;
export const DEFAULT_QUOTA_WINDOW_DAYS = 30;

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

export type ReportsOverviewData = {
  salesTrend: SalesTrendPoint[];
  summary: {
    totalRevenue: number;
    totalUnitsSold: number;
    highestDay: SalesTrendPoint | null;
    lowestDay: SalesTrendPoint | null;
    noSalesDays: number;
  };
};

export type ReportsAnalyticsData = {
  analyticsDays: number;
  salesTrend: SalesTrendPoint[];
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getWindowStart(days: number) {
  const safeDays = Math.max(1, Math.floor(days));
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (safeDays - 1));
  return date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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

async function getSalesTrendData(
  days: number = REPORT_OVERVIEW_WINDOW_DAYS
): Promise<SalesTrendPoint[]> {
  const since = getWindowStart(days);

  const orders = await prisma.salesOrder.findMany({
    where: {
      createdAt: { gte: since },
      status: { not: "CANCELLED" },
    },
    select: {
      totalAmount: true,
      createdAt: true,
      items: {
        select: {
          quantity: true,
        },
      },
    },
  });

  const byDate = new Map<string, { revenue: number; orderCount: number; unitsSold: number }>();

  for (const order of orders) {
    const key = toDateKey(order.createdAt);
    const existing = byDate.get(key) ?? { revenue: 0, orderCount: 0, unitsSold: 0 };
    existing.revenue += order.totalAmount.toNumber();
    existing.orderCount += 1;
    existing.unitsSold += order.items.reduce((sum, item) => sum + item.quantity, 0);
    byDate.set(key, existing);
  }

  return buildDateRange(since).map((date) => ({
    date,
    revenue: roundCurrency(byDate.get(date)?.revenue ?? 0),
    orderCount: byDate.get(date)?.orderCount ?? 0,
    unitsSold: byDate.get(date)?.unitsSold ?? 0,
  }));
}

async function getSalesItemAnalytics(days?: number) {
  const since = typeof days === "number" ? getWindowStart(days) : undefined;

  const items = await prisma.salesOrderItem.findMany({
    where: {
      salesOrder: {
        status: { not: "CANCELLED" },
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

async function getInventoryHealthSnapshot() {
  const stockRows = await prisma.locationStock.findMany({
    where: {
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

async function getStockMovementTrends(days: number) {
  const since = getWindowStart(days);

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      createdAt: { gte: since },
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

async function getOrderStatusDistribution(days?: number) {
  const since = typeof days === "number" ? getWindowStart(days) : undefined;

  const distribution = await prisma.salesOrder.groupBy({
    by: ["status"],
    where: since ? { createdAt: { gte: since } } : undefined,
    _count: { _all: true },
  });

  return distribution.map((row) => ({
    status: row.status.replace(/_/g, " "),
    count: row._count._all,
  }));
}

async function getLocationUtilization() {
  const stockRows = await prisma.locationStock.findMany({
    where: {
      location: { isActive: true },
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

async function getRevenueByBranchOverTime(days: number): Promise<BranchSeries> {
  const since = getWindowStart(days);

  const items = await prisma.salesOrderItem.findMany({
    where: {
      location: { type: "BRANCH" },
      salesOrder: {
        status: { not: "CANCELLED" },
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

async function getBranchComparison(days?: number) {
  const since = typeof days === "number" ? getWindowStart(days) : undefined;

  const items = await prisma.salesOrderItem.findMany({
    where: {
      location: { type: "BRANCH" },
      salesOrder: {
        status: { not: "CANCELLED" },
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

async function getSeasonalTrends(): Promise<BranchSeries> {
  const items = await prisma.salesOrderItem.findMany({
    where: {
      location: { type: "BRANCH" },
      salesOrder: {
        status: { not: "CANCELLED" },
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
    const month = item.salesOrder.createdAt.toISOString().slice(0, 7);
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

export async function getReportsOverviewData(): Promise<ReportsOverviewData> {
  const salesTrend = await getSalesTrendData(REPORT_OVERVIEW_WINDOW_DAYS);
  const totalRevenue = roundCurrency(
    salesTrend.reduce((sum, day) => sum + day.revenue, 0)
  );
  const totalUnitsSold = salesTrend.reduce((sum, day) => sum + day.unitsSold, 0);

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
      totalRevenue,
      totalUnitsSold,
      highestDay,
      lowestDay,
      noSalesDays: salesTrend.filter((day) => day.revenue === 0).length,
    },
  };
}

export async function getReportsAnalyticsData(
  days: number = DEFAULT_ANALYTICS_WINDOW_DAYS
): Promise<ReportsAnalyticsData> {
  const analyticsDays = Math.max(1, Math.floor(days));
  const [
    salesTrend,
    salesItemAnalytics,
    inventorySnapshot,
    movementTrends,
    orderStatusDistribution,
    locationUtilization,
    revenueByBranch,
    branchComparison,
    seasonalTrends,
  ] = await Promise.all([
    getSalesTrendData(analyticsDays),
    getSalesItemAnalytics(analyticsDays),
    getInventoryHealthSnapshot(),
    getStockMovementTrends(analyticsDays),
    getOrderStatusDistribution(analyticsDays),
    getLocationUtilization(),
    getRevenueByBranchOverTime(analyticsDays),
    getBranchComparison(analyticsDays),
    getSeasonalTrends(),
  ]);

  return {
    analyticsDays,
    salesTrend,
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
  };
}

export async function getReportsQuotaData({
  days = DEFAULT_QUOTA_WINDOW_DAYS,
  metric = "revenue",
  target = null,
}: {
  days?: number;
  metric?: QuotaMetric;
  target?: number | null;
} = {}): Promise<ReportsQuotaData> {
  const quotaDays = Math.max(1, Math.floor(days));
  const normalizedTarget = target && target > 0 ? target : null;
  const since = getWindowStart(quotaDays);

  const [branches, items] = await Promise.all([
    prisma.stockLocation.findMany({
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
    }),
    prisma.salesOrderItem.findMany({
      where: {
        location: { type: "BRANCH" },
        salesOrder: {
          status: { not: "CANCELLED" },
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
