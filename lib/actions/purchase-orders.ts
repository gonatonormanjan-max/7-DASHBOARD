"use server";

import { LocationType, Prisma, ProductStatus, PurchaseOrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { applyInboundMovingAverage } from "@/lib/costing";
import { requirePermission } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import { generatePurchaseOrderNumber } from "@/lib/purchase-orders";
import { prisma } from "@/lib/prisma";
import {
  extractPurchaseOrderFormValues,
  extractPurchaseOrderReceiveValues,
  initialPurchaseOrderFormState,
  initialPurchaseOrderReceiveState,
  purchaseOrderFormSchema,
  purchaseOrderReceiveSchema,
  type PurchaseOrderFormState,
  type PurchaseOrderReceiveState,
} from "@/lib/validators/purchase-orders";

function toMoney(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function revalidatePurchaseOrderPaths(options: {
  orderId?: string;
  locationIds?: string[];
} = {}) {
  const paths = new Set<string>([
    "/dashboard/purchase-orders",
    "/dashboard/inventory",
  ]);

  if (options.orderId) {
    paths.add(`/dashboard/purchase-orders/${options.orderId}`);
    paths.add(`/dashboard/purchase-orders/${options.orderId}/receive`);
  }

  for (const locationId of options.locationIds ?? []) {
    paths.add(`/dashboard/inventory/${locationId}`);
  }

  for (const path of paths) {
    revalidatePath(path);
  }
}

async function createPurchaseOrderRecord(
  tx: Prisma.TransactionClient,
  input: {
    supplierId: string;
    expectedDate: string | null;
    notes: string | null;
    totalAmount: Prisma.Decimal;
    createdById: string;
  }
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await tx.purchaseOrder.create({
        data: {
          orderNumber: generatePurchaseOrderNumber(),
          supplierId: input.supplierId,
          status: "DRAFT",
          totalAmount: input.totalAmount,
          expectedDate: input.expectedDate ? new Date(`${input.expectedDate}T00:00:00`) : null,
          notes: input.notes,
          createdById: input.createdById,
        },
        select: {
          id: true,
          orderNumber: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < 4
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("We could not generate a unique purchase order number. Please try again.");
}

export async function createPurchaseOrderAction(
  _prevState: PurchaseOrderFormState,
  formData: FormData
): Promise<PurchaseOrderFormState> {
  const user = await requirePermission("purchase_orders", "create");
  const values = extractPurchaseOrderFormValues(formData);
  const formValues = {
    supplierId: values.supplierId,
    locationId: values.locationId,
    expectedDate: values.expectedDate,
    notes: values.notes,
    itemsPayload: values.itemsPayload,
  };

  if (values.items === null) {
    return {
      ...initialPurchaseOrderFormState,
      status: "error",
      message: "We could not read the line items. Please try again.",
      fieldErrors: {
        items: ["We could not read the line items. Please try again."],
        itemsPayload: ["We could not read the line items. Please try again."],
      },
      values: formValues,
    };
  }

  const parsed = purchaseOrderFormSchema.safeParse({
    supplierId: values.supplierId,
    locationId: values.locationId,
    expectedDate: values.expectedDate,
    notes: values.notes,
    items: values.items,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten()
      .fieldErrors as Record<string, string[] | undefined>;
    const itemErrors: Array<string | undefined> = [];

    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "items" && typeof issue.path[1] === "number") {
        itemErrors[issue.path[1]] ??= issue.message;
      }
    }

    return {
      ...initialPurchaseOrderFormState,
      status: "error",
      message: "Please fix the purchase order details.",
      fieldErrors,
      itemErrors: itemErrors.some(Boolean) ? itemErrors : undefined,
      values: formValues,
    };
  }

  const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
  const [supplier, warehouse, products] = await Promise.all([
    prisma.supplier.findFirst({
      where: { id: parsed.data.supplierId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.stockLocation.findFirst({
      where: {
        id: parsed.data.locationId,
        isActive: true,
        type: LocationType.WAREHOUSE,
      },
      select: { id: true, name: true, code: true },
    }),
    prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: { in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] },
      },
      select: { id: true, name: true, sku: true },
    }),
  ]);

  if (!supplier) {
    return {
      status: "error",
      message: "Select an active supplier.",
      fieldErrors: { supplierId: ["Select an active supplier."] },
      values: formValues,
    };
  }

  if (!warehouse) {
    return {
      status: "error",
      message: "Select an active warehouse.",
      fieldErrors: { locationId: ["Select an active warehouse."] },
      values: formValues,
    };
  }

  if (products.length !== productIds.length) {
    return {
      status: "error",
      message: "One or more selected products are no longer available.",
      fieldErrors: { items: ["Select valid products for every line item."] },
      values: formValues,
    };
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const totalAmount = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await createPurchaseOrderRecord(tx, {
      supplierId: supplier.id,
      expectedDate: parsed.data.expectedDate,
      notes: parsed.data.notes,
      totalAmount: toMoney(totalAmount),
      createdById: user.id,
    });

    await tx.purchaseOrderItem.createMany({
      data: parsed.data.items.map((item) => ({
        purchaseOrderId: createdOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        unitCost: toMoney(item.unitCost),
      })),
    });

    // Upsert ProductSupplier links so the cost history is kept current.
    // This ensures future POs with the same supplier auto-populate the cost.
    for (const item of parsed.data.items) {
      await tx.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId: item.productId,
            supplierId: supplier.id,
          },
        },
        update: {
          costPrice: toMoney(item.unitCost),
        },
        create: {
          productId: item.productId,
          supplierId: supplier.id,
          costPrice: toMoney(item.unitCost),
          isPrimary: false,
        },
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: "purchase_order.create",
        entity: "purchase_order",
        entityId: createdOrder.id,
        details: {
          orderNumber: createdOrder.orderNumber,
          supplierId: supplier.id,
          supplierName: supplier.name,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          warehouseCode: warehouse.code,
          status: "DRAFT",
          itemCount: parsed.data.items.length,
          totalAmount: totalAmount.toFixed(2),
          expectedDate: parsed.data.expectedDate,
          items: parsed.data.items.map((item) => ({
            productId: item.productId,
            productName: productsById.get(item.productId)?.name ?? null,
            sku: productsById.get(item.productId)?.sku ?? null,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        },
      },
      tx
    );

    return createdOrder;
  });

  revalidatePurchaseOrderPaths({ orderId: order.id });
  redirect(`/dashboard/purchase-orders/${order.id}`);
}

type PurchaseOrderWorkflowState = {
  status: "idle" | "error";
  message?: string;
};

function getOrderIdFromWorkflowForm(formData: FormData) {
  const orderId = formData.get("orderId");
  if (typeof orderId !== "string") return null;
  const trimmed = orderId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function approvePurchaseOrderAction(
  _prevState: PurchaseOrderWorkflowState,
  formData: FormData
): Promise<PurchaseOrderWorkflowState> {
  const orderId = getOrderIdFromWorkflowForm(formData);

  if (!orderId) {
    return {
      status: "error",
      message: "Purchase order reference is missing. Refresh and try again.",
    };
  }

  const user = await requirePermission("purchase_orders", "approve");
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true },
  });

  if (!order) {
    return { status: "error" as const, message: "Purchase order not found." };
  }

  if (order.status !== "DRAFT") {
    return { status: "error" as const, message: "Only DRAFT orders can be approved." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id: orderId },
      data: { status: "APPROVED" },
    });

    await logAudit(
      {
        userId: user.id,
        action: "purchase_order.approve",
        entity: "purchase_order",
        entityId: orderId,
        details: { orderNumber: order.orderNumber, status: "APPROVED" },
      },
      tx
    );
  });

  revalidatePurchaseOrderPaths({ orderId });
  return {
    status: "idle",
    message: `Purchase order ${order.orderNumber} approved.`,
  };
}

