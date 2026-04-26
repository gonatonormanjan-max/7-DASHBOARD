"use server";

import { Prisma, ProductStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import { IMPORT_ROW_LIMIT } from "@/lib/validators/product-import";

export type ImportRow = {
  rowIndex: number;
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  costPrice: string;
  brand: string;
  status: string;
  reorderLevel: string;
  description: string;
};

export type ImportResult = {
  created: number;
  skipped: number;
  errors: Array<{ rowIndex: number; reason: string }>;
};

export async function checkBatchSkus(skus: string[]): Promise<string[]> {
  await requirePermission("products", "create");

  if (skus.length === 0) {
    return [];
  }

  const existing = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { sku: true },
  });

  return existing.map((product) => product.sku);
}

export async function importProducts(payload: {
  rows: ImportRow[];
  newCategoriesToCreate: string[];
}): Promise<ImportResult> {
  const user = await requirePermission("products", "create");
  const { rows, newCategoriesToCreate } = payload;

  if (rows.length > IMPORT_ROW_LIMIT) {
    return {
      created: 0,
      skipped: rows.length,
      errors: [{ rowIndex: 0, reason: `Import limited to ${IMPORT_ROW_LIMIT} rows per batch.` }],
    };
  }

  const validRows: ImportRow[] = [];

  const skuCount = new Map<string, number>();
  for (const row of rows) {
    const sku = row.sku.trim().toUpperCase();
    skuCount.set(sku, (skuCount.get(sku) ?? 0) + 1);
  }

  const batchDuplicateSkus = new Set(
    [...skuCount.entries()].filter(([, count]) => count > 1).map(([sku]) => sku)
  );

  const allSkus = rows.map((row) => row.sku.trim().toUpperCase());
  const existingInDb = await prisma.product.findMany({
    where: { sku: { in: allSkus } },
    select: { sku: true },
  });
  const existingSkuSet = new Set(existingInDb.map((product) => product.sku));

  const serverErrors: Array<{ rowIndex: number; reason: string }> = [];

  for (const row of rows) {
    const issues: string[] = [];
    const sku = row.sku.trim().toUpperCase();
    const name = row.name.trim();
    const category = row.category.trim();
    const unitPrice = Number(row.unitPrice);
    const costPrice = Number(row.costPrice);

    if (!name) {
      issues.push("Name is required.");
    } else if (name.length > 120) {
      issues.push("Name exceeds 120 characters.");
    }

    if (!sku) {
      issues.push("SKU is required.");
    }

    if (!category) {
      issues.push("Category is required.");
    }

    if (!row.unitPrice.trim() || !Number.isFinite(unitPrice) || unitPrice < 0) {
      issues.push("Invalid unit price.");
    }

    if (!row.costPrice.trim() || !Number.isFinite(costPrice) || costPrice < 0) {
      issues.push("Invalid cost price.");
    }

    const reorderRaw = row.reorderLevel.trim();
    if (reorderRaw && !/^\d+$/.test(reorderRaw)) {
      issues.push("Reorder level must be a whole number.");
    }

    const statusRaw = row.status.trim().toUpperCase();
    if (statusRaw && !["ACTIVE", "INACTIVE", "ARCHIVED"].includes(statusRaw)) {
      issues.push("Status must be ACTIVE, INACTIVE, or ARCHIVED.");
    }

    if (row.description.trim().length > 1500) {
      issues.push("Description exceeds 1500 characters.");
    }

    if (batchDuplicateSkus.has(sku)) {
      issues.push("Duplicate SKU within this import batch.");
    }

    if (existingSkuSet.has(sku)) {
      issues.push(`SKU "${sku}" already exists in the database.`);
    }

    if (issues.length > 0) {
      serverErrors.push({ rowIndex: row.rowIndex, reason: issues.join(" ") });
      continue;
    }

    validRows.push(row);
  }

  if (validRows.length === 0) {
    return {
      created: 0,
      skipped: rows.length,
      errors: serverErrors,
    };
  }

  const transactionErrors: Array<{ rowIndex: number; reason: string }> = [];
  let created = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const name of newCategoriesToCreate) {
        await tx.category.upsert({
          where: { name },
          create: { name },
          update: {},
        });
      }

      const allCategories = await tx.category.findMany({
        select: { id: true, name: true },
      });
      const categoryMap = new Map(allCategories.map((category) => [category.name.toLowerCase(), category.id]));

      const allBrands = await tx.brand.findMany({
        select: { id: true, name: true },
      });
      const brandMap = new Map(allBrands.map((brand) => [brand.name.toLowerCase(), brand.id]));

      const results = await Promise.allSettled(
        validRows.map(async (row) => {
          const sku = row.sku.trim().toUpperCase();
          const categoryId = categoryMap.get(row.category.trim().toLowerCase());

          if (!categoryId) {
            throw new Error(`Category "${row.category}" not found.`);
          }

          const brandRaw = row.brand.trim();
          const brandId = brandRaw ? (brandMap.get(brandRaw.toLowerCase()) ?? null) : null;

          const statusRaw = row.status.trim().toUpperCase();
          const status =
            statusRaw === "INACTIVE"
              ? ProductStatus.INACTIVE
              : statusRaw === "ARCHIVED"
                ? ProductStatus.ARCHIVED
                : ProductStatus.ACTIVE;

          const reorderLevel = row.reorderLevel.trim()
            ? parseInt(row.reorderLevel.trim(), 10)
            : 0;

          const product = await tx.product.create({
            data: {
              name: row.name.trim(),
              sku,
              categoryId,
              brandId,
              unitPrice: new Prisma.Decimal(Number(row.unitPrice).toFixed(2)),
              costPrice: new Prisma.Decimal(Number(row.costPrice).toFixed(2)),
              reorderLevel,
              status,
              description: row.description.trim() || null,
            },
            select: { id: true, name: true, sku: true },
          });

          return { row, product };
        })
      );

      for (let index = 0; index < results.length; index++) {
        const result = results[index];
        const row = validRows[index];

        if (result.status === "fulfilled") {
          created++;
          continue;
        }

        transactionErrors.push({
          rowIndex: row.rowIndex,
          reason: result.reason instanceof Error ? result.reason.message : "Database error.",
        });
      }

      if (created > 0) {
        await logAudit(
          {
            userId: user.id,
            action: "product.bulk_import",
            entity: "product",
            entityId: "bulk",
            details: {
              created,
              skipped: rows.length - created,
              newCategoriesCreated: newCategoriesToCreate.length,
            },
          },
          tx
        );
      }
    });
  } catch {
    return {
      created: 0,
      skipped: rows.length,
      errors: [
        ...serverErrors,
        {
          rowIndex: 0,
          reason: "A database error occurred during import. No products were created.",
        },
      ],
    };
  }

  revalidatePath("/dashboard/products");

  const allErrors = [...serverErrors, ...transactionErrors];

  return {
    created,
    skipped: allErrors.length,
    errors: allErrors,
  };
}
