import "server-only";

import {
  ProductStatus,
  SalesOrderStatus,
  type LocationType,
  type MovementType,
  type Role,
} from "@prisma/client";
import { getInventoryLandingData } from "@/lib/dal/inventory";
import { REPORT_INCLUDED_SALES_STATUSES } from "@/lib/dal/reports";
import { prisma } from "@/lib/prisma";
import { businessStartOfToday } from "@/lib/timezone";

const revenueSalesOrderStatuses = REPORT_INCLUDED_SALES_STATUSES;

const dashboardVisibleProductStatuses = [
  ProductStatus.ACTIVE,
  ProductStatus.INACTIVE,
] as const;

export type DashboardRecentMovement = {
  id: string;
  type: MovementType;
  quantityChange: number;
  createdAt: Date;
  productName: string;
  productSku: string;
  locationName: string;
  performedByName: string;
};

export type DashboardLocationHealth = {
  id: string;
  name: string;
  type: LocationType;
  skuCount: number;
  totalOnHand: number;
  lowStockCount: number;
};

export type DashboardData = {
  ordersToday: number;
  revenueToday: number;
  lowStockAlerts: number;
  ordersAwaitingDelivery: number;
  recentMovements: DashboardRecentMovement[];
  locationHealth: DashboardLocationHealth[];
};

// Replaced the inline `getStartOfToday` (which used Node's local TZ via
// setHours) with `businessStartOfToday` from lib/timezone.ts, which always
// anchors to Asia/Manila regardless of the server's system timezone setting.

export async function getDashboardData(
  _userId: string,
  role: Role,
  activeLocationId: string | null
): Promise<DashboardData> {
  const startOfToday = businessStartOfToday();
  const salesStaffOrderScope =
    role === "SALES_STAFF" && activeLocationId
      ? {
          // Use the same strict scope as the order list: an order belongs to this
          // branch only if ALL of its items are from this branch. The previous
          // `some` filter included orders where at least one item matched — which
          // counted mixed-branch orders and inflated revenue figures compared to
          // what the branch order list actually shows. The `some + none` pattern
          // makes dashboard totals and list counts consistent.
          items: {
            some: { locationId: activeLocationId },
            none: { locationId: { not: activeLocationId } },
          },
        }
      : {};
  const salesStaffLocationScope =
    role === "SALES_STAFF" && activeLocationId ? { locationId: activeLocationId } : {};

  const [
    ordersToday,
    revenueTodayAggregate,
    lowStockRows,
    ordersAwaitingDelivery,
    recentMovements,
    inventoryLandingData,
  ] = await Promise.all([
    prisma.salesOrder.count({
      where: {
        ...salesStaffOrderScope,
        createdAt: {
          gte: startOfToday,
        },
      },
    }),
    prisma.salesOrder.aggregate({
      where: {
        ...salesStaffOrderScope,
        createdAt: {
          gte: startOfToday,
        },
        status: {
          in: [...revenueSalesOrderStatuses],
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.locationStock.findMany({
      where: {
        ...salesStaffLocationScope,
        // Include rows where either the location-level or product-level
        // reorder threshold is set, so per-branch overrides are respected.
        OR: [
          {
            product: {
              reorderLevel: { gt: 0 },
              status: { in: [...dashboardVisibleProductStatuses] },
            },
          },
          {
            reorderLevel: { gt: 0 },
            product: { status: { in: [...dashboardVisibleProductStatuses] } },
          },
        ],
      },
      select: {
        quantity: true,
        reservedQty: true,
        reorderLevel: true,
        product: {
          select: {
            reorderLevel: true,
          },
        },
      },
    }),
    prisma.salesOrder.count({
      where: {
        status: SalesOrderStatus.CONFIRMED,
        ...salesStaffOrderScope,
      },
    }),
    prisma.inventoryMovement.findMany({
      where: salesStaffLocationScope,
      orderBy: [{ createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        type: true,
        quantityChange: true,
        createdAt: true,
        product: {
          select: {
            name: true,
            sku: true,
          },
        },
        location: {
          select: {
            name: true,
          },
        },
        performedBy: {
          select: {
            firstName: true,
          },
        },
      },
    }),
    getInventoryLandingData({
      locationId: role === "SALES_STAFF" ? activeLocationId : null,
    }),
  ]);

  return {
    ordersToday,
    revenueToday: revenueTodayAggregate._sum.totalAmount?.toNumber() ?? 0,
    lowStockAlerts: lowStockRows.filter((row) => {
      const threshold = row.reorderLevel ?? row.product.reorderLevel;
      return threshold > 0 && (row.quantity - row.reservedQty) <= threshold;
    }).length,
    ordersAwaitingDelivery,
    recentMovements: recentMovements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantityChange: movement.quantityChange,
      createdAt: movement.createdAt,
      productName: movement.product.name,
      productSku: movement.product.sku,
      locationName: movement.location.name,
      performedByName: movement.performedBy.firstName,
    })),
    locationHealth: inventoryLandingData.locationCards
      .filter((location) =>
        role === "SALES_STAFF" && activeLocationId ? location.id === activeLocationId : true
      )
      .map((location) => ({
        id: location.id,
        name: location.name,
        type: location.type,
        skuCount: location.skuCount,
        totalOnHand: location.totalOnHand,
        lowStockCount: location.lowStockCount,
      })),
  };
}
