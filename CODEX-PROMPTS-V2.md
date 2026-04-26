# CODEX EXECUTION PROMPTS — V2 (Plan-Aligned)

> Phase 1 (schema migration + cleanup) is already applied.
> Run `npx prisma migrate dev` + `npx prisma generate` BEFORE starting any prompt.
> Source of truth: SYSTEM-PLAN.md and prisma/schema.prisma.
> Read node_modules/next/dist/docs/ for any Next.js 16 API before writing code.

---

## EXECUTION ORDER

| # | Prompt | Depends On |
|---|--------|-----------|
| 1 | Categories & Brands (tab UI + Brand CRUD) | Phase 1 |
| 2 | Product Form — Multi-Supplier Selector | Prompt 1 |
| 3 | Locations Enhanced CRUD | Phase 1 |
| 4 | Inventory Actions (Supplier Receipt, Transfer, Adjustment, Initial Stock) | Prompt 3 |
| 5 | Inventory UI Overhaul (Location Cards + Tabbed View) | Prompt 4 |
| 6 | Sales Orders Full Flow | Prompt 4 |
| 7 | Dashboard Live KPIs + Recent Activity | Prompts 5, 6 |

---

## PROMPT 1 — Categories & Brands (Tab UI + Brand CRUD)

```
You are working on a Next.js 16 App Router inventory system.
Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.
Architecture: DAL in lib/dal/, Server Actions in lib/actions/, Zod validators in lib/validators/.
Read node_modules/next/dist/docs/ for any Next.js API you are unsure about.

CONTEXT:
Phase 1 already added a Brand model to the Prisma schema:
  model Brand {
    id          String    @id @default(uuid())
    name        String    @unique
    description String?
    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt
    products    Product[]
  }

Products already have brandId (optional FK). The product form already shows a Brand dropdown.
The existing Categories module is fully built:
  - app/dashboard/categories/page.tsx (list with StatCards, filters, table)
  - app/dashboard/categories/new/page.tsx (create form)
  - app/dashboard/categories/[id]/page.tsx (detail)
  - app/dashboard/categories/[id]/edit/page.tsx (edit form)
  - components/categories/categories-filters.tsx
  - components/categories/categories-table.tsx
  - components/categories/category-form.tsx
  - lib/dal/categories.ts
  - lib/actions/categories.ts
  - lib/validators/categories.ts

TASK — Add Brands as a TAB on the Categories page (not a separate nav item):

The SYSTEM-PLAN.md says:
  "Categories page stays as-is but add a Brands tab (or a toggle at the top of the page: Categories | Brands).
   Both share the same page pattern: list with search, create form, edit form."

STEP 1 — Tab Toggle Component:
Create components/ui/tab-toggle.tsx:
  - A reusable client component ("use client") that renders a pill/toggle bar with clickable tabs.
  - Props: tabs: Array<{ label: string, href: string, active: boolean }>
  - Uses Next.js <Link> for navigation (no client-side state — the tab is determined by the URL).
  - Style: pill-shaped buttons in a row. Active tab: bg-primary text-primary-foreground. Inactive: bg-slate-100 text-slate-600 hover:bg-slate-200.
  - Container: inline-flex gap-1 rounded-2xl bg-slate-100 p-1

STEP 2 — Update Categories List Page (app/dashboard/categories/page.tsx):
  - Add the TabToggle at the top of the page, BELOW the PageHeader and ABOVE the StatCards:
    tabs = [
      { label: "Categories", href: "/dashboard/categories", active: true },
      { label: "Brands", href: "/dashboard/categories/brands", active: false },
    ]
  - Everything else stays exactly as-is. Do NOT change the existing Categories code.

STEP 3 — Brand Backend:
Create lib/validators/brands.ts:
  - brandFormSchema: { name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional().transform(v => v || null) }
  - brandListQuerySchema: { query?: string, page?, pageSize? }
  - parseBrandListFilters(searchParams) → BrandListFilters
  - extractBrandFormValues(formData) → parsed form values
  - initialBrandFormState, BrandFormState types (match the pattern in lib/validators/categories.ts)

Create lib/dal/brands.ts (server-only):
  - getBrandListData(filters): returns { brands (id, name, description, _count.products, createdAt), pagination, summary: { total, inUse (brands with >=1 product), empty (brands with 0 products), linkedProducts (total product count across all brands) } }
  - getBrandById(id): returns brand with product list (id, name, sku, status)
  - getBrandFormOptions(): returns {} (no external relations needed)

Create lib/actions/brands.ts (server-only):
  - createBrandAction(prevState, formData): validate with brandFormSchema, check name uniqueness (prisma.brand.findFirst where name equals, case-insensitive), create brand, logAudit, redirect to /dashboard/categories/brands/{id} with flash
  - updateBrandAction(prevState, formData): same shape, excludes self from uniqueness check, redirect with flash
  - deleteBrandAction(prevState, formData): receives brandId, check if any products are linked (count > 0), if yes return error "Cannot delete a brand that has products assigned. Reassign or remove products first." else delete, logAudit, redirect to /dashboard/categories/brands with flash

STEP 4 — Brand Pages (nested under categories route):
All brand pages live under app/dashboard/categories/brands/ to keep them grouped with Categories in the URL.

app/dashboard/categories/brands/page.tsx:
  - requirePermission("categories", "read")
  - TabToggle with Brands tab active, Categories tab inactive
  - PageHeader: eyebrow "Catalog Structure", title "Brands", description "Manage the brand list used to classify products by manufacturer or label."
  - StatCards (same 4-card grid as Categories page): Total brands, In Use, Empty, Linked Products
  - BrandsFilters component (search input + Apply/Clear pattern — match CategoriesFilters exactly)
  - BrandsTable: name, description (truncated to ~60 chars), product count, created date, Edit link (if canManage), Delete button (if canDelete and product count is 0)
  - "Create brand" button if canCreate

app/dashboard/categories/brands/new/page.tsx:
  - requirePermission("categories", "create")
  - BrandForm with action=createBrandAction

app/dashboard/categories/brands/[id]/page.tsx:
  - requirePermission("categories", "read")
  - Brand detail: name, description, created/updated dates
  - Table of linked products (name, SKU, status badge, link to /dashboard/products/{id})
  - Edit button if canManage

app/dashboard/categories/brands/[id]/edit/page.tsx:
  - requirePermission("categories", "update")
  - BrandForm with action=updateBrandAction, prefilled values

STEP 5 — Brand Components:
components/brands/brand-form.tsx:
  - Fields: name (required text input), description (optional textarea)
  - Uses useActionState, pending state via SubmitButton, field-level errors
  - Cancel button links to brand detail page (edit mode) or /dashboard/categories/brands (create mode)
  - Match EXACT same form card style as category-form.tsx

components/brands/brands-filters.tsx:
  - Match CategoriesFilters pattern exactly (search input + Apply + Clear buttons)

components/brands/brands-table.tsx:
  - Match CategoriesTable pattern exactly (same card styling, header classes, row layout)

DESIGN RULES:
- Match existing UI exactly: rounded-[24px] cards, border border-white/70 bg-white/85, shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]
- Table headers: text-xs font-semibold uppercase tracking-[0.2em] text-slate-500
- Inputs: rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm
- Primary button: rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-[#16304f]
- Flash messages: withFlashMessage() from lib/flash-toast.ts
- Audit logging: logAudit() from lib/audit.ts inside transactions

PERMISSION:
- Brands share the "categories" PermissionResource. Do NOT add a new resource.
- Do NOT add a new nav item to NAV_ITEMS. The existing "Categories" nav item already covers brands (they share the page).

OUTPUT: All files listed above, complete, no placeholders, no stubs.
```

