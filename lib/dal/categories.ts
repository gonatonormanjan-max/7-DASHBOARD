import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CategoryListFilters } from "@/lib/validators/categories";

function getCategoryOrderBy(filters: CategoryListFilters): Prisma.CategoryOrderByWithRelationInput {
  if (filters.sortBy === "productCount") {
    return {
      products: {
        _count: filters.sortOrder,
      },
    };
  }

  return {
    [filters.sortBy]: filters.sortOrder,
  } as Prisma.CategoryOrderByWithRelationInput;
}

export async function getCategoryListData(filters: CategoryListFilters) {
  const where: Prisma.CategoryWhereInput = filters.query
    ? {
        OR: [
          { name: { contains: filters.query, mode: "insensitive" } },
          { description: { contains: filters.query, mode: "insensitive" } },
        ],
      }
    : {};

  const [categories, totalCategories, inUseCategories, emptyCategories] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: getCategoryOrderBy(filters),
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    }),
    prisma.category.count(),
    prisma.category.count({
      where: {
        products: {
          some: {},
        },
      },
    }),
    prisma.category.count({
      where: {
        products: {
          none: {},
        },
      },
    }),
  ]);

  return {
    categories,
    summary: {
      total: totalCategories,
      inUse: inUseCategories,
      empty: emptyCategories,
      linkedProducts: categories.reduce(
        (sum, category) => sum + category._count.products,
        0
      ),
    },
  };
}

export async function listCategoryOptions() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          products: true,
        },
      },
      products: {
        orderBy: {
          updatedAt: "desc",
        },
        take: 6,
        select: {
          id: true,
          name: true,
          sku: true,
          status: true,
          updatedAt: true,
        },
      },
    },
  });
}
