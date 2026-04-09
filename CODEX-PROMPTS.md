# Codex Implementation Prompts — 7Dashboard

Use these prompts in order. Each prompt is self-contained with full context for a coding AI.

---

## PROMPT 1: Schema Migration — Brand, ProductSupplier, MovementType

```
You are working on a Next.js 16 + Prisma 7 + PostgreSQL inventory management project.

<context>
The project is at: /7dashboard
The Prisma schema is at: prisma/schema.prisma
The system manages products, categories, stock locations (warehouses and branches), inventory movements, sales orders, and purchase orders for a multi-branch small business.

Current state:
- Product has a single optional `supplierId` foreign key to Supplier.
- Product has a `costPrice` field.
- There is no Brand model.
- MovementType enum has: PURCHASE_RECEIVED, SALES_FULFILLED, MANUAL_ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN, CUSTOMER_RETURN, DAMAGED_LOST.
</context>

<task>
Apply these schema changes in a single Prisma migration:

1. **Add Brand model:**
```prisma
model Brand {
  id          String    @id @default(uuid())
  name        String    @unique
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  products    Product[]
}
```

2. **Add ProductSupplier junction model:**
```prisma
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
  product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  supplier     Supplier @relation(fields: [supplierId], references: [id], onDelete: Restrict)

  @@unique([productId, supplierId])
  @@index([supplierId])
}
```

3. **Modify Product model:**
   - Add `brandId String` (required) with relation to Brand.
   - Add `suppliers ProductSupplier[]` relation.
   - Keep `costPrice` as a display-level field (the "default" cost).
   - REMOVE the direct `supplierId String?` field and `supplier Supplier?` relation.
   - Add `@@index([brandId])`.

4. **Modify Supplier model:**
   - Replace `products Product[]` with `productLinks ProductSupplier[]`.
   - Keep `purchaseOrders PurchaseOrder[]`.

5. **Add INITIAL_STOCK to MovementType enum:**
```prisma
enum MovementType {
  PURCHASE_RECEIVED
  SALES_FULFILLED
  MANUAL_ADJUSTMENT
  TRANSFER_OUT
  TRANSFER_IN
  CUSTOMER_RETURN
  DAMAGED_LOST
  INITIAL_STOCK
}
```

6. **Write a migration script** (in the migration SQL or a separate seed script) that:
   - Creates a default Brand called "Unbranded" so existing products have a valid brandId.
   - For every existing Product that has a non-null supplierId, creates a ProductSupplier row with isPrimary=true and copies the product's costPrice.
   - Sets all existing products' brandId to the "Unbranded" brand.
   - Then drops the supplierId column from Product.
</task>

<constraints>
- Use `npx prisma migrate dev --name add-brand-product-supplier-initial-stock` to create the migration.
- The migration must handle existing data without data loss.
- Do NOT modify any TypeScript application code in this prompt — only schema and migration.
- Do NOT delete any existing models or enums — only add and modify.
- Ensure all foreign key indexes are present.
</constraints>
```

---

## PROMPT 2: Cleanup — Remove Mock Data, Dead Files, Dead Code

