# Purchase Orders, Sales Order Verification & Stock Transfer UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Purchase Order workflow (create, approve, receive with stock inflow), verify and fix the sales order stock deduction/reservation logic, and create a dedicated stock transfer page.

**Architecture:** Three independent subsystems built on the existing DAL + server actions + App Router page pattern. PO is the largest piece (new DAL, validators, actions, and 4 pages). Sales verification audits existing `confirmSalesOrderAction`/`deliverSalesOrderAction`/`cancelSalesOrderAction` for correct stock reservation and release. Transfer UI is a new page wiring the existing `transferInventoryAction` to a dedicated route.

**Tech Stack:** Next.js 16.2.1 App Router (server components + server actions), Prisma ORM, Zod validation, `useActionState` for form state, Sonner toasts via flash params, Tailwind CSS with the project's rounded-[24px] card design system.

**IMPORTANT:** Before writing ANY Next.js code, read `node_modules/next/dist/docs/` for the correct App Router APIs. This is Next.js 16.2.1 with breaking changes from training data.

---

## File Structure

### New Files

```
lib/purchase-orders.ts                          — PO status labels, badge classes, formatters
lib/validators/purchase-orders.ts               — Zod schemas, form state types, extractors
lib/dal/purchase-orders.ts                      — DAL queries (list, detail, form options)
lib/actions/purchase-orders.ts                  — Server actions (create, approve, receive, cancel)
components/purchase-orders/po-status-badge.tsx  — PO status badge component
components/purchase-orders/po-form.tsx          — Create PO client form
components/purchase-orders/po-receive-form.tsx  — Receive items client form
components/purchase-orders/po-workflow-actions.tsx — Approve/Cancel action buttons
app/dashboard/purchase-orders/page.tsx          — PO list page
app/dashboard/purchase-orders/new/page.tsx      — Create PO page
app/dashboard/purchase-orders/[id]/page.tsx     — PO detail page
app/dashboard/purchase-orders/[id]/receive/page.tsx — Receive against PO page
app/dashboard/inventory/transfer/page.tsx       — Dedicated transfer page
```

### Modified Files

```
lib/actions/sales-orders.ts:575-611   — confirmSalesOrderAction: add stock reservation
lib/actions/sales-orders.ts:613-686   — deliverSalesOrderAction: use reserved qty instead of available
lib/actions/sales-orders.ts:726-799   — cancelSalesOrderAction: release reserved qty on cancel from CONFIRMED
```

---

## Part A: Purchase Orders

### Task 1: PO Utility Module

**Files:**
- Create: `lib/purchase-orders.ts`

- [ ] **Step 1: Create the PO utility module**

```ts
import type { PurchaseOrderStatus } from "@prisma/client";

export function formatPurchaseOrderStatus(status: PurchaseOrderStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "APPROVED":
      return "Approved";
    case "PARTIALLY_RECEIVED":
      return "Partially Received";
    case "RECEIVED":
      return "Received";
    case "CANCELLED":
      return "Cancelled";
  }
}

export function getPurchaseOrderStatusBadgeClass(status: PurchaseOrderStatus) {
  switch (status) {
    case "DRAFT":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "APPROVED":
      return "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]";
    case "PARTIALLY_RECEIVED":
      return "border-[#f2d2a2] bg-[#fff4e4] text-[#8a5610]";
    case "RECEIVED":
      return "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]";
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-destructive";
  }
}

export function generatePurchaseOrderNumber() {
  return `PO-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/purchase-orders.ts
git commit -m "feat(po): add purchase order utility module with status formatters"
```

---

### Task 2: PO Validators

**Files:**
- Create: `lib/validators/purchase-orders.ts`

- [ ] **Step 1: Create the PO validators module**

This follows the exact pattern from `lib/validators/sales-orders.ts` and `lib/validators/inventory.ts`.

```ts
import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeDateFilter(value: string | undefined) {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => normalizeDateFilter(value));

const purchaseOrderItemSchema = z.object({
  productId: z.string().uuid("Select a valid product."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unitCost: z.coerce.number().min(0, "Unit cost cannot be negative."),
});

export const purchaseOrderFormSchema = z.object({
  supplierId: z.string().uuid("Select a valid supplier."),
  locationId: z.string().uuid("Select a valid warehouse."),
  expectedDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  items: z.array(purchaseOrderItemSchema).min(1, "Add at least one item."),
});

export const purchaseOrderListQuerySchema = z
  .object({
    query: z.string().trim().max(150).optional().default(""),
    status: z
      .enum(["all", "DRAFT", "APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"])
      .optional()
      .catch("all")
      .default("all"),
    dateFrom: optionalDateSchema,
    dateTo: optionalDateSchema,
  })
  .merge(paginationQuerySchema);

export const purchaseOrderReceiveItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative."),
});

export const purchaseOrderReceiveSchema = z.object({
  items: z.array(purchaseOrderReceiveItemSchema).min(1, "Include at least one item."),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer.")
    .optional()
    .transform((value) => value || null),
});

export type PurchaseOrderFormData = z.output<typeof purchaseOrderFormSchema>;
export type PurchaseOrderListFilters = z.output<typeof purchaseOrderListQuerySchema>;
export type PurchaseOrderReceiveData = z.output<typeof purchaseOrderReceiveSchema>;

export type PurchaseOrderFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  itemErrors?: Array<string | undefined>;
  values?: Record<string, string>;
};

export type PurchaseOrderReceiveState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialPurchaseOrderFormState: PurchaseOrderFormState = {
  status: "idle",
};

export const initialPurchaseOrderReceiveState: PurchaseOrderReceiveState = {
  status: "idle",
};

export function parsePurchaseOrderListFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  const parsed = purchaseOrderListQuerySchema.parse({
    query: firstString(searchParams.query),
    status: firstString(searchParams.status),
    dateFrom: firstString(searchParams.dateFrom),
    dateTo: firstString(searchParams.dateTo),
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });

  if (parsed.dateFrom && parsed.dateTo && parsed.dateFrom > parsed.dateTo) {
    return { ...parsed, dateFrom: parsed.dateTo, dateTo: parsed.dateFrom };
  }

  return parsed;
}

