"use server";

import { randomInt } from "node:crypto";
import {
  LocationType,
  Prisma,
  ProductStatus,
  SalesOrderStatus,
  type SalesOrderVoidReason,
} from "@prisma/client";
import type { PaymentMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodIssue } from "zod";
import { logAudit } from "@/lib/audit";
import {
  applyInboundMovingAverage,
  getSaleCostSnapshot,
  syncLocationCostSnapshot,
} from "@/lib/costing";
import { requirePermission, requireSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { getAvailableQuantity } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { formatSalesOrderVoidReason } from "@/lib/sales-orders";
import {
  extractSalesOrderVoidFormValues,
  extractSalesOrderFormValues,
  salesOrderVoidFormSchema,
  salesOrderFormSchema,
  WALK_IN_CUSTOMER_NAME,
  type SalesOrderVoidFormState,
  type SalesOrderFormState,
} from "@/lib/validators/sales-orders";

type SalesOrderWorkflowActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export type VoidSalesOrderState = SalesOrderWorkflowActionState;

type OrderMutationItem = {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  unitCostAtSale: Prisma.Decimal;
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

type PreparedSalesOrderItem = {
  productId: string;
  locationId: string;
  quantity: number;
  unitPrice: number;
};

type PreparedSalesOrderCostedItem = PreparedSalesOrderItem & {
  unitCostAtSale: Prisma.Decimal;
  lineCogs: Prisma.Decimal;
  lineGrossProfit: Prisma.Decimal;
  isEstimatedCost: boolean;
};

type PaymentResolution =
  | {
      paymentMode: null;
      cashAmount: null;
      onlineAmount: null;
      fieldErrors?: undefined;
    }
  | {
      paymentMode: PaymentMode;
      cashAmount: Prisma.Decimal;
      onlineAmount: Prisma.Decimal;
      fieldErrors?: undefined;
    }
  | {
      paymentMode: null;
      cashAmount: null;
      onlineAmount: null;
      fieldErrors: Record<string, string[] | undefined>;
    };

function toMoney(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function generateSalesOrderNumber() {
  return `SO-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 1000)}`;
}

function buildFormValueMap(values: ReturnType<typeof extractSalesOrderFormValues>) {
  return {
    intent: values.intent,
    locationId: values.locationId,
    defaultLocationId: values.defaultLocationId,
    customerName: values.customerName,
    customerEmail: values.customerEmail,
    notes: values.notes,
    itemsPayload: values.itemsPayload,
    customerMode: values.customerMode,
    paymentMode: values.paymentMode,
    cashAmount: values.cashAmount,
    onlineAmount: values.onlineAmount,
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

function getInvalidLocationErrors(
  itemCount: number,
  items: Array<{ locationId: string }>,
  invalidLocationIds: Set<string>
) {
  const itemErrors = new Array<string | undefined>(itemCount).fill(undefined);

  items.forEach((item, index) => {
    if (invalidLocationIds.has(item.locationId)) {
      itemErrors[index] = "Select an active branch for this cart line.";
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
    required?: number;
    quantity?: number;
    available: number;
    locationName: string;
  }>
) {
  return [
    "Insufficient stock for this order:",
    ...shortages.map(
      (shortage) =>
        `${shortage.productName} (${shortage.sku}) at ${shortage.locationName}: needs ${shortage.required ?? shortage.quantity ?? 0}, available ${shortage.available}.`
    ),
  ].join("\n");
}

function buildStockShortageItemErrors(
  items: PreparedSalesOrderItem[],
  shortages: Array<{
    productId: string;
    locationId: string;
    available: number;
    locationName: string;
  }>
) {
  const shortageMap = new Map(
    shortages.map((shortage) => [
      `${shortage.productId}:${shortage.locationId}`,
      shortage.available === 0
        ? `Out of stock in ${shortage.locationName}. Remove this item or switch branches.`
        : `Only ${shortage.available} available in ${shortage.locationName}. Reduce the quantity or remove this item.`,
    ])
  );

  const itemErrors = items.map((item) =>
    shortageMap.get(`${item.productId}:${item.locationId}`)
  );

  return itemErrors.some(Boolean) ? itemErrors : undefined;
}

function parseIntent(rawIntent: string): "draft" | "record" | "record_and_new" {
  return rawIntent === "record" || rawIntent === "record_and_new" ? rawIntent : "draft";
}

function getWorkflowOrderId(formData: FormData) {
  const value = formData.get("orderId");
  return typeof value === "string" ? value.trim() : "";
}

function buildVoidReturnMovementNotes(input: {
  orderNumber: string;
  reason: SalesOrderVoidReason;
  remarks: string;
  documentation: string;
}) {
  return [
    `Void return for order ${input.orderNumber}`,
    `Reason: ${formatSalesOrderVoidReason(input.reason)}`,
    `Remarks: ${input.remarks}`,
    `Documentation: ${input.documentation}`,
  ].join("\n");
}

function normalizeCustomerName(customerMode: string, customerName: string, intent: string) {
  const trimmedCustomerName = customerName.trim();

  if (customerMode === "walk_in") {
    return WALK_IN_CUSTOMER_NAME;
  }

  if (intent === "draft") {
    return trimmedCustomerName;
  }

  return trimmedCustomerName;
}

function parseMoneyInput(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

function amountsMatchTotal(left: number, right: number) {
  return Math.abs(left - right) < 0.005;
}

function resolvePaymentDetails(input: {
  paymentMode: string;
  cashAmount: string;
  onlineAmount: string;
  orderTotal: number;
  intent: "draft" | "record" | "record_and_new";
}): PaymentResolution {
  if (input.intent === "draft") {
    return {
      paymentMode: null,
      cashAmount: null,
      onlineAmount: null,
    };
  }

  if (
    input.paymentMode !== "CASH" &&
    input.paymentMode !== "ONLINE" &&
    input.paymentMode !== "MIXED"
  ) {
    return {
      paymentMode: null,
      cashAmount: null,
      onlineAmount: null,
      fieldErrors: {
        paymentMode: ["Choose a mode of payment before recording the sale."],
      },
    };
  }

  if (input.paymentMode === "CASH") {
    return {
      paymentMode: "CASH",
      cashAmount: toMoney(input.orderTotal),
      onlineAmount: toMoney(0),
    };
  }

  if (input.paymentMode === "ONLINE") {
    return {
      paymentMode: "ONLINE",
      cashAmount: toMoney(0),
      onlineAmount: toMoney(input.orderTotal),
    };
  }

  const cashAmount = parseMoneyInput(input.cashAmount);
  const onlineAmount = parseMoneyInput(input.onlineAmount);
  const fieldErrors: Record<string, string[] | undefined> = {};

  if (cashAmount === null || Number.isNaN(cashAmount) || cashAmount <= 0) {
    fieldErrors.cashAmount = ["Enter the cash amount for a mixed payment."];
  }

  if (onlineAmount === null || Number.isNaN(onlineAmount) || onlineAmount <= 0) {
    fieldErrors.onlineAmount = ["Enter the online amount for a mixed payment."];
  }

  if (
    cashAmount !== null &&
    !Number.isNaN(cashAmount) &&
    onlineAmount !== null &&
    !Number.isNaN(onlineAmount) &&
    !amountsMatchTotal(cashAmount + onlineAmount, input.orderTotal)
  ) {
    fieldErrors.onlineAmount = [
      `Cash and online amounts must add up to ${input.orderTotal.toFixed(2)}.`,
    ];
  }

  if (Object.values(fieldErrors).some(Boolean)) {
    return {
      paymentMode: null,
      cashAmount: null,
      onlineAmount: null,
      fieldErrors,
    };
  }

  return {
    paymentMode: "MIXED",
    cashAmount: toMoney(cashAmount ?? 0),
    onlineAmount: toMoney(onlineAmount ?? 0),
  };
}

async function createSalesOrderRecord(
  tx: Prisma.TransactionClient,
  input: {
    customerName: string;
    customerEmail: string | null;
    notes: string | null;
    totalAmount: Prisma.Decimal;
    status: SalesOrderStatus;
    paymentMode: PaymentMode | null;
    cashAmount: Prisma.Decimal | null;
    onlineAmount: Prisma.Decimal | null;
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
          status: input.status,
          totalAmount: input.totalAmount,
          paymentMode: input.paymentMode,
          cashAmount: input.cashAmount,
          onlineAmount: input.onlineAmount,
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
          unitCostAtSale: true,
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

function isOutsideSalesStaffScope(
  order: { items: Array<{ locationId: string }> },
  activeLocationId: string | null
) {
  if (!activeLocationId) {
    return false;
  }

  if (order.items.length === 0) {
    return true;
  }

  return order.items.some((item) => item.locationId !== activeLocationId);
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
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: "/dashboard/sales-orders/new",
  });
  const values = extractSalesOrderFormValues(formData);
  const fieldValues = buildFormValueMap(values);
  const intent = parseIntent(values.intent);

  if (values.items === null) {
    return {
      status: "error",
      message: "We could not read the customer cart. Please try again.",
      fieldErrors: {
        items: ["We could not read the customer cart. Please try again."],
        itemsPayload: ["We could not read the customer cart. Please try again."],
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
      fieldErrors.items ??= ["Fix the highlighted cart lines before saving."];
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

  const customerName = normalizeCustomerName(
    values.customerMode,
    parsed.data.customerName,
    intent
  );

  if (intent !== "draft" && values.customerMode !== "walk_in" && !customerName) {
    return {
      status: "error",
      message: "Add a customer name or mark this as a walk-in sale before recording.",
      fieldErrors: {
        customerName: ["Add a customer name or switch to walk-in sale before recording."],
      },
      values: fieldValues,
    };
  }

  const preparedItems: PreparedSalesOrderItem[] = parsed.data.items.map((item) => ({
    productId: item.productId,
    locationId: item.locationId ?? parsed.data.locationId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));

  if (user.role === "SALES_STAFF" && activeLocationId) {
    const hasCrossBranchItem = preparedItems.some(
      (item) => item.locationId !== activeLocationId
    );

    if (parsed.data.locationId !== activeLocationId || hasCrossBranchItem) {
      return {
        status: "error",
        message: "Sales staff can only record sales for the selected branch.",
        fieldErrors: {
          locationId: ["This sale must stay under your selected branch."],
          items: ["This sale must stay under your selected branch."],
          itemsPayload: ["This sale must stay under your selected branch."],
        },
        values: fieldValues,
      };
    }
  }

  const uniqueLocationIds = [...new Set(preparedItems.map((item) => item.locationId))];
  const uniqueProductIds = [...new Set(preparedItems.map((item) => item.productId))];

  const [locations, products] = await Promise.all([
    prisma.stockLocation.findMany({
      where: {
        id: { in: uniqueLocationIds },
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
        id: { in: uniqueProductIds },
        status: ProductStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    }),
  ]);

  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const defaultLocation = locationsById.get(parsed.data.locationId);

  if (!defaultLocation) {
    return {
      status: "error",
      message: "Select an active branch for this order.",
      fieldErrors: {
        locationId: ["Select an active branch for this order."],
      },
      values: fieldValues,
    };
  }

  if (locations.length !== uniqueLocationIds.length) {
    const invalidLocationIds = new Set(
      preparedItems
        .map((item) => item.locationId)
        .filter((locationId) => !locationsById.has(locationId))
    );

    return {
      status: "error",
      message: "One or more cart lines point to an inactive branch.",
      fieldErrors: {
        items: ["Select an active branch for every cart line."],
        itemsPayload: ["Select an active branch for every cart line."],
      },
      itemErrors: getInvalidLocationErrors(
        preparedItems.length,
        preparedItems,
        invalidLocationIds
      ),
      values: fieldValues,
    };
  }

  const productsById = new Map(products.map((product) => [product.id, product]));

  if (products.length !== uniqueProductIds.length) {
    const invalidProductIds = new Set(
      preparedItems
        .map((item) => item.productId)
        .filter((productId) => !productsById.has(productId))
    );

    return {
      status: "error",
      message: "One or more selected products are no longer active.",
      fieldErrors: {
        items: ["Select active products for every cart line."],
        itemsPayload: ["Select active products for every cart line."],
      },
      itemErrors: getInvalidProductErrors(
        preparedItems.length,
        preparedItems,
        invalidProductIds
      ),
      values: fieldValues,
    };
  }

  const totalAmount = preparedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const paymentDetails = resolvePaymentDetails({
    paymentMode: values.paymentMode,
    cashAmount: values.cashAmount,
    onlineAmount: values.onlineAmount,
    orderTotal: totalAmount,
    intent,
  });

  if (paymentDetails.fieldErrors) {
    return {
      status: "error",
      message: "Choose a valid payment setup before recording the sale.",
      fieldErrors: paymentDetails.fieldErrors,
      values: fieldValues,
    };
  }

  const orderItemsForValidation: OrderMutationItem[] = preparedItems.map((item, index) => {
    const product = productsById.get(item.productId);
    const location = locationsById.get(item.locationId);

    return {
      id: `new-order-item-${index + 1}`,
      productId: item.productId,
      locationId: item.locationId,
      quantity: item.quantity,
      unitPrice: toMoney(item.unitPrice),
      unitCostAtSale: toMoney(0),
      product: {
        name: product?.name ?? "Unknown product",
        sku: product?.sku ?? "UNKNOWN",
      },
      location: {
        id: location?.id ?? item.locationId,
        name: location?.name ?? "Unknown branch",
      },
    };
  });

  if (intent !== "draft") {
    const requirements = buildStockRequirements(orderItemsForValidation);
    const shortages = await findStockShortages(prisma, requirements);

    if (shortages.length > 0) {
      return {
        status: "error",
        message: "Some cart lines exceed the available stock.",
        fieldErrors: {
          items: ["Reduce or remove the highlighted cart lines before recording the sale."],
          itemsPayload: ["Reduce or remove the highlighted cart lines before recording the sale."],
        },
        itemErrors: buildStockShortageItemErrors(preparedItems, shortages),
        values: fieldValues,
      };
    }
  }

  const affectedLocationIds = [...new Set(preparedItems.map((item) => item.locationId))];

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await createSalesOrderRecord(tx, {
      customerName,
      customerEmail: parsed.data.customerEmail || null,
      notes: parsed.data.notes,
      totalAmount: toMoney(totalAmount),
      status: intent === "draft" ? SalesOrderStatus.DRAFT : SalesOrderStatus.COMPLETED,
      paymentMode: paymentDetails.paymentMode,
      cashAmount: paymentDetails.cashAmount,
      onlineAmount: paymentDetails.onlineAmount,
      createdById: user.id,
    });

    const costSnapshotsByKey = new Map<
      string,
      Awaited<ReturnType<typeof getSaleCostSnapshot>>
    >();
    const costedItems: PreparedSalesOrderCostedItem[] = [];

    for (const item of preparedItems) {
      const key = `${item.productId}:${item.locationId}`;

      if (!costSnapshotsByKey.has(key)) {
        costSnapshotsByKey.set(
          key,
          await getSaleCostSnapshot(tx, {
            productId: item.productId,
            locationId: item.locationId,
          })
        );
      }

      const costSnapshot = costSnapshotsByKey.get(key)!;
      const lineCogsValue = item.quantity * costSnapshot.unitCost.toNumber();
      const lineRevenueValue = item.quantity * item.unitPrice;

      costedItems.push({
        ...item,
        unitCostAtSale: costSnapshot.unitCost,
        lineCogs: toMoney(lineCogsValue),
        lineGrossProfit: toMoney(lineRevenueValue - lineCogsValue),
        isEstimatedCost: costSnapshot.isEstimatedCost,
      });
    }

    await tx.salesOrderItem.createMany({
      data: costedItems.map((item) => ({
        salesOrderId: createdOrder.id,
        productId: item.productId,
        locationId: item.locationId,
        quantity: item.quantity,
        unitPrice: toMoney(item.unitPrice),
        unitCostAtSale: item.unitCostAtSale,
        lineCogs: item.lineCogs,
        lineGrossProfit: item.lineGrossProfit,
        isEstimatedCost: item.isEstimatedCost,
      })),
    });

    if (intent !== "draft") {
      const uniqueStockPairs = Array.from(
        new Map(
          costedItems.map((item) => [
            `${item.productId}:${item.locationId}`,
            {
              productId: item.productId,
              locationId: item.locationId,
            },
          ])
        ).values()
      );
      const stockRows = await tx.locationStock.findMany({
        where: {
          OR: uniqueStockPairs,
        },
        select: {
          productId: true,
          locationId: true,
          quantity: true,
        },
      });
      const onHandByKey = new Map(
        stockRows.map((row) => [`${row.productId}:${row.locationId}`, row.quantity])
      );

      for (const item of costedItems) {
        await tx.inventoryMovement.create({
          data: {
            type: "SALES_FULFILLED",
            productId: item.productId,
            locationId: item.locationId,
            quantityChange: -item.quantity,
            referenceType: "sales_order",
            referenceId: createdOrder.id,
            notes: `Recorded direct sale ${createdOrder.orderNumber}`,
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
          data: {
            quantity: { decrement: item.quantity },
          },
        });

        const key = `${item.productId}:${item.locationId}`;
        const previousOnHand = onHandByKey.get(key) ?? 0;
        const nextOnHand = previousOnHand - item.quantity;
        onHandByKey.set(key, nextOnHand);

        await syncLocationCostSnapshot(tx, {
          locationId: item.locationId,
          productId: item.productId,
          onHandQtySnapshot: nextOnHand,
        });
      }
    }

    await logAudit(
      {
        userId: user.id,
        action: intent === "draft" ? "sales_order.create" : "sales_order.record",
        entity: "sales_order",
        entityId: createdOrder.id,
        details: {
          orderNumber: createdOrder.orderNumber,
          status: intent === "draft" ? "DRAFT" : "COMPLETED",
          customerName: customerName || null,
          branchId: defaultLocation.id,
          branchName: defaultLocation.name,
          itemCount: preparedItems.length,
          totalAmount: totalAmount.toFixed(2),
          paymentMode: paymentDetails.paymentMode,
          cashAmount: paymentDetails.cashAmount?.toString() ?? null,
          onlineAmount: paymentDetails.onlineAmount?.toString() ?? null,
          estimatedCostLineCount: costedItems.filter((item) => item.isEstimatedCost).length,
          items: costedItems.map((item) => ({
            ...item,
            unitCostAtSale: item.unitCostAtSale.toString(),
            lineCogs: item.lineCogs.toString(),
            lineGrossProfit: item.lineGrossProfit.toString(),
            productName: productsById.get(item.productId)?.name ?? null,
            sku: productsById.get(item.productId)?.sku ?? null,
            branchName: locationsById.get(item.locationId)?.name ?? null,
          })),
        },
      },
      tx
    );

    return createdOrder;
  });

  revalidateSalesOrderPaths({ orderId: order.id, locationIds: affectedLocationIds });

  if (intent === "record_and_new") {
    redirect("/dashboard/sales-orders/new");
  }

  redirect(`/dashboard/sales-orders/${order.id}`);
}

async function runConfirmSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: `/dashboard/sales-orders/${orderId}`,
  });

  const order = await loadOrderForStatusAction(orderId);

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (isOutsideSalesStaffScope(order, activeLocationId)) {
    return {
      status: "error" as const,
      message: "You can only update orders for your selected branch.",
    };
  }

  if (order.status !== "DRAFT") {
    return { status: "error" as const, message: "Only DRAFT orders can be confirmed." };
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
      data: { status: "CONFIRMED" },
    });

    for (const requirement of requirements) {
      await tx.locationStock.update({
        where: {
          locationId_productId: {
            locationId: requirement.locationId,
            productId: requirement.productId,
          },
        },
        data: {
          reservedQty: { increment: requirement.quantity },
        },
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.confirm",
        entity: "sales_order",
        entityId: orderId,
        details: {
          orderNumber: order.orderNumber,
          reservedLocations: locationIds,
          reservedItemCount: order.items.length,
        },
      },
      tx
    );
  });

  revalidateSalesOrderPaths({ orderId, locationIds });
  return { status: "success" as const, message: `Order ${order.orderNumber} confirmed.` };
}

async function runDeliverSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: `/dashboard/sales-orders/${orderId}`,
  });

  const order = await loadOrderForStatusAction(orderId);

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (isOutsideSalesStaffScope(order, activeLocationId)) {
    return {
      status: "error" as const,
      message: "You can only update orders for your selected branch.",
    };
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

    const uniqueStockPairs = Array.from(
      new Map(
        order.items.map((item) => [
          `${item.productId}:${item.locationId}`,
          {
            productId: item.productId,
            locationId: item.locationId,
          },
        ])
      ).values()
    );
    const stockRows = await tx.locationStock.findMany({
      where: {
        OR: uniqueStockPairs,
      },
      select: {
        productId: true,
        locationId: true,
        quantity: true,
      },
    });
    const onHandByKey = new Map(
      stockRows.map((row) => [`${row.productId}:${row.locationId}`, row.quantity])
    );

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
        data: {
          quantity: { decrement: item.quantity },
          reservedQty: { decrement: item.quantity },
        },
      });

      const key = `${item.productId}:${item.locationId}`;
      const previousOnHand = onHandByKey.get(key) ?? 0;
      const nextOnHand = previousOnHand - item.quantity;
      onHandByKey.set(key, nextOnHand);

      await syncLocationCostSnapshot(tx, {
        locationId: item.locationId,
        productId: item.productId,
        onHandQtySnapshot: nextOnHand,
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

async function runCompleteSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: `/dashboard/sales-orders/${orderId}`,
  });

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      items: {
        select: {
          locationId: true,
        },
      },
    },
  });

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (isOutsideSalesStaffScope(order, activeLocationId)) {
    return {
      status: "error" as const,
      message: "You can only update orders for your selected branch.",
    };
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

async function runCancelSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: `/dashboard/sales-orders/${orderId}`,
  });

  const order = await loadOrderForStatusAction(orderId);

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (isOutsideSalesStaffScope(order, activeLocationId)) {
    return {
      status: "error" as const,
      message: "You can only update orders for your selected branch.",
    };
  }

  if (order.status === "CANCELLED") {
    return { status: "error" as const, message: "This order is already cancelled." };
  }

  if (order.status === "DELIVERED" || order.status === "COMPLETED") {
    return {
      status: "error" as const,
      message:
        "Use Void Sale with return details for delivered or completed sales so stock and return documentation stay accurate.",
    };
  }

  const wasConfirmed = order.status === "CONFIRMED";
  const locationIds = wasConfirmed ? [...new Set(order.items.map((item) => item.locationId))] : [];

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });

    if (wasConfirmed) {
      const requirements = buildStockRequirements(order.items as OrderMutationItem[]);

      for (const req of requirements) {
        await tx.locationStock.update({
          where: {
            locationId_productId: {
              locationId: req.locationId,
              productId: req.productId,
            },
          },
          data: { reservedQty: { decrement: req.quantity } },
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
          reservationReleased: wasConfirmed,
        },
      },
      tx
    );
  });

  revalidateSalesOrderPaths({ orderId, locationIds });
  return { status: "success" as const, message: `Order ${order.orderNumber} cancelled.` };
}

