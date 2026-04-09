import "server-only";

import { Prisma } from "@prisma/client";
import { getPaginationMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { BrandListFilters } from "@/lib/validators/brands";

export async function getBrandListData(filters: BrandListFilters) {
  const where: Prisma.BrandWhereInput = filters.query
    ? {
        OR: [
          { name: { contains: filters.query, mode: "insensitive" } },
          { description: { contains: filters.query, mode: "insensitive" } },
        ],
      }
    : {};

  const totalCount = await prisma.brand.count({ where });
  const pagination = getPaginationMeta(filters.page, filters.pageSize, totalCount);

  const [brands, totalBrands, inUseBrands, emptyBrands, linkedProducts] =
    await Promise.all([
      prisma.brand.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
      prisma.brand.count(),
      prisma.brand.count({
        where: {
          products: {
            some: {},
          },
        },
      }),
      prisma.brand.count({
        where: {
          products: {
            none: {},
          },
        },
      }),
      prisma.product.count({
        where: {
          brandId: {
            not: null,
          },
        },
      }),
    ]);

  return {
    brands,
    pagination,
    summary: {
      total: totalBrands,
      inUse: inUseBrands,
      empty: emptyBrands,
      linkedProducts,
    },
  };
}

export async function getBrandById(id: string) {
  return prisma.brand.findUnique({
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
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          sku: true,
          status: true,
        },
      },
    },
  });
}

export async function getBrandFormOptions() {
  return {};
}
