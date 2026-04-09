"use server";

import { randomInt } from "node:crypto";
import { LocationType, Prisma, ProductStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodIssue } from "zod";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import { getAvailableQuantity } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import {
  extractSalesOrderFormValues,
  salesOrderFormSchema,
  type SalesOrderFormState,
} from "@/lib/validators/sales-orders";

type SalesOrderWorkflowActionState = {
  status: "idle" | "error";
  message?: string;
};

export type VoidSalesOrderState = SalesOrderWorkflowActionState;

type OrderMutationItem = {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  product: {
    name: string;
    sku: string;
  };
  location: {
    id: string;
    name: string;
  };
};

type StockRequirement = {
  productId: string;
  locationId: string;
  quantity: number;
  productName: string;
  sku: string;
  locationName: string;
};

function toMoney(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function generateSalesOrderNumber() {
  return `SO-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 1000)}`;
}

function buildFormValueMap(values: ReturnType<typeof extractSalesOrderFormValues>) {
  return {
    locationId: values.locationId,
    defaultLocationId: values.defaultLocationId,
    customerName: values.customerName,
    customerEmail: values.customerEmail,
    notes: values.notes,
    itemsPayload: values.itemsPayload,
    customerMode: values.customerMode,
  };
}

function buildItemErrors(issues: ZodIssue[]) {
  const itemErrors: Array<string | undefined> = [];

  for (const issue of issues) {
    if (issue.path[0] !== "items" || typeof issue.path[1] !== "number") {
      continue;
    }

    const index = issue.path[1];
    itemErrors[index] ??= issue.message;
  }

  return itemErrors.some(Boolean) ? itemErrors : undefined;
}

function getInvalidProductErrors(
  itemCount: number,
  items: Array<{ productId: string }>,
  invalidProductIds: Set<string>
) {
  const itemErrors = new Array<string | undefined>(itemCount).fill(undefined);

  items.forEach((item, index) => {
    if (invalidProductIds.has(item.productId)) {
      itemErrors[index] = "Select an active product.";
    }
  });

  return itemErrors;
}

function buildStockRequirements(items: OrderMutationItem[]) {
  const requirements = new Map<string, StockRequirement>();

  for (const item of items) {
    const key = `${item.productId}:${item.locationId}`;
    const existing = requirements.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    requirements.set(key, {
      productId: item.productId,
      locationId: item.locationId,
      quantity: item.quantity,
      productName: item.product.name,
      sku: item.product.sku,
      locationName: item.location.name,
    });
  }

  return [...requirements.values()];
}

function buildStockShortageMessage(
  shortages: Array<{
    productName: string;
    sku: string;
    required: number;
    available: number;
    locationName: string;
  }>
) {
  return [
    "Insufficient stock for this order:",
    ...shortages.map(
      (shortage) =>
        `${shortage.productName} (${shortage.sku}) at ${shortage.locationName}: needs ${shortage.required}, available ${shortage.available}.`
    ),
  ].join("\n");
}

async function createSalesOrderRecord(
  tx: Prisma.TransactionClient,
  input: {
    customerName: string;
    customerEmail: string | null;
    notes: string | null;
    totalAmount: Prisma.Decimal;
    createdById: string;
  }
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await tx.salesOrder.create({
        data: {
          orderNumber: generateSalesOrderNumber(),
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          notes: input.notes,
          status: "DRAFT",
          totalAmount: input.totalAmount,
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

  throw new Error("We could not generate a unique sales order number. Please try again.");
}

async function loadOrderForStatusAction(orderId: string) {
  return prisma.salesOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      items: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          productId: true,
          locationId: true,
          quantity: true,
          unitPrice: true,
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

async function findStockShortages(
  client: Prisma.TransactionClient | typeof prisma,
  requirements: StockRequirement[]
) {
  if (requirements.length === 0) {
    return [];
  }

  const stockRows = await client.locationStock.findMany({
    where: {
      OR: requirements.map((requirement) => ({
        productId: requirement.productId,
        locationId: requirement.locationId,
      })),
    },
    select: {
      id: true,
      productId: true,
      locationId: true,
      quantity: true,
      reservedQty: true,
    },
  });

  const stockMap = new Map(
    stockRows.map((row) => [`${row.productId}:${row.locationId}`, row])
  );

  return requirements
    .map((requirement) => {
      const stock = stockMap.get(`${requirement.productId}:${requirement.locationId}`);
      const available = stock
        ? getAvailableQuantity(stock.quantity, stock.reservedQty)
        : 0;

      if (available >= requirement.quantity) {
        return null;
      }

      return {
        ...requirement,
        available,
      };
    })
    .filter((shortage): shortage is NonNullable<typeof shortage> => shortage !== null);
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

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: orderId },
      data: { archivedAt: new Date() },
    });

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.archive",
        entity: "sales_order",
        entityId: orderId,
        details: { orderNumber: order.orderNumber },
      },
      tx
    );
  });

  revalidateSalesOrderPaths({ orderId });
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

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: orderId },
      data: { archivedAt: null },
    });

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.unarchive",
        entity: "sales_order",
        entityId: orderId,
        details: { orderNumber: order.orderNumber },
      },
      tx
    );
  });

  revalidateSalesOrderPaths({ orderId });
  return { status: "success" as const, message: `Order ${order.orderNumber} restored.` };
}

