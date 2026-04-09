# 7Dashboard — Holistic System Plan

**Date:** April 8, 2026
**Status:** Approved blueprint — ready for phased implementation

---

## 1. Module Definitions and Responsibilities

### 1.1 Products (Catalog Registry)

**Purpose:** The product master list. Every item the business sells or stocks is registered here with its identity — name, SKU, description, pricing, reorder threshold, image, status. Products hold NO stock quantities. Stock lives in Inventory.

**Key relationships:**
- A product belongs to ONE category.
- A product belongs to ONE brand.
- A product can have MULTIPLE suppliers (junction table `ProductSupplier`).
- A product can exist in multiple locations via `LocationStock`.

**What changes from current state:**
- Replace single `supplierId` foreign key with a `ProductSupplier` junction table.
- Add `brandId` foreign key to Product.
- Product form gains a Brand dropdown and a multi-supplier selector.

---

### 1.2 Categories + Brands (Product Organization)

**Purpose:** Two independent classification dimensions for organizing the product catalog.

**Category** = what the product IS (Beverages, Snacks, Cleaning Supplies, Electronics).
**Brand** = who MAKES it (Coca-Cola, Frito-Lay, Unilever, Samsung).

They are **independent** — Coca-Cola can appear under Beverages AND under Snacks if they make products in both. A product picks one Category and one Brand.

**Schema changes:**
- `Category` model stays as-is (id, name, description, timestamps).
- NEW `Brand` model: id, name, description (optional), timestamps. Name is unique.
- `Product.brandId` — required foreign key to Brand.

**UI approach:**
- Categories page stays as-is but add a **Brands tab** (or a toggle at the top of the page: "Categories | Brands").
- Both share the same page pattern: list with search, create form, edit form.
- When creating a product, the form shows Category dropdown + Brand dropdown. Both must be populated first.

---

### 1.3 Locations (Physical Business Sites)

**Purpose:** Manage the physical places where inventory exists. Two types with different operational rules.

**WAREHOUSE:**
- Receives stock from suppliers (via Purchase Orders / Supplier Receipts).
- Sends stock to branches (via Transfers).
- Can transfer to other warehouses.
- Does NOT sell to end customers.
- Typically has higher stock volumes.

**BRANCH:**
- Receives stock from warehouses (via Transfers).
- Can receive stock from other branches (rare, but supported).
- Sells to customers (via Sales Orders).
- Processes returns and voids.
- Does NOT receive directly from suppliers.

**Locations page functions:**
1. **List all locations** — table showing name, code, type (Warehouse/Branch badge), manager, address, status (Active/Inactive), stock summary (total SKUs, total units).
2. **Create location** — form with: name, code, type (Warehouse/Branch), address, manager name, contact number.
3. **Edit location** — update details, activate/deactivate. Deactivating a location with stock should warn but not block (allows graceful wind-down).
4. **Location detail page** — shows location info + its current stock table + recent movements. This is a shortcut into the Inventory view filtered to this location.

**Transfer function placement decision:**
Transfers are initiated from the **Inventory** module, NOT from Locations. Locations is for managing the sites themselves. Inventory is where you move stock between them. This keeps responsibilities clean.

---

### 1.4 Inventory (Stock Counter + Movement Ledger)

**Purpose:** The central nervous system. Shows what stock exists, where it is, and every movement that changed it. Inventory is READ + CORRECT + TRANSFER — it reflects the output of all other modules.

**How stock enters and exits the system:**

