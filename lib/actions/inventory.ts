"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProductStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { withFlashMessage } from "@/lib/flash-toast";
import { getAvailableQuantity } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal/auth";
import {
  extractInventoryAdjustmentValues,
  extractInventoryTransferValues,
  initialInventoryAdjustmentState,
  inventoryAdjustmentSchema,
  inventoryTransferSchema,
  type InventoryAdjustmentState,
  type InventoryTransferState,
} from "@/lib/validators/inventory";

function revalidateInventoryPaths() {
  revalidatePath("/dashboard/inventory");
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
  const values = extractInventoryAdjustmentValues(formData);
  const parsed = inventoryAdjustmentSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ...initialInventoryAdjustmentState,
      status: "error",
      message: "Please fix the adjustment details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
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

  await prisma.$transaction(async (tx) => {
    const currentQuantity = currentStock?.quantity ?? 0;
    const nextQuantity = currentQuantity + quantityChange;

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

    await tx.inventoryMovement.create({
      data: {
        type: "MANUAL_ADJUSTMENT",
        productId: product.id,
        locationId: location.id,
        quantityChange,
        referenceType: "inventory.adjustment",
        notes: buildMovementNotes(parsed.data.reason, parsed.data.notes),
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

  revalidateInventoryPaths();
  redirect(
    withFlashMessage("/dashboard/inventory", {
      success: "Inventory adjustment recorded.",
    })
  );
}

export async function transferInventoryAction(
  _prevState: InventoryTransferState,
  formData: FormData
): Promise<InventoryTransferState> {
  const user = await requirePermission("inventory", "update");
  const values = extractInventoryTransferValues(formData);
  const parsed = inventoryTransferSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the transfer details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const [product, sourceLocation, destinationLocation, sourceStock] = await Promise.all([
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
        id: parsed.data.fromLocationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.stockLocation.findFirst({
      where: {
        id: parsed.data.toLocationId,
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
          locationId: parsed.data.fromLocationId,
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

  if (!product || !sourceLocation || !destinationLocation) {
    return {
      status: "error",
      message: "The selected product or location is no longer available.",
      values,
    };
  }

  const availableQty = sourceStock
    ? getAvailableQuantity(sourceStock.quantity, sourceStock.reservedQty)
    : 0;

  if (availableQty < parsed.data.quantity) {
    return {
      status: "error",
      message:
        availableQty > 0
          ? `Only ${availableQty} units are available to transfer from ${sourceLocation.name}.`
          : `No available stock can be transferred from ${sourceLocation.name}.`,
      values,
    };
  }

  await prisma.$transaction(async (tx) => {
    const transferGroupId = randomUUID();
    const transferNotes = buildTransferNotes({
      fromLocationName: sourceLocation.name,
      toLocationName: destinationLocation.name,
      notes: parsed.data.notes,
    });

    await tx.locationStock.update({
      where: {
        locationId_productId: {
          locationId: sourceLocation.id,
          productId: product.id,
        },
      },
      data: {
        quantity: sourceStock!.quantity - parsed.data.quantity,
      },
    });

    await tx.locationStock.upsert({
      where: {
        locationId_productId: {
          locationId: destinationLocation.id,
          productId: product.id,
        },
      },
      create: {
        locationId: destinationLocation.id,
        productId: product.id,
        quantity: parsed.data.quantity,
      },
      update: {
        quantity: {
          increment: parsed.data.quantity,
        },
      },
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
        },
      },
      tx
    );
  });

  revalidateInventoryPaths();
  redirect(
    withFlashMessage("/dashboard/inventory", {
      success: "Transfer recorded.",
    })
  );
}