---

## PROMPT 2 — Product Form: Multi-Supplier Selector

```
You are working on a Next.js 16 App Router inventory system.
Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.
Read node_modules/next/dist/docs/ for any Next.js API you are unsure about.

CONTEXT:
The Prisma schema has a ProductSupplier junction table:
  model ProductSupplier {
    id           String   @id @default(uuid())
    productId    String
    supplierId   String
    isPrimary    Boolean  @default(false)
    costPrice    Decimal  @db.Decimal(12, 2)
    leadTimeDays Int?
    notes        String?
    createdAt    DateTime @default(now())
    updatedAt    DateTime @updatedAt
    product      Product  @relation(...)
    supplier     Supplier @relation(...)
    @@unique([productId, supplierId])
    @@index([supplierId])
  }

The Supplier model has: id, name, contactName?, email?, phone?, address?, isActive, timestamps.
Note: Supplier does NOT have a "code" field.

The Product form is at components/products/product-form.tsx. It is a "use client" component.
The Product form currently has: name, sku, status, category (with inline create modal), brand (select), unitPrice, costPrice, reorderLevel, imageUrl, description.
It does NOT currently have any supplier selector.

The product detail page (app/dashboard/products/[id]/page.tsx) shows brand and category but does NOT show suppliers.

The DAL function getProductById in lib/dal/products.ts already queries:
  suppliers: {
    select: {
      isPrimary: true,
      costPrice: true,
      supplier: { select: { id, name, email, phone } },
    },
    orderBy: { isPrimary: "desc" },
  }

The DAL function getProductFormOptions in lib/dal/products.ts currently returns { categories, brands }.

TASK — Add multi-supplier selector to the Product form and supplier display to the detail page.

STEP 1 — Update DAL (lib/dal/products.ts):
  - getProductFormOptions(): Add a third query to return `suppliers` — all active suppliers (isActive: true), ordered by name asc, returning { id, name }.
  - Return type becomes { categories, brands, suppliers }.

STEP 2 — Update product form pages to pass suppliers:
  - app/dashboard/products/new/page.tsx: destructure { categories, brands, suppliers } from getProductFormOptions(), pass suppliers to ProductForm.
  - app/dashboard/products/[id]/edit/page.tsx: same — pass suppliers to ProductForm. Also pass the product's existing supplier links as: existingSuppliers: product.suppliers.map(ps => ({ supplierId: ps.supplier.id, isPrimary: ps.isPrimary, costPrice: String(ps.costPrice), leadTimeDays: ps.leadTimeDays ? String(ps.leadTimeDays) : "", notes: ps.notes ?? "" }))

STEP 3 — Update ProductForm (components/products/product-form.tsx):
Add new props:
  - suppliers: Array<{ id: string; name: string }>
  - existingSuppliers?: Array<{ supplierId: string; isPrimary: boolean; costPrice: string; leadTimeDays: string; notes: string }>

Add a "Suppliers" section BELOW the Brand select and ABOVE the Unit Price field. It should be lg:col-span-2.

This section is a dynamic list managed with useState:
  - State: supplierRows: Array<{ supplierId: string; isPrimary: boolean; costPrice: string; leadTimeDays: string; notes: string }>
  - Initialize from existingSuppliers prop (or empty array if creating new product).
  - Each row renders:
    - Supplier select (filter out already-selected suppliers from the dropdown)
    - Cost price input (number, step 0.01)
    - Lead time input (number, optional, placeholder "days")
    - Primary toggle (checkbox) — only one row can be isPrimary. When toggling one on, toggle all others off.
    - Remove button (red text, "Remove")
  - "Add supplier" button at the bottom of the list (disabled if all suppliers already added)
  - Each row serializes to hidden inputs:
    - name="suppliers[0].supplierId" value={row.supplierId}
    - name="suppliers[0].isPrimary" value={row.isPrimary ? "true" : "false"}
    - name="suppliers[0].costPrice" value={row.costPrice}
    - name="suppliers[0].leadTimeDays" value={row.leadTimeDays}
    - name="suppliers[0].notes" value={row.notes}
  - Style: each row is a rounded-2xl border border-slate-200 bg-slate-50 p-4 with a grid of fields inside.

STEP 4 — Update Server Actions (lib/actions/products.ts):
  - In createProductAction and updateProductAction, after creating/updating the Product:
    - Parse supplier rows from formData using a loop that reads suppliers[i].supplierId, suppliers[i].isPrimary, etc. until a supplierId is empty or missing.
    - Validate: costPrice must be a positive number. supplierId must exist. No duplicate supplierIds.
    - For CREATE: create all ProductSupplier rows in the same transaction.
    - For UPDATE: delete all existing ProductSupplier rows for this product, then re-create them from the form data (replace strategy). This is simpler than diffing and is safe because ProductSupplier has no external FKs.
    - Ensure at most one row has isPrimary=true. If multiple are flagged, only keep the first.

STEP 5 — Update Product Detail Page (app/dashboard/products/[id]/page.tsx):
  - Below the existing Brand field, add a "Suppliers" section.
  - If product.suppliers is empty, show "No suppliers assigned."
  - If populated, show a small table:
    Header: Supplier | Cost Price | Lead Time | Primary
    Rows: supplier.name | formatted costPrice | leadTimeDays + " days" or "—" | isPrimary badge (green "Primary" or grey "—")

DESIGN RULES:
- Match existing form card styling exactly.
- The supplier rows section should have a clear header: "Linked Suppliers" with subtext "Assign one or more suppliers to this product."
- Add supplier button: variant="outline" size="sm"
- Remove supplier button: text-sm text-destructive hover:underline

OUTPUT: Updated lib/dal/products.ts, updated page files, updated ProductForm component, updated product detail page, updated lib/actions/products.ts. Complete, no placeholders.
```