```
You are working on a Next.js 16 project at /7dashboard.

<task>
Perform these cleanup operations:

1. **Delete the entire `pure-desk-main/` directory** — this is a dead Vite/React prototype that is no longer used.

2. **Delete `components/sales-orders/sales-order-form.tsx`** — the old sales order form. The project uses `sales-order-form-redesign.tsx` exclusively now. Verify no imports reference the old file first. If any do, update them to use the redesign.

3. **Delete `IMPLEMENTATION-PROMPTS.md`** — development artifact, not part of the application.

4. **Remove the MockDataPanel from the dashboard:**
   - In `app/dashboard/page.tsx`, remove the import and rendering of `MockDataPanel`.
   - Delete `components/dashboard/mock-data-panel.tsx`.
   - Delete `lib/actions/mock-data.ts` (the server action wrapper).
   - Delete `lib/mock-data.ts` (the mock data seed/clear logic).

5. **Update `app/dashboard/page.tsx`** to remove the "Implementation baseline" aside section (the one listing development status items like "Expanded Prisma domain models..." and "Role-aware auth sessions..."). Replace it with a placeholder comment: `{/* TODO: Replace with real KPI widgets */}`.

6. **Clean the `[...segments]` catch-all route** at `app/dashboard/[...segments]/page.tsx`:
   - Make it render a clean "Page not found" message with a link back to the dashboard.
   - Style it consistently with the existing design system (rounded cards, slate colors, etc.).

7. **Clean up nav items in `lib/permissions.ts`:**
   - Keep all NAV_ITEMS entries but add a comment marking which pages don't exist yet: Suppliers, Purchase Orders, Audit Logs, Settings.
   - Do NOT remove them from the nav — they should still show for users with permission so the navigation feels complete.
</task>

<constraints>
- Do NOT modify any business logic in actions, DAL, or validators.
- Do NOT change the Prisma schema.
- Do NOT modify the sales order redesign form, inventory actions, or product actions.
- Verify there are no broken imports after deletions by checking all files that imported the deleted modules.
- Keep the dashboard page structure and stat cards, just remove the mock panel and implementation status section.
</constraints>
```

---

## PROMPT 3: Brand CRUD + Categories Page Update

```
You are working on a Next.js 16 + React 19 + Tailwind CSS 4 + Prisma 7 project at /7dashboard.

<context>
The schema now has a Brand model (id, name, description, createdAt, updatedAt) with a unique name field. The project uses:
- Server actions in `lib/actions/` with Zod validation
- DAL functions in `lib/dal/` for data fetching
- Validators in `lib/validators/` with Zod schemas
- Permission checks via `requirePermission(resource, action)`
- Audit logging via `logAudit()`
- Flash messages via `withFlashMessage()`
- Reusable UI components: PageHeader, StatCard, StatusBadge, Button, SubmitButton, Pagination

The Categories page is at `app/dashboard/categories/page.tsx` with components in `components/categories/`.
The permission resource for categories is "categories".
</context>

<task>
1. **Create Brand validator** at `lib/validators/brands.ts`:
   - `brandFormSchema`: name (1-80 chars, required), description (optional, max 240 chars, nullable).
   - `brandListQuerySchema`: query (optional search), sortBy (name/updatedAt/productCount), sortOrder (asc/desc).
   - Helper extractors following the same pattern as `lib/validators/categories.ts`.

2. **Create Brand DAL** at `lib/dal/brands.ts`:
   - `getBrandListData(filters)`: list brands with product count, search by name/description, sortable. Returns brands array + summary (total, inUse, empty).
   - `listBrandOptions()`: simple id+name list for dropdowns.
   - `getBrandById(id)`: brand details with recent products.

3. **Create Brand server actions** at `lib/actions/brands.ts`:
   - `createBrandAction(prevState, formData)`: create brand with validation, audit log, redirect with flash.
   - `updateBrandAction(prevState, formData)`: update brand with validation, audit log, redirect with flash.
   - Permission: use "categories" resource (brands share the same permission as categories since they're product organization).

4. **Create Brand components** in `components/brands/`:
   - `brand-form.tsx`: create/edit form matching the category form pattern.
   - `brands-table.tsx`: table with name, description, product count, actions.
   - `brands-filters.tsx`: search + sort controls.

5. **Create Brand pages:**
   - `app/dashboard/brands/page.tsx`: list page.
   - `app/dashboard/brands/new/page.tsx`: create page.
   - `app/dashboard/brands/[id]/edit/page.tsx`: edit page.

6. **Add Brands to navigation** in `lib/permissions.ts`:
   - Add a nav item: title "Brands", href "/dashboard/brands", icon "layers", section "Operations", resource "categories", action "read".
   - Position it right after the Categories nav item.

7. **Update Product form** (`components/products/product-form.tsx`):
   - Add a Brand dropdown (required field) that loads brand options.
   - The product form page should pass brand options from the DAL.
   - Update the product validator to include `brandId` as a required field.
</task>

<constraints>
- Follow the EXACT same code patterns as the existing Categories module (validators, DAL, actions, components).
- Use the same Tailwind design tokens: rounded-[24px] cards, border-white/70, bg-white/85, slate color palette.
- Use the same component patterns: PageHeader with eyebrow, StatCard for summary, table with proper column alignment.
- All server actions must use `requirePermission("categories", ...)` since brands share category permissions.
- All mutations must call `logAudit()`.
- All successful mutations must redirect with `withFlashMessage()`.
- Revalidate paths after mutations.
- Do NOT create a separate "Brands" section in the sidebar under a different resource. Brands use the "categories" permission.
</constraints>
```

