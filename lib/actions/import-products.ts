"use server";

import { Prisma, ProductStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import { IMPORT_ROW_LIMIT } from "@/lib/validators/product-import";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

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

// ----------------------------------------------------------------
// checkBatchSkus — called client-side after parse to pre-flag
// SKUs that already exist in the DB. Re-checked server-side
// inside importProducts before committing.
// ----------------------------------------------------------------

export async function checkBatchSkus(skus: string[]): Promise<string[]> {
  await requirePermission("products", "create");

  if (skus.length === 0) return [];

  const existing = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { sku: true },
  });

  return existing.map((p) => p.sku);
}

// ----------------------------------------------------------------
// importProducts — final server-side transaction
// ----------------------------------------------------------------

export async function importProducts(payload: {
  rows: ImportRow[];
  newCategoriesToCreate: string[];
}): Promise<ImportResult> {
  const user = await requirePermission("products", "create");

  const { rows, newCategoriesToCreate } = payload;

  // Hard cap — reject if somehow bypassed client-side limit
  if (rows.length > IMPORT_ROW_LIMIT) {
    return {
      created: 0,
      skipped: rows.length,
      errors: [{ rowIndex: 0, reason: `Import limited to ${IMPORT_ROW_LIMIT} rows per batch.` }],
    };
  }

  // ---- Server-side re-validation ----
  const validationErrors: Array<{ rowIndex: number; reason: string }> = [];
  const validRows: ImportRow[] = [];

  // Collect all SKUs to check for intra-batch duplicates
  const skusSeen = new Map<string, number>(); // sku → first rowIndex
  for (const row of rows) {
    const sku = row.sku.trim().toUpperCase();
    if (skusSeen.has(sku)) {
      validationErrors.push({
        rowIndex: row.rowIndex,
        reason: `Duplicate SKU "${sku}" within this batch (also on row ${skusSeen.get(sku)}).`,
      });
    } else {
      skusSeen.set(sku, row.rowIndex);
    }
  }

  const duplicateBatchSkus = new Set(
    validationErrors.map((e) => {
      // extract sku from reason string — simpler: just re-collect
      return "";
    })
  );
  // Cleaner: collect duplicate SKUs directly
  const skuCount = new Map<string, number>();
  for (const row of rows) {
    const sku = row.sku.trim().toUpperCase();
    skuCount.set(sku, (skuCount.get(sku) ?? 0) + 1);
  }
  const batchDuplicateSkus = new Set(
    [...skuCount.entries()].filter(([, count]) => count > 1).map(([sku]) => sku)
  );

  // Re-check all SKUs against DB (race condition guard)
  const allSkus = rows.map((r) => r.sku.trim().toUpperCase());
  const existingInDb = await prisma.product.findMany({
    where: { sku: { in: allSkus } },
    select: { sku: true },
  });
  const existingSkuSet = new Set(existingInDb.map((p) => p.sku));

  // Per-row server validation
  const serverErrors: Array<{ rowIndex: number; reason: string }> = [];

  for (const row of rows) {
    const issues: string[] = [];
    const sku = row.sku.trim().toUpperCase();
    const name = row.name.trim();
    const category = row.category.trim();
    const unitPrice = Number(row.unitPrice);
    const costPrice = Number(row.costPrice);

    if (!name) issues.push("Name is required.");
    else if (name.length > 120) issues.push("Name exceeds 120 characters.");

    if (!sku) issues.push("SKU is required.");

    if (!category) issues.push("Category is required.");

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
    } else {
      validRows.push(row);
    }
  }

  if (validRows.length === 0) {
    return {
      created: 0,
      skipped: rows.length,
      errors: serverErrors,
    };
  }

  // ---- Transaction ----
  const transactionErrors: Array<{ rowIndex: number; reason: string }> = [];
  let created = 0;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Create new categories that the user explicitly approved
      for (const name of newCategoriesToCreate) {
        await tx.category.upsert({
          where: { name },
          create: { name },
          update: {},
        });
      }

      // 2. Fetch full category map (existing + newly created)
      const allCategories = await tx.category.findMany({
        select: { id: true, name: true },
      });
      const catMap = new Map(allCategories.map((c) => [c.name.toLowerCase(), c.id]));

      // 3. Fetch full brand map
      const allBrands = await tx.brand.findMany({
        select: { id: true, name: true },
      });
      const brandMap = new Map(allBrands.map((b) => [b.name.toLowerCase(), b.id]));

      // 4. Create products
      const results = await Promise.allSettled(
        validRows.map(async (row) => {
          const sku = row.sku.trim().toUpperCase();
          const categoryId = catMap.get(row.category.trim().toLowerCase());

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

      // Tally results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const row = validRows[i];

        if (result.status === "fulfilled") {
          created++;
        } else {
          transactionErrors.push({
            rowIndex: row.rowIndex,
            reason: result.reason instanceof Error ? result.reason.message : "Database error.",
          });
        }
      }

      // 5. Audit log for the bulk import
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