async function runVoidSalesOrderAction(input: {
  orderId: string;
  voidReason: SalesOrderVoidReason;
  voidRemarks: string;
  voidDocumentation: string;
}) {
  const user = await requirePermission("sales_orders", "update");
  const activeLocationId = await requireSalesStaffActiveLocationId({
    user,
    returnTo: `/dashboard/sales-orders/${input.orderId}`,
  });

  const order = await loadOrderForStatusAction(input.orderId);

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (isOutsideSalesStaffScope(order, activeLocationId)) {
    return {
      status: "error" as const,
      message: "You can only update orders for your selected branch.",
    };
  }

  if (order.status === "CANCELLED") {
    return { status: "error" as const, message: "This order is already cancelled." };
  }

  if (order.status !== "DELIVERED" && order.status !== "COMPLETED") {
    return {
      status: "error" as const,
      message: "Only DELIVERED or COMPLETED sales can be voided with stock return.",
    };
  }

  const locationIds = [...new Set(order.items.map((item) => item.locationId))];
  const reasonLabel = formatSalesOrderVoidReason(input.voidReason);

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: input.orderId },
      data: {
        status: "CANCELLED",
        voidReason: input.voidReason,
        voidRemarks: input.voidRemarks,
        voidDocumentation: input.voidDocumentation,
        voidedAt: new Date(),
        voidedById: user.id,
      },
    });

    for (const item of order.items) {
      const stockBefore = await tx.locationStock.findUnique({
        where: {
          locationId_productId: {
            locationId: item.locationId,
            productId: item.productId,
          },
        },
        select: {
          quantity: true,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          type: "CUSTOMER_RETURN",
          productId: item.productId,
          locationId: item.locationId,
          quantityChange: item.quantity,
          referenceType: "sales_order",
          referenceId: input.orderId,
          notes: buildVoidReturnMovementNotes({
            orderNumber: order.orderNumber,
            reason: input.voidReason,
            remarks: input.voidRemarks,
            documentation: input.voidDocumentation,
          }),
          performedById: user.id,
        },
      });

      await tx.locationStock.upsert({
        where: {
          locationId_productId: {
            locationId: item.locationId,
            productId: item.productId,
          },
        },
        create: {
          locationId: item.locationId,
          productId: item.productId,
          quantity: item.quantity,
          reservedQty: 0,
        },
        update: {
          quantity: { increment: item.quantity },
        },
      });

      await applyInboundMovingAverage({
        tx,
        locationId: item.locationId,
        productId: item.productId,
        onHandBefore: stockBefore?.quantity ?? 0,
        inboundQty: item.quantity,
        inboundUnitCost: item.unitCostAtSale,
        performedById: user.id,
        sourceType: "customer_return",
        sourceId: input.orderId,
        reason: `Void sale return (${reasonLabel})`,
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.void",
        entity: "sales_order",
        entityId: input.orderId,
        details: {
          orderNumber: order.orderNumber,
          previousStatus: order.status,
          voidReason: input.voidReason,
          voidReasonLabel: reasonLabel,
          voidRemarks: input.voidRemarks,
          voidDocumentation: input.voidDocumentation,
          stockReturned: true,
        },
      },
      tx
    );
  });

  revalidateSalesOrderPaths({ orderId: input.orderId, locationIds });
  return {
    status: "success" as const,
    message: `Order ${order.orderNumber} voided. Stock restored to branch inventory.`,
  };
}

