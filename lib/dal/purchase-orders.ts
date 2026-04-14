import "server-only";

import { LocationType, Prisma, ProductStatus } from "@prisma/client";
import { businessDayStart, businessDayEnd } from "@/lib/timezone";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  getPaginationMeta,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { PurchaseOrderListFilters } from "@/lib/validators/purchase-orders";

function normalizeFilters(filters: Partial<PurchaseOrderListFilters>) {
  return {
    query: filters.query ?? "",
    status: filters.status ?? "all",
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    page: filters.page ?? DEFAULT_PAGE,
    pageSize: filters.pageSize ?? DEFAULT_PAGE_SIZE,
  } satisfies Partial<PurchaseOrderListFilters>;
}

function buildPurchaseOrderWhere(
  filters: Partial<PurchaseOrderListFilters>,
  options: { ignoreStatus?: boolean } = {}
): Prisma.PurchaseOrderWhereInput {
  const normalized = normalizeFilters(filters);
  const clauses: Prisma.PurchaseOrderWhereInput[] = [];

  if (!options.ignoreStatus && normalized.status !== "all") {
    clauses.push({ status: normalized.status });
  }

  if (normalized.dateFrom || normalized.dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};

    if (normalized.dateFrom) {
      createdAt.gte = businessDayStart(normalized.dateFrom);
    }

    if (normalized.dateTo) {
      createdAt.lt = businessDayEnd(normalized.dateTo);
    }

    clauses.push({ createdAt });
  }

  if (normalized.query.trim()) {
    clauses.push({
      OR: [
        {
          orderNumber: {
            contains: normalized.query.trim(),
            mode: "insensitive",
          },
        },
        {
          supplier: {
            name: {
              contains: normalized.query.trim(),
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  return clauses.length <= 1 ? (clauses[0] ?? {}) : { AND: clauses };
}

export async function getPurchaseOrderListData(filters: Partial<PurchaseOrderListFilters>) {
  const normalized = normalizeFilters(filters);
  const where = buildPurchaseOrderWhere(normalized);
  const summaryWhere = buildPurchaseOrderWhere(normalized, { ignoreStatus: true });
  const totalCount = await prisma.purchaseOrder.count({ where });
  const pagination = getPaginationMeta(
    normalized.page ?? DEFAULT_PAGE,
    normalized.pageSize ?? DEFAULT_PAGE_SIZE,
    totalCount
  );

  const [orders, groupedSummary] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        expectedDate: true,
        createdAt: true,
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
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
    prisma.purchaseOrder.groupBy({
      by: ["status"],
      where: summaryWhere,
      _count: {
        _all: true,
      },
    }),
  ]);

  return {
    orders: orders.map((o) => ({
      ...o,
      totalAmount: o.totalAmount.toString(),
    })),
    pagination,
    summary: {
      total: groupedSummary.reduce((sum, group) => sum + group._count._all, 0),
      draft: groupedSummary.find((group) => group.status === "DRAFT")?._count._all ?? 0,
      approved:
        groupedSummary.find((group) => group.status === "APPROVED")?._count._all ?? 0,
      partiallyReceived:
        groupedSummary.find((group) => group.status === "PARTIALLY_RECEIVED")?._count._all ??
        0,
      received:
        groupedSummary.find((group) => group.status === "RECEIVED")?._count._all ?? 0,
      cancelled:
        groupedSummary.find((group) => group.status === "CANCELLED")?._count._all ?? 0,
    },
  };
}

export async function getPurchaseOrderById(id: string) {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      expectedDate: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
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
          productId: true,
          quantity: true,
          receivedQty: true,
          unitCost: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
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
      unitCost: item.unitCost.toString(),
    })),
  };
}

export async function getPurchaseOrdersAwaitingReceipt(limit = 6) {
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      status: {
        in: ["APPROVED", "PARTIALLY_RECEIVED"],
      },
    },
    orderBy: [{ expectedDate: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      expectedDate: true,
      supplier: {
        select: {
          name: true,
        },
      },
      items: {
        select: {
          quantity: true,
          receivedQty: true,
        },
      },
    },
  });

  return orders.map((order) => {
    const remainingUnits = order.items.reduce(
      (sum, item) => sum + Math.max(item.quantity - item.receivedQty, 0),
      0
    );
    const remainingLines = order.items.filter((item) => item.receivedQty < item.quantity)
      .length;

    return {
      ...order,
      remainingLines,
      remainingUnits,
    };
  });
}

export async function getPurchaseOrderMovements(purchaseOrderId: string) {
  return prisma.inventoryMovement.findMany({
    where: {
      referenceType: "purchase_order",
      referenceId: purchaseOrderId,
    },
    include: {
      product: {
        select: { name: true, sku: true },
      },
      location: {
        select: { name: true, code: true },
      },
      performedBy: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPurchaseOrderFormOptions() {
  const [suppliers, warehouses, products, supplierProductLinks] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.stockLocation.findMany({
      where: { isActive: true, type: LocationType.WAREHOUSE },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),
    prisma.product.findMany({
      where: {
        status: {
          in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE],
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        costPrice: true,
      },
    }),
    prisma.productSupplier.findMany({
      select: {
        supplierId: true,
        productId: true,
        costPrice: true,
      },
    }),
  ]);

  return {
    suppliers,
    warehouses,
    products: products.map((p) => ({
      ...p,
      costPrice: p.costPrice.toString(),
    })),
    supplierProductLinks: supplierProductLinks.map((link) => ({
      ...link,
      costPrice: link.costPrice.toString(),
    })),
  };
}