| Action | Source | Destination | Movement Type | Triggered From |
|--------|--------|-------------|---------------|----------------|
| Supplier delivery | External | Warehouse | `PURCHASE_RECEIVED` | Supplier Receipt form (in Inventory) |
| Warehouse → Branch | Warehouse | Branch | `TRANSFER_OUT` / `TRANSFER_IN` | Transfer form (in Inventory) |
| Warehouse → Warehouse | Warehouse | Warehouse | `TRANSFER_OUT` / `TRANSFER_IN` | Transfer form (in Inventory) |
| Branch → Branch | Branch | Branch | `TRANSFER_OUT` / `TRANSFER_IN` | Transfer form (in Inventory) |
| Customer purchase | Branch | External | `SALES_FULFILLED` | Sales Order completion |
| Return / Void | External | Branch | `CUSTOMER_RETURN` | Void Sale action |
| Manual correction | — | Any location | `MANUAL_ADJUSTMENT` | Adjustment form (in Inventory) |
| Damage / Loss | Any location | — | `DAMAGED_LOST` | Adjustment form (reason: damage/loss) |
| Initial data load | — | Any location | `INITIAL_STOCK` | Data migration tool (one-time) |

**NEW movement type needed:** `INITIAL_STOCK` — for loading the client's real starting data. This is distinct from manual adjustment so reports can separate "corrections" from "opening balances."

---

## 2. Inventory Module — Detailed UX Plan

### 2.1 Landing View: Location Selector

When the user opens Inventory, they see **Location Cards** — one per active location, organized in two sections:

**Warehouses section:**
```
┌─────────────────────┐  ┌─────────────────────┐
│ 🏭 Central Warehouse│  │ 🏭 North Warehouse  │
│ 48 SKUs · 3,200 units│  │ 31 SKUs · 1,850 units│
│ ⚠ 3 low stock       │  │ ✓ All stocked       │
│ [View Inventory →]  │  │ [View Inventory →]  │
└─────────────────────┘  └─────────────────────┘
```

