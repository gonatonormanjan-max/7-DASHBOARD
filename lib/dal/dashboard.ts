import "server-only";

import {
  ProductStatus,
  SalesOrderStatus,
  type LocationType,
  type MovementType,
  type Role,
} from "@prisma/client";
import { getInventoryLandingData } from "@/lib/dal/inventory";
import { prisma } from "@/lib/prisma";

const revenueSalesOrderStatuses = [
  SalesOrderStatus.CONFIRMED,
  SalesOrderStatus.DELIVERED,
  SalesOrderStatus.COMPLETED,
] as const;

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

function getStartOfToday() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return startOfToday;
}

export async function getDashboardData(
  userId: string,
  role: Role,
  assignedLocationId: string | null
): Promise<DashboardData> {
  const startOfToday = getStartOfToday();
  const salesStaffOrderScope =
    role === "SALES_STAFF" && assignedLocationId ? { createdById: userId } : {};
  const salesStaffLocationScope =
    role === "SALES_STAFF" && assignedLocationId ? { locationId: assignedLocationId } : {};

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
        createdAt: {
          gte: startOfToday,
        },
        ...salesStaffOrderScope,
      },
    }),
    prisma.salesOrder.aggregate({
      where: {
        createdAt: {
          gte: startOfToday,
        },
        status: {
          in: [...revenueSalesOrderStatuses],
        },
        ...salesStaffOrderScope,
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.locationStock.findMany({
      where: {
        ...salesStaffLocationScope,
        product: {
          reorderLevel: {
            gt: 0,
          },
          status: {
            in: [...dashboardVisibleProductStatuses],
          },
        },
      },
      select: {
        quantity: true,
        reservedQty: true,
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
    getInventoryLandingData(),
  ]);

  return {
    ordersToday,
    revenueToday: revenueTodayAggregate._sum.totalAmount?.toNumber() ?? 0,
    lowStockAlerts: lowStockRows.filter(
      (row) => row.quantity - row.reservedQty <= row.product.reorderLevel
    ).length,
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
    locationHealth: inventoryLandingData.locationCards.map((location) => ({
      id: location.id,
      name: location.name,
      type: location.type,
      skuCount: location.skuCount,
      totalOnHand: location.totalOnHand,
      lowStockCount: location.lowStockCount,
    })),
  };
}
