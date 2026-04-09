# CODEX EXECUTION PROMPTS — PHASES 2–7

> Phase 1 (schema migration + cleanup) is already applied.
> The Prisma schema now has: `Brand`, `ProductSupplier` junction, `INITIAL_STOCK` movement type.
> All supplierId references replaced with brandId throughout the codebase.
> Run `npx prisma migrate dev` + `npx prisma generate` before starting any prompt below.

---

## PROMPT 2 — Brand CRUD Module

```
You are working on a Next.js 16 App Router inventory system.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.
Architecture pattern: DAL in lib/dal/, Server Actions in lib/actions/, Zod validators in lib/validators/.
Read node_modules/next/dist/docs/ for any Next.js API you are unsure about.

CONTEXT:
Phase 1 already added the Brand model to the Prisma schema. The schema is:
  model Brand {
    id          String    @id @default(cuid())
    name        String    @unique
    description String?
    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt
    products    Product[]
  }

Products already have brandId (optional FK). Product form already shows a Brand select.
The lib/dal/products.ts already calls prisma.brand.findMany() for form options and list filters.

TASK — build the Brand CRUD module with these files:

1. lib/validators/brands.ts
   - brandFormSchema: { name: z.string().min(1).max(100), description: z.string().max(500).optional() }
   - brandListQuerySchema: { query?: string, page?, pageSize? }
   - parseBrandListFilters(searchParams) → BrandListFilters
   - extractBrandFormValues(formData) → BrandFormValues

2. lib/dal/brands.ts (server-only)
   - getBrandListData(filters): returns { brands (with product count), pagination, summary: { total, withProducts, empty } }
   - getBrandById(id): returns brand with product count and product list (id, name, sku, status)
   - getBrandFormOptions(): returns {} (no external relations needed)

3. lib/actions/brands.ts (server-only)
   - createBrandAction(prevState, formData): validates with brandFormSchema, checks name uniqueness, creates brand, redirects to /dashboard/brands/{id} with flash
   - updateBrandAction(prevState, formData): same shape, checks name uniqueness excluding self, updates, redirects with flash
   - deleteBrandAction(prevState, formData): receives brandId, checks if any products linked, refuses deletion if products exist (return error), else deletes and redirects to /dashboard/brands

4. app/dashboard/brands/page.tsx
   - requirePermission("categories", "read") — brands share the categories permission resource
   - StatCards: Total brands, With products, Empty brands
   - BrandFilters component (search input + Apply/Clear)
   - BrandsTable component: name, description, product count, created date, Edit link (if canManage)
   - Link to /dashboard/brands/new if canCreate

5. app/dashboard/brands/new/page.tsx
   - requirePermission("categories", "create")
   - BrandForm with action=createBrandAction

6. app/dashboard/brands/[id]/page.tsx
   - requirePermission("categories", "read")
   - Brand detail: name, description, dates
   - Table of linked products (name, SKU, status, link to product detail)
   - Edit button if canManage

7. app/dashboard/brands/[id]/edit/page.tsx
   - requirePermission("categories", "update")
   - BrandForm with action=updateBrandAction, prefilled values

8. components/brands/brand-form.tsx
   - Fields: name (required), description (optional textarea)
   - Uses useActionState, pending state, field-level errors
   - Cancel button links back to referrer or /dashboard/brands

DESIGN RULES:
- Match existing UI: rounded-[24px] cards, border border-white/70 bg-white/85, shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]
- Table header: text-xs font-semibold uppercase tracking-[0.2em] text-slate-500
- All rounded inputs use: rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm
- Primary button: rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-[#16304f]
- PageHeader component already exists at components/ui/page-header.tsx
- StatCard component already exists at components/ui/stat-card.tsx
- Flash messages use withFlashMessage() wrapper from lib/flash.ts
- Audit logging: call logAudit() inside createBrand/updateBrand/deleteBrand transactions

PERMISSION:
- Brands share the "categories" resource in lib/permissions.ts
- Do NOT add a new PermissionResource — reuse "categories"

NAV:
- Add a "Brands" nav item to NAV_ITEMS in lib/permissions.ts under the Operations section
- href: "/dashboard/brands", resource: "categories", action: "read"
- Use icon: "layers" (already in NavIcon type)

OUTPUT: All files above, complete, no placeholders.
```

