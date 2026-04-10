import "server-only";

import {
  Prisma,
  ProductStatus,
  type LocationType,
  type MovementType,
} from "@prisma/client";
import { getAvailableQuantity } from "@/lib/inventory";
import { getPaginationMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type {
  InventoryPageFilters,
  InventoryStockSortField,
} from "@/lib/validators/inventory";

const inventoryVisibleProductStatuses: ProductStatus[] = [
  ProductStatus.ACTIVE,
  ProductStatus.INACTIVE,
];

const inventoryStockSelect = {
  id: true,
  quantity: true,
  reservedQty: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      reorderLevel: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      brand: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.LocationStockSelect;

type InventoryScopeLocationId = string | "system-wide";
type InventoryPageDataFilters = InventoryPageFilters & {
  locationId: InventoryScopeLocationId;
};
type RawInventoryStockRow = Prisma.LocationStockGetPayload<{
  select: typeof inventoryStockSelect;
}>;

export type InventoryLocationCard = {
  id: string;
  name: string;
  code: string;
  type: LocationType;
  skuCount: number;
  totalOnHand: number;
  lowStockCount: number;
};

export type InventoryLandingSummary = {
  totalSkus: number;
  totalOnHand: number;
  totalLowStock: number;
  totalOutOfStock: number;
};

export type InventoryStockRow = {
  id: string;
  quantity: number;
  reservedQty: number;
  availableQty: number;
  updatedAt: Date | null;
  product: {
    id: string;
    name: string;
    sku: string;
    reorderLevel: number;
    category: {
      id: string;
      name: string;
    };
    brand: {
      id: string;
      name: string;
    } | null;
  };
};

export type InventoryMovementRow = {
  id: string;
  type: MovementType;
  quantityChange: number;
  transferGroupId: string | null;
  createdAt: Date;
  notes: string | null;
  location: {
    id: string;
    name: string;
    code: string;
  };
  product: {
    id: string;
    name: string;
    sku: string;
  };
  performedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export type InventorySummary = {
  skuCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  onHandUnits: number;
};

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
      in: inventoryVisibleProductStatuses,
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
    ...(filters.brandId ? { brandId: filters.brandId } : {}),
  };
}

function getStockMetrics(
  quantity: number,
  reservedQty: number,
  reorderLevel: number
) {
  const availableQty = getAvailableQuantity(quantity, reservedQty);
  const isLowStock =
    reorderLevel > 0 && availableQty <= reorderLevel;
  const isOutOfStock = availableQty <= 0;

  return {
    availableQty,
    isLowStock,
    isOutOfStock,
  };
}

function mapStockRow(row: RawInventoryStockRow): InventoryStockRow {
  return {
    id: row.id,
    quantity: row.quantity,
    reservedQty: row.reservedQty,
    availableQty: getAvailableQuantity(row.quantity, row.reservedQty),
    updatedAt: row.updatedAt,
    product: row.product,
  };
}

function aggregateSystemWideStockRows(rows: RawInventoryStockRow[]) {
  const groupedRows = new Map<string, InventoryStockRow>();

  for (const row of rows) {
    const existing = groupedRows.get(row.product.id);

    if (!existing) {
      groupedRows.set(row.product.id, mapStockRow(row));
      continue;
    }

    existing.quantity += row.quantity;
    existing.reservedQty += row.reservedQty;
    existing.availableQty = getAvailableQuantity(existing.quantity, existing.reservedQty);
    existing.updatedAt =
      existing.updatedAt && existing.updatedAt > row.updatedAt ? existing.updatedAt : row.updatedAt;
  }

  return [...groupedRows.values()];
}

function sortInventoryStockRows(
  rows: InventoryStockRow[],
  sortBy: InventoryStockSortField,
  sortOrder: "asc" | "desc"
) {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftBrand = left.product.brand?.name ?? "Unbranded";
    const rightBrand = right.product.brand?.name ?? "Unbranded";
    let result = 0;

    switch (sortBy) {
      case "sku":
        result = left.product.sku.localeCompare(right.product.sku);
        break;
      case "category":
        result = left.product.category.name.localeCompare(right.product.category.name);
        break;
      case "brand":
        result = leftBrand.localeCompare(rightBrand);
        break;
      case "quantity":
        result = left.quantity - right.quantity;
        break;
      case "reservedQty":
        result = left.reservedQty - right.reservedQty;
        break;
      case "availableQty":
        result = left.availableQty - right.availableQty;
        break;
      case "reorderLevel":
        result = left.product.reorderLevel - right.product.reorderLevel;
        break;
      default:
        result = left.product.name.localeCompare(right.product.name);
        break;
    }

    return result * direction;
  });
}

export type StockSetupProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string | null;
  currentQty: number;
};

export async function getStockSetupPageData(locationId: string) {
  const [location, products, existingStock] = await Promise.all([
    prisma.stockLocation.findFirst({
      where: { id: locationId, isActive: true },
      select: { id: true, name: true, code: true, type: true },
    }),
    prisma.product.findMany({
      where: {
        status: { in: inventoryVisibleProductStatuses },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.locationStock.findMany({
      where: { locationId },
      select: { productId: true, quantity: true },
    }),
  ]);

  const stockByProductId = new Map(
    existingStock.map((s) => [s.productId, s.quantity])
  );

  const stockSetupProducts: StockSetupProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category.name,
    brand: product.brand?.name ?? null,
    currentQty: stockByProductId.get(product.id) ?? 0,
  }));

  return {
    location,
    products: stockSetupProducts,
  };
}

