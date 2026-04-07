import "server-only";

import { Prisma, ProductStatus } from "@prisma/client";
import { getAvailableQuantity } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import type { InventoryPageFilters } from "@/lib/validators/inventory";

function getDateRangeWhere(filters: InventoryPageFilters) {
  const createdAt: Prisma.DateTimeFilter = {};

  if (filters.dateFrom) {
    createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000`);
  }

  if (filters.dateTo) {
    createdAt.lte = new Date(`${filters.dateTo}T23:59:59.999`);
  }

  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
}

function getInventoryProductWhere(filters: InventoryPageFilters): Prisma.ProductWhereInput {
  return {
    status: {
      in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE],
    },
    ...(filters.query
      ? {
          OR: [
            { name: { contains: filters.query, mode: "insensitive" } },
            { sku: { contains: filters.query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
  };
}

function isLowStockRow(row: {
  quantity: number;
  reservedQty: number;
  product: { reorderLevel: number };
}) {
  const availableQty = getAvailableQuantity(row.quantity, row.reservedQty);
  return row.product.reorderLevel > 0 && availableQty <= row.product.reorderLevel;
}

export async function getInventoryPageData(filters: InventoryPageFilters) {
  const productWhere = getInventoryProductWhere(filters);
  const createdAt = getDateRangeWhere(filters);

  const stockWhere: Prisma.LocationStockWhereInput = {
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    product: productWhere,
  };

  const movementWhere: Prisma.InventoryMovementWhereInput = {
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(filters.movementType !== "all" ? { type: filters.movementType } : {}),
    ...(createdAt ? { createdAt } : {}),
    product: productWhere,
  };

  const [stockRows, movements, locations, categories, suppliers, products] =
    await Promise.all([
      prisma.locationStock.findMany({
        where: stockWhere,
        orderBy: [{ location: { name: "asc" } }, { product: { name: "asc" } }],
        select: {
          id: true,
          quantity: true,
          reservedQty: true,
          updatedAt: true,
          location: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              isActive: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              reorderLevel: true,
              category: {
                select: { id: true, name: true },
              },
              supplier: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.inventoryMovement.findMany({
        where: movementWhere,
        orderBy: [{ createdAt: "desc" }],
        take: 40,
        select: {
          id: true,
          type: true,
          quantityChange: true,
          notes: true,
          createdAt: true,
          transferGroupId: true,
          location: {
            select: { id: true, name: true, code: true },
          },
          product: {
            select: { id: true, name: true, sku: true },
          },
          performedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.stockLocation.findMany({
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, code: true, type: true },
      }),
      prisma.category.findMany({
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.supplier.findMany({
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.product.findMany({
        where: { status: { in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] } },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, sku: true },
      }),
    ]);

  const visibleStockRows = filters.lowStockOnly
    ? stockRows.filter((row) => isLowStockRow(row))
    : stockRows;

  const lowStockRows = [...stockRows]
    .filter((row) => isLowStockRow(row))
    .sort((left, right) => {
      const leftShortage =
        left.product.reorderLevel - getAvailableQuantity(left.quantity, left.reservedQty);
      const rightShortage =
        right.product.reorderLevel - getAvailableQuantity(right.quantity, right.reservedQty);
      return rightShortage - leftShortage || left.product.name.localeCompare(right.product.name);
    });

  const skuSet = new Set(
    visibleStockRows
      .filter((row) => getAvailableQuantity(row.quantity, row.reservedQty) > 0)
      .map((row) => row.product.id)
  );

  return {
    stockRows: visibleStockRows,
    lowStockRows,
    movements,
    options: {
      locations,
      categories,
      suppliers,
      products,
    },
    summary: {
      skuCount: skuSet.size,
      lowStockCount: lowStockRows.length,
      outOfStockCount: visibleStockRows.filter(
        (row) => getAvailableQuantity(row.quantity, row.reservedQty) <= 0
      ).length,
      onHandUnits: visibleStockRows.reduce((sum, row) => sum + row.quantity, 0),
    },
  };
}
