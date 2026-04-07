"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import { getAvailableQuantity } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { buildSalesOrderNumber } from "@/lib/sales-orders";
import {
  extractSalesOrderFormValues,
  normalizeSalesOrderItems,
  parseSalesOrderCustomer,
  parseSalesOrderItems,
  type SalesOrderFormState,
} from "@/lib/validators/sales-orders";

/* ------------------------------------------------------------------ */
/*  Void (cancel) a completed sales order                              */
/* ------------------------------------------------------------------ */

export type VoidSalesOrderState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function voidSalesOrderAction(
  _prevState: VoidSalesOrderState,
  formData: FormData
): Promise<VoidSalesOrderState> {
  const user = await requirePermission("sales_orders", "update");
  const orderId = String(formData.get("orderId") ?? "");

  if (!orderId) {
    return { status: "error", message: "Missing order ID." };
  }

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerName: true,
      items: {
        select: {
          id: true,
          productId: true,
          locationId: true,
          quantity: true,
          product: { select: { sku: true } },
        },
      },
    },
  });

  if (!order) {
    return { status: "error", message: "Sales order not found." };
  }

  if (order.status === "CANCELLED") {
    return { status: "error", message: "This sale is already voided." };
  }

  if (order.status !== "COMPLETED") {
    return {
      status: "error",
      message: `Only completed orders can be voided. This order is ${order.status}.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    // 1. Mark order as CANCELLED
    await tx.salesOrder.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });

    // 2. Return stock to each warehouse
    for (const item of order.items) {
      await tx.locationStock.updateMany({
        where: {
          productId: item.productId,
          locationId: item.locationId,
        },
        data: {
          quantity: { increment: item.quantity },
        },
      });
    }

    // 3. Create CUSTOMER_RETURN movements to record the reversal
    await tx.inventoryMovement.createMany({
      data: order.items.map((item) => ({
        type: "CUSTOMER_RETURN" as const,
        productId: item.productId,
        locationId: item.locationId,
        quantityChange: item.quantity,
        referenceType: "sales.order",
        referenceId: order.id,
        notes: `Void of ${order.orderNumber} for ${order.customerName} (${item.product.sku}). Stock returned.`,
        performedById: user.id,
      })),
    });

    // 4. Audit trail
    await logAudit(
      {
        userId: user.id,
        action: "sales_order.void",
        entity: "sales_order",
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          lineCount: order.items.length,
          returnedItems: order.items.map((item) => ({
            productId: item.productId,
            locationId: item.locationId,
            quantity: item.quantity,
          })),
        },
      },
      tx
    );
  });

  revalidateSalesOrderPaths(order.id);

  redirect(
    withFlashMessage(`/dashboard/sales-orders/${order.id}`, {
      success: `Sale ${order.orderNumber} was voided and the original stock was returned to inventory.`,
    })
  );
}

/* ------------------------------------------------------------------ */
/*  Archive / Unarchive sales orders                                   */
/* ------------------------------------------------------------------ */

export async function archiveSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, archivedAt: true },
  });

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (order.archivedAt) {
    return { status: "error" as const, message: "This order is already archived." };
  }

  await prisma.salesOrder.update({
    where: { id: orderId },
    data: { archivedAt: new Date() },
  });

  await logAudit({
    userId: user.id,
    action: "sales_order.archive",
    entity: "sales_order",
    entityId: orderId,
    details: { orderNumber: order.orderNumber },
  });

  revalidateSalesOrderPaths(orderId);
  return { status: "success" as const, message: `Order ${order.orderNumber} archived.` };
}

export async function unarchiveSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, archivedAt: true },
  });

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (!order.archivedAt) {
    return { status: "error" as const, message: "This order is not archived." };
  }

  await prisma.salesOrder.update({
    where: { id: orderId },
    data: { archivedAt: null },
  });

  await logAudit({
    userId: user.id,
    action: "sales_order.unarchive",
    entity: "sales_order",
    entityId: orderId,
    details: { orderNumber: order.orderNumber },
  });

  revalidateSalesOrderPaths(orderId);
  return { status: "success" as const, message: `Order ${order.orderNumber} restored.` };
}

export async function bulkArchiveSalesOrdersAction(olderThanDays: number) {
  const user = await requirePermission("sales_orders", "update");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await prisma.salesOrder.updateMany({
    where: {
      archivedAt: null,
      createdAt: { lt: cutoff },
    },
    data: { archivedAt: new Date() },
  });

  await logAudit({
    userId: user.id,
    action: "sales_order.bulk_archive",
    entity: "sales_order",
    entityId: "bulk",
    details: { olderThanDays, archivedCount: result.count },
  });

  revalidatePath("/dashboard/sales-orders");
  revalidatePath("/dashboard/sales-orders/archive");
  return { status: "success" as const, message: `${result.count} order${result.count === 1 ? "" : "s"} archived.` };
}

function toMoney(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function revalidateSalesOrderPaths(orderId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/sales-orders");
  revalidatePath("/dashboard/sales-orders/archive");

  if (orderId) {
    revalidatePath(`/dashboard/sales-orders/${orderId}`);
  }
}

export async function createSalesOrderAction(
  _prevState: SalesOrderFormState,
  formData: FormData
): Promise<SalesOrderFormState> {
  const user = await requirePermission("sales_orders", "create");
  const values = extractSalesOrderFormValues(formData);
  const customer = parseSalesOrderCustomer(values);
  const items = parseSalesOrderItems(values.itemsPayload);

  if (!customer.success || !items.success) {
    const customerFieldErrors = customer.success
      ? {}
      : customer.error.flatten().fieldErrors;
    const itemFieldErrors = items.success
      ? {}
      : (items.error.flatten().fieldErrors as Record<string, string[] | undefined>);

    return {
      status: "error",
      message: "Please fix the sale details.",
      fieldErrors: { ...customerFieldErrors, ...itemFieldErrors },
      itemErrors: items.success ? undefined : items.itemErrors,
      values,
    };
  }

  const normalizedItems = normalizeSalesOrderItems(items.data);
  const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
  const locationIds = [...new Set(normalizedItems.map((item) => item.locationId))];

  const [products, locations, stockRows] = await Promise.all([
    prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    }),
    prisma.stockLocation.findMany({
      where: {
        id: {
          in: locationIds,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.locationStock.findMany({
      where: {
        productId: {
          in: productIds,
        },
        locationId: {
          in: locationIds,
        },
      },
      select: {
        id: true,
        productId: true,
        locationId: true,
        quantity: true,
        reservedQty: true,
      },
    }),
  ]);

  const productsById = new Map(products.map((product) => [product.id, product]));
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const stockByKey = new Map<string, (typeof stockRows)[number]>(
    stockRows.map((stock) => [`${stock.productId}:${stock.locationId}`, stock])
  );
  const requiredByKey = new Map<string, number>();

  for (const item of normalizedItems) {
    const product = productsById.get(item.productId);
    const location = locationsById.get(item.locationId);

    if (!product || !location) {
      const itemErrors = items.data.map((row) =>
        row.productId === item.productId || row.locationId === item.locationId
          ? "This line uses a product or location that is no longer available."
          : undefined
      );

      return {
        status: "error",
        message: "One or more selected products or locations are no longer available.",
        itemErrors,
        values,
      };
    }

    requiredByKey.set(`${item.productId}:${item.locationId}`, item.quantity);
  }

  for (const [key, requiredQty] of requiredByKey) {
    const stock = stockByKey.get(key);
    const [productId, locationId] = key.split(":");
    const product = productsById.get(productId);
    const location = locationsById.get(locationId);
    const availableQty = stock
      ? getAvailableQuantity(stock.quantity, stock.reservedQty)
      : 0;

    if (!product || !location || availableQty < requiredQty) {
      const itemMessage =
        availableQty > 0
          ? `Only ${availableQty} unit${availableQty === 1 ? "" : "s"} available here.`
          : "No stock is available in this location.";
      const itemErrors = items.data.map((row) =>
        `${row.productId}:${row.locationId}` === key ? itemMessage : undefined
      );

      return {
        status: "error",
        message:
          availableQty > 0
            ? `Only ${availableQty} units of ${product?.name ?? "the product"} are available in ${location?.name ?? "the location"}.`
            : `${product?.name ?? "That product"} has no available stock in ${location?.name ?? "that location"}.`,
        itemErrors,
        values,
      };
    }
  }

  const totalAmount = normalizedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = buildSalesOrderNumber();
    const createdOrder = await tx.salesOrder.create({
      data: {
        orderNumber,
        customerName: customer.data.customerName,
        customerEmail: customer.data.customerEmail,
        notes: customer.data.notes,
        status: "COMPLETED",
        totalAmount: toMoney(totalAmount),
        createdById: user.id,
      },
      select: {
        id: true,
        orderNumber: true,
      },
    });

    await tx.salesOrderItem.createMany({
      data: normalizedItems.map((item) => ({
        salesOrderId: createdOrder.id,
        productId: item.productId,
        locationId: item.locationId,
        quantity: item.quantity,
        unitPrice: toMoney(item.unitPrice),
      })),
    });

    for (const [key, requiredQty] of requiredByKey) {
      const stock = stockByKey.get(key);

      if (!stock) {
        throw new Error("Stock row disappeared during sale creation.");
      }

      const updated = await tx.locationStock.updateMany({
        where: {
          id: stock.id,
          quantity: {
            gte: stock.reservedQty + requiredQty,
          },
        },
        data: {
          quantity: {
            decrement: requiredQty,
          },
        },
      });

      if (updated.count === 0) {
        throw new Error("Stock changed before the sale could be completed. Please retry.");
      }
    }

    await tx.inventoryMovement.createMany({
      data: normalizedItems.map((item) => {
        const product = productsById.get(item.productId)!;

        return {
          type: "SALES_FULFILLED",
          productId: item.productId,
          locationId: item.locationId,
          quantityChange: -item.quantity,
          referenceType: "sales.order",
          referenceId: createdOrder.id,
          notes: `Sales order ${createdOrder.orderNumber} for ${customer.data.customerName} (${product.sku}).`,
          performedById: user.id,
        };
      }),
    });

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.create",
        entity: "sales_order",
        entityId: createdOrder.id,
        details: {
          orderNumber: createdOrder.orderNumber,
          customerName: customer.data.customerName,
          lineCount: normalizedItems.length,
          totalAmount: totalAmount.toFixed(2),
          locationIds,
          productIds,
        },
      },
      tx
    );

    return createdOrder;
  });

  revalidateSalesOrderPaths(order.id);

  const intent = formData.get("intent");
  const nextDefaults = new URLSearchParams();

  if (intent === "record_and_new") {
    if (values.defaultLocationId) {
      nextDefaults.set("location", values.defaultLocationId);
    }
    if (values.customerMode) {
      nextDefaults.set("customerMode", values.customerMode);
    }
  }

  const destination =
    intent === "record_and_new"
      ? `/dashboard/sales-orders/new${nextDefaults.toString() ? `?${nextDefaults.toString()}` : ""}`
      : `/dashboard/sales-orders/${order.id}`;

  redirect(
    withFlashMessage(destination, {
      success: `Sale ${order.orderNumber} recorded and inventory updated.`,
    })
  );
}
