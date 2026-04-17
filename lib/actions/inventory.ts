"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LocationType, Prisma, ProductStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import {
  applyInboundMovingAverage,
  getSaleCostSnapshot,
  recordOutboundCostHistory,
  syncLocationCostSnapshot,
} from "@/lib/costing";
import { requirePermission } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import { getAvailableQuantity } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import {
  buildInventoryFieldErrors,
  extractBulkStockSetupValues,
  extractInitialStockValues,
  extractInventoryAdjustmentValues,
  extractInventoryTransferValues,
  extractSupplierReceiptValues,
  initialBulkStockSetupState,
  initialInitialStockState,
  initialInventoryAdjustmentState,
  initialSupplierReceiptState,
  bulkStockSetupSchema,
  initialStockSchema,
  inventoryAdjustmentSchema,
  inventoryTransferSchema,
  supplierReceiptSchema,
  type BulkStockSetupReason,
  type BulkStockSetupState,
  type InitialStockState,
  type InventoryAdjustmentReason,
  type InventoryAdjustmentState,
  type SupplierReceiptState,
  type InventoryTransferState,
} from "@/lib/validators/inventory";

const adjustmentReasonLabels: Record<InventoryAdjustmentReason, string> = {
  count_correction: "Count Correction",
  damage_loss: "Damage / Loss",
  expired: "Expired",
  other: "Other",
};

const bulkStockSetupReasonLabels: Record<BulkStockSetupReason, string> = {
  new_branch_setup: "New Branch Setup",
  warehouse_migration: "Warehouse Migration",
  system_import: "System Import",
  other: "Other",
};

function normalizeInventoryPath(path: string) {
  return path.split("?")[0];
}

function hasUnsafePathSegments(path: string) {
  const pathname = path.split("?")[0].split("#")[0];
  const candidates = [pathname];

  try {
    candidates.push(decodeURIComponent(pathname));
  } catch {
    // Ignore malformed encoded paths and keep raw validation.
  }

  return candidates.some((candidate) =>
    candidate.split("/").some((segment) => segment === "..")
  );
}

function resolveInventoryReturnTo(formData: FormData, fallback: string) {
  const returnTo = String(formData.get("returnTo") ?? "").trim();

  if (returnTo.startsWith("/dashboard/inventory") && !hasUnsafePathSegments(returnTo)) {
    return returnTo;
  }

  return fallback;
}

function parseWholeNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function revalidateInventoryPaths(paths: string[] = []) {
  const allPaths = new Set<string>([
    "/dashboard/inventory",
    "/dashboard/inventory/system-wide",
    "/dashboard/inventory/receive",
    "/dashboard/inventory/initial-stock",
    "/dashboard/inventory/stock-setup",
  ]);

  for (const path of paths) {
    if (!path.startsWith("/dashboard/inventory")) {
      continue;
    }

    allPaths.add(normalizeInventoryPath(path));
  }

  for (const path of allPaths) {
    revalidatePath(path);
  }
}

function buildMovementNotes(reason: string, notes: string | null) {
  return notes ? `Reason: ${reason}\nNotes: ${notes}` : `Reason: ${reason}`;
}

function buildTransferNotes(details: {
  fromLocationName: string;
  toLocationName: string;
  notes: string | null;
}) {
  const prefix = `Transfer from ${details.fromLocationName} to ${details.toLocationName}`;

  return details.notes ? `${prefix}\nNotes: ${details.notes}` : prefix;
}

class InitialStockAlreadyExistsError extends Error {
  quantity: number;

  constructor(quantity: number) {
    super("Initial stock already exists for this location and product.");
    this.quantity = quantity;
  }
}

type LockedLocationStock = {
  id: string;
  quantity: number;
  reservedQty: number;
};

async function lockLocationStock(
  tx: Prisma.TransactionClient,
  locationId: string,
  productId: string
): Promise<LockedLocationStock | null> {
  const rows = await tx.$queryRaw<LockedLocationStock[]>(Prisma.sql`
    SELECT "id", "quantity", "reservedQty"
    FROM "LocationStock"
    WHERE "locationId" = ${locationId}
      AND "productId" = ${productId}
    FOR UPDATE
  `);

  return rows[0] ?? null;
}

async function withInventoryTransactionRetry<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isSerializationRetry =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      const isUniqueConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

      if ((!isSerializationRetry && !isUniqueConflict) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error("Could not complete the inventory write after multiple retries.");
}

