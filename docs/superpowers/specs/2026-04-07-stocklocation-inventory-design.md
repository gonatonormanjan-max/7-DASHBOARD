# StockLocation & Inventory Movement Design
**Date:** 2026-04-07
**Status:** Approved
**Scope:** Warehouse → StockLocation unification + full inventory movement model

---

## 1. Background & Goal

The system previously modeled only `Warehouse` as a stock-holding location. The business reality is that **store branches** also hold stock, receive supplier deliveries, and must be inventoried. Rather than creating a separate `Branch` model (which would duplicate code paths), we unify both into a single `StockLocation` model distinguished by a `type` enum.

**Core principle:** INVENTORY = the ledger of movement. It is not a place — it describes what moved, where, when, and who did it.

---

## 2. Data Model Changes

### 2.1 New Enum: `LocationType`

```prisma
enum LocationType {
  WAREHOUSE
  BRANCH
}
```

### 2.2 Rename `Warehouse` → `StockLocation`

```prisma
model StockLocation {
  id            String        @id @default(uuid())
  name          String        @unique
  code          String        @unique
  type          LocationType  // WAREHOUSE or BRANCH
  address       String?       // physical address
  managerName   String?       // person in charge
  contactNumber String?       // phone/contact for this location
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  assignedUsers User[]
  stock         LocationStock[]
  salesItems    SalesOrderItem[]
  movements     InventoryMovement[]
}
```

**Fields added vs current `Warehouse`:**
| Field | Reason |
|---|---|
| `type` | Distinguishes WAREHOUSE from BRANCH |
| `address` | Replaces old `location: String?` (renamed for clarity) |
| `managerName` | Who manages this location |
| `contactNumber` | Contact info for the location |

### 2.3 Rename `WarehouseStock` → `LocationStock`

```prisma
model LocationStock {
  id          String        @id @default(uuid())
  locationId  String
  productId   String
  quantity    Int           @default(0)
  reservedQty Int           @default(0)
  updatedAt   DateTime      @updatedAt
  location    StockLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)
  product     Product       @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([locationId, productId])
  @@index([productId])
}
```

`LocationStock` is the **snapshot** of current quantity per product per location. It is updated every time an `InventoryMovement` is recorded.

### 2.4 Updated `MovementType` Enum

```prisma
enum MovementType {
  PURCHASE_RECEIVED   // Supplier delivers stock to any location
  TRANSFER_OUT        // Stock leaves a location (source side)
  TRANSFER_IN         // Stock arrives at a location (destination side)
  SALES_FULFILLED     // Branch sells to a customer
  CUSTOMER_RETURN     // Customer returns item to a branch
  MANUAL_ADJUSTMENT   // Admin manually corrects a stock count
  DAMAGED_LOST        // Stock written off as damaged or lost
}
```

**Removed:** `WAREHOUSE_TRANSFER` — replaced by the `TRANSFER_OUT` / `TRANSFER_IN` pair.

### 2.5 Updated `InventoryMovement`

```prisma
model InventoryMovement {
  id              String        @id @default(uuid())
  type            MovementType
  productId       String
  locationId      String        // was: warehouseId
  quantityChange  Int           // positive = stock in, negative = stock out
  transferGroupId String?       // links TRANSFER_OUT + TRANSFER_IN pair
  referenceType   String?       // e.g. "PurchaseOrder", "SalesOrder"
  referenceId     String?       // FK to the related document
  notes           String?
  performedById   String        // who executed this action (was: createdById)
  createdAt       DateTime      @default(now())
  product         Product       @relation(fields: [productId], references: [id], onDelete: Restrict)
  location        StockLocation @relation(fields: [locationId], references: [id], onDelete: Restrict)
  performedBy     User          @relation(fields: [performedById], references: [id], onDelete: Restrict)

  @@index([productId, locationId, createdAt])
  @@index([referenceType, referenceId])
  @@index([performedById])
  @@index([transferGroupId])
}
```

**Key change:** `createdById` → `performedById` to express semantic intent: *the person who performed the stock action*, not just who created the record. This name also displays clearly in the Reports UI ("Performed by: Juan dela Cruz").

### 2.6 Updated `User`

```prisma
// was: assignedWarehouseId / assignedWarehouse
assignedLocationId  String?
assignedLocation    StockLocation? @relation(fields: [assignedLocationId], references: [id], onDelete: SetNull)
```

### 2.7 Updated `SalesOrderItem`

```prisma
// was: warehouseId / warehouse
locationId  String
location    StockLocation @relation(fields: [locationId], references: [id], onDelete: Restrict)
```

---

## 3. Movement Types — Full Reference