---

## PROMPT 3 — Locations Module (Enhanced)

```
You are working on a Next.js 16 App Router inventory system.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.
Architecture: DAL in lib/dal/, Server Actions in lib/actions/, Zod validators in lib/validators/.

CONTEXT:
The StockLocation model already exists:
  model StockLocation {
    id         String        @id @default(cuid())
    name       String        @unique
    code       String        @unique
    type       LocationType  (WAREHOUSE | BRANCH)
    isActive   Boolean       @default(true)
    address    String?
    createdAt  DateTime
    updatedAt  DateTime
    stock      LocationStock[]
    movements  InventoryMovement[]
  }
  enum LocationType { WAREHOUSE, BRANCH }

The Locations module already has basic pages. The task is to REPLACE them with a fully working CRUD module.

TASK:

1. lib/validators/locations.ts
   - locationFormSchema: { name: z.string().min(1).max(100), code: z.string().min(1).max(20).toUpperCase(), type: z.enum(["WAREHOUSE","BRANCH"]), address: z.string().max(300).optional() }
   - locationListQuerySchema: { query?, type?, isActive?, page?, pageSize? }
   - parseLocationListFilters(searchParams) → LocationListFilters
   - extractLocationFormValues(formData) → LocationFormValues

2. lib/dal/locations.ts (server-only)
   - getLocationListData(filters): returns { locations (with stock row count), pagination, summary: { total, warehouses, branches, active, inactive } }
   - getLocationById(id): returns location with stock summary (SKU count, total on-hand units)
   - getLocationFormOptions(): returns {} (no external relations needed)

3. lib/actions/locations.ts (server-only)
   - createLocationAction(prevState, formData): validate, check name+code uniqueness, create, redirect to /dashboard/locations/{id} with flash
   - updateLocationAction(prevState, formData): validate, check uniqueness excluding self, update, redirect with flash
   - toggleLocationActiveAction(prevState, formData): receives locationId + newIsActive (boolean), prevents deactivating a location that has stock with quantity > 0 (return error if so), else updates isActive, redirects with flash
   - NOTE: No hard delete. Locations are deactivated only.

4. app/dashboard/locations/page.tsx
   - requirePermission("locations", "read")
   - StatCards: Total locations, Warehouses, Branches, Active/Inactive ratio
   - LocationFilters: search, type filter (All / Warehouse / Branch), status filter (All / Active / Inactive)
   - LocationsTable: name, code, type badge (WAREHOUSE = blue, BRANCH = purple), active badge, stock rows count, actions (Edit, Deactivate/Activate toggle) if canManage
   - Create button if canCreate

5. app/dashboard/locations/new/page.tsx
   - requirePermission("locations", "create")
   - LocationForm with action=createLocationAction

6. app/dashboard/locations/[id]/page.tsx
   - requirePermission("locations", "read")
   - Location detail: name, code, type, address, status, dates
   - StatCards: SKUs with stock, total on-hand units
   - Top 10 stock rows table (product name, SKU, on-hand, reserved, available)
   - Edit button if canManage

7. app/dashboard/locations/[id]/edit/page.tsx
   - requirePermission("locations", "update")
   - LocationForm with action=updateLocationAction, prefilled

8. components/locations/location-form.tsx
   - Fields: name (required), code (required, auto-uppercases), type select (Warehouse / Branch), address (optional)
   - Uses useActionState, pending, field-level errors

DESIGN RULES: Same as existing system (rounded-[24px] cards, etc).
Flash + audit logging on all mutations.

CONSTRAINT: Location type (WAREHOUSE vs BRANCH) cannot be changed after creation. If editing, type field is displayed as read-only text, not a select.

OUTPUT: All files above, complete, no placeholders.
```

---

## PROMPT 4 — Inventory Overhaul (INITIAL_STOCK + Transfer Validation)

