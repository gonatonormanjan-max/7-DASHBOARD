# CODEX Prompt — Purchase Orders, Sales Verification & Transfer UI

````
You are implementing 3 features in a Next.js 16.2.1 inventory management dashboard. The codebase uses App Router with server components, server actions, Prisma ORM, Zod validation, Tailwind CSS, and a consistent design system with rounded-[24px] cards and slate color palette.

CRITICAL: This is Next.js 16.2.1 — NOT standard Next.js. Before writing code:
- `searchParams` and `params` in page components are `Promise<...>` and must be awaited
- `Form` is imported from `next/form`
- `useActionState` is imported from `react` (not `react-dom`)
- Read `node_modules/next/dist/docs/01-app/` if unsure about any API

## Codebase Context

**Architecture pattern (follow exactly):**
- Validators: `lib/validators/{module}.ts` — Zod schemas, form state types, extract functions
- DAL: `lib/dal/{module}.ts` — `import "server-only"`, Prisma queries, filter builders
- Actions: `lib/actions/{module}.ts` — `"use server"`, permission checks via `requirePermission()`, Prisma transactions, `logAudit()`, `revalidatePath()`, `redirect()` with `withFlashMessage()`
- Pages: `app/dashboard/{module}/page.tsx` — server components, import DAL + PageHeader + StatCard + table pattern
- Components: `components/{module}/*.tsx` — client components use `useActionState` for form state

**Key imports and utilities:**
- `requirePermission(resource, action)` from `@/lib/dal/auth` — checks RBAC, redirects if denied
- `hasPermission(role, resource, action)` from `@/lib/permissions` — boolean check for conditional UI
- `logAudit({ userId, action, entity, entityId, details }, tx?)` from `@/lib/audit`
- `withFlashMessage(path, { success?, error? })` from `@/lib/flash-toast`
- `getPaginationMeta(page, pageSize, totalCount)` from `@/lib/pagination`
- `formatCurrency(value)` from `@/lib/products`
- `getAvailableQuantity(quantity, reservedQty)` from `@/lib/inventory`
- `prisma` from `@/lib/prisma`
- `cn()` from `@/lib/utils` (clsx + twMerge)

**UI components available:**
- `PageHeader` — props: `eyebrow?`, `title`, `description?`, `action?` (ReactNode)
- `StatCard` — props: `label`, `value`, `description?`, `tone?` ("default"|"primary"|"success"|"warning")
- `Button` — props: `variant?` ("default"|"outline"|"ghost"), `size?`, standard button props
- `SubmitButton` — wraps Button with `useFormStatus`, props: `pendingLabel?`, `disabled?`
- `DetailField` — props: `label`, `value`
- `Pagination` — props: `basePath`, `pagination`, `query`
- `StatusBadge` — generic status badge with auto-coloring

**Prisma schema (relevant models):**

```prisma
enum PurchaseOrderStatus { DRAFT, APPROVED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED }
enum SalesOrderStatus { DRAFT, CONFIRMED, DELIVERED, COMPLETED, CANCELLED }
enum MovementType { PURCHASE_RECEIVED, SALES_FULFILLED, MANUAL_ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN, CUSTOMER_RETURN, DAMAGED_LOST, INITIAL_STOCK }

model PurchaseOrder {
  id           String              @id @default(uuid())
  orderNumber  String              @unique
  supplierId   String
  status       PurchaseOrderStatus @default(DRAFT)
  totalAmount  Decimal             @db.Decimal(12, 2)
  expectedDate DateTime?
  notes        String?
  createdById  String
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
  supplier     Supplier            @relation(...)
  createdBy    User                @relation(...)
  items        PurchaseOrderItem[]
  @@index([status]) @@index([supplierId]) @@index([createdById])
}

model PurchaseOrderItem {
  id              String @id @default(uuid())
  purchaseOrderId String
  productId       String
  quantity        Int
  receivedQty     Int    @default(0)
  unitCost        Decimal @db.Decimal(12, 2)
  @@unique([purchaseOrderId, productId])
}

model LocationStock {
  id          String @id @default(uuid())
  locationId  String
  productId   String
  quantity    Int    @default(0)
  reservedQty Int    @default(0)
  @@unique([locationId, productId])
}

model SalesOrderItem {
  id           String @id @default(uuid())
  salesOrderId String
  productId    String
  locationId   String
  quantity     Int
  unitPrice    Decimal @db.Decimal(12, 2)
}
```

**Permission matrix:** `purchase_orders` resource exists with ALL_ACTIONS for ADMIN and SYSTEM_MANAGER. SALES_STAFF cannot access purchase orders.

## FEATURE 1: Purchase Orders (end-to-end)

Build the complete Purchase Order workflow. Create these files:

### File 1: `lib/purchase-orders.ts`
Status formatters and badge classes for PurchaseOrderStatus. Pattern: copy `lib/sales-orders.ts` structure.
- `formatPurchaseOrderStatus(status)` — returns human label
- `getPurchaseOrderStatusBadgeClass(status)` — returns Tailwind classes matching existing badge palette:
  - DRAFT: `border-slate-200 bg-slate-100 text-slate-600`
  - APPROVED: `border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]`
  - PARTIALLY_RECEIVED: `border-[#f2d2a2] bg-[#fff4e4] text-[#8a5610]`
  - RECEIVED: `border-[#c5e7db] bg-[#edf8f4] text-[#11664b]`
  - CANCELLED: `border-red-200 bg-red-50 text-destructive`
