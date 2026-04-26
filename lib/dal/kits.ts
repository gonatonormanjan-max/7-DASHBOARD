import "server-only";

import { LocationType, ProductStatus } from "@prisma/client";
import type { CurrentUser } from "@/lib/dal/auth";
import { getBranchScope } from "@/lib/dal/scope";
import { prisma } from "@/lib/prisma";

export async function getKitComponents(kitProductId: string) {
  const rows = await prisma.productKitComponent.findMany({
    where: { kitProductId },
    orderBy: [{ componentProduct: { name: "asc" } }],
    select: {
      id: true,
      componentQty: true,
      componentProduct: {
        select: {
          id: true,
          name: true,
          sku: true,
          unitPrice: true,
          costPrice: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    ...row,
    componentProduct: {
      ...row.componentProduct,
      unitPrice: row.componentProduct.unitPrice.toString(),
      costPrice: row.componentProduct.costPrice.toString(),
    },
  }));
}

export async function getProductsUsedAsComponents() {
  const rows = await prisma.productKitComponent.findMany({
    distinct: ["componentProductId"],
    select: {
      componentProductId: true,
    },
  });

  return rows.map((row) => row.componentProductId);
}

export async function isProductAKit(productId: string) {
  const count = await prisma.productKitComponent.count({
    where: { kitProductId: productId },
  });

  return count > 0;
}

export async function getDismantleHistory(locationId?: string, kitProductId?: string) {
  return prisma.dismantleRecord.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
      ...(kitProductId ? { kitProductId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      qty: true,
      notes: true,
      createdAt: true,
      location: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      kitProduct: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
      dismantledBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

export async function getKitComponentCandidateProducts(kitProductId: string) {
  return prisma.product.findMany({
    where: {
      id: { not: kitProductId },
      status: {
        in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE],
      },
      kitComponents: {
        none: {},
      },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
    },
  });
}

export async function getKitDismantlePageData(user: CurrentUser) {
  const branchScope = getBranchScope(user);

  const [branches, kits] = await Promise.all([
    prisma.stockLocation.findMany({
      where: {
        isActive: true,
        type: LocationType.BRANCH,
        ...(branchScope ? { id: branchScope } : {}),
      },
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
        kitComponents: {
          some: {},
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        kitComponents: {
          orderBy: [{ componentProduct: { name: "asc" } }],
          select: {
            id: true,
            componentQty: true,
            componentProduct: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    branchScope,
    branches,
    kits,
  };
}