```
You are working on a Next.js 16 App Router inventory system.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.
Architecture: DAL in lib/dal/, Server Actions in lib/actions/, lib/inventory.ts for types/helpers.

CONTEXT — Movement cascade rules (STRICT — never violate):
  PURCHASE_RECEIVED  : Supplier → Warehouse  (stock increases at warehouse)
  TRANSFER_OUT       : Any location → Any location (stock decreases at source)
  TRANSFER_IN        : Paired with TRANSFER_OUT (stock increases at destination, same transferGroupId UUID)
  SALES_FULFILLED    : Branch → Customer (stock decreases at branch)
  CUSTOMER_RETURN    : Customer → Branch (stock increases at branch)
  MANUAL_ADJUSTMENT  : Corrections only — any location, quantity can be positive or negative
  DAMAGED_LOST       : Negative-only adjustment at any location
  INITIAL_STOCK      : Opening stock load only — any location, must be positive quantity

The Prisma schema already has INITIAL_STOCK in the MovementType enum (applied in Phase 1 migration).
lib/inventory.ts already has INITIAL_STOCK in INVENTORY_MOVEMENT_TYPES and MOVEMENT_TYPE_LABELS.

The LocationStock model tracks live stock:
  model LocationStock {
    id          String   @id @default(cuid())
    locationId  String
    productId   String
    quantity    Int      @default(0)
    reservedQty Int      @default(0)
    createdAt   DateTime
    updatedAt   DateTime
    @@unique([locationId, productId])
  }

Existing server actions for inventory are in lib/actions/inventory.ts.
Existing inventory page is at app/dashboard/inventory/page.tsx.

TASK 1 — Fix transfer action (lib/actions/inventory.ts):
The existing transferInventoryAction must:
  a) Accept: productId, fromLocationId, toLocationId, quantity (positive Int), notes?
  b) Validate: fromLocation and toLocation must both be isActive=true
  c) Validate: fromLocation must have sufficient available quantity (quantity - reservedQty >= transfer quantity)
  d) In a single Prisma transaction:
     - Generate a transferGroupId = crypto.randomUUID()
     - Create InventoryMovement { type: TRANSFER_OUT, quantityChange: -quantity, locationId: fromLocationId, transferGroupId, ... }
     - Create InventoryMovement { type: TRANSFER_IN, quantityChange: +quantity, locationId: toLocationId, transferGroupId, ... }
     - Decrement LocationStock.quantity at fromLocation (upsert: if row doesn't exist, that's an error — do not create it)
     - Increment LocationStock.quantity at toLocation (upsert: if row doesn't exist, create it with quantity = transfer amount)
  e) Redirect with flash on success, return field errors on validation failure

TASK 2 — Fix adjustment action (lib/actions/inventory.ts):
The existing adjustInventoryAction must:
  a) Accept: productId, locationId, quantityChange (positive or negative Int, not zero), reason (MovementType enum: MANUAL_ADJUSTMENT | DAMAGED_LOST | PURCHASE_RECEIVED), notes?
  b) Validate: location must be isActive=true
  c) For DAMAGED_LOST: quantityChange must be negative
  d) For PURCHASE_RECEIVED: quantityChange must be positive, locationId must reference a WAREHOUSE
  e) In a transaction:
     - Create InventoryMovement with the correct type
     - Upsert LocationStock (create if not exists, increment/decrement quantity)
     - Ensure resulting quantity never goes below 0 (throw error if it would)
  f) Redirect with flash on success

TASK 3 — Build Initial Stock Load tool:
New file: app/dashboard/inventory/initial-stock/page.tsx
  - requirePermission("inventory", "update")
  - Show a warning banner: "Use this only for opening stock migration. Do not use for regular stock changes."
  - Form fields: product (searchable select), location (select, all active locations), quantity (positive Int), notes (optional)
  - On submit: creates LocationStock row (upsert) and InventoryMovement { type: INITIAL_STOCK }
  - If LocationStock already has quantity > 0 for that product+location combination, REJECT with error: "Stock already exists for this product at this location. Use Manual Adjustment instead."
  - Link to this page from the main Inventory page (small "Load opening stock" link, visible to ADMIN and SYSTEM_MANAGER only)

New server action: initialStockAction in lib/actions/inventory.ts
New form component: components/inventory/initial-stock-form.tsx

DESIGN: Match existing inventory form style (InventoryAdjustmentForm pattern).
Flash + audit logging on all mutations.

OUTPUT: Updated lib/actions/inventory.ts, new page, new form component. Complete, no placeholders.
```