export async function confirmSalesOrderAction(
  _prevState: SalesOrderWorkflowActionState,
  formData: FormData
): Promise<SalesOrderWorkflowActionState> {
  const orderId = getWorkflowOrderId(formData);

  if (!orderId) {
    return {
      status: "error",
      message: "We could not identify this sales order. Refresh the page and try again.",
    };
  }

  return runConfirmSalesOrderAction(orderId);
}

export async function deliverSalesOrderAction(
  _prevState: SalesOrderWorkflowActionState,
  formData: FormData
): Promise<SalesOrderWorkflowActionState> {
  const orderId = getWorkflowOrderId(formData);

  if (!orderId) {
    return {
      status: "error",
      message: "We could not identify this sales order. Refresh the page and try again.",
    };
  }

  return runDeliverSalesOrderAction(orderId);
}

export async function completeSalesOrderAction(
  _prevState: SalesOrderWorkflowActionState,
  formData: FormData
): Promise<SalesOrderWorkflowActionState> {
  const orderId = getWorkflowOrderId(formData);

  if (!orderId) {
    return {
      status: "error",
      message: "We could not identify this sales order. Refresh the page and try again.",
    };
  }

  return runCompleteSalesOrderAction(orderId);
}

export async function cancelSalesOrderAction(
  _prevState: SalesOrderWorkflowActionState,
  formData: FormData
): Promise<SalesOrderWorkflowActionState> {
  const orderId = getWorkflowOrderId(formData);

  if (!orderId) {
    return {
      status: "error",
      message: "We could not identify this sales order. Refresh the page and try again.",
    };
  }

  return runCancelSalesOrderAction(orderId);
}

export async function voidSalesOrderWithReturnAction(
  _prevState: SalesOrderVoidFormState,
  formData: FormData
): Promise<SalesOrderVoidFormState> {
  const values = extractSalesOrderVoidFormValues(formData);
  const parsed = salesOrderVoidFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please complete the return details before voiding this sale.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const result = await runVoidSalesOrderAction(parsed.data);

  if (result.status === "error") {
    return {
      status: "error",
      message: result.message,
      values,
    };
  }

  return result;
}

// Backward-compatible alias for older UI components that still refer to "void" terminology.
export async function voidSalesOrderAction(
  prevState: SalesOrderWorkflowActionState,
  formData: FormData
): Promise<SalesOrderWorkflowActionState> {
  return cancelSalesOrderAction(prevState, formData);
}