---

## PROMPT 4: Locations Page Enhancement

```
You are working on a Next.js 16 + React 19 + Tailwind CSS 4 + Prisma 7 project at /7dashboard.

<context>
The Locations page at `app/dashboard/locations/page.tsx` is currently a read-only table showing locations with name, code, type, manager, address, and status. It has no create, edit, or detail views.

The StockLocation model has: id, name (unique), code (unique), type (WAREHOUSE/BRANCH), address, managerName, contactNumber, isActive, timestamps. It relates to LocationStock, SalesOrderItem, InventoryMovement, and User (assignedUsers).

Permission resource: "locations". ADMIN and SYSTEM_MANAGER have full CRUD. SALES_STAFF has read only.
</context>

<task>
1. **Create Location validator** at `lib/validators/locations.ts`:
   - `locationFormSchema`: name (1-80 chars), code (1-20 chars, uppercase alphanumeric + hyphens), type (WAREHOUSE/BRANCH), address (optional, max 240), managerName (optional, max 80), contactNumber (optional, max 40).
   - `locationListQuerySchema`: query (search), type filter (WAREHOUSE/BRANCH/all), status filter (active/inactive/all), sortBy, sortOrder.

2. **Create Location DAL** at `lib/dal/locations.ts` (if it doesn't exist, or update it):
   - `getLocationListData(filters)`: list locations with stock summary (SKU count, total units, low stock count per location). Search by name/code/address. Filter by type and active status.
   - `getLocationById(id)`: full location details + stock rows + recent movements (last 20).
   - `listLocationOptions(type?)`: id+name+code+type for dropdowns, optionally filtered by type.

3. **Create Location server actions** at `lib/actions/locations.ts`:
   - `createLocationAction(prevState, formData)`: create with validation and audit.
   - `updateLocationAction(prevState, formData)`: update with validation and audit. If deactivating and location has stock, include a warning message in the response but allow it.

4. **Create Location components** in `components/locations/`:
   - `location-form.tsx`: create/edit form. Type selector (Warehouse/Branch) with visual distinction.
   - `locations-table.tsx`: enhanced table with stock summary columns.
   - `locations-filters.tsx`: search + type filter + status filter.

5. **Create/Update Location pages:**
   - Update `app/dashboard/locations/page.tsx`: use new components, add "Create Location" button for users with create permission.
   - `app/dashboard/locations/new/page.tsx`: create page.
   - `app/dashboard/locations/[id]/page.tsx`: detail page showing location info + stock snapshot + recent movements.
   - `app/dashboard/locations/[id]/edit/page.tsx`: edit page.

6. **Detail page specifics:**
   - Show a summary card with: location type badge, status, manager, address, contact.
   - Below it, a stock table showing products at this location with quantities.
   - Below that, a movement feed showing the last 20 movements at this location.
   - "Edit" button visible only for users with update permission.
</task>

<constraints>
- Follow the same code patterns as Products and Categories modules.
- Location code should be auto-uppercased in the form and validated to be unique.
- The type selector should use clear visual cues: warehouse icon vs store/branch icon.
- Deactivating a location must NOT cascade-delete stock. It should just prevent new movements.
- Use the same Tailwind design system as the rest of the dashboard.
- All mutations must audit log and flash message.
</constraints>
```

---

## PROMPT 5: Inventory Module Overhaul