export async function adjustInventoryAction(
  _prevState: InventoryAdjustmentState,
  formData: FormData
): Promise<InventoryAdjustmentState> {
  const user = await requirePermission("inventory", "update");
  const returnTo = resolveInventoryReturnTo(formData, "/dashboard/inventory");
  const values = extractInventoryAdjustmentValues(formData);
  const parsed = inventoryAdjustmentSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ...initialInventoryAdjustmentState,
      status: "error",
      message: "Please fix the adjustment details.",
      fieldErrors: buildInventoryFieldErrors(parsed.error),
      values,
    };
  }

  const [product, location] = await Promise.all([
    prisma.product.findFirst({
      where: {
        id: parsed.data.productId,
        status: {
          in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE],
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    }),
    prisma.stockLocation.findFirst({
      where: {
        id: parsed.data.locationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  if (!product || !location) {
    return {
      status: "error",
      message: "The selected product or location is no longer available.",
      values,
    };
  }

  const movementType =
    parsed.data.reason === "damage_loss" || parsed.data.reason === "expired"
      ? "DAMAGED_LOST"
      : "MANUAL_ADJUSTMENT";

  if (movementType === "DAMAGED_LOST" && parsed.data.direction === "increase") {
    return {
      status: "error",
      message: "Damage and expiry adjustments are always negative.",
      fieldErrors: {
        direction: ["Damage and expiry adjustments are always negative."],
      },
      values,
    };
  }

  const quantityChange =
    parsed.data.direction === "increase" ? parsed.data.quantity : -parsed.data.quantity;
  const adjustmentResult = await withInventoryTransactionRetry(async (tx) => {
    const currentStock = await lockLocationStock(tx, location.id, product.id);
    const currentQuantity = currentStock?.quantity ?? 0;
    const currentReservedQty = currentStock?.reservedQty ?? 0;
    const availableQty = currentStock
      ? getAvailableQuantity(currentQuantity, currentReservedQty)
      : 0;

    if (parsed.data.direction === "decrease" && availableQty < parsed.data.quantity) {
      return {
        status: "error" as const,
        message:
          availableQty > 0
            ? `Only ${availableQty} units are currently available to reduce in ${location.name}.`
            : `No available stock can be reduced from ${location.name}.`,
        values,
      };
    }

    const nextQuantity = currentQuantity + quantityChange;

    if (nextQuantity < 0) {
      return {
        status: "error" as const,
        message: `Adjustment would result in negative stock (${currentQuantity} + ${quantityChange} = ${nextQuantity}). Verify the count.`,
        values,
      };
    }

    if (currentStock) {
      await tx.locationStock.update({
        where: { id: currentStock.id },
        data: {
          quantity: nextQuantity,
        },
      });
    } else {
      await tx.locationStock.create({
        data: {
          productId: product.id,
          locationId: location.id,
          quantity: nextQuantity,
        },
      });
    }

    await syncLocationCostSnapshot(tx, {
      locationId: location.id,
      productId: product.id,
      onHandQtySnapshot: nextQuantity,
    });

    await tx.inventoryMovement.create({
      data: {
        type: movementType,
        productId: product.id,
        locationId: location.id,
        quantityChange,
        referenceType: "inventory.adjustment",
        notes: buildMovementNotes(
          adjustmentReasonLabels[parsed.data.reason],
          parsed.data.notes
        ),
        performedById: user.id,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: "inventory.adjust",
        entity: "location_stock",
        entityId: currentStock?.id ?? `${location.id}:${product.id}`,
        details: {
          direction: parsed.data.direction,
          quantity: parsed.data.quantity,
          reason: parsed.data.reason,
          movementType,
          notes: parsed.data.notes,
          locationId: location.id,
          locationName: location.name,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          previousQuantity: currentQuantity,
          nextQuantity,
        },
      },
      tx
    );

    return null;
  });

  if (adjustmentResult) {
    return adjustmentResult;
  }

  revalidateInventoryPaths([
    returnTo,
    `/dashboard/inventory/${location.id}`,
  ]);
  redirect(
    withFlashMessage(returnTo, {
      success: "Inventory adjustment recorded.",
    })
  );
}

export async function supplierReceiptAction(
  _prevState: SupplierReceiptState,
  formData: FormData
): Promise<SupplierReceiptState> {
  const user = await requirePermission("inventory", "update");
  const values = extractSupplierReceiptValues(formData);
  const parsed = supplierReceiptSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ...initialSupplierReceiptState,
      status: "error",
      message: "Please fix the supplier receipt details.",
      fieldErrors: buildInventoryFieldErrors(parsed.error),
      values,
    };
  }

  if (parsed.data.items.some((item) => item.quantity < 1)) {
    return {
      ...initialSupplierReceiptState,
      status: "error",
      message: "Each receipt line must receive at least 1 unit.",
      fieldErrors: {
        items: ["Each receipt line must receive at least 1 unit."],
      },
      values,
    };
  }

  const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
  const [supplier, location, products, supplierProductLinks] = await Promise.all([
    prisma.supplier.findFirst({
      where: {
        id: parsed.data.supplierId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.stockLocation.findUnique({
      where: {
        id: parsed.data.locationId,
      },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
      },
    }),
    prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        status: {
          in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE],
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    }),
    prisma.productSupplier.findMany({
      where: {
        supplierId: parsed.data.supplierId,
        productId: {
          in: productIds,
        },
      },
      select: {
        productId: true,
      },
    }),
  ]);

  if (!supplier) {
    return {
      status: "error",
      message: "Select an active supplier.",
      fieldErrors: {
        supplierId: ["Select an active supplier."],
      },
      values,
    };
  }

  if (!location || !location.isActive) {
    return {
      status: "error",
      message: "Select an active warehouse location.",
      fieldErrors: {
        locationId: ["Select an active warehouse location."],
      },
      values,
    };
  }

  if (location.type !== LocationType.WAREHOUSE) {
    return {
      status: "error",
      message: "Supplier receipts can only be received at a warehouse location.",
      fieldErrors: {
        locationId: ["Supplier receipts can only be received at a warehouse location."],
      },
      values,
    };
  }

  if (products.length !== productIds.length) {
    return {
      status: "error",
      message: "One or more selected products are no longer available for inventory changes.",
      fieldErrors: {
        items: ["One or more selected products are not available."],
      },
      values,
    };
  }

  // Check that all products are linked to this supplier
  const linkedProductIds = new Set(supplierProductLinks.map((link) => link.productId));
  const unlinkedProducts = parsed.data.items.filter(
    (item) => !linkedProductIds.has(item.productId)
  );

  if (unlinkedProducts.length > 0) {
    return {
      status: "error",
      message: "One or more selected products are not linked to the selected supplier.",
      fieldErrors: {
        items: ["Select products linked to the selected supplier."],
      },
      values,
    };
  }

  const productsById = new Map(products.map((p) => [p.id, p]));
  const receiptReferenceId = parsed.data.referenceNumber || randomUUID();

  await prisma.$transaction(async (tx) => {
    for (const item of parsed.data.items) {
      const stockBefore = await tx.locationStock.findUnique({
        where: {
          locationId_productId: {
            locationId: location.id,
            productId: item.productId,
          },
        },
        select: {
          quantity: true,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          type: "PURCHASE_RECEIVED",
          productId: item.productId,
          locationId: location.id,
          quantityChange: item.quantity,
          referenceType: "supplier.receipt",
          referenceId: parsed.data.referenceNumber ?? null,
          notes:
            parsed.data.notes ??
            `Supplier receipt at unit cost ${Number(item.unitCost).toFixed(2)}`,
          performedById: user.id,
        },
      });

      await tx.locationStock.upsert({
        where: {
          locationId_productId: {
            locationId: location.id,
            productId: item.productId,
          },
        },
        create: {
          locationId: location.id,
          productId: item.productId,
          quantity: item.quantity,
        },
        update: {
          quantity: { increment: item.quantity },
        },
      });

      await applyInboundMovingAverage({
        tx,
        locationId: location.id,
        productId: item.productId,
        onHandBefore: stockBefore?.quantity ?? 0,
        inboundQty: item.quantity,
        inboundUnitCost: item.unitCost,
        performedById: user.id,
        sourceType: "supplier.receipt",
        sourceId: parsed.data.referenceNumber ?? receiptReferenceId,
        reason: "Supplier receipt",
      });

      await tx.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId: item.productId,
            supplierId: supplier.id,
          },
        },
        update: {
          costPrice: item.unitCost,
        },
        create: {
          productId: item.productId,
          supplierId: supplier.id,
          costPrice: item.unitCost,
          isPrimary: false,
        },
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: "inventory.supplier_receipt",
        entity: "supplier_receipt",
        entityId: receiptReferenceId,
        details: {
          supplierId: supplier.id,
          supplierName: supplier.name,
          locationId: location.id,
          locationName: location.name,
          referenceNumber: parsed.data.referenceNumber,
          itemCount: parsed.data.items.length,
          items: parsed.data.items.map((item) => ({
            productId: item.productId,
            productName: productsById.get(item.productId)?.name,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        },
      },
      tx
    );
  });

  const totalReceived = parsed.data.items.reduce((sum, item) => sum + item.quantity, 0);
  revalidateInventoryPaths([`/dashboard/inventory/${location.id}`]);
  redirect(
    withFlashMessage(`/dashboard/inventory/${location.id}`, {
      success: `Supplier receipt recorded: ${totalReceived} units received at ${location.name}.`,
    })
  );
}

export async function transferInventoryAction(
  _prevState: InventoryTransferState,
  formData: FormData
): Promise<InventoryTransferState> {
  const user = await requirePermission("inventory", "update");
  const returnTo = resolveInventoryReturnTo(formData, "/dashboard/inventory");
  const values = extractInventoryTransferValues(formData);
  const parsed = inventoryTransferSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the transfer details.",
      fieldErrors: buildInventoryFieldErrors(parsed.error),
      values,
    };
  }

  const [product, sourceLocation, destinationLocation] = await Promise.all([
    prisma.product.findFirst({
      where: { id: parsed.data.productId, status: { in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] } },
      select: { id: true, name: true, sku: true },
    }),
    prisma.stockLocation.findFirst({
      where: { id: parsed.data.fromLocationId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.stockLocation.findFirst({
      where: { id: parsed.data.toLocationId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  if (!product || !sourceLocation || !destinationLocation) {
    return { status: "error", message: "The selected product or location is no longer available.", values };
  }

  const transferGroupId = randomUUID();
  const transferNotes = buildTransferNotes({
    fromLocationName: sourceLocation.name,
    toLocationName: destinationLocation.name,
    notes: parsed.data.notes,
  });

  const transferResult = await withInventoryTransactionRetry(async (tx) => {
    const lockTargets = [
      { kind: "source" as const, locationId: sourceLocation.id },
      { kind: "destination" as const, locationId: destinationLocation.id },
    ].sort((left, right) => left.locationId.localeCompare(right.locationId));

    const lockedStocks = new Map<"source" | "destination", LockedLocationStock | null>();

    for (const target of lockTargets) {
      lockedStocks.set(
        target.kind,
        await lockLocationStock(tx, target.locationId, product.id)
      );
    }

    const sourceStock = lockedStocks.get("source") ?? null;
    const destinationStockBefore = lockedStocks.get("destination") ?? null;

    if (!sourceStock) {
      return {
        status: "error" as const,
        message: `No stock record found for this product at ${sourceLocation.name}.`,
        values,
      };
    }

    const availableQty = getAvailableQuantity(sourceStock.quantity, sourceStock.reservedQty);

    if (availableQty < parsed.data.quantity) {
      return {
        status: "error" as const,
        message:
          availableQty > 0
            ? `Only ${availableQty} units are available to transfer from ${sourceLocation.name}.`
            : `No available stock can be transferred from ${sourceLocation.name}.`,
        values,
      };
    }

    const sourceCostSnapshot = await getSaleCostSnapshot(tx, {
      locationId: sourceLocation.id,
      productId: product.id,
    });

    const nextSourceQuantity = sourceStock.quantity - parsed.data.quantity;

    await tx.locationStock.update({
      where: {
        id: sourceStock.id,
      },
      data: { quantity: nextSourceQuantity },
    });

    await tx.locationStock.upsert({
      where: { locationId_productId: { locationId: destinationLocation.id, productId: product.id } },
      create: { locationId: destinationLocation.id, productId: product.id, quantity: parsed.data.quantity },
      update: { quantity: { increment: parsed.data.quantity } },
    });

    await tx.inventoryMovement.createMany({
      data: [
        {
          type: "TRANSFER_OUT",
          productId: product.id,
          locationId: sourceLocation.id,
          quantityChange: -parsed.data.quantity,
          referenceType: "inventory.transfer",
          referenceId: transferGroupId,
          transferGroupId,
          notes: transferNotes,
          performedById: user.id,
        },
        {
          type: "TRANSFER_IN",
          productId: product.id,
          locationId: destinationLocation.id,
          quantityChange: parsed.data.quantity,
          referenceType: "inventory.transfer",
          referenceId: transferGroupId,
          transferGroupId,
          notes: transferNotes,
          performedById: user.id,
        },
      ],
    });

    await syncLocationCostSnapshot(tx, {
      locationId: sourceLocation.id,
      productId: product.id,
      onHandQtySnapshot: nextSourceQuantity,
    });

    await recordOutboundCostHistory({
      tx,
      locationId: sourceLocation.id,
      productId: product.id,
      outboundQty: parsed.data.quantity,
      outboundUnitCost: sourceCostSnapshot.unitCost,
      performedById: user.id,
      sourceType: "inventory.transfer",
      sourceId: transferGroupId,
      reason: "Transfer out",
    });

    await applyInboundMovingAverage({
      tx,
      locationId: destinationLocation.id,
      productId: product.id,
      onHandBefore: destinationStockBefore?.quantity ?? 0,
      inboundQty: parsed.data.quantity,
      inboundUnitCost: sourceCostSnapshot.unitCost,
      performedById: user.id,
      sourceType: "inventory.transfer",
      sourceId: transferGroupId,
      reason: "Transfer in",
    });

    await logAudit(
      {
        userId: user.id,
        action: "inventory.transfer",
        entity: "inventory_transfer",
        entityId: transferGroupId,
        details: {
          quantity: parsed.data.quantity,
          notes: parsed.data.notes,
          fromLocationId: sourceLocation.id,
          fromLocationName: sourceLocation.name,
          toLocationId: destinationLocation.id,
          toLocationName: destinationLocation.name,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          transferUnitCost: sourceCostSnapshot.unitCost.toString(),
          transferCostEstimated: sourceCostSnapshot.isEstimatedCost,
        },
      },
      tx
    );

    return null;
  });

  if (transferResult) {
    return transferResult;
  }

  revalidateInventoryPaths([returnTo, `/dashboard/inventory/${sourceLocation.id}`, `/dashboard/inventory/${destinationLocation.id}`]);
  redirect(withFlashMessage(returnTo, { success: "Transfer recorded." }));
}

export async function initialStockAction(
  _prevState: InitialStockState,
  formData: FormData
): Promise<InitialStockState> {
  const user = await requirePermission("inventory", "update");
  const values = extractInitialStockValues(formData);
  const parsed = initialStockSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ...initialInitialStockState,
      status: "error",
      message: "Please fix the stock details.",
      fieldErrors: buildInventoryFieldErrors(parsed.error),
      values,
    };
  }

  const [product, location] = await Promise.all([
    prisma.product.findFirst({
      where: { id: parsed.data.productId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, sku: true, costPrice: true },
    }),
    prisma.stockLocation.findFirst({
      where: { id: parsed.data.locationId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) {
    return { status: "error", message: "Select a valid product.", values };
  }

  if (!location) {
    return { status: "error", message: "Select a valid active location.", values };
  }

  let committed = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const currentStock = await tx.locationStock.findUnique({
            where: {
              locationId_productId: {
                locationId: location.id,
                productId: product.id,
              },
            },
            select: { quantity: true },
          });

          if (currentStock && currentStock.quantity > 0) {
            throw new InitialStockAlreadyExistsError(currentStock.quantity);
          }

          await tx.locationStock.upsert({
            where: {
              locationId_productId: { locationId: location.id, productId: product.id },
            },
            create: {
              locationId: location.id,
              productId: product.id,
              quantity: parsed.data.quantity,
            },
            update: { quantity: parsed.data.quantity },
          });

          await tx.inventoryMovement.create({
            data: {
              type: "INITIAL_STOCK",
              productId: product.id,
              locationId: location.id,
              quantityChange: parsed.data.quantity,
              referenceType: "inventory.initial_stock",
              notes: parsed.data.notes ?? null,
              performedById: user.id,
            },
          });

          await applyInboundMovingAverage({
            tx,
            locationId: location.id,
            productId: product.id,
            onHandBefore: currentStock?.quantity ?? 0,
            inboundQty: parsed.data.quantity,
            inboundUnitCost: product.costPrice,
            performedById: user.id,
            sourceType: "inventory.initial_stock",
            sourceId: null,
            reason: "Initial stock load",
          });

          await logAudit(
            {
              userId: user.id,
              action: "inventory.initial_stock",
              entity: "location_stock",
              entityId: `${location.id}:${product.id}`,
              details: {
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                locationId: location.id,
                locationName: location.name,
                quantity: parsed.data.quantity,
                notes: parsed.data.notes,
              },
            },
            tx
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      committed = true;
      break;
    } catch (error) {
      if (error instanceof InitialStockAlreadyExistsError) {
        return {
          status: "error",
          message: `Stock already exists for this product at ${location.name} (${error.quantity} units). Use Manual Adjustment to correct existing stock.`,
          fieldErrors: { productId: ["Stock already exists at this location."] },
          values,
        };
      }

      const isRetryableConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";

      if (isRetryableConflict && attempt < 2) {
        continue;
      }

      throw error;
    }
  }

  if (!committed) {
    return {
      status: "error",
      message: "We could not load the initial stock due to a temporary conflict. Please try again.",
      values,
    };
  }

  revalidateInventoryPaths([`/dashboard/inventory/${location.id}`]);
  redirect(
    withFlashMessage("/dashboard/inventory/initial-stock", {
      success: `Opening stock loaded: ${parsed.data.quantity} units of ${product.name} at ${location.name}.`,
    })
  );
}

export async function bulkStockSetupAction(
  _prevState: BulkStockSetupState,
  formData: FormData
): Promise<BulkStockSetupState> {
  const user = await requirePermission("inventory", "update");

  const values = extractBulkStockSetupValues(formData);

  // Filter items: only include rows where the user actually entered a quantity > 0
  const activeItems = values.items.filter(
    (item) => item.quantity !== "" && item.quantity !== "0"
  );

  const parsedValues = {
    ...values,
    items: activeItems,
  };

  const parsed = bulkStockSetupSchema.safeParse(parsedValues);

  if (!parsed.success) {
    return {
      ...initialBulkStockSetupState,
      status: "error",
      message: "Please fix the stock setup details.",
      fieldErrors: buildInventoryFieldErrors(parsed.error),
      values,
    };
  }

  const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];

  const [location, products, existingStock] = await Promise.all([
    prisma.stockLocation.findFirst({
      where: { id: parsed.data.locationId, isActive: true },
      select: { id: true, name: true, code: true, type: true },
    }),
    prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: { in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] },
      },
      select: { id: true, name: true, sku: true, costPrice: true },
    }),
    prisma.locationStock.findMany({
      where: {
        locationId: parsed.data.locationId,
        productId: { in: productIds },
      },
      select: { productId: true, quantity: true },
    }),
  ]);

  if (!location) {
    return {
      status: "error",
      message: "Select an active location.",
      fieldErrors: { locationId: ["Select an active location."] },
      values,
    };
  }

  if (products.length !== productIds.length) {
    return {
      status: "error",
      message: "One or more selected products are no longer available.",
      fieldErrors: { items: ["One or more selected products are not available."] },
      values,
    };
  }

  const productsById = new Map(products.map((p) => [p.id, p]));
  const existingStockByProductId = new Map(
    existingStock.map((s) => [s.productId, s.quantity])
  );

  const batchId = randomUUID();
  const reasonLabel = bulkStockSetupReasonLabels[parsed.data.reason];

  await prisma.$transaction(async (tx) => {
    for (const item of parsed.data.items) {
      const currentQty = existingStockByProductId.get(item.productId) ?? 0;
      const quantityChange = item.quantity - currentQty;

      // Skip if quantity hasn't actually changed
      if (quantityChange === 0) {
        continue;
      }

      await tx.locationStock.upsert({
        where: {
          locationId_productId: {
            locationId: location.id,
            productId: item.productId,
          },
        },
        create: {
          locationId: location.id,
          productId: item.productId,
          quantity: item.quantity,
        },
        update: {
          quantity: item.quantity,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          type: currentQty === 0 ? "INITIAL_STOCK" : "MANUAL_ADJUSTMENT",
          productId: item.productId,
          locationId: location.id,
          quantityChange,
          referenceType: "inventory.bulk_stock_setup",
          referenceId: batchId,
          notes: buildMovementNotes(reasonLabel, parsed.data.notes),
          performedById: user.id,
        },
      });

      if (quantityChange > 0) {
        await applyInboundMovingAverage({
          tx,
          locationId: location.id,
          productId: item.productId,
          onHandBefore: currentQty,
          inboundQty: quantityChange,
          inboundUnitCost: productsById.get(item.productId)?.costPrice ?? 0,
          performedById: user.id,
          sourceType: "inventory.bulk_stock_setup",
          sourceId: batchId,
          reason: reasonLabel,
        });
      } else {
        await syncLocationCostSnapshot(tx, {
          locationId: location.id,
          productId: item.productId,
          onHandQtySnapshot: item.quantity,
        });
      }
    }

    const auditItems = parsed.data.items.map((item) => ({
      productId: item.productId,
      productName: productsById.get(item.productId)?.name,
      sku: productsById.get(item.productId)?.sku,
      previousQuantity: existingStockByProductId.get(item.productId) ?? 0,
      newQuantity: item.quantity,
    }));

    await logAudit(
      {
        userId: user.id,
        action: "inventory.bulk_stock_setup",
        entity: "bulk_stock_setup",
        entityId: batchId,
        details: {
          locationId: location.id,
          locationName: location.name,
          locationType: location.type,
          reason: parsed.data.reason,
          reasonLabel,
          notes: parsed.data.notes,
          itemCount: parsed.data.items.length,
          items: auditItems,
        },
      },
      tx
    );
  });

  const totalUpdated = parsed.data.items.length;
  revalidateInventoryPaths([`/dashboard/inventory/${location.id}`]);
  redirect(
    withFlashMessage("/dashboard/inventory/stock-setup", {
      success: `Stock setup complete: ${totalUpdated} product${totalUpdated === 1 ? "" : "s"} updated at ${location.name}.`,
    })
  );
}

export async function correctReservedQtyAction(formData: FormData) {
  const user = await requirePermission("inventory", "update");
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const reserveCorrectionPath = "/dashboard/inventory/reserve-correction";
  const returnTo = resolveInventoryReturnTo(formData, reserveCorrectionPath);
  const locationStockId = String(formData.get("locationStockId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const newReservedQty = parseWholeNumber(formData.get("newReservedQty"));

  if (!locationStockId) {
    redirect(
      withFlashMessage(returnTo, {
        error: "Location stock record is missing.",
      })
    );
  }

  if (newReservedQty === null) {
    redirect(
      withFlashMessage(returnTo, {
        error: "Correct reserved quantity must be a non-negative whole number.",
      })
    );
  }

  if (!reason) {
    redirect(
      withFlashMessage(returnTo, {
        error: "Correction reason is required.",
      })
    );
  }

  if (reason.length > 500) {
    redirect(
      withFlashMessage(returnTo, {
        error: "Correction reason must be 500 characters or fewer.",
      })
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.locationStock.findUnique({
      where: {
        id: locationStockId,
      },
      select: {
        id: true,
        locationId: true,
        productId: true,
        quantity: true,
        reservedQty: true,
      },
    });

    if (!stock) {
      return {
        ok: false as const,
        error: "Location stock record no longer exists.",
      };
    }

    if (newReservedQty > stock.quantity) {
      return {
        ok: false as const,
        error: `Correct reserved quantity cannot exceed on-hand quantity (${stock.quantity.toLocaleString("en-US")}).`,
      };
    }

    await tx.locationStock.update({
      where: {
        id: stock.id,
      },
      data: {
        reservedQty: newReservedQty,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: "RESERVE_CORRECTION",
        entity: "LocationStock",
        entityId: stock.id,
        details: {
          locationId: stock.locationId,
          productId: stock.productId,
          oldReservedQty: stock.reservedQty,
          newReservedQty,
          reason,
        },
      },
      tx
    );

    return {
      ok: true as const,
      locationId: stock.locationId,
    };
  });

  if (!result.ok) {
    redirect(
      withFlashMessage(returnTo, {
        error: result.error,
      })
    );
  }

  revalidatePath(reserveCorrectionPath);
  revalidatePath(`/dashboard/inventory/${result.locationId}`);
  redirect(
    withFlashMessage(returnTo, {
      success: "Reserved quantity corrected successfully.",
    })
  );
}