---

## PROMPT 3 — Locations Enhanced CRUD

```
You are working on a Next.js 16 App Router inventory system.
Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.
Architecture: DAL in lib/dal/, Server Actions in lib/actions/, Zod validators in lib/validators/.
Read node_modules/next/dist/docs/ for any Next.js API you are unsure about.

CONTEXT:
The StockLocation model in prisma/schema.prisma:
  model StockLocation {
    id            String        @id @default(uuid())
    name          String        @unique
    code          String        @unique
    type          LocationType  (WAREHOUSE | BRANCH)
    address       String?
    managerName   String?
    contactNumber String?
    isActive      Boolean       @default(true)
    createdAt     DateTime
    updatedAt     DateTime
    assignedUsers User[]
    stock         LocationStock[]
    salesItems    SalesOrderItem[]
    movements     InventoryMovement[]
  }
  enum LocationType { WAREHOUSE, BRANCH }

The Locations module currently uses the catch-all placeholder route. There are NO existing location-specific pages, DAL, actions, or validators. Build everything from scratch.

The "locations" PermissionResource and NAV_ITEMS entry already exist in lib/permissions.ts.

TASK — Build the full Locations CRUD module:

1. lib/validators/locations.ts
   - locationFormSchema: {
       name: z.string().trim().min(1,"Required").max(100),
       code: z.string().trim().min(1,"Required").max(20).toUpperCase(),
       type: z.enum(["WAREHOUSE","BRANCH"]),
       address: z.string().trim().max(300).optional().transform(v => v || null),
       managerName: z.string().trim().max(100).optional().transform(v => v || null),
       contactNumber: z.string().trim().max(30).optional().transform(v => v || null),
     }
   - locationListQuerySchema: { query?, type? (all | WAREHOUSE | BRANCH), isActive? (all | true | false), page?, pageSize?, sortBy? (name | code | type | updatedAt), sortOrder? (asc | desc) }
   - parseLocationListFilters(searchParams) → LocationListFilters
   - extractLocationFormValues(formData) → LocationFormValues
   - initialLocationFormState, LocationFormState types

2. lib/dal/locations.ts (server-only)
   - getLocationListData(filters): returns {
       locations: Array of { id, name, code, type, isActive, address, managerName, updatedAt, _count: { stock (number of LocationStock rows with quantity > 0) } },
       pagination,
       summary: { total, warehouses, branches, active, inactive }
     }
   - getLocationById(id): returns location with:
       - All fields
       - Stock summary: skuCount (distinct products with quantity > 0), totalOnHand (sum of quantity), totalReserved (sum of reservedQty)
       - Top 20 stock rows: product { id, name, sku }, quantity, reservedQty — ordered by product.name asc
       - Recent 10 movements: id, type, product { name, sku }, quantityChange, createdAt, performedBy { firstName, lastName }

3. lib/actions/locations.ts (server-only)
   - createLocationAction(prevState, formData): validate, check name AND code uniqueness separately (case-insensitive), create, logAudit, redirect to /dashboard/locations/{id} with flash
   - updateLocationAction(prevState, formData): validate, check uniqueness excluding self, update, logAudit, redirect with flash. IMPORTANT: the "type" field must NOT be changeable after creation. Ignore any type value from the form on update — read the existing type from DB.
   - toggleLocationActiveAction(prevState, formData): receives locationId + targetIsActive (boolean string from form).
     DEACTIVATION RULE (from SYSTEM-PLAN.md): "Deactivating a location with stock should WARN but not BLOCK. Allows graceful wind-down."
     Implementation:
       - If deactivating and location has stock rows with quantity > 0: proceed with deactivation BUT return a flash message: "Location deactivated. Warning: {N} products still have stock at this location. Transfer stock out before fully retiring it."
       - If deactivating and no stock: normal flash "Location deactivated."
       - If activating: normal flash "Location activated."
     NOTE: No hard delete. Locations are deactivated only.

4. app/dashboard/locations/page.tsx
   - requirePermission("locations", "read")
   - PageHeader: eyebrow "Infrastructure", title "Locations", description "Manage warehouse and branch locations where inventory is stored and sold."
   - StatCards (4 cards): Total locations, Warehouses (tone primary), Branches (tone primary), Active/Inactive (show "X active / Y inactive", tone based on whether any are inactive)
   - LocationFilters: search input, type filter (All / Warehouse / Branch), status filter (All / Active / Inactive) — GET form pattern matching CategoriesFilters
   - LocationsTable:
     Columns: Name, Code, Type (badge: WAREHOUSE=blue, BRANCH=purple), Status (Active=green, Inactive=grey badge), Products in stock (count), Manager, Actions
     Actions column: Link "View" → detail page. If canManage: "Edit" link + Activate/Deactivate toggle button (form with toggleLocationActiveAction)
   - "Create location" button in PageHeader action slot if canCreate

5. app/dashboard/locations/new/page.tsx
   - requirePermission("locations", "create")
   - LocationForm with action=createLocationAction, mode="create"

6. app/dashboard/locations/[id]/page.tsx
   - requirePermission("locations", "read")
   - Location detail card: name, code, type badge, status badge, address, manager, contact number, created/updated dates
   - StatCards (3 cards): Products in stock (skuCount), Total on-hand, Total reserved
   - Stock table (top 20 products): Product Name, SKU, On Hand, Reserved, Available (= on hand - reserved). Color-code: red row if available <= 0, amber if available <= product.reorderLevel.
   - Recent movements mini-table (last 10): Date, Type badge, Product, Qty Change (+/−), Performed By
   - PageHeader action: Edit button (if canManage) + Activate/Deactivate button

7. app/dashboard/locations/[id]/edit/page.tsx
   - requirePermission("locations", "update")
   - LocationForm with action=updateLocationAction, mode="edit", prefilled values
   - CRITICAL: The "type" field is READ-ONLY when editing. Show it as plain text (e.g., a disabled input or a StatusBadge), NOT as a select. Include a hidden input for the type value so the form still submits it, but the user cannot change it.

8. components/locations/location-form.tsx
   - "use client" component
   - Props: { action, mode: "create" | "edit", location?: { id, name, code, type, address, managerName, contactNumber } }
   - Fields: name (required), code (required, CSS uppercase), type (select: Warehouse/Branch — only on create, read-only on edit), address (optional), manager name (optional), contact number (optional)
   - Hidden input for location id (edit mode)
   - useActionState, SubmitButton, field-level errors
   - Cancel links to detail page (edit) or list (create)

9. components/locations/locations-filters.tsx
   - Match CategoriesFilters pattern. GET form with query input + type select + status select + Apply + Clear.

10. components/locations/locations-table.tsx
    - Match CategoriesTable pattern for card/table styling.

DESIGN RULES: Same as existing system (rounded-[24px] cards, standard inputs, standard buttons).
Flash + audit logging on all mutations.

OUTPUT: All files listed above, complete, no placeholders.
```

