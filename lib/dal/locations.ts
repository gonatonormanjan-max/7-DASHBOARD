import "server-only";

import { Prisma } from "@prisma/client";
import { getPaginationMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { LocationListFilters } from "@/lib/validators/locations";

function getLocationOrderBy(
  filters: LocationListFilters
): Prisma.StockLocationOrderByWithRelationInput[] {
  if (filters.sortBy === "updatedAt") {
    return [{ updatedAt: filters.sortOrder }, { name: "asc" }];
  }

  return [
    {
      [filters.sortBy]: filters.sortOrder,
    } as Prisma.StockLocationOrderByWithRelationInput,
    { updatedAt: "desc" },
  ];
}

function getLocationWhere(
  filters: LocationListFilters,
  options: { locationId?: string | null } = {}
): Prisma.StockLocationWhereInput {
  return {
    ...(options.locationId ? { id: options.locationId } : {}),
    ...(filters.query
      ? {
          OR: [
            { name: { contains: filters.query, mode: "insensitive" } },
            { code: { contains: filters.query, mode: "insensitive" } },
            { address: { contains: filters.query, mode: "insensitive" } },
            { managerName: { contains: filters.query, mode: "insensitive" } },
            { contactNumber: { contains: filters.query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.type !== "all" ? { type: filters.type } : {}),
    ...(filters.isActive === "true"
      ? { isActive: true }
      : filters.isActive === "false"
        ? { isActive: false }
        : {}),
  };
}

export async function getLocationListData(
  filters: LocationListFilters,
  options: { locationId?: string | null } = {}
) {
  const where = getLocationWhere(filters, options);
  const summaryScope: Prisma.StockLocationWhereInput = options.locationId
    ? { id: options.locationId }
    : {};
  const totalCount = await prisma.stockLocation.count({ where });
  const pagination = getPaginationMeta(filters.page, filters.pageSize, totalCount);

  const [locations, total, warehouses, branches, active, inactive] = await Promise.all([
    prisma.stockLocation.findMany({
      where,
      orderBy: getLocationOrderBy(filters),
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        isActive: true,
        address: true,
        managerName: true,
        updatedAt: true,
      },
    }),
    prisma.stockLocation.count({
      where: summaryScope,
    }),
    prisma.stockLocation.count({
      where: {
        ...summaryScope,
        type: "WAREHOUSE",
      },
    }),
    prisma.stockLocation.count({
      where: {
        ...summaryScope,
        type: "BRANCH",
      },
    }),
    prisma.stockLocation.count({
      where: {
        ...summaryScope,
        isActive: true,
      },
    }),
    prisma.stockLocation.count({
      where: {
        ...summaryScope,
        isActive: false,
      },
    }),
  ]);

  const stockCounts =
    locations.length > 0
      ? await prisma.locationStock.groupBy({
          by: ["locationId"],
          where: {
            locationId: {
              in: locations.map((location) => location.id),
            },
            quantity: {
              gt: 0,
            },
          },
          _count: {
            _all: true,
          },
        })
      : [];

  const stockCountsByLocationId = new Map(
    stockCounts.map((row) => [row.locationId, row._count._all])
  );

  return {
    locations: locations.map((location) => ({
      ...location,
      _count: {
        stock: stockCountsByLocationId.get(location.id) ?? 0,
      },
    })),
    pagination,
    summary: {
      total,
      warehouses,
      branches,
      active,
      inactive,
    },
  };
}

export async function getLocationById(id: string) {
  const [location, stockSummary] = await Promise.all([
    prisma.stockLocation.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        address: true,
        managerName: true,
        contactNumber: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        stock: {
          orderBy: {
            product: {
              name: "asc",
            },
          },
          take: 20,
          select: {
            id: true,
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
        },
        movements: {
          orderBy: {
            createdAt: "desc",
          },
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
            performedBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
    prisma.locationStock.aggregate({
      where: {
        locationId: id,
      },
      _sum: {
        quantity: true,
        reservedQty: true,
      },
    }),
  ]);

  if (!location) {
    return null;
  }

  const skuCount = await prisma.locationStock.count({
    where: {
      locationId: id,
      quantity: {
        gt: 0,
      },
    },
  });

  return {
    ...location,
    stockSummary: {
      skuCount,
      totalOnHand: stockSummary._sum.quantity ?? 0,
      totalReserved: stockSummary._sum.reservedQty ?? 0,
    },
  };
}