---

## PROMPT 5 — Sales Orders Full Flow

```
You are working on a Next.js 16 App Router inventory system.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.

CONTEXT — SalesOrder schema:
  model SalesOrder {
    id              String           @id @default(cuid())
    orderNumber     String           @unique
    status          SalesOrderStatus
    locationId      String
    location        StockLocation    @relation(...)
    createdById     String
    createdBy       User             @relation(...)
    notes           String?
    totalAmount     Decimal
    createdAt       DateTime
    updatedAt       DateTime
    items           SalesOrderItem[]
  }

  model SalesOrderItem {
    id          String     @id @default(cuid())
    orderId     String
    productId   String
    quantity    Int
    unitPrice   Decimal
    subtotal    Decimal
    product     Product    @relation(...)
    order       SalesOrder @relation(...)
  }

  enum SalesOrderStatus { DRAFT | CONFIRMED | DELIVERED | CANCELLED }

MOVEMENT RULE: Stock is decremented (SALES_FULFILLED) only when order moves to DELIVERED — not on CONFIRMED.
On CANCELLED from DELIVERED: stock is restored via CUSTOMER_RETURN movement.

TASK:

1. lib/validators/sales-orders.ts
   - salesOrderFormSchema: { locationId, items: [{ productId, quantity, unitPrice }], notes? }
   - salesOrderListQuerySchema: { query?, status?, locationId?, dateFrom?, dateTo?, page?, pageSize? }
   - parseSalesOrderListFilters(searchParams) → SalesOrderListFilters

2. lib/dal/sales-orders.ts (server-only)
   - getSalesOrderListData(filters): returns paginated orders with location, createdBy, item count, total
   - getSalesOrderById(id): returns full order with all items (product name, sku, qty, unitPrice, subtotal)
   - getSalesOrderFormOptions(): returns { products (ACTIVE only, with unitPrice), locations (BRANCH type, isActive only) }
   NOTE: Sales orders can only be created against BRANCH locations (not WAREHOUSE)

3. lib/actions/sales-orders.ts (server-only)
   - createSalesOrderAction: creates order in DRAFT status with items. Does NOT touch inventory.
   - confirmSalesOrderAction(orderId): DRAFT → CONFIRMED. Validates each item has sufficient available stock at the order's location. Does NOT decrement stock yet.
   - deliverSalesOrderAction(orderId): CONFIRMED → DELIVERED. In a transaction: for each item, create InventoryMovement (SALES_FULFILLED, negative quantityChange), decrement LocationStock.quantity, decrement LocationStock.reservedQty by the same amount. If any product is out of stock at this point, reject the entire transaction.
   - cancelSalesOrderAction(orderId): Any non-DELIVERED status → CANCELLED. If cancelling from DELIVERED: restore stock via CUSTOMER_RETURN movements (positive). If cancelling from CONFIRMED: release reservedQty. If from DRAFT: nothing to undo.

4. app/dashboard/sales-orders/page.tsx
   - requirePermission("sales_orders", "read")
   - StatCards: Total orders, Draft, Confirmed, Delivered
   - Filters: query, status, location, date range
   - SalesOrdersTable: order number, location, status badge, item count, total, created by, date, View link
   - Create button if canCreate

5. app/dashboard/sales-orders/new/page.tsx
   - requirePermission("sales_orders", "create")
   - SalesOrderForm: select location (BRANCH only), dynamic line items (add/remove rows: product select + quantity + unit price auto-filled from product.unitPrice but editable), notes, running total
   - Uses client component (useState) for dynamic line items — wrap in "use client"
   - Submit creates DRAFT order

6. app/dashboard/sales-orders/[id]/page.tsx
   - requirePermission("sales_orders", "read")
   - Full order detail with items table
   - Status workflow buttons: Confirm (DRAFT→CONFIRMED), Deliver (CONFIRMED→DELIVERED), Cancel (DRAFT/CONFIRMED/DELIVERED→CANCELLED)
   - Each button is a form using the relevant server action
   - Show stock availability warning if any item is below required quantity (on CONFIRMED status view)

DESIGN: Match existing system style.
Flash + audit logging on all status transitions.

OUTPUT: All files above, complete, no placeholders.
```