**Branches section:**
```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ 🏪 Makati Branch    │  │ 🏪 BGC Branch       │  │ 🏪 Quezon Branch    │
│ 35 SKUs · 890 units │  │ 28 SKUs · 650 units │  │ 42 SKUs · 1,100 units│
│ ⚠ 5 low stock       │  │ ⚠ 2 low stock       │  │ ✓ All stocked       │
│ [View Inventory →]  │  │ [View Inventory →]  │  │ [View Inventory →]  │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

**Also on the landing page:**
- A **"System-wide" card** — click to see aggregated stock across ALL locations.
- Quick-action buttons: "Record Transfer" · "Adjust Stock" · "Receive from Supplier" (the three core inventory actions).
- A **global summary row** — total SKUs in system, total units on hand, total low-stock alerts, total out-of-stock.

### 2.2 Location Inventory View (after clicking a card)

**Persistent filter bar** (stays on every sub-view within this location):
- Location selector (dropdown to switch without going back)
- Category filter
- Brand filter
- Stock status: All / Low Stock / Out of Stock / In Stock
- Search by product name or SKU

**Tab structure within a location:**

**Tab 1: Current Stock**
Table: Product Name | SKU | Category | Brand | On Hand | Reserved | Available | Reorder Level | Status
- Color-coded rows: red for out-of-stock, amber for low stock, green for healthy.
- Sortable by any column.
- "Available" = On Hand − Reserved.

**Tab 2: Movement Ledger**
Table: Date/Time | Type (badge) | Product | SKU | Qty Change (+/-) | Running Balance | Reference | Performed By
- Type badges: blue for transfers, green for receipts, red for sales, amber for adjustments, purple for returns.
- Filterable by movement type, date range.
- Grouped by date for readability.
- Clicking a movement that references a sales order or transfer links to that record.

**Tab 3: Low Stock Alerts**
Filtered view showing only items at or below reorder level. Action button to initiate a transfer request for each item.

### 2.3 Inventory Actions

**A) Receive from Supplier (NEW)**
- Available ONLY when a WAREHOUSE is selected (enforced in UI and server).
- Form: Select supplier → select products (filtered to that supplier's products) → enter quantities → optional reference number (PO number, delivery receipt) → optional notes.
- On submit: warehouse stock increases, `PURCHASE_RECEIVED` movement logged for each line item.
- This replaces the need for a full Purchase Order module in v1. PO can come later as a planning/approval layer on top.

**B) Transfer Stock (EXISTS — enhance)**
- Form: From location → To location → select product → enter quantity → notes.
- Validation: source must have sufficient available stock.
- Business rules enforced:
  - Warehouse → Branch: always allowed.
  - Warehouse → Warehouse: always allowed.
  - Branch → Branch: allowed (with a note that this is unusual).
  - Branch → Warehouse: allowed (for returns to warehouse).
- On submit: source decreases, destination increases, paired movements logged.

**C) Manual Adjustment (EXISTS — keep)**
- Select location → select product → increase or decrease → quantity → reason (required) → notes.
- Reason codes: Count Correction, Damage/Loss, Expired, Other.
- When reason is "Damage/Loss", movement type is `DAMAGED_LOST` instead of `MANUAL_ADJUSTMENT`.

**D) Initial Stock Load (NEW — one-time migration tool)**
- Admin-only. Appears as a special action or separate page.
- Bulk form or CSV upload: Location + Product + Opening Quantity.
- Logs `INITIAL_STOCK` movements so the ledger has a clean starting point.
- Can be disabled/hidden after initial migration is complete.

---

## 3. Movement Cascade Rules (The Golden Rules)

These are the system-wide invariants that must NEVER be broken:

1. **Every stock change creates a movement record.** No silent quantity edits. The movement ledger is the source of truth.

2. **Stock quantities are always updated within a database transaction alongside their movement records.** If the movement fails to write, the stock doesn't change. If the stock fails to update, the movement doesn't write.

3. **Transfers create exactly two paired movements** with a shared `transferGroupId`. TRANSFER_OUT at source + TRANSFER_IN at destination. Both or neither.

4. **Sales fulfilled at a BRANCH decrease that branch's stock.** The SalesOrderItem.locationId determines which branch is affected.

5. **Voids/returns at a BRANCH increase that branch's stock.** Reversed using the original SalesOrderItem's locationId.

6. **Supplier receipts ONLY increase WAREHOUSE stock.** The system should reject attempts to receive supplier stock directly at a branch.

7. **Available quantity = On Hand − Reserved.** All transfer and sale validations check available quantity, not raw on-hand.

8. **LocationStock rows are upserted.** If a product has never been at a location, a new row is created on the first movement. No need to pre-populate.

9. **Deactivating a location does NOT delete its stock.** It prevents new movements to/from that location. Existing stock remains visible and must be transferred out before the location can be fully retired.

---

## 4. Schema Changes Required

### 4.1 New Model: Brand

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

### 4.2 New Model: ProductSupplier (junction)

```prisma
model ProductSupplier {
  id         String   @id @default(uuid())
  productId  String
  supplierId String
  isPrimary  Boolean  @default(false)
  costPrice  Decimal  @db.Decimal(12, 2)
  leadTimeDays Int?
  notes      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  supplier   Supplier @relation(fields: [supplierId], references: [id], onDelete: Restrict)

  @@unique([productId, supplierId])
  @@index([supplierId])
}
```

### 4.3 Product Model Changes

```prisma
model Product {
  // ... existing fields ...
  brandId    String              // NEW — required
  brand      Brand               @relation(fields: [brandId], references: [id], onDelete: Restrict)
  suppliers  ProductSupplier[]   // NEW — replaces direct supplierId
  // REMOVE: supplierId  String?
  // REMOVE: supplier    Supplier? @relation(...)
  // NOTE: costPrice moves to ProductSupplier (per-supplier cost)
  //       Product keeps a "default" costPrice for quick reference/display
}
```

### 4.4 MovementType Enum Update

```prisma
enum MovementType {
  PURCHASE_RECEIVED
  SALES_FULFILLED
  MANUAL_ADJUSTMENT
  TRANSFER_OUT
  TRANSFER_IN
  CUSTOMER_RETURN
  DAMAGED_LOST
  INITIAL_STOCK       // NEW
}
```

---

## 5. Implementation Phases

### Phase 1: Schema + Cleanup (Do First)

1. Delete `pure-desk-main/` folder entirely.
2. Delete `components/sales-orders/sales-order-form.tsx` (the old form, keeping only the redesign).
3. Delete `IMPLEMENTATION-PROMPTS.md`.
4. Run Prisma migration:
   - Add `Brand` model.
   - Add `ProductSupplier` junction model.
   - Add `brandId` to Product (will need a default brand for existing products or migration script).
   - Add `INITIAL_STOCK` to MovementType enum.
   - Remove `supplierId` from Product (after migrating existing supplier links to ProductSupplier).
   - Remove `costPrice` from Product OR keep it as a display field derived from primary supplier.
5. Create the "clear mock data" migration/script — nuke all mock categories, suppliers, locations, products, stock rows, movements, and audit logs with mock references.
6. Remove `MockDataPanel` component and its references.

### Phase 2: Categories + Brands (Foundation Data)

1. Add Brand CRUD — brand list page with search, create/edit forms.
2. Update Categories page — add "Brands" tab toggle at the top.
3. Update Product form — add Brand dropdown, replace single supplier select with multi-supplier selector.
4. Update product list/detail pages to show brand.
5. Validators and DAL updates for brand.

### Phase 3: Locations Enhancement

1. Enhance Locations page — add create/edit functionality (currently read-only).
2. Location form: name, code, type (Warehouse/Branch), address, manager, contact, isActive toggle.
3. Location detail page showing site info + stock summary + recent movements.
4. Enforce: deactivating a location with stock shows warning.
5. Add location type badges and filtering on the list page.

### Phase 4: Inventory Overhaul

1. **Landing view** — Location cards (warehouses section + branches section + system-wide card + global summary).
2. **Location inventory view** — tabbed interface (Current Stock | Movement Ledger | Low Stock Alerts) with persistent filter bar.
3. **Supplier Receipt form** — warehouse-only stock receiving. Form: supplier → products → quantities → reference → notes.
4. **Enhanced Transfer form** — supports all transfer directions (W→B, W→W, B→B, B→W). Add business rule enforcement and source/destination type display.
5. **Initial Stock Load tool** — admin-only bulk stock entry for data migration. Individual form OR CSV upload. Logs INITIAL_STOCK movements.
6. Update the existing Adjustment form to include reason codes that map to DAMAGED_LOST when appropriate.

### Phase 5: Dashboard + Cross-Module Wiring

1. Replace the developer status dashboard with real KPIs:
   - Today's sales (count + revenue).
   - Low stock alerts (count, clickable to inventory).
   - Recent movements (last 10, with type badges).
   - Revenue trend (7-day mini chart).
   - Per-location stock health summary.
2. Wire up the `[...segments]` catch-all to show a proper "Coming Soon" or 404 for unbuilt pages.
3. Remove nav items for modules that don't exist yet (Suppliers standalone page, Purchase Orders, Audit Logs, Settings) OR create minimal placeholder pages.

---

## 6. What We Are NOT Building Yet

To keep scope controlled, these are explicitly deferred:

- **Purchase Orders** (formal PO → approval → receive workflow). The Supplier Receipt form in Inventory covers the "receive stock" need. PO comes later as a planning layer.
- **Suppliers standalone page** (CRUD for suppliers). Currently suppliers exist in the schema. We'll use them via the Product form's multi-supplier selector. A dedicated management page can come later.
- **Audit Logs viewer page**.
- **Settings page**.
- **Barcode scanning** (referenced in prompts but not in scope for this phase).
- **Reserved quantity workflow** (reservedQty exists in schema but no formal reservation flow yet).

---

## 7. Data Migration Strategy

For loading the client's real data after the system is rebuilt:

1. **Step 1:** Create all Categories and Brands first.
2. **Step 2:** Create all Suppliers.
3. **Step 3:** Create all Products (linking to categories, brands, and suppliers).
4. **Step 4:** Create all Locations (warehouses and branches).
5. **Step 5:** Use the Initial Stock Load tool to enter opening quantities per location per product. Each entry creates an `INITIAL_STOCK` movement so the ledger starts clean.

This can be done via the UI forms or via a bulk CSV import if the dataset is large.

---

*This plan is the single source of truth for the Operations modules. All implementation work should reference this document.*
