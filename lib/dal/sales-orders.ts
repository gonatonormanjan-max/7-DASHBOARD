import "server-only";

import { LocationType, Prisma, ProductStatus } from "@prisma/client";
import { getAvailableQuantity } from "@/lib/inventory";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  getPaginationMeta,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { SalesOrderListFilters } from "@/lib/validators/sales-orders";

type LegacyWindowFilter = "all" | "today" | "7d" | "30d";

type SalesOrderDataFilters = Partial<SalesOrderListFilters> & {
  archived?: boolean;
  window?: LegacyWindowFilter;
};

function normalizeFilters(filters: SalesOrderDataFilters) {
  return {
    query: filters.query ?? "",
    status: filters.status ?? "all",
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    page: filters.page ?? DEFAULT_PAGE,
    pageSize: filters.pageSize ?? DEFAULT_PAGE_SIZE,
    archived: filters.archived ?? false,
    window: filters.window ?? "all",
  } satisfies SalesOrderDataFilters;
}

function getCreatedAtFilter(filters: SalesOrderDataFilters) {
  if (filters.dateFrom || filters.dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};

    if (filters.dateFrom) {
      createdAt.gte = new Date(`${filters.dateFrom}T00:00:00`);
    }

    if (filters.dateTo) {
      const endOfDay = new Date(`${filters.dateTo}T00:00:00`);
      endOfDay.setDate(endOfDay.getDate() + 1);
      createdAt.lt = endOfDay;
    }

    return createdAt;
  }

  if (!filters.window || filters.window === "all") {
    return undefined;
  }

  const since = new Date();

  if (filters.window === "today") {
    since.setHours(0, 0, 0, 0);
  } else {
    since.setDate(since.getDate() - (filters.window === "7d" ? 7 : 30));
  }

  return { gte: since } satisfies Prisma.DateTimeFilter;
}

function buildSalesOrderWhere(
  filters: SalesOrderDataFilters,
  options: {
    ignoreStatus?: boolean;
  } = {}
): Prisma.SalesOrderWhereInput {
  const normalizedFilters = normalizeFilters(filters);
  const clauses: Prisma.SalesOrderWhereInput[] = [];
  const query = normalizedFilters.query.trim();
  const createdAt = getCreatedAtFilter(normalizedFilters);

  clauses.push(
    normalizedFilters.archived ? { archivedAt: { not: null } } : { archivedAt: null }
  );

  if (!options.ignoreStatus && normalizedFilters.status !== "all") {
    clauses.push({ status: normalizedFilters.status });
  }

  if (createdAt) {
    clauses.push({ createdAt });
  }

  if (query) {
    clauses.push({
      OR: [
        {
          orderNumber: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          customerName: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  return clauses.length === 1 ? clauses[0] : { AND: clauses };
}

export async function getSalesOrderListData(filters: SalesOrderDataFilters) {
  const normalizedFilters = normalizeFilters(filters);
  const where = buildSalesOrderWhere(normalizedFilters);
  const summaryWhere = buildSalesOrderWhere(normalizedFilters, { ignoreStatus: true });
  const totalCount = await prisma.salesOrder.count({ where });
  const pagination = getPaginationMeta(
    normalizedFilters.page ?? DEFAULT_PAGE,
    normalizedFilters.pageSize ?? DEFAULT_PAGE_SIZE,
    totalCount
  );

  const [orders, groupedSummary, aggregate] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
        items: {
          take: 1,
          orderBy: [{ createdAt: "asc" }],
          select: {
            location: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.salesOrder.groupBy({
      by: ["status"],
      where: summaryWhere,
      _count: {
        _all: true,
      },
    }),
    prisma.salesOrder.aggregate({
      where: summaryWhere,
      _sum: {
        totalAmount: true,
      },
    }),
  ]);

  return {
    orders: orders.map((o) => ({
      ...o,
      totalAmount: o.totalAmount.toString(),
    })),
    pagination,
    filteredCount: totalCount,
    summary: {
      total: groupedSummary.reduce((sum, group) => sum + group._count._all, 0),
      draft: groupedSummary.find((group) => group.status === "DRAFT")?._count._all ?? 0,
      confirmed:
        groupedSummary.find((group) => group.status === "CONFIRMED")?._count._all ?? 0,
      delivered:
        groupedSummary.find((group) => group.status === "DELIVERED")?._count._all ?? 0,
      completed:
        groupedSummary.find((group) => group.status === "COMPLETED")?._count._all ?? 0,
      cancelled:
        groupedSummary.find((group) => group.status === "CANCELLED")?._count._all ?? 0,
      revenue: (aggregate._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
    },
  };
}

export async function getSalesOrderById(id: string) {
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      status: true,
      totalAmount: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      items: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
    },
  });

  if (!order) return null;

  return {
    ...order,
    totalAmount: order.totalAmount.toString(),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
    })),
  };
}

export async function getSalesOrderFormOptions() {
  const [locations, products] = await Promise.all([
    prisma.stockLocation.findMany({
      where: { isActive: true, type: LocationType.BRANCH },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),
    prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        unitPrice: true,
      },
    }),
  ]);

  return {
    locations,
    products: products.map((p) => ({
      ...p,
      unitPrice: p.unitPrice.toString(),
    })),
  };
}