| MovementType | `quantityChange` | Triggered By | Allowed Location Types |
|---|---|---|---|
| `PURCHASE_RECEIVED` | positive (+) | PO marked received | WAREHOUSE, BRANCH |
| `TRANSFER_OUT` | negative (−) | Transfer initiated | WAREHOUSE, BRANCH |
| `TRANSFER_IN` | positive (+) | Transfer received | WAREHOUSE, BRANCH |
| `SALES_FULFILLED` | negative (−) | Sales order delivered | BRANCH only |
| `CUSTOMER_RETURN` | positive (+) | Return recorded | BRANCH only |
| `MANUAL_ADJUSTMENT` | positive or negative | Admin correction | WAREHOUSE, BRANCH |
| `DAMAGED_LOST` | negative (−) | Damage/loss report | WAREHOUSE, BRANCH |

### 3.1 Transfer Pair Pattern

Every stock transfer between locations creates **two linked records** sharing the same `transferGroupId`:

```
Transfer: Warehouse A → Branch B (10 units of Product X)

Record 1:
  type:           TRANSFER_OUT
  locationId:     warehouse_a_id
  quantityChange: -10
  transferGroupId: "txfr_abc123"

Record 2:
  type:           TRANSFER_IN
  locationId:     branch_b_id
  quantityChange: +10
  transferGroupId: "txfr_abc123"
```

Both records are created atomically in a single database transaction. The `transferGroupId` allows Reports to show this as one transfer event rather than two disconnected movements.

---

## 4. Business Rules

| Rule | Detail |
|---|---|
| **Only BRANCH fulfills retail sales** | `SALES_FULFILLED` and `CUSTOMER_RETURN` are restricted to locations with `type = BRANCH` |
| **Both types receive supplier deliveries** | `PURCHASE_RECEIVED` is valid for WAREHOUSE and BRANCH |
| **Transfers are always paired** | A `TRANSFER_OUT` always creates a corresponding `TRANSFER_IN` in the same DB transaction |
| **In-transit state** | A transfer with `TRANSFER_OUT` but no matching `TRANSFER_IN` = in transit (for multi-day deliveries) |
| **Stock cannot go negative** | Validate available quantity before any `TRANSFER_OUT`, `SALES_FULFILLED`, or `DAMAGED_LOST` |
| **Every movement records who did it** | `performedById` is required on all `InventoryMovement` records |
| **LocationStock stays in sync** | Every `InventoryMovement` write must also update `LocationStock.quantity` atomically |

---

## 5. Stock Flow Diagram

```
Supplier
   │
   ├─── PURCHASE_RECEIVED ──► WAREHOUSE
   │                               │
   │                               └─── TRANSFER_OUT / TRANSFER_IN ──► BRANCH
   │
   └─── PURCHASE_RECEIVED ──► BRANCH
                                   │
                                   └─── SALES_FULFILLED ──► Customer
                                   └─── CUSTOMER_RETURN ◄── Customer
```

---

## 6. Reports Implications

The `InventoryMovement` table is the single source of truth for all reporting. Key report sections:

| Report | Data Source | Key Filters |
|---|---|---|
| **Stock by Location** | `LocationStock` snapshot | location, product, low-stock flag |
| **Movement History** | `InventoryMovement` | location, product, date range, type, performedBy |
| **Transfer Log** | `InventoryMovement` grouped by `transferGroupId` | from/to location, date, product |
| **Supplier Deliveries** | `InventoryMovement` WHERE type=PURCHASE_RECEIVED | supplier, PO number, date, destination location |
| **Sales Fulfillment** | `InventoryMovement` WHERE type=SALES_FULFILLED | branch, sales order, date |
| **Loss & Adjustment** | `InventoryMovement` WHERE type IN (DAMAGED_LOST, MANUAL_ADJUSTMENT) | location, product, performedBy, date |
| **Branch Performance** | `InventoryMovement` SALES_FULFILLED aggregated | branch, date range, product |
| **Warehouse Distribution** | `InventoryMovement` TRANSFER_OUT from WAREHOUSE | source warehouse, destination branch, date |

All reports expose `performedBy → User.firstName + User.lastName` so every action is attributable to a person.

---

## 7. Rename Map (Migration Reference)

| Old | New |
|---|---|
| `Warehouse` model | `StockLocation` model |
| `WarehouseStock` model | `LocationStock` model |
| `warehouseId` (all models) | `locationId` |
| `warehouse` relation (all models) | `location` |
| `assignedWarehouseId` (User) | `assignedLocationId` |
| `assignedWarehouse` (User) | `assignedLocation` |
| `WAREHOUSE_TRANSFER` enum value | removed — replaced by `TRANSFER_OUT` + `TRANSFER_IN` |
| `createdById` (InventoryMovement) | `performedById` |
| `createdBy` relation (InventoryMovement) | `performedBy` |
| `Product.warehouseStock` | `Product.locationStock` |

---

## 8. Out of Scope (Future)

- Multi-currency pricing per location
- Location-specific product pricing
- Inter-branch transfers (Branch → Branch) — currently not restricted but not a primary use case
- Real-time in-transit tracking (shipping status)