---

## PROMPT 6 — Suppliers Module

```
You are working on a Next.js 16 App Router inventory system.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.

CONTEXT:
After Phase 1, the Supplier model now connects to products via the ProductSupplier junction:

  model Supplier {
    id           String           @id @default(cuid())
    name         String           @unique
    code         String           @unique
    email        String?
    phone        String?
    address      String?
    isActive     Boolean          @default(true)
    createdAt    DateTime
    updatedAt    DateTime
    productLinks ProductSupplier[]
  }

  model ProductSupplier {
    id           String   @id @default(cuid())
    productId    String
    supplierId   String
    isPrimary    Boolean  @default(false)
    costPrice    Decimal
    leadTimeDays Int?
    notes        String?
    createdAt    DateTime
    updatedAt    DateTime
    product      Product  @relation(...)
    supplier     Supplier @relation(...)
    @@unique([productId, supplierId])
  }

TASK:

1. lib/validators/suppliers.ts
   - supplierFormSchema: { name, code (auto-uppercase), email?, phone?, address? }
   - supplierListQuerySchema: { query?, isActive?, page?, pageSize? }

2. lib/dal/suppliers.ts (server-only)
   - getSupplierListData(filters): suppliers with product link count, pagination, summary
   - getSupplierById(id): supplier with all productLinks (product name, sku, isPrimary, costPrice, leadTimeDays)
   - getSupplierFormOptions(): {}

3. lib/actions/suppliers.ts (server-only)
   - createSupplierAction: validate, check name+code uniqueness, create, redirect with flash
   - updateSupplierAction: same but excludes self from uniqueness check
   - toggleSupplierActiveAction: deactivate/reactivate — NO hard delete
   - NOTE: A supplier with active product links cannot be deactivated (return error if productLinks exist)

4. app/dashboard/suppliers/page.tsx
   - requirePermission("suppliers", "read")
   - StatCards: Total, Active, Inactive, Products linked
   - Filters: search, active/inactive toggle
   - SuppliersTable: name, code, email, product link count, status badge, actions

5. app/dashboard/suppliers/new/page.tsx + /[id]/page.tsx + /[id]/edit/page.tsx
   - Standard CRUD pages matching existing module pattern

6. components/suppliers/supplier-form.tsx
   - Fields: name (required), code (required, auto-uppercase), email (optional), phone (optional), address (optional textarea)

DESIGN: Match existing system style.
Flash + audit logging on all mutations.

OUTPUT: All files above, complete, no placeholders.
```

---

## PROMPT 7 — Dashboard Live KPIs