---

## PROMPT 4 — Inventory Actions (Supplier Receipt + Transfer + Adjustment + Initial Stock)

```
You are working on a Next.js 16 App Router inventory system.
Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.
Architecture: Server Actions in lib/actions/, Zod validators in lib/validators/.
Read node_modules/next/dist/docs/ for any Next.js API you are unsure about.

CONTEXT — Movement cascade rules (STRICT — never violate):
  PURCHASE_RECEIVED  : Supplier → Warehouse ONLY (stock increases at warehouse)
  TRANSFER_OUT       : Any location → (paired with TRANSFER_IN)
  TRANSFER_IN        : Paired with TRANSFER_OUT (same transferGroupId UUID)
  SALES_FULFILLED    : Branch → Customer (stock decreases at branch)
  CUSTOMER_RETURN    : Customer → Branch (stock increases at branch)
  MANUAL_ADJUSTMENT  : Corrections only — any location, positive or negative
  DAMAGED_LOST       : Negative-only — any location
  INITIAL_STOCK      : Opening stock load — any location, positive only

Golden rules:
  - Every stock change creates a movement record. No silent quantity edits.
  - Stock updates and movement records are ALWAYS in the same database transaction.
  - Transfers create exactly two paired movements with shared transferGroupId.
  - Available quantity = On Hand − Reserved. All validations use available qty, not raw on-hand.
  - LocationStock rows are upserted — created on first movement if they don't exist.
  - Resulting quantity must never go below 0.

EXISTING FILES:
  - lib/actions/inventory.ts — has adjustInventoryAction and transferInventoryAction (both working but need enhancement)
  - lib/validators/inventory.ts — has inventoryAdjustmentSchema, inventoryTransferSchema, and supporting types
  - components/inventory/inventory-adjustment-form.tsx — existing adjustment form
  - components/inventory/inventory-transfer-form.tsx — existing transfer form

The ProductSupplier junction exists: model ProductSupplier { productId, supplierId, isPrimary, costPrice, ... }
The Supplier model has: id, name, contactName?, email?, phone?, address?, isActive.
The StockLocation model has: id, name, code, type (WAREHOUSE|BRANCH), isActive.

TASK 1 — NEW: Supplier Receipt Action + Form (SYSTEM-PLAN Section 2.3 A):
This is a SEPARATE action and form — NOT part of the adjustment form.
"Available ONLY when a WAREHOUSE is selected. Form: Select supplier → select products (filtered to that supplier's linked products) → enter quantities → optional reference number → optional notes."

Create lib/validators/inventory.ts additions:
  - supplierReceiptSchema: z.object({
      supplierId: z.string().uuid(),
      locationId: z.string().uuid(),
      referenceNumber: z.string().trim().max(50).optional().transform(v => v || null),
      notes: z.string().trim().max(500).optional().transform(v => v || null),
      items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
      })).min(1, "Add at least one product line"),
    })
  - SupplierReceiptState, initialSupplierReceiptState types
  - extractSupplierReceiptValues(formData): parse the dynamic line items

Create supplierReceiptAction in lib/actions/inventory.ts:
  - requirePermission("inventory", "update")
  - Validate with supplierReceiptSchema
  - Validate: locationId must reference an ACTIVE location with type = WAREHOUSE. If BRANCH, return error: "Supplier receipts can only be received at a warehouse location."
  - Validate: supplierId must reference an active supplier
  - Validate: each productId must exist and be ACTIVE or INACTIVE (not ARCHIVED)
  - In a single transaction, for each item:
    - Create InventoryMovement { type: PURCHASE_RECEIVED, productId, locationId, quantityChange: +quantity, referenceType: "supplier.receipt", referenceId: referenceNumber or null, notes, performedById: user.id }
    - Upsert LocationStock: create if not exists (quantity = item.quantity), else increment quantity
  - logAudit with all details (supplierId, items, locationId)
  - Redirect to /dashboard/inventory with flash "Supplier receipt recorded: {N} products received."

Create components/inventory/supplier-receipt-form.tsx ("use client"):
  - Props: { action, suppliers: Array<{id,name}>, warehouses: Array<{id,name,code}> }
  - The form has:
    1. Supplier select (required) — when supplier changes, fetch/filter available products
    2. Warehouse select (required) — only WAREHOUSE locations shown, not branches
    3. Reference number input (optional, placeholder "PO# or delivery receipt")
    4. Dynamic line items section:
       - Each row: Product select (options come from the selected supplier's linked products — pass allProducts and supplierProductMap as props) + Quantity input
       - "Add line" button, "Remove" button per row
       - Products already added in other rows are excluded from the dropdown
    5. Notes textarea (optional)
    6. Submit button: "Record Receipt"
  - To make the supplier-product filtering work on the client WITHOUT a fetch call:
    - The parent page passes: allProducts: Array<{id,name,sku}> and supplierProductLinks: Array<{supplierId,productId}> (from ProductSupplier table)
    - The form filters products client-side based on selected supplierId

Create app/dashboard/inventory/receive/page.tsx:
  - requirePermission("inventory", "update")
  - PageHeader: eyebrow "Inventory", title "Receive from Supplier", description "Record stock arriving from a supplier into a warehouse."
  - Query data needed:
    - Active suppliers: prisma.supplier.findMany({ where: { isActive: true }, select: { id, name }, orderBy: { name: "asc" } })
    - Warehouse locations: prisma.stockLocation.findMany({ where: { isActive: true, type: "WAREHOUSE" }, select: { id, name, code }, orderBy: { name: "asc" } })
    - Active products: prisma.product.findMany({ where: { status: { in: ["ACTIVE","INACTIVE"] } }, select: { id, name, sku }, orderBy: { name: "asc" } })
    - Supplier-product links: prisma.productSupplier.findMany({ select: { supplierId, productId } })
  - Render SupplierReceiptForm with all data passed as props

TASK 2 — ENHANCE: Adjustment Action (lib/actions/inventory.ts):
The existing adjustInventoryAction works but needs movement type mapping:

Update the inventoryAdjustmentSchema in lib/validators/inventory.ts:
  - Change the "reason" field to: z.enum(["count_correction", "damage_loss", "expired", "other"])
  - This is a human-readable reason code, NOT a MovementType.

Update adjustInventoryAction in lib/actions/inventory.ts:
  - Map reason to MovementType:
    - "damage_loss" or "expired" → DAMAGED_LOST (and force quantityChange to be negative — if direction is "increase", return error)
    - "count_correction" or "other" → MANUAL_ADJUSTMENT (allow increase or decrease)
  - Ensure resulting LocationStock.quantity never goes below 0. If it would, return error: "Adjustment would result in negative stock ({currentQty} + {change} = {result}). Verify the count."
  - Everything else stays the same (transaction, upsert, audit log).

Update components/inventory/inventory-adjustment-form.tsx:
  - Change the "reason" field from a free text input to a select with options:
    - "count_correction" → "Count Correction"
    - "damage_loss" → "Damage / Loss"
    - "expired" → "Expired"
    - "other" → "Other"
  - When "damage_loss" or "expired" is selected, auto-set direction to "decrease" and disable the direction toggle (grey it out). Show helper text: "Damage and expiry adjustments are always negative."

TASK 3 — VERIFY: Transfer Action (lib/actions/inventory.ts):
The existing transferInventoryAction is already well-implemented. Verify these rules are met (fix if not):
  a) Both fromLocation and toLocation must be isActive=true
  b) fromLocation must have sufficient AVAILABLE quantity (quantity - reservedQty >= transfer quantity)
  c) Transaction creates paired TRANSFER_OUT + TRANSFER_IN with shared transferGroupId (crypto.randomUUID())
  d) Source LocationStock decremented, destination LocationStock upserted
  e) Source location must have an existing LocationStock row (do NOT create one — that would mean transferring from nothing)
  f) All these rules are currently met. Leave the action as-is unless something is wrong.

TASK 4 — NEW: Initial Stock Load Action + Form:
Create initialStockSchema in lib/validators/inventory.ts:
  - productId: z.string().uuid()
  - locationId: z.string().uuid()
  - quantity: z.coerce.number().int().min(1, "Quantity must be at least 1")
  - notes: z.string().trim().max(500).optional().transform(v => v || null)

Create initialStockAction in lib/actions/inventory.ts:
  - requirePermission("inventory", "update")
  - Validate with initialStockSchema
  - Validate: product must exist and not be ARCHIVED
  - Validate: location must exist and be isActive=true
  - Check: does LocationStock already exist for this product+location with quantity > 0?
    If yes: return error "Stock already exists for this product at this location ({currentQty} units). Use Manual Adjustment to correct existing stock."
  - In transaction:
    - Upsert LocationStock (create with quantity, or update if row exists but quantity was 0)
    - Create InventoryMovement { type: INITIAL_STOCK, quantityChange: +quantity, referenceType: "inventory.initial_stock" }
    - logAudit
  - Redirect to /dashboard/inventory/initial-stock with flash "Opening stock loaded: {quantity} units of {productName} at {locationName}."

Create components/inventory/initial-stock-form.tsx ("use client"):
  - Props: { action, products: Array<{id,name,sku}>, locations: Array<{id,name,code,type}> }
  - Warning banner at top (amber bg): "Use this tool only for loading opening stock during initial data migration. For regular stock changes, use Manual Adjustment or Supplier Receipt."
  - Fields: Product select (required), Location select (required, shows all active locations), Quantity (positive integer), Notes (optional)
  - Submit: "Load Opening Stock"

Create app/dashboard/inventory/initial-stock/page.tsx:
  - requirePermission("inventory", "update")
  - Only accessible to ADMIN and SYSTEM_MANAGER — check user.role, if SALES_STAFF redirect to /dashboard/inventory
  - PageHeader: eyebrow "Data Migration", title "Load Opening Stock", description "Enter initial stock quantities for products at each location. This creates INITIAL_STOCK movements for a clean ledger starting point."
  - Query: active products + active locations
  - Render InitialStockForm

OUTPUT: Updated lib/validators/inventory.ts, updated lib/actions/inventory.ts, updated inventory-adjustment-form.tsx, new supplier-receipt-form.tsx, new initial-stock-form.tsx, new receive/page.tsx, new initial-stock/page.tsx. Complete, no placeholders.
```