```
You are working on a Next.js 16 + React 19 + Tailwind CSS 4 + Prisma 7 project at /7dashboard.

<context>
The Inventory page at `app/dashboard/inventory/page.tsx` currently shows a single flat view with stat cards, a stock table, low stock table, movement table, and adjustment/transfer forms. It does NOT allow choosing a specific location to view.

The existing code:
- `lib/dal/inventory.ts` — fetches stock rows, movements, filter options, and summary.
- `lib/actions/inventory.ts` — has adjustInventoryAction and transferInventoryAction (both working correctly with transactions, movements, and audit).
- `lib/validators/inventory.ts` — has adjustment and transfer schemas.
- Components in `components/inventory/`: stock-table, movement-table, low-stock-table, inventory-filters, adjustment-form, transfer-form.
- `lib/inventory.ts` — utility constants and helpers.

MovementType enum now includes INITIAL_STOCK.
The StockLocation model has type: WAREHOUSE | BRANCH.
</context>

<task>
Rebuild the Inventory module with a location-first navigation pattern:

### A) Inventory Landing Page (`app/dashboard/inventory/page.tsx`)

Replace the current flat view with a location card selector:

1. **Global summary row** at top: 4 StatCards showing total SKUs, total units on hand, total low-stock alerts, total out-of-stock across all locations.

2. **Warehouses section** with a heading "Warehouses". Display one card per active warehouse showing: name, code, total SKUs, total units, low stock count badge (amber if > 0). Each card links to `/dashboard/inventory/[locationId]`.

3. **Branches section** with a heading "Branches". Same card pattern as warehouses but for branches.

4. **Quick action buttons** below the cards: "Receive from Supplier" (links to `/dashboard/inventory/receive`), "Transfer Stock" (links to `/dashboard/inventory/transfer`), "Adjust Stock" (links to `/dashboard/inventory/adjust`).

5. **System-wide view link**: A subtle "View all locations combined →" link that goes to `/dashboard/inventory/all`.

### B) Location Inventory View (`app/dashboard/inventory/[locationId]/page.tsx`)

This page shows inventory for a SINGLE location with tabs:

1. **Persistent filter bar** at the top: location switcher dropdown (to jump between locations without going back), category filter, brand filter, stock status filter (All/Low/Out/In), product search.

2. **Tab 1: Current Stock** (default)
   - Table: Product | SKU | Category | Brand | On Hand | Reserved | Available | Reorder Level | Status indicator.
   - Color coding: red row highlight for out-of-stock, amber for low stock.
   - Sortable columns.

3. **Tab 2: Movement Ledger**
   - Table: Date/Time | Type (colored badge) | Product | SKU | Qty Change (signed, colored) | Reference | Performed By.
   - Badge colors: blue=transfer, green=receipt, red=sale, amber=adjustment, purple=return, gray=initial.
   - Additional filters: movement type multi-select, date range picker.
   - Default: last 30 days.

4. **Tab 3: Low Stock Alerts**
   - Filtered table of items at or below reorder level.
   - Shows: Product | SKU | Available | Reorder Level | Shortage (reorder - available).
   - Sorted by worst shortage first.

5. **Page header** shows location name, type badge (Warehouse/Branch), and quick actions relevant to this location type:
   - Warehouse: "Receive Stock" + "Transfer Out"
   - Branch: "Transfer In" (note: redirect to transfer form with this branch pre-selected as destination)

### C) System-Wide View (`app/dashboard/inventory/all/page.tsx`)

Same tabbed structure as location view but aggregated across ALL active locations. Stock table shows an additional "Location" column. Movement ledger shows all movements. Useful for admin overview.

### D) Supplier Receipt Form (`app/dashboard/inventory/receive/page.tsx` + `components/inventory/supplier-receipt-form.tsx`)

NEW page and component:

1. Permission: requirePermission("inventory", "create") — only ADMIN and SYSTEM_MANAGER.
2. Form fields:
   - Destination warehouse (dropdown — ONLY shows warehouses, not branches).
   - Supplier (dropdown from active suppliers).
   - Line items: for each line, select product (filtered to products linked to chosen supplier via ProductSupplier) + quantity + optional unit cost override.
   - Reference number (optional — for PO/delivery receipt numbers).
   - Notes (optional).
3. On submit:
   - For each line item, increment the warehouse's LocationStock for that product.
   - Create a PURCHASE_RECEIVED movement for each line item.
   - Audit log the receipt.
   - Redirect to the warehouse's inventory view with a success flash.
4. Validation: warehouse must be active, supplier must be active, products must be active, quantities must be positive integers.

### E) Existing Forms — Relocate as Subpages

Move adjustment and transfer to dedicated subpages:
- `app/dashboard/inventory/adjust/page.tsx` — renders the existing adjustment form with a location dropdown pre-populated if coming from a location view (via `?location=` query param).
- `app/dashboard/inventory/transfer/page.tsx` — renders the existing transfer form with source/destination pre-populated if coming from a location view (via `?from=` or `?to=` query param).

### F) DAL Updates (`lib/dal/inventory.ts`)

Add/update these functions:
- `getInventoryLandingData()`: returns per-location summary cards (locationId, name, code, type, skuCount, totalUnits, lowStockCount) + global summary.
- `getLocationInventoryData(locationId, filters)`: returns stock rows, movements, low stock rows, and filter options for a single location.
- `getSystemWideInventoryData(filters)`: returns aggregated data across all locations.
- Keep existing functions for backward compatibility but mark them for deprecation.

### G) New Validator (`lib/validators/inventory.ts` — extend)

Add:
- `supplierReceiptSchema`: destinationLocationId (required, must be warehouse), supplierId (required), items array (productId + quantity + optional unitCost), referenceNumber (optional), notes (optional).
- `supplierReceiptFormState` type.

### H) New Action (`lib/actions/inventory.ts` — extend)

Add:
- `receiveFromSupplierAction(prevState, formData)`: validates, checks warehouse type, creates stock + movements in transaction, audit logs, redirects with flash.
</task>

<constraints>
- The existing adjustInventoryAction and transferInventoryAction must continue to work exactly as they do now. Do not break them.
- All new pages must use requirePermission for access control.
- All new server actions must use Prisma transactions, logAudit, and withFlashMessage.
- Follow the existing Tailwind design system (rounded-[24px] cards, border-white/70, bg-white/85, shadow patterns, slate colors).
- Use the existing component patterns: PageHeader, StatCard, StatusBadge, Button, SubmitButton.
- Tab navigation should use URL search params (e.g., ?tab=stock, ?tab=movements, ?tab=low-stock) so tabs are bookmarkable.
- The filter bar must persist across tab switches (filters are stored in URL search params).
- Movement type badge colors must be consistent system-wide.
- The supplier receipt form must enforce warehouse-only destinations at both UI and server action level.
- Pre-populate form fields from query params where noted (location, from, to).
</constraints>
```