export async function bulkArchiveSalesOrdersAction(olderThanDays: number) {
  const user = await requirePermission("sales_orders", "update");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await prisma.$transaction(async (tx) => {
    const updatedOrders = await tx.salesOrder.updateMany({
      where: {
        archivedAt: null,
        createdAt: { lt: cutoff },
      },
      data: { archivedAt: new Date() },
    });

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.bulk_archive",
        entity: "sales_order",
        entityId: "bulk",
        details: { olderThanDays, archivedCount: updatedOrders.count },
      },
      tx
    );

    return updatedOrders;
  });

  revalidateSalesOrderPaths();
  return {
    status: "success" as const,
    message: `${result.count} order${result.count === 1 ? "" : "s"} archived.`,
  };
}

function revalidateSalesOrderPaths(options: {
  orderId?: string;
  locationIds?: string[];
} = {}) {
  const paths = new Set<string>([
    "/dashboard",
    "/dashboard/reports",
    "/dashboard/inventory",
    "/dashboard/sales-orders",
    "/dashboard/sales-orders/archive",
  ]);

  if (options.orderId) {
    paths.add(`/dashboard/sales-orders/${options.orderId}`);
  }

  for (const locationId of options.locationIds ?? []) {
    paths.add(`/dashboard/inventory/${locationId}`);
  }

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function createSalesOrderAction(
  _prevState: SalesOrderFormState,
  formData: FormData
): Promise<SalesOrderFormState> {
  const user = await requirePermission("sales_orders", "create");
  const values = extractSalesOrderFormValues(formData);
  const fieldValues = buildFormValueMap(values);

  if (values.items === null) {
    return {
      status: "error",
      message: "We could not read the line items. Please try again.",
      fieldErrors: {
        items: ["We could not read the line items. Please try again."],
        itemsPayload: ["We could not read the line items. Please try again."],
      },
      values: fieldValues,
    };
  }

  const parsed = salesOrderFormSchema.safeParse({
    locationId: values.locationId,
    customerName: values.customerName,
    customerEmail: values.customerEmail,
    notes: values.notes,
    items: values.items,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten()
      .fieldErrors as Record<string, string[] | undefined>;
    const itemErrors = buildItemErrors(parsed.error.issues);

    if (itemErrors) {
      fieldErrors.items ??= ["Fix the highlighted line items before saving."];
      fieldErrors.itemsPayload ??= fieldErrors.items;
    }

    return {
      status: "error",
      message: "Please fix the sales order details.",
      fieldErrors,
      itemErrors,
      values: fieldValues,
    };
  }

  const [location, products] = await Promise.all([
    prisma.stockLocation.findFirst({
      where: {
        id: parsed.data.locationId,
        type: LocationType.BRANCH,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.product.findMany({
      where: {
        id: {
          in: [...new Set(parsed.data.items.map((item) => item.productId))],
        },
        status: ProductStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    }),
  ]);

  if (!location) {
    return {
      status: "error",
      message: "Select an active branch for this order.",
      fieldErrors: {
        locationId: ["Select an active branch for this order."],
      },
      values: fieldValues,
    };
  }

  const productsById = new Map(products.map((product) => [product.id, product]));

  if (products.length !== new Set(parsed.data.items.map((item) => item.productId)).size) {
    const invalidProductIds = new Set(
      parsed.data.items
        .map((item) => item.productId)
        .filter((productId) => !productsById.has(productId))
    );

    return {
      status: "error",
      message: "One or more selected products are no longer active.",
      fieldErrors: {
        items: ["Select active products for every line item."],
        itemsPayload: ["Select active products for every line item."],
      },
      itemErrors: getInvalidProductErrors(
        parsed.data.items.length,
        parsed.data.items,
        invalidProductIds
      ),
      values: fieldValues,
    };
  }

  const totalAmount = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await createSalesOrderRecord(tx, {
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail || null,
      notes: parsed.data.notes,
      totalAmount: toMoney(totalAmount),
      createdById: user.id,
    });

    await tx.salesOrderItem.createMany({
      data: parsed.data.items.map((item) => ({
        salesOrderId: createdOrder.id,
        productId: item.productId,
        locationId: location.id,
        quantity: item.quantity,
        unitPrice: toMoney(item.unitPrice),
      })),
    });

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.create",
        entity: "sales_order",
        entityId: createdOrder.id,
        details: {
          orderNumber: createdOrder.orderNumber,
          status: "DRAFT",
          customerName: parsed.data.customerName,
          branchId: location.id,
          branchName: location.name,
          itemCount: parsed.data.items.length,
          totalAmount: totalAmount.toFixed(2),
          items: parsed.data.items.map((item) => ({
            ...item,
            productName: productsById.get(item.productId)?.name ?? null,
            sku: productsById.get(item.productId)?.sku ?? null,
          })),
        },
      },
      tx
    );

    return createdOrder;
  });

  revalidateSalesOrderPaths({ orderId: order.id });
  redirect(`/dashboard/sales-orders/${order.id}`);
}

export async function confirmSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true },
  });

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (order.status !== "DRAFT") {
    return { status: "error" as const, message: "Only DRAFT orders can be confirmed." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" },
    });

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.confirm",
        entity: "sales_order",
        entityId: orderId,
        details: { orderNumber: order.orderNumber },
      },
      tx
    );
  });

  revalidateSalesOrderPaths({ orderId });
  return { status: "success" as const, message: `Order ${order.orderNumber} confirmed.` };
}