export function extractPurchaseOrderFormValues(formData: FormData) {
  const itemsPayload = String(formData.get("itemsPayload") ?? "");
  let items: unknown = [];

  try {
    items = itemsPayload.trim() ? JSON.parse(itemsPayload) : [];
  } catch {
    items = null;
  }

  return {
    supplierId: String(formData.get("supplierId") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
    expectedDate: String(formData.get("expectedDate") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    itemsPayload,
    items,
  };
}

export function extractPurchaseOrderReceiveValues(formData: FormData) {
  const itemIndexes = new Set<number>();

  for (const [key] of formData.entries()) {
    const match = /^items\[(\d+)\]\.(itemId|quantity)$/.exec(key);
    if (match) itemIndexes.add(Number.parseInt(match[1], 10));
  }

  const items = [...itemIndexes]
    .sort((a, b) => a - b)
    .map((index) => ({
      itemId: String(formData.get(`items[${index}].itemId`) ?? ""),
      quantity: String(formData.get(`items[${index}].quantity`) ?? ""),
    }));

  return {
    items,
    notes: String(formData.get("notes") ?? ""),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/validators/purchase-orders.ts
git commit -m "feat(po): add Zod validators and form state types for purchase orders"
```

---

### Task 3: PO DAL

**Files:**
- Create: `lib/dal/purchase-orders.ts`

- [ ] **Step 1: Create the PO DAL module**

Follows the same pattern as `lib/dal/sales-orders.ts`:

```ts
import "server-only";

import { Prisma } from "@prisma/client";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  getPaginationMeta,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { PurchaseOrderListFilters } from "@/lib/validators/purchase-orders";

type PurchaseOrderDataFilters = Partial<PurchaseOrderListFilters>;

function normalizeFilters(filters: PurchaseOrderDataFilters) {
  return {
    query: filters.query ?? "",
    status: filters.status ?? "all",
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    page: filters.page ?? DEFAULT_PAGE,
    pageSize: filters.pageSize ?? DEFAULT_PAGE_SIZE,
  };
}

function buildPurchaseOrderWhere(
  filters: PurchaseOrderDataFilters,
  options: { ignoreStatus?: boolean } = {}
): Prisma.PurchaseOrderWhereInput {
  const normalized = normalizeFilters(filters);
  const clauses: Prisma.PurchaseOrderWhereInput[] = [];

  if (!options.ignoreStatus && normalized.status !== "all") {
    clauses.push({ status: normalized.status as any });
  }

  if (normalized.dateFrom || normalized.dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (normalized.dateFrom) createdAt.gte = new Date(`${normalized.dateFrom}T00:00:00`);
    if (normalized.dateTo) {
      const endOfDay = new Date(`${normalized.dateTo}T00:00:00`);
      endOfDay.setDate(endOfDay.getDate() + 1);
      createdAt.lt = endOfDay;
    }
    clauses.push({ createdAt });
  }

  if (normalized.query.trim()) {
    const query = normalized.query.trim();
    clauses.push({
      OR: [
        { orderNumber: { contains: query, mode: "insensitive" } },
        { supplier: { name: { contains: query, mode: "insensitive" } } },
      ],
    });
  }

  return clauses.length === 0
    ? {}
    : clauses.length === 1
      ? clauses[0]
      : { AND: clauses };
}

export async function getPurchaseOrderListData(filters: PurchaseOrderDataFilters) {
  const normalized = normalizeFilters(filters);
  const where = buildPurchaseOrderWhere(normalized);
  const summaryWhere = buildPurchaseOrderWhere(normalized, { ignoreStatus: true });
  const totalCount = await prisma.purchaseOrder.count({ where });
  const pagination = getPaginationMeta(
    normalized.page,
    normalized.pageSize,
    totalCount
  );

  const [orders, groupedSummary] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        expectedDate: true,
        createdAt: true,
        supplier: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchaseOrder.groupBy({
      by: ["status"],
      where: summaryWhere,
      _count: { _all: true },
    }),
  ]);

  return {
    orders,
    pagination,
    summary: {
      total: groupedSummary.reduce((sum, g) => sum + g._count._all, 0),
      draft: groupedSummary.find((g) => g.status === "DRAFT")?._count._all ?? 0,
      approved: groupedSummary.find((g) => g.status === "APPROVED")?._count._all ?? 0,
      partiallyReceived: groupedSummary.find((g) => g.status === "PARTIALLY_RECEIVED")?._count._all ?? 0,
      received: groupedSummary.find((g) => g.status === "RECEIVED")?._count._all ?? 0,
      cancelled: groupedSummary.find((g) => g.status === "CANCELLED")?._count._all ?? 0,
    },
  };
}

export async function getPurchaseOrderById(id: string) {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      expectedDate: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      supplier: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      items: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          quantity: true,
          receivedQty: true,
          unitCost: true,
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      },
    },
  });

  return order ?? null;
}