---

## PROMPT 5 — Inventory UI Overhaul (Location Cards + Tabbed View)

```
You are working on a Next.js 16 App Router inventory system.
Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.
Architecture: DAL in lib/dal/, components in components/inventory/.
Read node_modules/next/dist/docs/ for any Next.js API you are unsure about.

CONTEXT:
The existing Inventory page (app/dashboard/inventory/page.tsx) shows a flat list: stat cards + filters + stock table + low-stock table + movement ledger. All in one long page with no location-based organization.

The SYSTEM-PLAN.md specifies a completely different UX:

LANDING VIEW: "When the user opens Inventory, they see Location Cards — one per active location, organized in two sections: Warehouses section and Branches section."
  Each card shows: location name, type icon, SKU count, total on-hand units, low-stock alert count, "View Inventory →" link.
  Plus: a "System-wide" card to see aggregated stock.
  Plus: quick-action buttons — "Record Transfer", "Adjust Stock", "Receive from Supplier".
  Plus: a global summary row — total SKUs, total on-hand, total low-stock alerts.

LOCATION VIEW: "After clicking a card, tabbed interface with persistent filter bar."
  Tab 1: Current Stock — table with color-coded rows (red out-of-stock, amber low-stock)
  Tab 2: Movement Ledger — filterable by type, date range. Color-coded type badges.
  Tab 3: Low Stock Alerts — filtered view of items at/below reorder level.

EXISTING FILES:
  - app/dashboard/inventory/page.tsx (REWRITE this)
  - lib/dal/inventory.ts (has getInventoryPageData — UPDATE this)
  - components/inventory/stock-table.tsx (exists — can keep or refactor)
  - components/inventory/low-stock-table.tsx (exists — can keep or refactor)
  - components/inventory/movement-table.tsx (exists — can keep or refactor)
  - components/inventory/inventory-filters.tsx (exists — refactor for location view)
  - components/inventory/inventory-adjustment-form.tsx (exists — keep, link from landing)
  - components/inventory/inventory-transfer-form.tsx (exists — keep, link from landing)
  - Sub-pages already created by Prompt 4: app/dashboard/inventory/receive/page.tsx, app/dashboard/inventory/initial-stock/page.tsx

TASK 1 — Update DAL (lib/dal/inventory.ts):

Add new function: getInventoryLandingData()
  Returns:
  - locationCards: Array of { id, name, code, type, skuCount (products with qty > 0), totalOnHand (sum quantity), lowStockCount (rows where available <= reorderLevel and reorderLevel > 0) } — one per active location, grouped by type
  - globalSummary: { totalSkus, totalOnHand, totalLowStock, totalOutOfStock }

Update getInventoryPageData(filters) to accept a required locationId:
  - If locationId is "system-wide", query across all active locations.
  - Otherwise, filter to that specific location.
  - Return: stockRows, lowStockRows, movements (last 50 instead of 40), options (categories, brands), summary
  - Movements: include product { name, sku }, location { name }, performedBy { firstName, lastName }, type, quantityChange, transferGroupId, createdAt, notes

TASK 2 — Rewrite Inventory Landing Page (app/dashboard/inventory/page.tsx):

Replace the entire page with the Location Cards layout:

  <PageHeader eyebrow="Inventory Control" title="Inventory" description="Monitor stock by location, record movements, and manage stock health across all warehouses and branches." />

  <section> Global summary: 4 StatCards — Total SKUs in stock, Total on-hand units, Low-stock alerts, Out-of-stock </section>

  <section> Quick Actions row — 3 action cards/buttons:
    "Receive from Supplier" → /dashboard/inventory/receive (visible to ADMIN, SYSTEM_MANAGER only)
    "Record Transfer" → /dashboard/inventory?action=transfer (opens a modal or dedicated section)
    "Adjust Stock" → /dashboard/inventory?action=adjust (opens a modal or dedicated section)
    NOTE: For simplicity, make these Link components to the relevant pages. Transfers and adjustments will use the existing forms on the location view.
    Actually, simplify: just make them links. "Receive from Supplier" → /dashboard/inventory/receive. "Record Transfer" and "Adjust Stock" will be accessible from within any location view. So only show "Receive from Supplier" as a quick action on the landing page.
    Also show: "Load Opening Stock" → /dashboard/inventory/initial-stock (visible to ADMIN, SYSTEM_MANAGER only)
  </section>

  <section> "Warehouses" heading
    Grid of location cards for type=WAREHOUSE. Each card:
      - Location name (bold) + code (grey)
      - Stats row: "{N} SKUs · {N} units on hand"
      - Low-stock indicator: "⚠ {N} low stock" (amber text) or "All stocked" (green text)
      - Entire card is a <Link> to /dashboard/inventory/{locationId}
      - Card style: rounded-[20px] border border-slate-200 bg-slate-50/70 p-5 hover:border-slate-300 hover:bg-white hover:shadow-sm cursor-pointer (matches dashboard module cards)
  </section>

  <section> "Branches" heading
    Same grid pattern for type=BRANCH.
  </section>

  <section> System-wide card (full width):
    "View all inventory" → /dashboard/inventory/system-wide
    Shows aggregated totals.
  </section>

TASK 3 — Create Location Inventory View (app/dashboard/inventory/[locationId]/page.tsx):

This is the tabbed view for a single location (or "system-wide").

  - requirePermission("inventory", "read")
  - Read locationId from params. If locationId is "system-wide", no location record needed. Otherwise, fetch the location record to display its name.
  - Read searchParams for: tab (stock | movements | low-stock, default "stock"), query, categoryId, brandId, movementType, dateFrom, dateTo, page, pageSize
  - Call getInventoryPageData({ locationId, ...filters })

  Layout:
  <PageHeader eyebrow={location.name or "System-Wide"} title="Inventory" action={<Link href="/dashboard/inventory"><Button variant="outline">All Locations</Button></Link>} />

  IF canManage: show inline Adjustment and Transfer forms in a collapsible sidebar or below the tabs (match current layout: grid xl:grid-cols-[1.45fr_0.85fr]). Pre-fill the locationId on both forms.

  Tab bar (use the TabToggle component from Prompt 1, or build inline):
    - "Current Stock" → ?tab=stock
    - "Movement Ledger" → ?tab=movements
    - "Low Stock" → ?tab=low-stock

  Persistent filter bar (always visible regardless of tab):
    - Category filter, Brand filter, Search by product name/SKU
    - For movements tab additionally: Movement type filter, Date range filters

  TAB: Current Stock
    Table: Product Name | SKU | Category | Brand | On Hand | Reserved | Available | Reorder Level | Status indicator
    Color-coded rows:
      - Row bg-red-50/60 if available <= 0
      - Row bg-amber-50/60 if available > 0 but available <= reorderLevel and reorderLevel > 0
      - Normal otherwise
    Sortable columns.

  TAB: Movement Ledger
    Table: Date/Time | Type (color badge) | Product | SKU | Qty Change (+N green / -N red) | Performed By | Notes (truncated)
    Type badges: PURCHASE_RECEIVED=green, TRANSFER_OUT=blue, TRANSFER_IN=blue, SALES_FULFILLED=red, CUSTOMER_RETURN=purple, MANUAL_ADJUSTMENT=amber, DAMAGED_LOST=red, INITIAL_STOCK=grey
    Paginated or "Load more" button.

  TAB: Low Stock
    Filtered table showing only items where available <= reorderLevel and reorderLevel > 0.
    Columns: Product | SKU | On Hand | Reserved | Available | Reorder Level | Shortage (reorderLevel - available)
    Sorted by shortage descending (most critical first).

TASK 4 — Create tab components:
  components/inventory/inventory-stock-tab.tsx — renders the Current Stock table
  components/inventory/inventory-movements-tab.tsx — renders the Movement Ledger table
  components/inventory/inventory-low-stock-tab.tsx — renders the Low Stock table
  components/inventory/location-inventory-filters.tsx — persistent filter bar

You may reuse logic from the existing stock-table.tsx, movement-table.tsx, and low-stock-table.tsx. Either refactor them or create new components that replace them.

DESIGN RULES: Match existing system styling. Location cards match the module cards on the dashboard page.

OUTPUT: Updated lib/dal/inventory.ts, rewritten app/dashboard/inventory/page.tsx, new app/dashboard/inventory/[locationId]/page.tsx, new or updated components. Complete, no placeholders.
```