- `generatePurchaseOrderNumber()` — `PO-{timestamp_base36}-{random3digits}`

### File 2: `lib/validators/purchase-orders.ts`
Zod schemas and form helpers. Pattern: copy structure from `lib/validators/sales-orders.ts`.
- `purchaseOrderFormSchema` — supplierId (uuid), locationId (uuid), expectedDate (optional string→null), notes (optional max 500→null), items array of {productId, quantity (int min 1), unitCost (number min 0)}
- `purchaseOrderListQuerySchema` — query, status (all|DRAFT|APPROVED|PARTIALLY_RECEIVED|RECEIVED|CANCELLED), dateFrom, dateTo, merged with paginationQuerySchema
- `purchaseOrderReceiveSchema` — items array of {itemId (uuid), quantity (int min 0)}, notes (optional)
- Types: `PurchaseOrderFormData`, `PurchaseOrderListFilters`, `PurchaseOrderReceiveData`, `PurchaseOrderFormState`, `PurchaseOrderReceiveState`
- Initial states: `initialPurchaseOrderFormState`, `initialPurchaseOrderReceiveState`
- Parsers: `parsePurchaseOrderListFilters(searchParams)`, `extractPurchaseOrderFormValues(formData)`, `extractPurchaseOrderReceiveValues(formData)` — items use `items[N].itemId` / `items[N].quantity` pattern from `extractSupplierReceiptValues`

### File 3: `lib/dal/purchase-orders.ts`
DAL queries. Pattern: copy structure from `lib/dal/sales-orders.ts`.
- `getPurchaseOrderListData(filters)` — paginated list with summary counts by status. Query includes supplier.name for search. Select: id, orderNumber, status, totalAmount, expectedDate, createdAt, supplier{id,name}, createdBy{id,firstName,lastName}, _count{items}
- `getPurchaseOrderById(id)` — full detail with items including product{id,name,sku}, receivedQty, unitCost
- `getPurchaseOrderFormOptions()` — returns { suppliers (active), warehouses (active, type WAREHOUSE), products (ACTIVE/INACTIVE with costPrice), supplierProductLinks (supplierId, productId, costPrice) }

### File 4: `lib/actions/purchase-orders.ts`
Server actions. Pattern: copy structure from `lib/actions/sales-orders.ts`.

**createPurchaseOrderAction(prevState, formData):**
- Permission: `purchase_orders`, `create`
- Validate form, check supplier active, warehouse active+WAREHOUSE type, products exist
- Transaction: create PurchaseOrder (DRAFT), createMany PurchaseOrderItem, logAudit
- Retry loop for unique orderNumber (same P2002 pattern as sales)
- Redirect to `/dashboard/purchase-orders/{id}`
- NOTE: PurchaseOrder has no locationId column — the warehouse from form is informational only (stored in audit details)

**approvePurchaseOrderAction(orderId):**
- Permission: `purchase_orders`, `approve`
- Only DRAFT → APPROVED
- Transaction: update status, logAudit
- Returns `{ status, message }`

**cancelPurchaseOrderAction(orderId):**
- Permission: `purchase_orders`, `update`
- Cannot cancel RECEIVED or already CANCELLED
- Transaction: update status to CANCELLED, logAudit

**receivePurchaseOrderAction(orderId, prevState, formData):**
- Permission: `purchase_orders`, `receive`
- Only APPROVED or PARTIALLY_RECEIVED can receive
- Read `warehouseId` from formData, validate it's active WAREHOUSE
- For each item with quantity > 0: validate receive qty doesn't exceed (ordered - already received)
- Transaction per item: update PurchaseOrderItem.receivedQty, upsert LocationStock (increment quantity), create InventoryMovement (PURCHASE_RECEIVED, referenceType "purchase_order", referenceId order.id)
- After loop: check if all items fully received → RECEIVED, else if any received → PARTIALLY_RECEIVED
- logAudit, revalidate paths, redirect with flash

### File 5: `components/purchase-orders/po-status-badge.tsx`
Copy pattern from `components/sales-orders/sales-order-status-badge.tsx`. Use `formatPurchaseOrderStatus` and `getPurchaseOrderStatusBadgeClass`.

### File 6: `components/purchase-orders/po-workflow-actions.tsx`
Copy pattern from `components/sales-orders/sales-order-workflow-actions.tsx`.
- DRAFT + canApprove → Approve button (calls approvePurchaseOrderAction)
- APPROVED or PARTIALLY_RECEIVED + canUpdate → "Receive Stock" Link to `/dashboard/purchase-orders/{id}/receive`
- Not terminal + canUpdate → Cancel button (calls cancelPurchaseOrderAction, red outline style)