export async function getPurchaseOrderFormOptions() {
  const [suppliers, warehouses, products, supplierProductLinks] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.stockLocation.findMany({
      where: { isActive: true, type: "WAREHOUSE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.product.findMany({
      where: { status: { in: ["ACTIVE", "INACTIVE"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, costPrice: true },
    }),
    prisma.productSupplier.findMany({
      select: { supplierId: true, productId: true, costPrice: true },
    }),
  ]);

  return { suppliers, warehouses, products, supplierProductLinks };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/dal/purchase-orders.ts
git commit -m "feat(po): add DAL queries for purchase order list, detail, and form options"
```

---

### Task 4: PO Server Actions

**Files:**
- Create: `lib/actions/purchase-orders.ts`

- [ ] **Step 1: Create the PO server actions module**

This is the most critical file. It implements 4 actions: create, approve, receive, cancel.

```ts
"use server";

import { Prisma, LocationType, ProductStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import { generatePurchaseOrderNumber } from "@/lib/purchase-orders";
import { prisma } from "@/lib/prisma";
import {
  extractPurchaseOrderFormValues,
  extractPurchaseOrderReceiveValues,
  purchaseOrderFormSchema,
  purchaseOrderReceiveSchema,
  type PurchaseOrderFormState,
  type PurchaseOrderReceiveState,
  initialPurchaseOrderFormState,
  initialPurchaseOrderReceiveState,
} from "@/lib/validators/purchase-orders";

function revalidatePurchaseOrderPaths(options: { orderId?: string } = {}) {
  const paths = new Set<string>([
    "/dashboard",
    "/dashboard/purchase-orders",
    "/dashboard/inventory",
  ]);

  if (options.orderId) {
    paths.add(`/dashboard/purchase-orders/${options.orderId}`);
    paths.add(`/dashboard/purchase-orders/${options.orderId}/receive`);
  }

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function createPurchaseOrderAction(
  _prevState: PurchaseOrderFormState,
  formData: FormData
): Promise<PurchaseOrderFormState> {
  const user = await requirePermission("purchase_orders", "create");
  const values = extractPurchaseOrderFormValues(formData);
  const fieldValues = {
    supplierId: values.supplierId,
    locationId: values.locationId,
    expectedDate: values.expectedDate,
    notes: values.notes,
    itemsPayload: values.itemsPayload,
  };

  if (values.items === null) {
    return {
      status: "error",
      message: "Could not read the line items. Please try again.",
      fieldErrors: { items: ["Could not read the line items."] },
      values: fieldValues,
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
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    return {
      status: "error",
      message: "Please fix the purchase order details.",
      fieldErrors,
      values: fieldValues,
    };
  }

  const [supplier, warehouse, products] = await Promise.all([
    prisma.supplier.findFirst({
      where: { id: parsed.data.supplierId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.stockLocation.findFirst({
      where: { id: parsed.data.locationId, isActive: true, type: LocationType.WAREHOUSE },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: {
        id: { in: [...new Set(parsed.data.items.map((i) => i.productId))] },
        status: { in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] },
      },
      select: { id: true, name: true, sku: true },
    }),
  ]);

  if (!supplier) {
    return { status: "error", message: "Select an active supplier.", values: fieldValues };
  }

  if (!warehouse) {
    return { status: "error", message: "Select an active warehouse.", values: fieldValues };
  }

  const productsById = new Map(products.map((p) => [p.id, p]));

  if (products.length !== new Set(parsed.data.items.map((i) => i.productId)).size) {
    return {
      status: "error",
      message: "One or more selected products are no longer available.",
      values: fieldValues,
    };
  }

  const totalAmount = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );

  // Retry loop for unique order number (same pattern as sales orders)
  let order: { id: string; orderNumber: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      order = await prisma.$transaction(async (tx) => {
        const created = await tx.purchaseOrder.create({
          data: {
            orderNumber: generatePurchaseOrderNumber(),
            supplierId: supplier.id,
            status: "DRAFT",
            totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
            expectedDate: parsed.data.expectedDate ? new Date(parsed.data.expectedDate) : null,
            notes: parsed.data.notes,
            createdById: user.id,
          },
          select: { id: true, orderNumber: true },
        });

        await tx.purchaseOrderItem.createMany({
          data: parsed.data.items.map((item) => ({
            purchaseOrderId: created.id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: new Prisma.Decimal(item.unitCost.toFixed(2)),
          })),
        });

        await logAudit(
          {
            userId: user.id,
            action: "purchase_order.create",
            entity: "purchase_order",
            entityId: created.id,
            details: {
              orderNumber: created.orderNumber,
              supplierId: supplier.id,
              supplierName: supplier.name,
              warehouseId: warehouse.id,
              warehouseName: warehouse.name,
              itemCount: parsed.data.items.length,
              totalAmount: totalAmount.toFixed(2),
            },
          },
          tx
        );

        return created;
      });

      break;
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

  if (!order) {
    throw new Error("Could not generate a unique purchase order number. Please try again.");
  }

  revalidatePurchaseOrderPaths({ orderId: order.id });
  redirect(`/dashboard/purchase-orders/${order.id}`);
}

export async function approvePurchaseOrderAction(orderId: string) {
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
        details: { orderNumber: order.orderNumber },
      },
      tx
    );
  });

  revalidatePurchaseOrderPaths({ orderId });
  return { status: "success" as const, message: `Order ${order.orderNumber} approved.` };
}

export async function cancelPurchaseOrderAction(orderId: string) {
  const user = await requirePermission("purchase_orders", "update");

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true },
  });

  if (!order) {
    return { status: "error" as const, message: "Purchase order not found." };
  }

  if (order.status === "RECEIVED" || order.status === "CANCELLED") {
    return {
      status: "error" as const,
      message: `Cannot cancel a ${order.status.toLowerCase().replace("_", " ")} order.`,
    };
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
        details: { orderNumber: order.orderNumber, previousStatus: order.status },
      },
      tx
    );
  });

  revalidatePurchaseOrderPaths({ orderId });
  return { status: "success" as const, message: `Order ${order.orderNumber} cancelled.` };
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
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    return {
      ...initialPurchaseOrderReceiveState,
      status: "error",
      message: "Please fix the receive details.",
      fieldErrors,
    };
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      supplierId: true,
      supplier: { select: { name: true } },
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          receivedQty: true,
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });

  if (!order) {
    return { status: "error", message: "Purchase order not found." };
  }

  if (order.status !== "APPROVED" && order.status !== "PARTIALLY_RECEIVED") {
    return { status: "error", message: "Only approved or partially received orders can receive stock." };
  }

  // NOTE: PurchaseOrder does not have a locationId field directly.
  // We need the user to specify which warehouse is receiving.
  // For simplicity, we read it from formData.
  const warehouseId = String(formData.get("warehouseId") ?? "");

  if (!warehouseId) {
    return { status: "error", message: "Select a warehouse to receive into." };
  }

  const warehouse = await prisma.stockLocation.findFirst({
    where: { id: warehouseId, isActive: true, type: LocationType.WAREHOUSE },
    select: { id: true, name: true },
  });

  if (!warehouse) {
    return { status: "error", message: "Select a valid active warehouse." };
  }

  const itemsById = new Map(order.items.map((item) => [item.id, item]));
  const receiveItems = parsed.data.items.filter((ri) => ri.quantity > 0);

  if (receiveItems.length === 0) {
    return { status: "error", message: "Enter a quantity for at least one item." };
  }

  // Validate that receive quantities don't exceed remaining
  for (const ri of receiveItems) {
    const orderItem = itemsById.get(ri.itemId);
    if (!orderItem) {
      return { status: "error", message: "One or more items do not belong to this order." };
    }

    const remaining = orderItem.quantity - orderItem.receivedQty;
    if (ri.quantity > remaining) {
      return {
        status: "error",
        message: `${orderItem.product.name} (${orderItem.product.sku}): receiving ${ri.quantity} exceeds remaining ${remaining}.`,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const ri of receiveItems) {
      const orderItem = itemsById.get(ri.itemId)!;

      await tx.purchaseOrderItem.update({
        where: { id: ri.itemId },
        data: { receivedQty: { increment: ri.quantity } },
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
          quantity: ri.quantity,
        },
        update: {
          quantity: { increment: ri.quantity },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          type: "PURCHASE_RECEIVED",
          productId: orderItem.productId,
          locationId: warehouse.id,
          quantityChange: ri.quantity,
          referenceType: "purchase_order",
          referenceId: order.id,
          notes: `Received against PO ${order.orderNumber}`,
          performedById: user.id,
        },
      });
    }

    // Determine new PO status
    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: order.id },
      select: { quantity: true, receivedQty: true },
    });

    const allReceived = updatedItems.every((item) => item.receivedQty >= item.quantity);
    const someReceived = updatedItems.some((item) => item.receivedQty > 0);
    const newStatus = allReceived ? "RECEIVED" : someReceived ? "PARTIALLY_RECEIVED" : order.status;

    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: newStatus },
    });

    const totalReceived = receiveItems.reduce((sum, ri) => sum + ri.quantity, 0);

    await logAudit(
      {
        userId: user.id,
        action: "purchase_order.receive",
        entity: "purchase_order",
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          totalReceived,
          newStatus,
          items: receiveItems.map((ri) => {
            const oi = itemsById.get(ri.itemId)!;
            return {
              productId: oi.productId,
              productName: oi.product.name,
              sku: oi.product.sku,
              quantityReceived: ri.quantity,
            };
          }),
        },
      },
      tx
    );
  });

  revalidatePurchaseOrderPaths({ orderId: order.id });
  revalidatePath(`/dashboard/inventory/${warehouse.id}`);
  redirect(
    withFlashMessage(`/dashboard/purchase-orders/${order.id}`, {
      success: `Stock received against ${order.orderNumber}.`,
    })
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/purchase-orders.ts
git commit -m "feat(po): add server actions for create, approve, receive, and cancel"
```

---

### Task 5: PO Status Badge Component

**Files:**
- Create: `components/purchase-orders/po-status-badge.tsx`

- [ ] **Step 1: Create the PO status badge**

Same pattern as `components/sales-orders/sales-order-status-badge.tsx`:

```tsx
import type { PurchaseOrderStatus } from "@prisma/client";
import {
  formatPurchaseOrderStatus,
  getPurchaseOrderStatusBadgeClass,
} from "@/lib/purchase-orders";
import { cn } from "@/lib/utils";

export function PurchaseOrderStatusBadge({
  status,
}: {
  status: PurchaseOrderStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        getPurchaseOrderStatusBadgeClass(status)
      )}
    >
      {formatPurchaseOrderStatus(status)}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/purchase-orders/po-status-badge.tsx
git commit -m "feat(po): add PurchaseOrderStatusBadge component"
```

---

### Task 6: PO Workflow Actions Component

**Files:**
- Create: `components/purchase-orders/po-workflow-actions.tsx`

- [ ] **Step 1: Create workflow actions for PO detail page**

Same pattern as `components/sales-orders/sales-order-workflow-actions.tsx`:

```tsx
"use client";

import {
  approvePurchaseOrderAction,
  cancelPurchaseOrderAction,
} from "@/lib/actions/purchase-orders";
import { SubmitButton } from "@/components/ui/submit-button";
import type { PurchaseOrderStatus } from "@prisma/client";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type WorkflowState = {
  status: "idle" | "error";
  message?: string;
};

const initialWorkflowState: WorkflowState = { status: "idle" };

function WorkflowActionForm({
  action,
  orderId,
  label,
  pendingLabel,
  variant = "default",
  className,
}: {
  action: (state: WorkflowState, formData: FormData) => Promise<WorkflowState>;
  orderId: string;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialWorkflowState);

  return (
    <form action={formAction} className="space-y-2">
      <input name="orderId" type="hidden" value={orderId} />
      <SubmitButton className={className} pendingLabel={pendingLabel} variant={variant}>
        {label}
      </SubmitButton>
      {state.message ? (
        <p className="max-w-md whitespace-pre-line text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function PurchaseOrderWorkflowActions({
  orderId,
  status,
  canApprove,
  canUpdate,
}: {
  orderId: string;
  status: PurchaseOrderStatus;
  canApprove: boolean;
  canUpdate: boolean;
}) {
  if (status === "RECEIVED" || status === "CANCELLED") {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {status === "DRAFT" && canApprove ? (
        <WorkflowActionForm
          action={approvePurchaseOrderAction}
          label="Approve"
          orderId={orderId}
          pendingLabel="Approving..."
        />
      ) : null}

      {(status === "APPROVED" || status === "PARTIALLY_RECEIVED") && canUpdate ? (
        <Link href={`/dashboard/purchase-orders/${orderId}/receive`}>
          <Button>Receive Stock</Button>
        </Link>
      ) : null}

      {status !== "RECEIVED" && status !== "CANCELLED" && canUpdate ? (
        <WorkflowActionForm
          action={cancelPurchaseOrderAction}
          className="border-[#f3c7c7] text-[#9f2121] hover:border-[#e39a9a] hover:bg-[#fff1f1]"
          label="Cancel"
          orderId={orderId}
          pendingLabel="Cancelling..."
          variant="outline"
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/purchase-orders/po-workflow-actions.tsx
git commit -m "feat(po): add PO workflow actions component (approve, receive link, cancel)"
```

---

### Task 7: PO Create Form Component

**Files:**
- Create: `components/purchase-orders/po-form.tsx`

- [ ] **Step 1: Create the PO create form**

This is a client component with a dynamic line-items builder, following the sales order form pattern but for PO items (product, qty, unit cost).

```tsx
"use client";

import { useActionState, useState, useCallback } from "react";
import {
  initialPurchaseOrderFormState,
  type PurchaseOrderFormState,
} from "@/lib/validators/purchase-orders";
import { SubmitButton } from "@/components/ui/submit-button";

type POFormProduct = { id: string; name: string; sku: string; costPrice: { toString(): string } };
type POFormSupplier = { id: string; name: string };
type POFormWarehouse = { id: string; name: string; code: string };
type SupplierProductLink = { supplierId: string; productId: string; costPrice: { toString(): string } };

type LineItem = {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
};

type PurchaseOrderFormProps = {
  action: (state: PurchaseOrderFormState, formData: FormData) => Promise<PurchaseOrderFormState>;
  suppliers: POFormSupplier[];
  warehouses: POFormWarehouse[];
  products: POFormProduct[];
  supplierProductLinks: SupplierProductLink[];
};

function generateKey() {
  return Math.random().toString(36).slice(2, 9);
}

export function PurchaseOrderForm({
  action,
  suppliers,
  warehouses,
  products,
  supplierProductLinks,
}: PurchaseOrderFormProps) {
  const [state, formAction] = useActionState(action, initialPurchaseOrderFormState);
  const [selectedSupplierId, setSelectedSupplierId] = useState(state.values?.supplierId ?? "");
  const [items, setItems] = useState<LineItem[]>([{ key: generateKey(), productId: "", quantity: "", unitCost: "" }]);

  const supplierProductIds = new Set(
    supplierProductLinks
      .filter((link) => link.supplierId === selectedSupplierId)
      .map((link) => link.productId)
  );

  const filteredProducts = selectedSupplierId
    ? products.filter((p) => supplierProductIds.has(p.id))
    : products;

  const supplierCostMap = new Map(
    supplierProductLinks
      .filter((link) => link.supplierId === selectedSupplierId)
      .map((link) => [link.productId, link.costPrice.toString()])
  );

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { key: generateKey(), productId: "", quantity: "", unitCost: "" }]);
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.key !== key) : prev));
  }, []);

  const updateItem = useCallback((key: string, field: keyof LineItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const updated = { ...item, [field]: value };
        if (field === "productId" && value) {
          const cost = supplierCostMap.get(value);
          if (cost) updated.unitCost = cost;
        }
        return updated;
      })
    );
  }, [supplierCostMap]);

  const itemsPayload = JSON.stringify(
    items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitCost: item.unitCost,
    }))
  );

  return (
    <form
      action={formAction}
      className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]"
    >
      <input name="itemsPayload" type="hidden" value={itemsPayload} />

      <div>
        <h2 className="text-lg font-semibold text-slate-950">Purchase Order Details</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Select a supplier, choose the receiving warehouse, and add products with quantities and costs.
        </p>
      </div>

      {state.message ? (
        <div className="mt-4 rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Supplier</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              name="supplierId"
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
            >
              <option value="">Select a supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {state.fieldErrors?.supplierId ? (
              <p className="text-sm text-destructive">{state.fieldErrors.supplierId[0]}</p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Receiving Warehouse</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={state.values?.locationId ?? ""}
              name="locationId"
            >
              <option value="">Select a warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
            {state.fieldErrors?.locationId ? (
              <p className="text-sm text-destructive">{state.fieldErrors.locationId[0]}</p>
            ) : null}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Expected Date</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={state.values?.expectedDate ?? ""}
              name="expectedDate"
              type="date"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={state.values?.notes ?? ""}
              name="notes"
              placeholder="Optional notes"
            />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Line Items</h3>
            <button
              className="text-sm font-semibold text-primary hover:underline"
              onClick={addItem}
              type="button"
            >
              + Add item
            </button>
          </div>

          {items.map((item, index) => (
            <div key={item.key} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[1fr_100px_120px_auto]">
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                value={item.productId}
                onChange={(e) => updateItem(item.key, "productId", e.target.value)}
              >
                <option value="">Select product</option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>

              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                min={1}
                placeholder="Qty"
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(item.key, "quantity", e.target.value)}
              />

              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                min={0}
                placeholder="Unit cost"
                step="0.01"
                type="number"
                value={item.unitCost}
                onChange={(e) => updateItem(item.key, "unitCost", e.target.value)}
              />

              <button
                className="self-center text-sm text-slate-400 hover:text-destructive"
                onClick={() => removeItem(item.key)}
                type="button"
              >
                Remove
              </button>
            </div>
          ))}

          {state.fieldErrors?.items ? (
            <p className="text-sm text-destructive">{state.fieldErrors.items[0]}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <SubmitButton pendingLabel="Creating...">Create Purchase Order</SubmitButton>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/purchase-orders/po-form.tsx
git commit -m "feat(po): add PO create form with dynamic line items and supplier filtering"
```

---

### Task 8: PO Receive Form Component

**Files:**
- Create: `components/purchase-orders/po-receive-form.tsx`

- [ ] **Step 1: Create the receive form**

```tsx
"use client";

import { useActionState } from "react";
import {
  initialPurchaseOrderReceiveState,
  type PurchaseOrderReceiveState,
} from "@/lib/validators/purchase-orders";
import { SubmitButton } from "@/components/ui/submit-button";

type ReceiveFormItem = {
  id: string;
  quantity: number;
  receivedQty: number;
  product: { id: string; name: string; sku: string };
};

type ReceiveFormWarehouse = { id: string; name: string; code: string };

type PurchaseOrderReceiveFormProps = {
  action: (state: PurchaseOrderReceiveState, formData: FormData) => Promise<PurchaseOrderReceiveState>;
  items: ReceiveFormItem[];
  warehouses: ReceiveFormWarehouse[];
  orderNumber: string;
};

export function PurchaseOrderReceiveForm({
  action,
  items,
  warehouses,
  orderNumber,
}: PurchaseOrderReceiveFormProps) {
  const [state, formAction] = useActionState(action, initialPurchaseOrderReceiveState);

  return (
    <form
      action={formAction}
      className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Receive Stock for {orderNumber}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Enter the quantity received for each line item. Leave at 0 for items not yet delivered.
        </p>
      </div>

      {state.message ? (
        <div className="mt-4 rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Receiving Warehouse</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            name="warehouseId"
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
            ))}
          </select>
        </label>

        <div className="overflow-hidden rounded-[20px] border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Ordered</th>
                <th className="px-4 py-3">Already Received</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Receive Now</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((item, index) => {
                const remaining = item.quantity - item.receivedQty;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {item.product.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.product.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.receivedQty}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{remaining}</td>
                    <td className="px-4 py-3">
                      <input name={`items[${index}].itemId`} type="hidden" value={item.id} />
                      <input
                        className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
                        defaultValue={0}
                        max={remaining}
                        min={0}
                        name={`items[${index}].quantity`}
                        type="number"
                        disabled={remaining === 0}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea
            className="min-h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            name="notes"
            placeholder="Optional receiving notes"
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <SubmitButton pendingLabel="Receiving...">Record Receipt</SubmitButton>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/purchase-orders/po-receive-form.tsx
git commit -m "feat(po): add PO receive form with line-item quantity inputs"
```

---

### Task 9: PO List Page

**Files:**
- Create: `app/dashboard/purchase-orders/page.tsx`

- [ ] **Step 1: Create the PO list page**

Follows the exact pattern of `app/dashboard/sales-orders/page.tsx`:

```tsx
import Form from "next/form";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getPurchaseOrderListData } from "@/lib/dal/purchase-orders";
import { parsePurchaseOrderListFilters } from "@/lib/validators/purchase-orders";
import { formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { PurchaseOrderStatusBadge } from "@/components/purchase-orders/po-status-badge";

type PurchaseOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PurchaseOrdersPage({ searchParams }: PurchaseOrdersPageProps) {
  const user = await requirePermission("purchase_orders", "read");
  const filters = parsePurchaseOrderListFilters(await searchParams);
  const { orders, pagination, summary } = await getPurchaseOrderListData(filters);
  const canCreate = hasPermission(user.role, "purchase_orders", "create");
  const hasFilters = Boolean(filters.query || filters.status !== "all" || filters.dateFrom || filters.dateTo);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title="Purchase Orders"
        description="Create and manage purchase orders to bring stock into the system through approved supplier workflows."
        action={
          canCreate ? (
            <Link href="/dashboard/purchase-orders/new">
              <Button>New Purchase Order</Button>
            </Link>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard description="Total orders matching current filters." label="Total" tone="primary" value={String(summary.total)} />
        <StatCard description="Draft orders awaiting approval." label="Draft" value={String(summary.draft)} />
        <StatCard description="Approved orders ready to receive." label="Approved" tone="warning" value={String(summary.approved)} />
        <StatCard description="Fully received orders." label="Received" tone="success" value={String(summary.received)} />
      </section>

      <section className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Find purchase orders</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by order number or supplier name, filter by status, and narrow by date range.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Showing {pagination.from}-{pagination.to} of {pagination.totalCount} orders
          </p>
        </div>

        <Form
          action="/dashboard/purchase-orders"
          className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_220px_repeat(2,190px)_auto]"
        >
          <input name="page" type="hidden" value="1" />
          <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={filters.query}
              name="query"
              placeholder="Order number or supplier"
              type="search"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={filters.status}
              name="status"
            >
              <option value="all">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date from</span>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]" defaultValue={filters.dateFrom ?? ""} name="dateFrom" type="date" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date to</span>
            <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]" defaultValue={filters.dateTo ?? ""} name="dateTo" type="date" />
          </label>

          <div className="flex items-end gap-2">
            <Button className="flex-1" type="submit">Filter</Button>
            {hasFilters ? (
              <Link href="/dashboard/purchase-orders">
                <Button type="button" variant="outline">Clear</Button>
              </Link>
            ) : null}
          </div>
        </Form>

        <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {orders.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>No purchase orders found.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link className="text-sm font-semibold text-primary hover:underline" href={`/dashboard/purchase-orders/${order.id}`}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{order.supplier.name}</td>
                    <td className="px-4 py-3"><PurchaseOrderStatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{order._count.items}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatCurrency(order.totalAmount.toString())}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{order.createdAt.toLocaleDateString("en-PH", { dateStyle: "medium" })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Pagination basePath="/dashboard/purchase-orders" pagination={pagination} query={filters} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/purchase-orders/page.tsx
git commit -m "feat(po): add purchase orders list page with filters and summary stats"
```

---

### Task 10: PO Create Page

**Files:**
- Create: `app/dashboard/purchase-orders/new/page.tsx`

- [ ] **Step 1: Create the new PO page**

```tsx
import { createPurchaseOrderAction } from "@/lib/actions/purchase-orders";
import { requirePermission } from "@/lib/dal/auth";
import { getPurchaseOrderFormOptions } from "@/lib/dal/purchase-orders";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseOrderForm } from "@/components/purchase-orders/po-form";

export default async function NewPurchaseOrderPage() {
  await requirePermission("purchase_orders", "create");
  const { suppliers, warehouses, products, supplierProductLinks } =
    await getPurchaseOrderFormOptions();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title="New Purchase Order"
        description="Draft a purchase order for a supplier. Once approved, use it to receive stock into a warehouse."
      />

      <PurchaseOrderForm
        action={createPurchaseOrderAction}
        products={products}
        supplierProductLinks={supplierProductLinks}
        suppliers={suppliers}
        warehouses={warehouses}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/purchase-orders/new/page.tsx
git commit -m "feat(po): add new purchase order page"
```

---

### Task 11: PO Detail Page

**Files:**
- Create: `app/dashboard/purchase-orders/[id]/page.tsx`

- [ ] **Step 1: Create the PO detail page**

Follows `app/dashboard/sales-orders/[id]/page.tsx` pattern:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getPurchaseOrderById } from "@/lib/dal/purchase-orders";
import { formatCurrency } from "@/lib/products";
import { formatPurchaseOrderStatus } from "@/lib/purchase-orders";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/components/ui/detail-field";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseOrderStatusBadge } from "@/components/purchase-orders/po-status-badge";
import { PurchaseOrderWorkflowActions } from "@/components/purchase-orders/po-workflow-actions";

type PurchaseOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const user = await requirePermission("purchase_orders", "read");
  const { id } = await params;
  const order = await getPurchaseOrderById(id);
  const canApprove = hasPermission(user.role, "purchase_orders", "approve");
  const canUpdate = hasPermission(user.role, "purchase_orders", "update");

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title={order.orderNumber}
        description="Review supplier, line items, receiving progress, and available workflow actions for this purchase order."
        action={
          <Link href="/dashboard/purchase-orders">
            <Button variant="outline">Back to Purchase Orders</Button>
          </Link>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
          <div className="flex flex-wrap items-center gap-3">
            <PurchaseOrderStatusBadge status={order.status} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {order.items.length} item{order.items.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Supplier" value={order.supplier.name} />
            <DetailField label="Total amount" value={formatCurrency(order.totalAmount.toString())} />
            <DetailField label="Expected date" value={order.expectedDate ? order.expectedDate.toLocaleDateString("en-PH", { dateStyle: "medium" }) : "Not set"} />
            <DetailField label="Created by" value={`${order.createdBy.firstName} ${order.createdBy.lastName}`} />
            <DetailField label="Notes" value={order.notes?.trim() ? order.notes : "No additional notes."} />
          </div>

          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Ordered</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{item.product.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.product.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {item.receivedQty} / {item.quantity}
                      {item.receivedQty >= item.quantity ? (
                        <span className="ml-2 text-xs text-[#11664b]">Complete</span>
                      ) : item.receivedQty > 0 ? (
                        <span className="ml-2 text-xs text-[#8a5610]">Partial</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(item.unitCost.toString())}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(item.unitCost.mul(item.quantity).toString())}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/70">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900" colSpan={5}>Total</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatCurrency(order.totalAmount.toString())}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Workflow actions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Approve this PO to unlock receiving, or cancel if no longer needed.
            </p>
            <div className="mt-4">
              <PurchaseOrderWorkflowActions
                canApprove={canApprove}
                canUpdate={canUpdate}
                orderId={order.id}
                status={order.status}
              />
            </div>
            {order.status === "RECEIVED" || order.status === "CANCELLED" ? (
              <p className="mt-3 text-sm text-slate-500">
                This order is in a terminal state.
              </p>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Order timeline</h2>
            <div className="mt-4 space-y-4">
              <DetailField label="Created" value={order.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} />
              <DetailField label="Last updated" value={order.updatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} />
            </div>
          </div>

          <div className="pt-2">
            <Link href="/dashboard/purchase-orders">
              <Button type="button" variant="ghost" className="w-full">
                Back to Purchase Orders
              </Button>
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/purchase-orders/[id]/page.tsx
git commit -m "feat(po): add purchase order detail page with items table and workflow"
```

---

### Task 12: PO Receive Page

**Files:**
- Create: `app/dashboard/purchase-orders/[id]/receive/page.tsx`

- [ ] **Step 1: Create the PO receive page**

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/dal/auth";
import { getPurchaseOrderById } from "@/lib/dal/purchase-orders";
import { receivePurchaseOrderAction } from "@/lib/actions/purchase-orders";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseOrderReceiveForm } from "@/components/purchase-orders/po-receive-form";

type ReceivePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseOrderReceivePage({ params }: ReceivePageProps) {
  await requirePermission("purchase_orders", "receive");
  const { id } = await params;
  const order = await getPurchaseOrderById(id);

  if (!order) {
    notFound();
  }

  if (order.status !== "APPROVED" && order.status !== "PARTIALLY_RECEIVED") {
    redirect(`/dashboard/purchase-orders/${id}`);
  }

  const warehouses = await prisma.stockLocation.findMany({
    where: { isActive: true, type: "WAREHOUSE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  const boundAction = receivePurchaseOrderAction.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Procurement"
        title={`Receive: ${order.orderNumber}`}
        description="Record the quantities received from the supplier into a warehouse."
        action={
          <Link href={`/dashboard/purchase-orders/${id}`}>
            <Button variant="outline">Back to Order</Button>
          </Link>
        }
      />

      <PurchaseOrderReceiveForm
        action={boundAction}
        items={order.items}
        orderNumber={order.orderNumber}
        warehouses={warehouses}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/purchase-orders/[id]/receive/page.tsx
git commit -m "feat(po): add PO receive page for recording stock into warehouse"
```

---

## Part B: Sales Order Stock Verification & Fix

### Task 13: Fix confirmSalesOrderAction — Add Stock Reservation

**Files:**
- Modify: `lib/actions/sales-orders.ts:575-611`

The current `confirmSalesOrderAction` transitions DRAFT → CONFIRMED but does NOT reserve stock. When a sales order is confirmed, reserved quantities on `LocationStock` should be incremented so other actions see the correct available quantity.

- [ ] **Step 1: Read and verify the current confirm action**

Run: Read `lib/actions/sales-orders.ts` lines 575-611.

Current behavior: updates status to CONFIRMED + audit log. No stock reservation. This means two confirmed orders could "double-book" the same stock.

- [ ] **Step 2: Modify confirmSalesOrderAction to reserve stock**

Replace the existing `confirmSalesOrderAction` function with:

```ts
export async function confirmSalesOrderAction(orderId: string) {
  const user = await requirePermission("sales_orders", "update");

  const order = await loadOrderForStatusAction(orderId);

  if (!order) {
    return { status: "error" as const, message: "Sales order not found." };
  }

  if (order.status !== "DRAFT") {
    return { status: "error" as const, message: "Only DRAFT orders can be confirmed." };
  }

  // Check stock availability before confirming
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

    // Reserve stock for each line item
    for (const req of requirements) {
      await tx.locationStock.update({
        where: {
          locationId_productId: {
            locationId: req.locationId,
            productId: req.productId,
          },
        },
        data: { reservedQty: { increment: req.quantity } },
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: "sales_order.confirm",
        entity: "sales_order",
        entityId: orderId,
        details: { orderNumber: order.orderNumber, stockReserved: true },
      },
      tx
    );
  });

  revalidateSalesOrderPaths({ orderId, locationIds });
  return { status: "success" as const, message: `Order ${order.orderNumber} confirmed.` };
}
```

- [ ] **Step 3: Modify deliverSalesOrderAction to release reservation while deducting**

In `deliverSalesOrderAction`, the existing code at `lib/actions/sales-orders.ts:644-666` decrements `quantity` on delivery. It should ALSO decrement `reservedQty` since the reservation is being fulfilled.

Change the `locationStock.update` inside the for-loop from:

```ts
data: { quantity: { decrement: item.quantity } },
```

to:

```ts
data: {
  quantity: { decrement: item.quantity },
  reservedQty: { decrement: item.quantity },
},
```

- [ ] **Step 4: Modify cancelSalesOrderAction to release reservation on CONFIRMED cancel**

In `cancelSalesOrderAction`, when cancelling from CONFIRMED status, the reserved stock must be released. The current code only handles `wasDelivered` (stock return). Add handling for `wasConfirmed`.

After the line `const wasDelivered = order.status === "DELIVERED";` add:

```ts
const wasConfirmed = order.status === "CONFIRMED";
```

And in the transaction, after the `if (wasDelivered)` block, add:

```ts
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
```

Also update `locationIds` to include locations for confirmed cancellations:

```ts
const locationIds = wasDelivered || wasConfirmed
  ? [...new Set(order.items.map((item) => item.locationId))]
  : [];
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/sales-orders.ts
git commit -m "fix(sales): add stock reservation on confirm, release on cancel, decrement on deliver"
```

---

## Part C: Dedicated Stock Transfer Page

### Task 14: Transfer Page

**Files:**
- Create: `app/dashboard/inventory/transfer/page.tsx`

The transfer form (`InventoryTransferForm`) and action (`transferInventoryAction`) already exist. This task is purely wiring them to a dedicated page route.

- [ ] **Step 1: Create the dedicated transfer page**

```tsx
import { transferInventoryAction } from "@/lib/actions/inventory";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import { ProductStatus } from "@prisma/client";
import { InventoryTransferForm } from "@/components/inventory/inventory-transfer-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function TransferInventoryPage() {
  await requirePermission("inventory", "update");

  const [products, locations] = await Promise.all([
    prisma.product.findMany({
      where: { status: { in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
    prisma.stockLocation.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory"
        title="Stock Transfer"
        description="Move available stock between any two active locations — warehouse to branch, branch to branch, or warehouse to warehouse."
      />

      <div className="max-w-2xl">
        <InventoryTransferForm
          action={transferInventoryAction}
          locations={locations}
          products={products}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/inventory/transfer/page.tsx
git commit -m "feat(inventory): add dedicated stock transfer page"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - Purchase Orders: create (Task 10), approve (Task 6/11), receive with stock inflow (Task 12/4), cancel (Task 6/4), list (Task 9), detail (Task 11) -- all covered.
   - Sales order verification: reservation on confirm, release on cancel-from-confirmed, decrement reservedQty on deliver -- covered in Task 13.
   - Transfer UI: dedicated route using existing action and form -- covered in Task 14.

2. **Placeholder scan:** All code blocks are complete. No TBD, TODO, or "fill in" references.

3. **Type consistency:** `PurchaseOrderFormState`, `PurchaseOrderReceiveState` match across validators, actions, and components. `WorkflowState` pattern matches sales order precedent. `receivePurchaseOrderAction` uses `.bind(null, orderId)` for the 3-arg action pattern.

4. **PO schema note:** The `PurchaseOrder` model has no `locationId` field. The warehouse for receiving is selected at receive time (not at PO creation). This is intentional and more flexible -- a PO can be received at different warehouses for partial shipments. The `locationId` on the create form is stored only in audit detail for reference, not on the PO record itself. **Actually, looking again -- we DO pass `locationId` in the create form but the PO model doesn't store it. Let me fix this:** The create form includes a warehouse selector for UX context, but we should NOT try to store it on PurchaseOrder since the schema has no such field. The `locationId` in the form is informational and stored in the audit log. The actual warehouse is chosen when receiving. This is correct as designed.

5. **Permission matrix verified:** `purchase_orders` already exists in `lib/permissions.ts` with `ALL_ACTIONS` for ADMIN and SYSTEM_MANAGER, and NOT available for SALES_STAFF. The `approve` and `receive` actions are part of `ALL_ACTIONS`. No permission changes needed.

---

## IMPORTANT: Next.js Version Check

Before implementing ANY page or component, the executing agent MUST:
1. Read `node_modules/next/dist/docs/01-app/` index to check for breaking changes
2. Verify that `searchParams` is `Promise<...>` (confirmed in existing pages)
3. Verify that `params` is `Promise<...>` (confirmed in existing pages)
4. Verify `Form` import from `next/form` (confirmed in existing pages)
5. Check if `useActionState` is still from `react` (confirmed in existing components)
