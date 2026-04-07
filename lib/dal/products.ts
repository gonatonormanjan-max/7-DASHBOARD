import "server-only";

import { Prisma, ProductStatus } from "@prisma/client";
import { getPaginationMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { ProductListFilters } from "@/lib/validators/products";

function getStatusWhere(status: ProductListFilters["status"]): Prisma.ProductWhereInput {
  switch (status) {
    case "ACTIVE":
      return { status: ProductStatus.ACTIVE };
    case "INACTIVE":
      return { status: ProductStatus.INACTIVE };
    case "ARCHIVED":
      return { status: ProductStatus.ARCHIVED };
    case "all":
      return {};
    case "visible":
    default:
      return {
        status: {
          in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE],
        },
      };
  }
}

function getProductOrderBy(filters: ProductListFilters): Prisma.ProductOrderByWithRelationInput {
  if (filters.sortBy === "status") {
    return { status: filters.sortOrder };
  }

  return {
    [filters.sortBy]: filters.sortOrder,
  } as Prisma.ProductOrderByWithRelationInput;
}

export async function getProductListData(filters: ProductListFilters) {
  const where: Prisma.ProductWhereInput = {
    ...getStatusWhere(filters.status),
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

  const [totalCount, categories, suppliers, summary] = await Promise.all([
    prisma.product.count({ where }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.product.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);
  const pagination = getPaginationMeta(filters.page, filters.pageSize, totalCount);

  const products = await prisma.product.findMany({
    where,
    orderBy: getProductOrderBy(filters),
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
    select: {
      id: true,
      name: true,
      sku: true,
      unitPrice: true,
      costPrice: true,
      locationStock: {
        select: {
          quantity: true,
        },
      },
      status: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    products,
    categories,
    suppliers,
    pagination,
    summary: {
      totalVisible: summary
        .filter((item) => item.status !== ProductStatus.ARCHIVED)
        .reduce((sum, item) => sum + item._count._all, 0),
      active:
        summary.find((item) => item.status === ProductStatus.ACTIVE)?._count._all ?? 0,
      inactive:
        summary.find((item) => item.status === ProductStatus.INACTIVE)?._count._all ?? 0,
      archived:
        summary.find((item) => item.status === ProductStatus.ARCHIVED)?._count._all ?? 0,
    },
  };
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      sku: true,
      description: true,
      unitPrice: true,
      costPrice: true,
      reorderLevel: true,
      imageUrl: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      categoryId: true,
      supplierId: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });
}

export async function getProductFormOptions() {
  const [categories, suppliers] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return {
    categories,
    suppliers,
  };
}
