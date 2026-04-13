import "server-only";

import {
  LocationType,
  PaymentMode,
  Prisma,
  ProductStatus,
  SalesOrderStatus,
  SalesOrderVoidReason,
} from "@prisma/client";
import { businessDayStart, businessDayEnd, businessStartOfToday } from "@/lib/timezone";
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
type SalesOrderScopeOptions = {
  locationId?: string | null;
};

type SalesOrderDetailData = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  status: SalesOrderStatus;
  totalAmount: string;
  paymentMode: PaymentMode | null;
  cashAmount: string | null;
  onlineAmount: string | null;
  voidReason: SalesOrderVoidReason | null;
  voidRemarks: string | null;
  voidDocumentation: string | null;
  voidedAt: Date | null;
  notes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  voidedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: string;
    product: {
      id: string;
      name: string;
      sku: string;
    };
    location: {
      id: string;
      name: string;
      type: LocationType;
    };
  }>;
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
      // Use business-timezone midnight so "from April 13" means April 13 00:00
      // Asia/Manila, not UTC midnight (which would be 08:00 Manila time).
      createdAt.gte = businessDayStart(filters.dateFrom);
    }

    if (filters.dateTo) {
      // Exclusive upper bound = start of the next business day in Manila time.
      createdAt.lt = businessDayEnd(filters.dateTo);
    }

    return createdAt;
  }

  if (!filters.window || filters.window === "all") {
    return undefined;
  }

  if (filters.window === "today") {
    // "Today" = midnight of the current business day in Asia/Manila.
    return { gte: businessStartOfToday() } satisfies Prisma.DateTimeFilter;
  }

  const since = new Date();
  since.setDate(since.getDate() - (filters.window === "7d" ? 7 : 30));
  return { gte: since } satisfies Prisma.DateTimeFilter;
}

function buildSalesOrderWhere(
  filters: SalesOrderDataFilters,
  options: {
    ignoreStatus?: boolean;
    locationId?: string | null;
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

  if (options.locationId) {
    clauses.push({
      items: {
        some: { locationId: options.locationId },
        none: {
          locationId: {
            not: options.locationId,
          },
        },
      },
    });
  }

  return clauses.length === 1 ? clauses[0] : { AND: clauses };
}

export async function getSalesOrderListData(
  filters: SalesOrderDataFilters,
  options: SalesOrderScopeOptions = {}
) {
  const normalizedFilters = normalizeFilters(filters);
  const where = buildSalesOrderWhere(normalizedFilters, {
    locationId: options.locationId,
  });
  const summaryWhere = buildSalesOrderWhere(normalizedFilters, {
    ignoreStatus: true,
    locationId: options.locationId,
  });
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

export async function getSalesOrderById(
  id: string,
  options: SalesOrderScopeOptions = {}
): Promise<SalesOrderDetailData | null> {
  const order = await prisma.salesOrder.findFirst({
    where: {
      id,
      ...(options.locationId
        ? {
            items: {
              some: { locationId: options.locationId },
              none: {
                locationId: {
                  not: options.locationId,
                },
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      status: true,
      totalAmount: true,
      paymentMode: true,
      cashAmount: true,
      onlineAmount: true,
      voidReason: true,
      voidRemarks: true,
      voidDocumentation: true,
      voidedAt: true,
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
      voidedBy: {
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
    cashAmount: order.cashAmount?.toString() ?? null,
    onlineAmount: order.onlineAmount?.toString() ?? null,
    items: order.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
    })),
  };
}

export async function getSalesOrderFormOptions(options: SalesOrderScopeOptions = {}) {
  const [locations, products, stockRows] = await Promise.all([
    prisma.stockLocation.findMany({
      where: {
        isActive: true,
        type: LocationType.BRANCH,
        ...(options.locationId ? { id: options.locationId } : {}),
      },
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
    prisma.locationStock.findMany({
      where: {
        location: {
          isActive: true,
          type: LocationType.BRANCH,
          ...(options.locationId ? { id: options.locationId } : {}),
        },
        product: { status: ProductStatus.ACTIVE },
      },
      select: {
        locationId: true,
        productId: true,
        quantity: true,
        reservedQty: true,
      },
    }),
  ]);

  return {
    locations,
    products: products.map((p) => ({
      ...p,
      unitPrice: p.unitPrice.toString(),
    })),
    stockRows: stockRows.map((row) => ({
      locationId: row.locationId,
      productId: row.productId,
      availableQty: getAvailableQuantity(row.quantity, row.reservedQty),
    })),
  };
}