---

## PROMPT 6: Initial Stock Load Tool

```
You are working on a Next.js 16 + React 19 + Tailwind CSS 4 + Prisma 7 project at /7dashboard.

<context>
The MovementType enum now includes INITIAL_STOCK. The system needs a way to load real opening stock data for a client migrating to this system. This is a one-time (or few-times) operation, not a daily workflow.
</context>

<task>
Create an admin-only "Initial Stock Load" page at `app/dashboard/inventory/initial-load/page.tsx`.

1. **Permission**: requireRole(["ADMIN"]) — only the admin can load initial stock.

2. **UI**: A clean form with these sections:

   **Section A: Location selector**
   - Dropdown to choose which location is receiving this initial stock.
   - Both warehouses and branches are valid (the client may have stock in branches already).

   **Section B: Line items**
   - A dynamic form where each row has: Product (searchable dropdown) + Opening Quantity (positive integer).
   - "Add another product" button to add rows.
   - Remove button on each row.
   - Validation: no duplicate products in the same submission.

   **Section C: Notes**
   - Optional text area for migration batch notes (e.g., "Physical count as of April 1, 2026").

3. **On submit**:
   - For each line item, upsert LocationStock (create if doesn't exist, add to quantity if it does).
   - Create an INITIAL_STOCK movement for each line item with notes referencing the migration.
   - Audit log the bulk operation.
   - Redirect to the location's inventory view with a flash message: "Initial stock loaded: X products, Y total units."

4. **Server action** at `lib/actions/inventory.ts`:
   - `loadInitialStockAction(prevState, formData)` — admin-only, transactional, creates movements and upserts stock.

5. **Validator** in `lib/validators/inventory.ts`:
   - `initialStockSchema`: locationId (required), items array (productId + quantity), notes (optional).

6. **Component** at `components/inventory/initial-stock-form.tsx`.
</task>

<constraints>
- Admin-only. Not visible in nav for other roles.
- This page should be accessible via a link from the inventory landing page (a subtle "Load initial stock" link, not a prominent button).
- The form should warn if any of the selected products already have stock at the chosen location — display current quantity so the user knows they're adding to it.
- All operations in a single transaction.
- Follow existing code patterns for forms, actions, and validation.
</constraints>
```

