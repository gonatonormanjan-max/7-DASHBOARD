"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LocationType, ProductStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import {
  applyInboundMovingAverage,
  getSaleCostSnapshot,
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

function resolveInventoryReturnTo(formData: FormData, fallback: string) {
  const returnTo = String(formData.get("returnTo") ?? "").trim();

  if (returnTo.startsWith("/dashboard/inventory")) {
    return returnTo;
  }

  return fallback;
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

  const [product, location, currentStock] = await Promise.all([
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
    prisma.locationStock.findUnique({
      where: {
        locationId_productId: {
          locationId: parsed.data.locationId,
          productId: parsed.data.productId,
        },
      },
      select: {
        id: true,
        quantity: true,
        reservedQty: true,
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

  const availableQty = currentStock
    ? getAvailableQuantity(currentStock.quantity, currentStock.reservedQty)
    : 0;

  if (parsed.data.direction === "decrease" && availableQty < parsed.data.quantity) {
    return {
      status: "error",
      message:
        availableQty > 0
          ? `Only ${availableQty} units are currently available to reduce in ${location.name}.`
          : `No available stock can be reduced from ${location.name}.`,
      values,
    };
  }

  const quantityChange =
    parsed.data.direction === "increase" ? parsed.data.quantity : -parsed.data.quantity;
  const currentQuantity = currentStock?.quantity ?? 0;
  const nextQuantity = currentQuantity + quantityChange;

  if (nextQuantity < 0) {
    return {
      status: "error",
      message: `Adjustment would result in negative stock (${currentQuantity} + ${quantityChange} = ${nextQuantity}). Verify the count.`,
      values,
    };
  }

  await prisma.$transaction(async (tx) => {
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
  });

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

  const [product, sourceLocation, destinationLocation, sourceStock] = await Promise.all([
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
    prisma.locationStock.findUnique({
      where: { locationId_productId: { locationId: parsed.data.fromLocationId, productId: parsed.data.productId } },
      select: { id: true, quantity: true, reservedQty: true },
    }),
  ]);

  if (!product || !sourceLocation || !destinationLocation) {
    return { status: "error", message: "The selected product or location is no longer available.", values };
  }

  if (!sourceStock) {
    return { status: "error", message: `No stock record found for this product at ${sourceLocation.name}.`, values };
  }

  const availableQty = getAvailableQuantity(sourceStock.quantity, sourceStock.reservedQty);

  if (availableQty < parsed.data.quantity) {
    return {
      status: "error",
      message: availableQty > 0
        ? `Only ${availableQty} units are available to transfer from ${sourceLocation.name}.`
        : `No available stock can be transferred from ${sourceLocation.name}.`,
      values,
    };
  }

  const transferGroupId = randomUUID();
  const transferNotes = buildTransferNotes({
    fromLocationName: sourceLocation.name,
    toLocationName: destinationLocation.name,
    notes: parsed.data.notes,
  });

  await prisma.$transaction(async (tx) => {
    const [sourceCostSnapshot, destinationStockBefore] = await Promise.all([
      getSaleCostSnapshot(tx, {
        locationId: sourceLocation.id,
        productId: product.id,
      }),
      tx.locationStock.findUnique({
        where: {
          locationId_productId: {
            locationId: destinationLocation.id,
            productId: product.id,
          },
        },
        select: {
          quantity: true,
        },
      }),
    ]);

    await tx.locationStock.update({
      where: { locationId_productId: { locationId: sourceLocation.id, productId: product.id } },
      data: { quantity: { decrement: parsed.data.quantity } },
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
      onHandQtySnapshot: sourceStock.quantity - parsed.data.quantity,
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
  });

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

  const [product, location, currentStock] = await Promise.all([
    prisma.product.findFirst({
      where: { id: parsed.data.productId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, sku: true, costPrice: true },
    }),
    prisma.stockLocation.findFirst({
      where: { id: parsed.data.locationId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.locationStock.findUnique({
      where: { locationId_productId: { locationId: parsed.data.locationId, productId: parsed.data.productId } },
      select: { id: true, quantity: true },
    }),
  ]);

  if (!product) {
    return { status: "error", message: "Select a valid product.", values };
  }

  if (!location) {
    return { status: "error", message: "Select a valid active location.", values };
  }

  if (currentStock && currentStock.quantity > 0) {
    return {
      status: "error",
      message: `Stock already exists for this product at ${location.name} (${currentStock.quantity} units). Use Manual Adjustment to correct existing stock.`,
      fieldErrors: { productId: ["Stock already exists at this location."] },
      values,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.locationStock.upsert({
      where: { locationId_productId: { locationId: location.id, productId: product.id } },
      create: { locationId: location.id, productId: product.id, quantity: parsed.data.quantity },
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
  });

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

  if (user.role === "SALES_STAFF") {
    return {
      status: "error",
      message: "You do not have permission to perform bulk stock setup.",
    };
  }

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
