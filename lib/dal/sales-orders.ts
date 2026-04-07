import "server-only";

import { Prisma, ProductStatus } from "@prisma/client";
import { getAvailableQuantity } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

type SalesOrderListFilters = {
  query?: string;
  window?: "all" | "today" | "7d" | "30d";
  archived?: boolean;
};

function buildSalesOrderWhere(filters: SalesOrderListFilters): Prisma.SalesOrderWhereInput {
  const clauses: Prisma.SalesOrderWhereInput[] = [];
  const query = filters.query?.trim();

  // Filter by archived status
  if (filters.archived) {
    clauses.push({ archivedAt: { not: null } });
  } else {
    clauses.push({ archivedAt: null });
  }

  if (filters.window && filters.window !== "all") {
    const since = new Date();

    if (filters.window === "today") {
      since.setHours(0, 0, 0, 0);
    } else {
      const days = filters.window === "7d" ? 7 : 30;
      since.setDate(since.getDate() - days);
    }

    clauses.push({
      createdAt: {
        gte: since,
      },
    });
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
        {
          customerEmail: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          items: {
            some: {
              product: {
                OR: [
                  {
                    name: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                  {
                    sku: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function getSalesOrderListData(filters: SalesOrderListFilters = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const where = buildSalesOrderWhere(filters);

  const [orders, totalOrders, todayOrders, aggregate, filteredCount] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 50,
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
      },
    }),
    prisma.salesOrder.count({ where: { archivedAt: null } }),
    prisma.salesOrder.count({
      where: {
        archivedAt: null,
        createdAt: {
          gte: today,
        },
      },
    }),
    prisma.salesOrder.aggregate({
      where: { archivedAt: null },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return {
    orders,
    summary: {
      total: totalOrders,
      today: todayOrders,
      revenue: aggregate._sum.totalAmount ?? new Prisma.Decimal(0),
      recent: orders.length,
    },
    filteredCount,
  };
}

export async function getSalesOrderCreateData() {
  const [products, locations, stockRows] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        sku: true,
        unitPrice: true,
      },
    }),
    prisma.stockLocation.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),
    prisma.locationStock.findMany({
      where: {
        location: {
          isActive: true,
        },
        product: {
          status: ProductStatus.ACTIVE,
        },
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
    products: products.map((p) => ({
      ...p,
      unitPrice: p.unitPrice.toString(),
    })),
    locations,
    stockRows: stockRows.map((row) => ({
      ...row,
      availableQty: getAvailableQuantity(row.quantity, row.reservedQty),
    })),
  };
}

export async function getSalesOrderById(id: string) {
  return prisma.salesOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      status: true,
      totalAmount: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
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
              code: true,
            },
          },
        },
      },
    },
  });
}