export async function deliverSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");

  const order = await loadOrderForStatusAction(orderId);

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (order.status !== "CONFIRMED") {
    return { status: "error" as const, message: "Only CONFIRMED orders can be delivered." };
  }

  const requirements = buildStockRequirements(order.items as OrderMutationItem[]);
  const shortages = await findStockShortages(prisma, requirements);

  if (shortages.length > 0) {
    return {
      status: "error" as const,
      message: buildStockShortageMessage(shortages),
    };
  }

  const locationIds = [...new Set(order.items.map((item) => item.locationId))];

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: orderId },
      data: { status: "DELIVERED" },
    });

    for (const item of order.items) {
      await tx.inventoryMovement.create({
        data: {
          type: "SALES_FULFILLED",
          productId: item.productId,
          locationId: item.locationId,
          quantityChange: -item.quantity,
          referenceType: "sales_order",
          referenceId: orderId,
          notes: `Fulfilled for order ${order.orderNumber}`,
          performedById: user.id,
        },
      });

      await tx.locationStock.update({
        where: {
          locationId_productId: {
            locationId: item.locationId,
            productId: item.productId,
          },
        },
        data: { quantity: { decrement: item.quantity } },
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.deliver",
        entity: "sales_order",
        entityId: orderId,
        details: {
          orderNumber: order.orderNumber,
          itemCount: order.items.length,
        },
      },
      tx
    );
  });

  revalidateSalesOrderPaths({ orderId, locationIds });
  return { status: "success" as const, message: `Order ${order.orderNumber} marked as delivered.` };
}

export async function completeSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true },
  });

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (order.status !== "DELIVERED") {
    return { status: "error" as const, message: "Only DELIVERED orders can be completed." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: orderId },
      data: { status: "COMPLETED" },
    });

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.complete",
        entity: "sales_order",
        entityId: orderId,
        details: { orderNumber: order.orderNumber },
      },
      tx
    );
  });

  revalidateSalesOrderPaths({ orderId });
  return { status: "success" as const, message: `Order ${order.orderNumber} completed.` };
}

export async function cancelSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");

  const order = await loadOrderForStatusAction(orderId);

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (order.status === "COMPLETED") {
    return { status: "error" as const, message: "Completed orders cannot be cancelled." };
  }

  if (order.status === "CANCELLED") {
    return { status: "error" as const, message: "This order is already cancelled." };
  }

  const wasDelivered = order.status === "DELIVERED";
  const locationIds = wasDelivered
    ? [...new Set(order.items.map((item) => item.locationId))]
    : [];

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });

    if (wasDelivered) {
      for (const item of order.items) {
        await tx.inventoryMovement.create({
          data: {
            type: "CUSTOMER_RETURN",
            productId: item.productId,
            locationId: item.locationId,
            quantityChange: item.quantity,
            referenceType: "sales_order",
            referenceId: orderId,
            notes: `Return from cancelled order ${order.orderNumber}`,
            performedById: user.id,
          },
        });

        await tx.locationStock.update({
          where: {
            locationId_productId: {
              locationId: item.locationId,
              productId: item.productId,
            },
          },
          data: { quantity: { increment: item.quantity } },
        });
      }
    }

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.cancel",
        entity: "sales_order",
        entityId: orderId,
        details: {
          orderNumber: order.orderNumber,
          previousStatus: order.status,
          stockReturned: wasDelivered,
        },
      },
      tx
    );
  });

  revalidateSalesOrderPaths({ orderId, locationIds });
  return { status: "success" as const, message: `Order ${order.orderNumber} cancelled.` };
}