---

## PROMPT 6 — Sales Orders Full Flow

```
You are working on a Next.js 16 App Router inventory system.
Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.
Architecture: DAL in lib/dal/, Server Actions in lib/actions/, Zod validators in lib/validators/.
Read node_modules/next/dist/docs/ for any Next.js API you are unsure about.

CONTEXT — SalesOrder schema (from prisma/schema.prisma):
  model SalesOrder {
    id            String           @id @default(uuid())
    orderNumber   String           @unique
    customerName  String
    customerEmail String?
    status        SalesOrderStatus @default(DRAFT)
    totalAmount   Decimal          @db.Decimal(12, 2)
    notes         String?
    archivedAt    DateTime?
    createdById   String
    createdAt     DateTime
    updatedAt     DateTime
    createdBy     User             @relation(...)
    items         SalesOrderItem[]
  }

  model SalesOrderItem {
    id           String        @id @default(uuid())
    salesOrderId String
    productId    String
    locationId   String
    quantity     Int
    unitPrice    Decimal       @db.Decimal(12, 2)
    createdAt    DateTime
    updatedAt    DateTime
    salesOrder   SalesOrder    @relation(...)
    product      Product       @relation(...)
    location     StockLocation @relation(...)
  }

  enum SalesOrderStatus { DRAFT, CONFIRMED, DELIVERED, COMPLETED, CANCELLED }

IMPORTANT: SalesOrderItem has locationId per item, but for v1 simplicity: all items in a single order use the SAME location. The form picks one branch, and all items inherit it. The schema supports per-item locations for future flexibility.

MOVEMENT RULES:
  - Stock is decremented (SALES_FULFILLED) ONLY when order moves to DELIVERED — not on CONFIRMED.
  - CANCELLED from DELIVERED: stock is restored via CUSTOMER_RETURN movements.
  - CANCELLED from CONFIRMED or DRAFT: no stock impact (nothing was decremented yet).
  - Sales ONLY happen at BRANCH locations (not warehouses).
  - Order number is auto-generated: "SO-" + timestamp-based or sequential ID.

TASK:

1. lib/validators/sales-orders.ts
   - salesOrderFormSchema: {
       locationId: z.string().uuid(),
       customerName: z.string().trim().min(1).max(150),
       customerEmail: z.string().email().optional().or(z.literal("")),
       notes: z.string().trim().max(500).optional().transform(v => v || null),
       items: z.array(z.object({
         productId: z.string().uuid(),
         quantity: z.coerce.number().int().min(1),
         unitPrice: z.coerce.number().min(0),
       })).min(1, "Add at least one item"),
     }
   - salesOrderListQuerySchema: { query?, status? (all | DRAFT | CONFIRMED | DELIVERED | COMPLETED | CANCELLED), dateFrom?, dateTo?, page?, pageSize? }
   - parseSalesOrderListFilters(searchParams)
   - extractSalesOrderFormValues(formData)
   - SalesOrderFormState, initialSalesOrderFormState

2. lib/dal/sales-orders.ts (server-only)
   - getSalesOrderListData(filters): paginated orders with:
       Selecting: id, orderNumber, customerName, status, totalAmount, createdAt, createdBy { firstName, lastName }, items count, items[0].location { name } (to display the branch)
       Summary: { total, draft, confirmed, delivered, completed, cancelled }
   - getSalesOrderById(id): full order with all items expanded (product { id, name, sku }, location { id, name }, quantity, unitPrice, subtotal computed as quantity * unitPrice)
   - getSalesOrderFormOptions(): { products (ACTIVE, with unitPrice and sku), locations (BRANCH type, isActive=true) }

3. lib/actions/sales-orders.ts (server-only)
   Generate order numbers with: "SO-" + Date.now().toString(36).toUpperCase() + "-" + randomInt(100,999)

   - createSalesOrderAction(prevState, formData):
     - Validate with salesOrderFormSchema
     - Validate: locationId must reference a BRANCH (not WAREHOUSE) that is active
     - Calculate totalAmount from items (sum of quantity * unitPrice per item)
     - In transaction: create SalesOrder (status DRAFT) + create all SalesOrderItems (each gets the same locationId)
     - logAudit, redirect to /dashboard/sales-orders/{id} with flash

   - confirmSalesOrderAction(prevState, formData):
     - Receives orderId from hidden input
     - Load order, verify status is DRAFT
     - For each item: check LocationStock at item.locationId has available quantity >= item.quantity
     - If any item fails stock check: return error listing which products are short
     - Update status to CONFIRMED (do NOT touch LocationStock or create movements — stock is only decremented on DELIVERED)
     - logAudit, redirect with flash

   - deliverSalesOrderAction(prevState, formData):
     - Receives orderId
     - Load order, verify status is CONFIRMED
     - In transaction: for each item:
       - Validate LocationStock has sufficient quantity (quantity - reservedQty >= item.quantity). If not, reject ENTIRE transaction with error.
       - Create InventoryMovement { type: SALES_FULFILLED, productId, locationId: item.locationId, quantityChange: -item.quantity, referenceType: "sales_order", referenceId: order.id, performedById: user.id }
       - Decrement LocationStock.quantity by item.quantity
     - Update order status to DELIVERED
     - logAudit, redirect with flash

   - cancelSalesOrderAction(prevState, formData):
     - Receives orderId
     - Load order, verify status is NOT COMPLETED
     - If current status is DELIVERED: in transaction, for each item:
       - Create InventoryMovement { type: CUSTOMER_RETURN, productId, locationId: item.locationId, quantityChange: +item.quantity, referenceType: "sales_order.cancel", referenceId: order.id }
       - Increment LocationStock.quantity by item.quantity
     - If current status is CONFIRMED or DRAFT: no stock impact, just update status
     - Update order status to CANCELLED
     - logAudit, redirect with flash

   - completeSalesOrderAction(prevState, formData):
     - Receives orderId
     - Load order, verify status is DELIVERED
     - Update status to COMPLETED (terminal state — no stock impact, just marks it as done)
     - logAudit, redirect with flash

4. app/dashboard/sales-orders/page.tsx
   - requirePermission("sales_orders", "read")
   - PageHeader: eyebrow "Sales", title "Sales Orders"
   - StatCards: Total, Draft, Confirmed, Delivered (4 cards)
   - Filters: query (searches orderNumber + customerName), status select, date range
   - SalesOrdersTable: Order #, Customer, Branch, Status badge, Items count, Total, Created by, Date, "View" link
   - Status badges: DRAFT=grey, CONFIRMED=blue, DELIVERED=green, COMPLETED=slate, CANCELLED=red
   - "New Sale" button if canCreate

5. app/dashboard/sales-orders/new/page.tsx
   - requirePermission("sales_orders", "create")
   - SalesOrderForm (client component, "use client"):
     - Location select (BRANCH only)
     - Customer name (required), Customer email (optional)
     - Dynamic line items (managed with useState):
       - Each row: Product select (auto-fills unit price from product data, but editable) + Quantity + computed subtotal
       - Add/remove rows
       - Products already in another row excluded from dropdown
       - Running total displayed at bottom
     - Notes (optional)
     - Submit → DRAFT

6. app/dashboard/sales-orders/[id]/page.tsx
   - requirePermission("sales_orders", "read")
   - Full order detail: order number, customer info, branch, status, dates, notes
   - Items table: Product, SKU, Qty, Unit Price, Subtotal
   - Total row at bottom
   - Status workflow buttons (each is a small form with a hidden orderId input):
     Visible buttons depend on current status:
     - DRAFT: "Confirm Order" (confirmSalesOrderAction) + "Cancel" (cancelSalesOrderAction)
     - CONFIRMED: "Mark Delivered" (deliverSalesOrderAction) + "Cancel" (cancelSalesOrderAction)
     - DELIVERED: "Complete Order" (completeSalesOrderAction) + "Cancel & Restore Stock" (cancelSalesOrderAction)
     - COMPLETED: no actions (terminal)
     - CANCELLED: no actions (terminal)
   - If CONFIRMED: show stock availability check — for each item, display available stock at the order's location. Highlight items where available < required in amber/red.
   - Only show action buttons if user has sales_orders "update" permission

DESIGN: Match existing system style. Flash + audit logging on all status transitions.

OUTPUT: All files listed above, complete, no placeholders.
```

