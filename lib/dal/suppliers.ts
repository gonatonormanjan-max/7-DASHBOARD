import "server-only";

import { Prisma } from "@prisma/client";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  getPaginationMeta,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { SupplierListFilters } from "@/lib/validators/suppliers";

function buildSupplierWhere(
  filters: Partial<SupplierListFilters>
): Prisma.SupplierWhereInput {
  const query = filters.query ?? "";
  const status = filters.status ?? "all";
  const clauses: Prisma.SupplierWhereInput[] = [];

  if (status !== "all") {
    clauses.push({ isActive: status === "active" });
  }

  if (query.trim()) {
    clauses.push({
      OR: [
        { name: { contains: query.trim(), mode: "insensitive" } },
        { contactName: { contains: query.trim(), mode: "insensitive" } },
        { email: { contains: query.trim(), mode: "insensitive" } },
      ],
    });
  }

  return clauses.length <= 1 ? (clauses[0] ?? {}) : { AND: clauses };
}

export async function getSupplierListData(
  filters: Partial<SupplierListFilters>
) {
  const page = filters.page ?? DEFAULT_PAGE;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = buildSupplierWhere(filters);
  const summaryWhere = buildSupplierWhere({ ...filters, status: "all" });

  const totalCount = await prisma.supplier.count({ where });
  const pagination = getPaginationMeta(page, pageSize, totalCount);

  const [suppliers, groupedSummary] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: {
        id: true,
        name: true,
        contactName: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            purchaseOrders: true,
            productLinks: true,
          },
        },
      },
    }),
    prisma.supplier.groupBy({
      by: ["isActive"],
      where: summaryWhere,
      _count: { _all: true },
    }),
  ]);

  return {
    suppliers,
    pagination,
    summary: {
      total: groupedSummary.reduce((sum, g) => sum + g._count._all, 0),
      active: groupedSummary.find((g) => g.isActive)?._count._all ?? 0,
      inactive: groupedSummary.find((g) => !g.isActive)?._count._all ?? 0,
    },
  };
}

export async function getSupplierById(id: string) {
  return prisma.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      contactName: true,
      email: true,
      phone: true,
      address: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          purchaseOrders: true,
          productLinks: true,
        },
      },
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function getSupplierByIdForEdit(id: string) {
  return prisma.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      contactName: true,
      email: true,
      phone: true,
      address: true,
      isActive: true,
    },
  });
}

export async function checkSupplierNameConflict(
  name: string,
  excludeId?: string
) {
  return prisma.supplier.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
}