export async function getStockSetupLocations() {
  return prisma.stockLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, type: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function getInventoryLandingData() {
  const [locations, stockRows] = await Promise.all([
    prisma.stockLocation.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, type: true },
    }),
    prisma.locationStock.findMany({
      select: {
        locationId: true,
        quantity: true,
        reservedQty: true,
        product: { select: { reorderLevel: true } },
      },
    }),
  ]);

  const locationCards: InventoryLocationCard[] = locations.map((location) => {
    const locationStockRows = stockRows.filter(
      (row) => row.locationId === location.id
    );

    const skuCount = locationStockRows.filter(
      (row) => row.quantity > 0
    ).length;

    const totalOnHand = locationStockRows.reduce(
      (sum, row) => sum + row.quantity,
      0
    );

    const lowStockCount = locationStockRows.filter((row) => {
      const availableQty = getAvailableQuantity(row.quantity, row.reservedQty);
      return (
        row.product.reorderLevel > 0 && availableQty <= row.product.reorderLevel
      );
    }).length;

    return {
      id: location.id,
      name: location.name,
      code: location.code,
      type: location.type,
      skuCount,
      totalOnHand,
      lowStockCount,
    };
  });

  const seenProductIds = new Set<string>();
  let totalSkus = 0;
  let totalLowStock = 0;
  let totalOutOfStock = 0;

  for (const row of stockRows) {
    if (!seenProductIds.has(row.product.id)) {
      seenProductIds.add(row.product.id);
      totalSkus++;
    }
  }

  for (const row of stockRows) {
    const availableQty = getAvailableQuantity(row.quantity, row.reservedQty);
    if (
      row.product.reorderLevel > 0 &&
      availableQty <= row.product.reorderLevel
    ) {
      totalLowStock++;
    }
    if (availableQty <= 0) {
      totalOutOfStock++;
    }
  }

  const totalOnHand = stockRows.reduce((sum, row) => sum + row.quantity, 0);

  const globalSummary: InventoryLandingSummary = {
    totalSkus,
    totalOnHand,
    totalLowStock,
    totalOutOfStock,
  };

  return {
    locationCards,
    globalSummary,
  };
}

export async function getInventoryPageData(
  filters: InventoryPageDataFilters
) {
  const productWhere = getInventoryProductWhere(filters);
  const dateRangeWhere = getDateRangeWhere(filters);

  const locationWhere =
    filters.locationId === "system-wide"
      ? { location: { isActive: true } }
      : { locationId: filters.locationId };

  const movementTypeWhere =
    filters.movementType === "all"
      ? {}
      : { type: filters.movementType as MovementType };

  const [stockRows, movements, categories, brands, products] =
    await Promise.all([
      prisma.locationStock.findMany({
        where: {
          ...locationWhere,
          product: productWhere,
        },
        select: inventoryStockSelect,
        orderBy: { product: { name: "asc" } },
      }),
      prisma.inventoryMovement.findMany({
        where: {
          ...locationWhere,
          ...movementTypeWhere,
          ...(dateRangeWhere ? { createdAt: dateRangeWhere } : {}),
        },
        select: {
          id: true,
          type: true,
          quantityChange: true,
          transferGroupId: true,
          notes: true,
          createdAt: true,
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
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.brand.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where: {
          status: {
            in: inventoryVisibleProductStatuses,
          },
        },
        select: { id: true, name: true, sku: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const processedStockRows =
    filters.locationId === "system-wide"
      ? aggregateSystemWideStockRows(stockRows)
      : stockRows.map(mapStockRow);

  const sortedStockRows = sortInventoryStockRows(
    processedStockRows,
    filters.sortBy,
    filters.sortOrder
  );

  const lowStockRows = sortedStockRows
    .filter((row) => {
      const { isLowStock } = getStockMetrics(
        row.quantity,
        row.reservedQty,
        row.product.reorderLevel
      );
      return isLowStock;
    })
    .sort((a, b) => {
      const aAvailable = getAvailableQuantity(a.quantity, a.reservedQty);
      const bAvailable = getAvailableQuantity(b.quantity, b.reservedQty);
      const aShortage = a.product.reorderLevel - aAvailable;
      const bShortage = b.product.reorderLevel - bAvailable;
      return bShortage - aShortage;
    });

  const summary: InventorySummary = {
    skuCount: sortedStockRows.filter((row) => row.availableQty > 0).length,
    lowStockCount: lowStockRows.length,
    outOfStockCount: sortedStockRows.filter(
      (row) => row.availableQty <= 0
    ).length,
    onHandUnits: sortedStockRows.reduce((sum, row) => sum + row.quantity, 0),
  };

  return {
    stockRows: sortedStockRows,
    lowStockRows,
    movements,
    options: {
      categories,
      brands,
      products,
    },
    summary,
  };
}
 