```
You are working on a Next.js 16 App Router inventory system.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.

CONTEXT:
app/dashboard/page.tsx currently has a TODO comment:
  {/* TODO: Replace these two with real live KPIs from getDashboardData() */}
The two placeholder StatCards show "Record Sale" and "View Inventory" as quick-action tiles.

The dashboard page is a Server Component at app/dashboard/page.tsx.
The user object has: user.role (ADMIN | SYSTEM_MANAGER | SALES_STAFF), user.locationId (optional).

TASK:

1. lib/dal/dashboard.ts (server-only)
   - getDashboardData(userId: string, role: Role): returns KPI object

   For ADMIN and SYSTEM_MANAGER:
   - totalOrdersToday: count of SalesOrders created today (any status)
   - ordersAwaitingDelivery: count of SalesOrders with status CONFIRMED
   - lowStockAlerts: count of LocationStock rows where (quantity - reservedQty) <= product.reorderLevel AND product.reorderLevel > 0
   - totalOnHandUnits: sum of LocationStock.quantity across all active locations

   For SALES_STAFF:
   - myOrdersToday: count of SalesOrders created today where createdById = userId
   - myDraftOrders: count of SalesOrders with status DRAFT where createdById = userId
   - lowStockAtMyLocation: if user has a locationId, count low-stock rows at that location; else 0
   - totalOnHandAtMyLocation: if user has a locationId, sum of quantity at that location; else 0

2. Update app/dashboard/page.tsx:
   - Call getDashboardData(user.id, user.role) and replace the two placeholder StatCars with real data
   - For ADMIN/SYSTEM_MANAGER show: "Orders today", "Awaiting delivery", "Low-stock alerts", "On-hand units" (4 cards total, replacing the 2 placeholder cards while keeping the first 2 cards that show role info)
   - Wait — the existing layout has 4 StatCards. Replace only the last 2 (the placeholder ones) with the 2 most important KPIs for the role:
     - ADMIN/SYSTEM_MANAGER: "Awaiting delivery" (tone warning) + "Low-stock alerts" (tone warning)  
     - SALES_STAFF: "My drafts" (tone warning) + "My orders today" (tone primary)
   - Add tone and description to each KPI card

DESIGN: StatCard component accepts: label, value, tone (primary|success|warning|undefined), description.

OUTPUT: lib/dal/dashboard.ts and updated app/dashboard/page.tsx. Complete, no placeholders.
```

---

## PROMPT 8 — Reports Module

```
You are working on a Next.js 16 App Router inventory system.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.

TASK — Build the Reports module.

The module lives at app/dashboard/reports/ and requires permission("reports", "read").

REPORTS TO BUILD (each as a sub-page or tab):

1. Sales Summary Report (app/dashboard/reports/sales/page.tsx)
   - Filters: date range (required), location (optional), product (optional)
   - Aggregated data: total orders, total revenue, average order value, top 10 products by quantity sold
   - Table: date | location | order count | revenue

2. Inventory Health Report (app/dashboard/reports/inventory/page.tsx)
   - No date filter (current snapshot)
   - Filters: location (optional), category (optional)
   - Shows: SKU count, on-hand units, reserved units, available units, low-stock count, out-of-stock count
   - Table grouped by location: location | SKU count | on-hand | available | low-stock rows

3. Stock Movement Report (app/dashboard/reports/movements/page.tsx)
   - Filters: date range, movement type, location, product
   - Table: date | product | SKU | location | movement type | quantity change | performed by
   - Totals: units in (positive movements) vs units out (negative movements) for the filtered period

DAL: lib/dal/reports.ts
   - getSalesReportData(filters)
   - getInventoryHealthData(filters)
   - getMovementReportData(filters)

All report pages are Server Components with search param filters (GET forms).
No export functionality needed in this phase.
Reports landing page: app/dashboard/reports/page.tsx — shows 3 clickable report cards (Sales Summary, Inventory Health, Stock Movements).

DESIGN: Match existing system style.
All queries are read-only — no mutations, no actions needed.

OUTPUT: All files above, complete, no placeholders.
```

---

## EXECUTION ORDER

Run prompts in this order. Each phase depends on the previous being stable and compiling clean.

1. ✅ Phase 1 — Schema + cleanup (already applied, run `prisma migrate dev` + `prisma generate` locally)
2. **Prompt 2** — Brand CRUD (fast, independent module)
3. **Prompt 3** — Locations enhanced CRUD
4. **Prompt 6** — Suppliers module (independent, no deps on new modules)
5. **Prompt 4** — Inventory overhaul (depends on Locations being solid)
6. **Prompt 5** — Sales Orders full flow (depends on Inventory actions being correct)
7. **Prompt 7** — Dashboard KPIs (depends on Sales Orders + Inventory data existing)
8. **Prompt 8** — Reports (depends on all data modules being live)

## BEFORE EACH PROMPT

Tell the coding AI:
> Read node_modules/next/dist/docs/ for any Next.js API you are unsure about.
> Do not invent API signatures. Check the actual source if needed.
> The Prisma schema is the source of truth — check prisma/schema.prisma before writing any query.
> Match the existing design system exactly. Do not introduce new UI patterns.
