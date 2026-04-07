import "server-only";

import type { MovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getThirtyDaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  date.setHours(0, 0, 0, 0);
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

async function getSalesTrendData() {
  const since = getThirtyDaysAgo();

  const orders = await prisma.salesOrder.findMany({
    where: {
      createdAt: { gte: since },
      status: { not: "CANCELLED" },
    },
    select: {
      totalAmount: true,
      createdAt: true,
    },
  });

  const byDate = new Map<string, { revenue: number; orderCount: number }>();

  for (const order of orders) {
    const key = toDateKey(order.createdAt);
    const existing = byDate.get(key) ?? { revenue: 0, orderCount: 0 };
    existing.revenue += order.totalAmount.toNumber();
    existing.orderCount += 1;
    byDate.set(key, existing);
  }

  return buildDateRange(since).map((date) => ({
    date,
    revenue: byDate.get(date)?.revenue ?? 0,
    orderCount: byDate.get(date)?.orderCount ?? 0,
  }));
}

async function getSalesItemAnalytics() {
  const items = await prisma.salesOrderItem.findMany({
    where: {
      salesOrder: {
        status: { not: "CANCELLED" },
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
    revenue: Math.round(revenue * 100) / 100,
  })).sort((a, b) => b.revenue - a.revenue);

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((p) => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
    }));

  return { revenueByCategory, topProducts };
}

async function getInventoryHealthData() {
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

  return Array.from(productMap.values())
    .map((p) => {
      const available = p.totalStock - p.totalReserved;
      let status: "healthy" | "low" | "out";

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
    })
    .slice(0, 20);
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

async function getStockMovementTrends() {
  const since = getThirtyDaysAgo();

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

async function getOrderStatusDistribution() {
  const distribution = await prisma.salesOrder.groupBy({
    by: ["status"],
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

async function getRevenueByBranchOverTime() {
  const since = getThirtyDaysAgo();

  const items = await prisma.salesOrderItem.findMany({
    where: {
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

  const warehouseNames = new Map<string, string>();
  const byDateAndBranch = new Map<string, Map<string, number>>();

  for (const item of items) {
    const date = toDateKey(item.salesOrder.createdAt);
    const branchId = item.location.id;
    const revenue = item.quantity * item.unitPrice.toNumber();

    warehouseNames.set(branchId, item.location.name);

    if (!byDateAndBranch.has(date)) {
      byDateAndBranch.set(date, new Map());
    }

    const dateMap = byDateAndBranch.get(date)!;
    dateMap.set(branchId, (dateMap.get(branchId) ?? 0) + revenue);
  }

  const branches = Array.from(warehouseNames, ([id, name]) => ({ id, name }));
  const dateRange = buildDateRange(since);

  const data = dateRange.map((date) => {
    const dayData = byDateAndBranch.get(date);
    const row: Record<string, string | number> = { date };

    for (const branch of branches) {
      row[branch.name] = Math.round((dayData?.get(branch.id) ?? 0) * 100) / 100;
    }

    return row;
  });

  return { data, branches: branches.map((b) => b.name) };
}

async function getBranchComparison() {
  const items = await prisma.salesOrderItem.findMany({
    where: {
      salesOrder: {
        status: { not: "CANCELLED" },
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

  return Array.from(branchMap.values()).map((branch) => {
    const orderCount = branch.orderIds.size;
    const topProduct = Array.from(branch.productRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)[0];

    return {
      name: branch.name,
      code: branch.code,
      totalRevenue: Math.round(branch.totalRevenue * 100) / 100,
      orderCount,
      totalUnits: branch.totalUnits,
      avgOrderValue:
        orderCount > 0
          ? Math.round((branch.totalRevenue / orderCount) * 100) / 100
          : 0,
      topProduct: topProduct?.name ?? "N/A",
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

async function getSeasonalTrends() {
  const items = await prisma.salesOrderItem.findMany({
    where: {
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

  const byMonth = new Map<string, Map<string, { revenue: number; orders: Set<string> }>>();
  const warehouseNames = new Map<string, string>();

  for (const item of items) {
    const month = item.salesOrder.createdAt.toISOString().slice(0, 7); // YYYY-MM
    const branchId = item.location.id;
    const revenue = item.quantity * item.unitPrice.toNumber();

    warehouseNames.set(branchId, item.location.name);

    if (!byMonth.has(month)) {
      byMonth.set(month, new Map());
    }

    const monthMap = byMonth.get(month)!;

    if (!monthMap.has(branchId)) {
      monthMap.set(branchId, { revenue: 0, orders: new Set() });
    }

    const entry = monthMap.get(branchId)!;
    entry.revenue += revenue;
  }

  const branches = Array.from(warehouseNames, ([id, name]) => ({ id, name }));
  const months = Array.from(byMonth.keys()).sort();

  const data = months.map((month) => {
    const monthData = byMonth.get(month);
    const row: Record<string, string | number> = { month };

    for (const branch of branches) {
      row[branch.name] = Math.round((monthData?.get(branch.id)?.revenue ?? 0) * 100) / 100;
    }

    return row;
  });

  return { data, branches: branches.map((b) => b.name) };
}

export async function getReportsPageData() {
  const [
    salesTrend,
    salesItemAnalytics,
    inventoryHealth,
    movementTrends,
    orderStatusDistribution,
    locationUtilization,
    revenueByBranch,
    branchComparison,
    seasonalTrends,
  ] = await Promise.all([
    getSalesTrendData(),
    getSalesItemAnalytics(),
    getInventoryHealthData(),
    getStockMovementTrends(),
    getOrderStatusDistribution(),
    getLocationUtilization(),
    getRevenueByBranchOverTime(),
    getBranchComparison(),
    getSeasonalTrends(),
  ]);

  const totalRevenue = salesTrend.reduce((sum, day) => sum + day.revenue, 0);
  const totalOrders = salesTrend.reduce((sum, day) => sum + day.orderCount, 0);
  const lowStockCount = inventoryHealth.filter(
    (p) => p.status === "low" || p.status === "out"
  ).length;
  const activeProductCount = inventoryHealth.length;

  return {
    salesTrend,
    revenueByCategory: salesItemAnalytics.revenueByCategory,
    topProducts: salesItemAnalytics.topProducts,
    inventoryHealth,
    movementTrends,
    orderStatusDistribution,
    locationUtilization,
    revenueByBranch,
    branchComparison,
    seasonalTrends,
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      lowStockCount,
      activeProductCount,
    },
  };
}