---

## PROMPT 7 — Dashboard Live KPIs + Recent Activity

```
You are working on a Next.js 16 App Router inventory system.
Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.
Read node_modules/next/dist/docs/ for any Next.js API you are unsure about.

CONTEXT:
app/dashboard/page.tsx currently has a TODO comment:
  {/* TODO: Replace these two with real live KPIs from getDashboardData() */}
The two placeholder StatCards show "Record Sale" and "View Inventory" as quick-action tiles.

The existing layout has 4 StatCards in a row, then a 2-column grid with module cards (left) and getting started guide (right).

The user object: user.id, user.role (ADMIN | SYSTEM_MANAGER | SALES_STAFF), user.firstName, user.assignedLocationId (optional FK to StockLocation).

SYSTEM-PLAN.md Phase 5 specifies these dashboard KPIs:
  - Today's sales (count + revenue)
  - Low stock alerts (count, clickable to inventory)
  - Recent movements (last 10, with type badges)
  - Per-location stock health summary

TASK:

1. lib/dal/dashboard.ts (server-only)
   Create getDashboardData(userId: string, role: Role, assignedLocationId: string | null):

   Queries to run (use Promise.all for parallel execution):

   For ALL roles:
   a) ordersToday: count of SalesOrders created today (createdAt >= start of today)
   b) revenueToday: sum of totalAmount from SalesOrders created today with status in [CONFIRMED, DELIVERED, COMPLETED]
   c) lowStockAlerts: count of LocationStock rows where (quantity - reservedQty) <= product.reorderLevel AND product.reorderLevel > 0 AND product.status in [ACTIVE, INACTIVE]
   d) ordersAwaitingDelivery: count of SalesOrders with status CONFIRMED
   e) recentMovements: last 10 InventoryMovement records ordered by createdAt desc, selecting { id, type, quantityChange, createdAt, product { name, sku }, location { name }, performedBy { firstName } }
   f) locationHealth: for each active StockLocation: { id, name, type, skuCount, totalOnHand, lowStockCount } — same aggregation as the inventory landing page

   For SALES_STAFF specifically (scoped to their location):
   - If assignedLocationId exists, filter ordersToday and revenueToday to createdById = userId
   - Filter lowStockAlerts to assignedLocationId
   - Filter recentMovements to assignedLocationId

   Return type: {
     ordersToday: number,
     revenueToday: number,
     lowStockAlerts: number,
     ordersAwaitingDelivery: number,
     recentMovements: Array<{ id, type, quantityChange, createdAt, productName, productSku, locationName, performedByName }>,
     locationHealth: Array<{ id, name, type, skuCount, totalOnHand, lowStockCount }>,
   }

2. Update app/dashboard/page.tsx:

   Replace the 4 StatCards section with role-aware KPIs:

   For ADMIN / SYSTEM_MANAGER (4 cards):
   - "Orders Today" — value: ordersToday, tone: "primary", description includes revenue: "₱{revenueToday} total revenue"
   - "Awaiting Delivery" — value: ordersAwaitingDelivery, tone: ordersAwaitingDelivery > 0 ? "warning" : "success", description: "Confirmed orders pending delivery"
   - "Low Stock Alerts" — value: lowStockAlerts, tone: lowStockAlerts > 0 ? "warning" : "success", description: "Products at or below reorder level"
   - "Locations Active" — value: locationHealth.length, tone: "primary", description: "{warehouses} warehouses, {branches} branches"

   For SALES_STAFF (4 cards):
   - "My Orders Today" — value: ordersToday, tone: "primary", description: "₱{revenueToday} revenue"
   - "Awaiting Delivery" — value: ordersAwaitingDelivery, tone: ordersAwaitingDelivery > 0 ? "warning" : "success"
   - "Low Stock" — value: lowStockAlerts, tone: lowStockAlerts > 0 ? "warning" : "success", description: assignedLocationId ? "At your assigned location" : "Across all locations"
   - Quick action: "New Sale" — link to /dashboard/sales-orders/new (keep as a StatCard-like link card)

   ADD a new section BETWEEN the StatCards and the module cards grid:

   "Recent Activity" panel (full width):
   - A compact table or list showing the last 10 movements:
     Each row: time ago (e.g., "2m ago", "1h ago") | type badge (color-coded) | product name | location | qty change (+N/-N) | performed by first name
   - Type badge colors: PURCHASE_RECEIVED=green, TRANSFER_OUT=blue, TRANSFER_IN=blue, SALES_FULFILLED=red, CUSTOMER_RETURN=purple, MANUAL_ADJUSTMENT=amber, DAMAGED_LOST=red, INITIAL_STOCK=slate
   - Card style: same rounded-[24px] card as existing sections
   - "View all inventory →" link at the bottom of the panel

   Keep the existing module cards grid and getting started guide below the new sections.

DESIGN: StatCard component (components/ui/stat-card.tsx) accepts: label, value (string), tone, description.
For the revenue display, format as currency: new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(revenueToday)

Create a helper component for the activity feed: components/dashboard/recent-activity.tsx
  - Server component (no "use client" needed)
  - Receives movements array as prop
  - Renders the compact table/list described above

OUTPUT: New lib/dal/dashboard.ts, new components/dashboard/recent-activity.tsx, updated app/dashboard/page.tsx. Complete, no placeholders.
```

---

## PRE-FLIGHT CHECKLIST (tell the AI before EACH prompt)

```
BEFORE YOU WRITE ANY CODE:

1. Read node_modules/next/dist/docs/ for any Next.js API you plan to use.
2. Read prisma/schema.prisma — it is the source of truth for all models and types.
3. Read the existing file you are modifying BEFORE making changes.
4. Match the existing design system exactly:
   - Cards: rounded-[24px] border border-white/70 bg-white/85 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]
   - Table headers: text-xs font-semibold uppercase tracking-[0.2em] text-slate-500
   - Inputs: rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm
   - Primary button: rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-[#16304f]
5. Use withFlashMessage() from lib/flash-toast.ts for redirect flash messages.
6. Use logAudit() from lib/audit.ts inside Prisma transactions for all mutations.
7. Use requirePermission() from lib/dal/auth.ts as the first line in every page and action.
8. Do NOT invent API signatures. Check actual imports before using them.
9. Do NOT add console.log statements.
10. Do NOT create placeholder or stub functions. Every function must be complete.
```