### File 7: `components/purchase-orders/po-form.tsx`
Client component for creating POs. Dynamic line items with supplier-filtered product list.
- State: selectedSupplierId controls which products show (filter via supplierProductLinks)
- When product selected, auto-fill unitCost from supplier's costPrice
- Items serialized as JSON in hidden `itemsPayload` field
- Fields: supplier dropdown, warehouse dropdown, expectedDate, notes, line items (product, qty, unitCost), add/remove item buttons
- Uses useActionState with `initialPurchaseOrderFormState`

### File 8: `components/purchase-orders/po-receive-form.tsx`
Client component for receiving stock against a PO.
- Shows table: Product, SKU, Ordered, Already Received, Remaining, Receive Now (number input)
- Warehouse selector dropdown
- Notes textarea
- Items use `items[N].itemId` and `items[N].quantity` naming for FormData
- Uses useActionState with `initialPurchaseOrderReceiveState`

### File 9: `app/dashboard/purchase-orders/page.tsx`
PO list page. Copy structure from `app/dashboard/sales-orders/page.tsx`.
- requirePermission("purchase_orders", "read")
- Parse filters, get list data
- PageHeader eyebrow="Procurement" title="Purchase Orders"
- 4 StatCards: Total, Draft, Approved, Received
- Filter form: search, status dropdown, dateFrom, dateTo
- Table: Order#(link), Supplier, Status(badge), Items, Total, Date
- Pagination component

### File 10: `app/dashboard/purchase-orders/new/page.tsx`
- requirePermission("purchase_orders", "create")
- Get form options, render PageHeader + PurchaseOrderForm

### File 11: `app/dashboard/purchase-orders/[id]/page.tsx`
PO detail page. Copy structure from `app/dashboard/sales-orders/[id]/page.tsx`.
- Two-column layout: main (status badge, detail fields, items table with Ordered/Received columns) + sidebar (workflow actions, timeline)
- Items table shows received progress: "X / Y" with "Complete" or "Partial" labels

### File 12: `app/dashboard/purchase-orders/[id]/receive/page.tsx`
- requirePermission("purchase_orders", "receive")
- Get order, redirect if not APPROVED/PARTIALLY_RECEIVED
- Get warehouses, bind orderId to action: `receivePurchaseOrderAction.bind(null, id)`
- Render PageHeader + PurchaseOrderReceiveForm

## FEATURE 2: Fix Sales Order Stock Reservation

Modify `lib/actions/sales-orders.ts` — 3 surgical changes:

### Change 1: `confirmSalesOrderAction` (currently lines ~575-611)
Replace the entire function. The new version:
- Uses `loadOrderForStatusAction` instead of simple findUnique (to get items)
- Checks stock availability via `findStockShortages` BEFORE confirming
- In the transaction: updates status to CONFIRMED AND increments `reservedQty` on LocationStock for each aggregated requirement
- Returns locationIds for revalidation

### Change 2: `deliverSalesOrderAction` (line ~658, the locationStock.update)
Change from `data: { quantity: { decrement: item.quantity } }` to:
```ts
data: {
  quantity: { decrement: item.quantity },
  reservedQty: { decrement: item.quantity },
}
```
This releases the reservation while deducting actual stock.

### Change 3: `cancelSalesOrderAction` (lines ~726-799)
After `const wasDelivered = order.status === "DELIVERED";` add `const wasConfirmed = order.status === "CONFIRMED";`
In the transaction, add a new block after the `if (wasDelivered)` block:
```ts
if (wasConfirmed) {
  const requirements = buildStockRequirements(order.items as OrderMutationItem[]);
  for (const req of requirements) {
    await tx.locationStock.update({
      where: { locationId_productId: { locationId: req.locationId, productId: req.productId } },
      data: { reservedQty: { decrement: req.quantity } },
    });
  }
}
```
Update locationIds: `const locationIds = wasDelivered || wasConfirmed ? [...new Set(order.items.map((item) => item.locationId))] : [];`

## FEATURE 3: Dedicated Stock Transfer Page

### File: `app/dashboard/inventory/transfer/page.tsx`
Wire existing components to a new route:
- requirePermission("inventory", "update")
- Query products (ACTIVE/INACTIVE) and locations (active)
- Render PageHeader eyebrow="Inventory" title="Stock Transfer" + InventoryTransferForm (from `@/components/inventory/inventory-transfer-form`)
- Wrap form in `<div className="max-w-2xl">` for layout

## Constraints
- Use `"use server"` directive at top of action files
- Use `import "server-only"` at top of DAL files  
- All pages are server components (async functions, no "use client")
- Form components are client components ("use client" + useActionState)
- Follow existing Tailwind classes exactly — rounded-2xl for inputs, rounded-[24px] for cards, rounded-[20px] for inner tables
- Shadow: `shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]`
- All dates use `toLocaleDateString("en-PH", { dateStyle: "medium" })`
- Currency uses `formatCurrency()` from `@/lib/products`
- Every mutation must be wrapped in `prisma.$transaction`
- Every mutation must call `logAudit()` inside the transaction
- Every redirect after mutation uses `withFlashMessage()`
- Commit after each logical unit of work
````