export async function cancelPurchaseOrderAction(
  _prevState: PurchaseOrderWorkflowState,
  formData: FormData
): Promise<PurchaseOrderWorkflowState> {
  const orderId = getOrderIdFromWorkflowForm(formData);

  if (!orderId) {
    return {
      status: "error",
      message: "Purchase order reference is missing. Refresh and try again.",
    };
  }

  const user = await requirePermission("purchase_orders", "update");
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true },
  });

  if (!order) {
    return { status: "error" as const, message: "Purchase order not found." };
  }

  if (order.status === "RECEIVED") {
    return {
      status: "error" as const,
      message: "Received purchase orders cannot be cancelled.",
    };
  }

  if (order.status === "CANCELLED") {
    return { status: "error" as const, message: "This order is already cancelled." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });

    await logAudit(
      {
        userId: user.id,
        action: "purchase_order.cancel",
        entity: "purchase_order",
        entityId: orderId,
        details: {
          orderNumber: order.orderNumber,
          previousStatus: order.status,
          status: "CANCELLED",
        },
      },
      tx
    );
  });

  revalidatePurchaseOrderPaths({ orderId });
  return {
    status: "idle",
    message: `Purchase order ${order.orderNumber} cancelled.`,
  };
}

export async function receivePurchaseOrderAction(
  orderId: string,
  _prevState: PurchaseOrderReceiveState,
  formData: FormData
): Promise<PurchaseOrderReceiveState> {
  const user = await requirePermission("purchase_orders", "receive");
  const values = extractPurchaseOrderReceiveValues(formData);
  const parsed = purchaseOrderReceiveSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten()
      .fieldErrors as Record<string, string[] | undefined>;

    for (const issue of parsed.error.issues) {
      if (issue.path.length > 0) {
        const key = issue.path.join(".");
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
    }

    return {
      ...initialPurchaseOrderReceiveState,
      status: "error",
      message: "Please fix the receiving details.",
      fieldErrors,
      values: {
        warehouseId: values.warehouseId,
        notes: values.notes,
        ...Object.fromEntries(
          values.items.flatMap((item, index) => [
            [`items.${index}.itemId`, item.itemId],
            [`items.${index}.quantity`, item.quantity],
          ])
        ),
      },
    };
  }

  const [order, warehouse] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        items: {
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            productId: true,
            quantity: true,
            receivedQty: true,
            unitCost: true,
            product: {
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
    prisma.stockLocation.findFirst({
      where: {
        id: parsed.data.warehouseId,
        isActive: true,
        type: LocationType.WAREHOUSE,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),
  ]);

  if (!order) {
    return {
      status: "error",
      message: "Purchase order not found.",
    };
  }

  if (
    order.status !== PurchaseOrderStatus.APPROVED &&
    order.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
  ) {
    return {
      status: "error",
      message: "Only approved purchase orders can receive stock.",
    };
  }

  if (!warehouse) {
    return {
      status: "error",
      message: "Select an active warehouse.",
      fieldErrors: { warehouseId: ["Select an active warehouse."] },
    };
  }

  const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
  const receiveLines = parsed.data.items.filter((item) => item.quantity > 0);

  if (receiveLines.length === 0) {
    return {
      status: "error",
      message: "Enter at least one receive quantity greater than zero.",
      fieldErrors: { items: ["Enter at least one receive quantity greater than zero."] },
    };
  }

  for (const line of receiveLines) {
    const orderItem = orderItemsById.get(line.itemId);

    if (!orderItem) {
      return {
        status: "error",
        message: "One or more purchase order lines are invalid.",
      };
    }

    const remaining = orderItem.quantity - orderItem.receivedQty;

    if (line.quantity > remaining) {
      return {
        status: "error",
        message: `${orderItem.product.name} can only receive ${remaining} more unit${remaining === 1 ? "" : "s"}.`,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const line of receiveLines) {
      const orderItem = orderItemsById.get(line.itemId)!;
      const stockBefore = await tx.locationStock.findUnique({
        where: {
          locationId_productId: {
            locationId: warehouse.id,
            productId: orderItem.productId,
          },
        },
        select: {
          quantity: true,
        },
      });

      await tx.purchaseOrderItem.update({
        where: { id: orderItem.id },
        data: {
          receivedQty: {
            increment: line.quantity,
          },
        },
      });

      await tx.locationStock.upsert({
        where: {
          locationId_productId: {
            locationId: warehouse.id,
            productId: orderItem.productId,
          },
        },
        create: {
          locationId: warehouse.id,
          productId: orderItem.productId,
          quantity: line.quantity,
        },
        update: {
          quantity: { increment: line.quantity },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          type: "PURCHASE_RECEIVED",
          productId: orderItem.productId,
          locationId: warehouse.id,
          quantityChange: line.quantity,
          referenceType: "purchase_order",
          referenceId: order.id,
          notes: parsed.data.notes ?? `Received against ${order.orderNumber}`,
          performedById: user.id,
        },
      });

      await applyInboundMovingAverage({
        tx,
        locationId: warehouse.id,
        productId: orderItem.productId,
        onHandBefore: stockBefore?.quantity ?? 0,
        inboundQty: line.quantity,
        inboundUnitCost: orderItem.unitCost,
        performedById: user.id,
        sourceType: "purchase_order",
        sourceId: order.id,
        reason: "PO receive",
      });
    }

    const refreshedItems = order.items.map((item) => {
      const matchedLine = receiveLines.find((line) => line.itemId === item.id);
      return {
        ...item,
        receivedQty: item.receivedQty + (matchedLine?.quantity ?? 0),
      };
    });
    const allReceived = refreshedItems.every((item) => item.receivedQty >= item.quantity);
    const anyReceived = refreshedItems.some((item) => item.receivedQty > 0);

    await tx.purchaseOrder.update({
      where: { id: orderId },
      data: {
        status: allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : order.status,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: "purchase_order.receive",
        entity: "purchase_order",
        entityId: orderId,
        details: {
          orderNumber: order.orderNumber,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          notes: parsed.data.notes,
          items: receiveLines.map((line) => {
            const orderItem = orderItemsById.get(line.itemId)!;
            return {
              itemId: line.itemId,
              productId: orderItem.productId,
              productName: orderItem.product.name,
              sku: orderItem.product.sku,
              quantityReceived: line.quantity,
              unitCost: orderItem.unitCost.toString(),
            };
          }),
        },
      },
      tx
    );
  });

  revalidatePurchaseOrderPaths({ orderId, locationIds: [warehouse.id] });
  redirect(
    withFlashMessage(`/dashboard/purchase-orders/${orderId}`, {
      success: `Stock received for purchase order ${order.orderNumber}.`,
    })
  );
}

/**
 * Returns current stock quantities for a list of products at a given warehouse.
 * Used by the receive form to show a before/after stock impact preview.
 */
export async function getStockLevelsForReceivingAction(
  productIds: string[],
  warehouseId: string
): Promise<Array<{ productId: string; quantity: number }>> {
  await requirePermission("purchase_orders", "receive");

  if (!productIds.length || !warehouseId) return [];

  const stocks = await prisma.locationStock.findMany({
    where: {
      locationId: warehouseId,
      productId: { in: productIds },
    },
    select: { productId: true, quantity: true },
  });

  return stocks;
}