---

## PROMPT 7: Dashboard KPIs (Replace Developer Status Page)

```
You are working on a Next.js 16 + React 19 + Tailwind CSS 4 + Prisma 7 + Recharts project at /7dashboard.

<context>
The dashboard page at `app/dashboard/page.tsx` currently shows developer-facing stat cards (Role Access, Direct Stock Edits, Protected Modules, Audit Scope) and an "Implementation baseline" section. This needs to be replaced with real business KPIs.

The project has Recharts installed. The reports module at `lib/dal/reports.ts` already queries sales trends, revenue, order counts, etc.
</context>

<task>
Rewrite `app/dashboard/page.tsx` to show real business data:

1. **Top stat cards row** (4 cards):
   - "Today's Sales" — count of completed sales orders created today + total revenue. Tone: primary.
   - "Low Stock Alerts" — count of products at or below reorder level across all locations. Tone: warning. Clickable → links to inventory.
   - "Total Products" — count of active products in the catalog. Tone: success.
   - "Active Locations" — count of active warehouses + branches. Show breakdown like "2 warehouses, 3 branches".

2. **Main content area** (2-column on desktop):

   **Left column (wider):**
   - "Recent Sales" card — table of last 10 sales orders: Order #, Customer, Amount, Branch, Time (relative like "2 hours ago"). Each row links to the sales order detail page.

   **Right column:**
   - "Stock Alerts" card — list of top 10 most critical low-stock items: Product name, Location, Available qty, Reorder level. Sorted by worst shortage. Links to inventory view.
   - "Recent Activity" card — last 8 inventory movements: type badge, product, location, qty change, who, when. Compact feed-style layout.

3. **Create a DAL function** `getDashboardData()` in `lib/dal/dashboard.ts` that fetches all the above in parallel using Promise.all for performance.

4. **Role-based adjustments:**
   - ADMIN and SYSTEM_MANAGER see everything described above.
   - SALES_STAFF sees: Today's Sales (filtered to their assigned location), Recent Sales (filtered to their orders), and Stock Alerts for their location only. They do NOT see the Recent Activity feed.

5. Keep the role-based greeting from the current page's `roleCopy` pattern but simplify it:
   - ADMIN: "Welcome back" + first name
   - SYSTEM_MANAGER: "Welcome back" + first name
   - SALES_STAFF: "Welcome back" + first name + their assigned location name
</task>

<constraints>
- Do NOT use mock data. All queries must hit real database tables.
- Use the existing StatCard, PageHeader, StatusBadge components.
- Follow the existing Tailwind design system.
- The page must be a server component (async function, no "use client").
- Use relative time formatting (e.g., "2h ago", "yesterday") for timestamps — you can use a simple helper function, no need for a library.
- The page should load fast — use Promise.all for parallel queries.
- If the database has no data yet (empty state), show a friendly message guiding the user to create their first category, product, and location.
</constraints>
```
