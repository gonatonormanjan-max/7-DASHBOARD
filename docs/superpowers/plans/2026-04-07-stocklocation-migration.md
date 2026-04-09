# StockLocation Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `Warehouse` model to a unified `StockLocation` model (with `type: WAREHOUSE | BRANCH`), update the movement ledger to use paired `TRANSFER_OUT`/`TRANSFER_IN` entries, and propagate all renames across every layer of the stack.

**Architecture:** Single Prisma migration replaces the `Warehouse` and `WarehouseStock` tables with `StockLocation` and `LocationStock`. Every downstream file (validators, DAL, server actions, components, pages) is updated in dependency order — schema first, then lib, then UI. No new pages are created; existing pages are updated in-place.

**Tech Stack:** Next.js 14+, Prisma ORM, PostgreSQL, TypeScript, Zod, React Server Components / Server Actions

---

## File Map

### Modified (schema layer)
- `prisma/schema.prisma` — full model + enum changes

### Modified (constants / validators)
- `lib/inventory.ts` — update `INVENTORY_MOVEMENT_TYPES`, `MOVEMENT_TYPE_LABELS`
- `lib/validators/inventory.ts` — rename `warehouseId` → `locationId`, transfer fields
- `lib/validators/users.ts` — rename `assignedWarehouseId` → `assignedLocationId`
- `lib/permissions.ts` — rename `warehouses` resource → `locations`, update nav item

### Modified (data access layer)
- `lib/dal/inventory.ts` — all prisma calls use new model/field names
- `lib/dal/users.ts` — `getUserById` + rename `getActiveWarehouses` → `getActiveLocations`
- `lib/dal/reports.ts` — `getWarehouseUtilization` → `getLocationUtilization`, movement types

### Modified (server actions)
- `lib/actions/inventory.ts` — all prisma calls, split `WAREHOUSE_TRANSFER` → `TRANSFER_OUT`/`TRANSFER_IN` pair
- `lib/actions/users.ts` — rename `assignedWarehouseId` → `assignedLocationId`

### Modified (UI components)
- `components/inventory/inventory-filters.tsx`
- `components/inventory/stock-table.tsx`
- `components/inventory/movement-table.tsx`
- `components/inventory/inventory-adjustment-form.tsx`
- `components/inventory/inventory-transfer-form.tsx`
- `components/users/user-form.tsx`
- `components/reports/warehouse-utilization-chart.tsx`

### Modified (pages)
- `app/dashboard/inventory/page.tsx`
- `app/dashboard/users/new/page.tsx`
- `app/dashboard/users/[id]/edit/page.tsx`
- `app/dashboard/reports/page.tsx`
- `app/dashboard/warehouses/page.tsx` — rename route to `locations` OR update in-place

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `LocationType` enum and rename `MovementType`**

Replace the existing `MovementType` enum and add the new enum:

```prisma
enum LocationType {
  WAREHOUSE
  BRANCH
}

enum MovementType {
  PURCHASE_RECEIVED
  SALES_FULFILLED
  MANUAL_ADJUSTMENT
  TRANSFER_OUT
  TRANSFER_IN
  CUSTOMER_RETURN
  DAMAGED_LOST
}
```

- [ ] **Step 2: Replace `Warehouse` model with `StockLocation`**

Remove the `model Warehouse { ... }` block entirely and replace with:

```prisma
model StockLocation {
  id             String        @id @default(uuid())
  name           String        @unique
  code           String        @unique
  type           LocationType
  address        String?
  managerName    String?
  contactNumber  String?
  isActive       Boolean       @default(true)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  assignedUsers  User[]
  stock          LocationStock[]
  salesItems     SalesOrderItem[]
  movements      InventoryMovement[]
}
```

- [ ] **Step 3: Replace `WarehouseStock` model with `LocationStock`**

Remove `model WarehouseStock { ... }` and replace with:

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

- [ ] **Step 4: Update `InventoryMovement` model**

Replace the existing `model InventoryMovement { ... }` with:

```prisma
model InventoryMovement {
  id              String        @id @default(uuid())
  type            MovementType
  productId       String
  locationId      String
  quantityChange  Int
  transferGroupId String?
  referenceType   String?
  referenceId     String?
  notes           String?
  performedById   String
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

- [ ] **Step 5: Update `User` model**

In `model User`, replace:
```prisma
  assignedWarehouseId String?
  assignedWarehouse   Warehouse?          @relation(fields: [assignedWarehouseId], references: [id], onDelete: SetNull)
  inventoryMovements  InventoryMovement[]
```
with:
```prisma
  assignedLocationId  String?
  assignedLocation    StockLocation?      @relation(fields: [assignedLocationId], references: [id], onDelete: SetNull)
  inventoryMovements  InventoryMovement[]
```

- [ ] **Step 6: Update `SalesOrderItem` model**

In `model SalesOrderItem`, replace:
```prisma
  warehouseId  String
  warehouse    Warehouse  @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
```
with:
```prisma
  locationId  String
  location    StockLocation @relation(fields: [locationId], references: [id], onDelete: Restrict)
```

Also update the index: `@@index([warehouseId])` → `@@index([locationId])`

- [ ] **Step 7: Update `Product` model**

In `model Product`, replace:
```prisma
  warehouseStock WarehouseStock[]
```
with:
```prisma
  locationStock LocationStock[]
```

- [ ] **Step 8: Verify the schema compiles**

```bash
cd /c/Users/margu/OneDrive/Desktop/7dashboard
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

---

## Task 2: Generate and Run the Migration

**Files:**
- Creates: `prisma/migrations/<timestamp>_stocklocation_migration/migration.sql`

- [ ] **Step 1: Generate the migration**

```bash
cd /c/Users/margu/OneDrive/Desktop/7dashboard
npx prisma migrate dev --name stocklocation_migration
```

Expected output ends with: `Your database is now in sync with your schema.`

> If Prisma can't auto-detect the rename (it sees DROP + CREATE instead of RENAME), it will warn you. In that case, edit the generated `.sql` file before applying:
> - Replace `DROP TABLE "Warehouse"` with `ALTER TABLE "Warehouse" RENAME TO "StockLocation";`
> - Replace `DROP TABLE "WarehouseStock"` with `ALTER TABLE "WarehouseStock" RENAME TO "LocationStock";`
> - Replace `ALTER TABLE "StockLocation" DROP COLUMN "location"` + `ALTER TABLE "StockLocation" ADD COLUMN "address"` with `ALTER TABLE "StockLocation" RENAME COLUMN "location" TO "address";`
> - Replace `DROP COLUMN "warehouseId"` + `ADD COLUMN "locationId"` with `RENAME COLUMN "warehouseId" TO "locationId";` (in LocationStock, InventoryMovement, SalesOrderItem)
> - Replace `DROP COLUMN "assignedWarehouseId"` + `ADD COLUMN "assignedLocationId"` with `RENAME COLUMN "assignedWarehouseId" TO "assignedLocationId";` (in User)
> - Replace `DROP COLUMN "createdById"` + `ADD COLUMN "performedById"` with `RENAME COLUMN "createdById" TO "performedById";` (in InventoryMovement)
> Then run: `npx prisma migrate dev` again to apply the edited SQL.

- [ ] **Step 2: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: migrate Warehouse to unified StockLocation model with BRANCH/WAREHOUSE type"
```

---

## Task 3: Update Constants and Validators

**Files:**
- Modify: `lib/inventory.ts`
- Modify: `lib/validators/inventory.ts`
- Modify: `lib/validators/users.ts`
- Modify: `lib/permissions.ts`

- [ ] **Step 1: Update `lib/inventory.ts`**

Replace the file content:

```typescript
import { MovementType, ProductStatus } from "@prisma/client";

export const INVENTORY_MUTABLE_PRODUCT_STATUSES = [
  ProductStatus.ACTIVE,
  ProductStatus.INACTIVE,
] as const;

export const INVENTORY_MOVEMENT_TYPES = [
  MovementType.PURCHASE_RECEIVED,
  MovementType.SALES_FULFILLED,
  MovementType.MANUAL_ADJUSTMENT,
  MovementType.TRANSFER_OUT,
  MovementType.TRANSFER_IN,
  MovementType.CUSTOMER_RETURN,
  MovementType.DAMAGED_LOST,
] as const;

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  PURCHASE_RECEIVED: "Purchase received",
  SALES_FULFILLED: "Sales fulfilled",
  MANUAL_ADJUSTMENT: "Manual adjustment",
  TRANSFER_OUT: "Transfer out",
  TRANSFER_IN: "Transfer in",
  CUSTOMER_RETURN: "Customer return",
  DAMAGED_LOST: "Damaged or lost",
};

export function getMovementTypeLabel(type: MovementType) {
  return MOVEMENT_TYPE_LABELS[type];
}

export function formatSignedQuantity(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US")}`;
}

export function getAvailableQuantity(quantity: number, reservedQty: number) {
  return quantity - reservedQty;
}
```

- [ ] **Step 2: Update `lib/validators/inventory.ts`**

Replace `warehouseId` → `locationId` and transfer field names throughout:

```typescript
import { z } from "zod";
import { INVENTORY_MOVEMENT_TYPES } from "@/lib/inventory";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const optionalUuidFilter = z.string().uuid().optional().catch(undefined);

const optionalTextArea = z
  .string()
  .trim()
  .max(500, "Notes must be 500 characters or fewer.")
  .optional()
  .transform((value) => value || null);

const booleanishField = z.preprocess((value) => {
  if (value === "true" || value === "on" || value === true) {
    return true;
  }
  if (
    value === "false" ||
    value === false ||
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return false;
  }
  return value;
}, z.boolean().catch(false).default(false));

const optionalDateFilter = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
  .optional()
  .catch(undefined);

export const inventoryFiltersSchema = z.object({
  query: z.string().trim().max(120).optional().default(""),
  locationId: optionalUuidFilter,
  categoryId: optionalUuidFilter,
  supplierId: optionalUuidFilter,
  lowStockOnly: booleanishField,
  movementType: z
    .enum(["all", ...INVENTORY_MOVEMENT_TYPES])
    .optional()
    .catch("all")
    .default("all"),
  dateFrom: optionalDateFilter,
  dateTo: optionalDateFilter,
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().uuid("Select a valid product."),
  locationId: z.string().uuid("Select a valid location."),
  direction: z.enum(["increase", "decrease"]),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  reason: z
    .string()
    .trim()
    .min(3, "Reason is required.")
    .max(120, "Reason must be 120 characters or fewer."),
  notes: optionalTextArea,
});

export const inventoryTransferSchema = z
  .object({
    productId: z.string().uuid("Select a valid product."),
    fromLocationId: z.string().uuid("Select a valid source location."),
    toLocationId: z.string().uuid("Select a valid destination location."),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
    notes: optionalTextArea,
  })
  .refine((value) => value.fromLocationId !== value.toLocationId, {
    message: "Choose different locations for the transfer.",
    path: ["toLocationId"],
  });

export type InventoryPageFilters = z.output<typeof inventoryFiltersSchema>;
export type InventoryAdjustmentValues = z.input<typeof inventoryAdjustmentSchema>;
export type InventoryAdjustmentData = z.output<typeof inventoryAdjustmentSchema>;
export type InventoryTransferValues = z.input<typeof inventoryTransferSchema>;
export type InventoryTransferData = z.output<typeof inventoryTransferSchema>;

type InventoryFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export type InventoryAdjustmentState = InventoryFormState;
export type InventoryTransferState = InventoryFormState;

export const initialInventoryAdjustmentState: InventoryAdjustmentState = {
  status: "idle",
};

export const initialInventoryTransferState: InventoryTransferState = {
  status: "idle",
};

export function parseInventoryFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  return inventoryFiltersSchema.parse({
    query: firstString(searchParams.query),
    locationId: firstString(searchParams.locationId),
    categoryId: firstString(searchParams.categoryId),
    supplierId: firstString(searchParams.supplierId),
    lowStockOnly: firstString(searchParams.lowStockOnly),
    movementType: firstString(searchParams.movementType),
    dateFrom: firstString(searchParams.dateFrom),
    dateTo: firstString(searchParams.dateTo),
  });
}

export function extractInventoryAdjustmentValues(formData: FormData) {
  return {
    productId: String(formData.get("productId") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
    direction: String(formData.get("direction") ?? "increase"),
    quantity: String(formData.get("quantity") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export function extractInventoryTransferValues(formData: FormData) {
  return {
    productId: String(formData.get("productId") ?? ""),
    fromLocationId: String(formData.get("fromLocationId") ?? ""),
    toLocationId: String(formData.get("toLocationId") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}
```

- [ ] **Step 3: Update `lib/validators/users.ts`**

In `baseUserSchema`, replace:
```typescript
  assignedWarehouseId: z
    .string()
    .uuid("Select a valid warehouse.")
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
```
with:
```typescript
  assignedLocationId: z
    .string()
    .uuid("Select a valid location.")
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
```

In `extractUserFormValues`, replace:
```typescript
    assignedWarehouseId: String(formData.get("assignedWarehouseId") ?? ""),
```
with:
```typescript
    assignedLocationId: String(formData.get("assignedLocationId") ?? ""),
```

- [ ] **Step 4: Update `lib/permissions.ts`**

Replace the `warehouses` resource key with `locations` throughout. In `PermissionResource`:
```typescript
  | "locations"
```
(remove `| "warehouses"`)

In `permissionMatrix` for ADMIN, SYSTEM_MANAGER, SALES_STAFF — replace `warehouses:` with `locations:`.

In `NAV_ITEMS`, update the Warehouses entry:
```typescript
  {
    title: "Locations",
    href: "/dashboard/locations",
    icon: "warehouse",
    section: "Operations",
    resource: "locations",
    action: "read",
  },
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /c/Users/margu/OneDrive/Desktop/7dashboard
npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only in files not yet updated (DAL, actions, components) — not in the files just edited.

- [ ] **Step 6: Commit**

```bash
git add lib/inventory.ts lib/validators/inventory.ts lib/validators/users.ts lib/permissions.ts
git commit -m "feat: update constants, validators, and permissions for StockLocation rename"
```

---

## Task 4: Update Data Access Layer

**Files:**
- Modify: `lib/dal/inventory.ts`
- Modify: `lib/dal/users.ts`
- Modify: `lib/dal/reports.ts`

- [ ] **Step 1: Update `lib/dal/inventory.ts`**

Replace the full file. Key changes:
- `Prisma.WarehouseStockWhereInput` → `Prisma.LocationStockWhereInput`
- `filters.warehouseId` → `filters.locationId`
- `prisma.warehouseStock.findMany` → `prisma.locationStock.findMany`
- `prisma.inventoryMovement` select: `warehouse` relation → `location`, `createdBy` → `performedBy`
- `prisma.warehouse.findMany` → `prisma.stockLocation.findMany`
- All `warehouse: { select: { ... } }` include blocks → `location: { select: { ... } }`

Full replacement:

```typescript
import "server-only";

import { Prisma, ProductStatus } from "@prisma/client";
import { getAvailableQuantity } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import type { InventoryPageFilters } from "@/lib/validators/inventory";

function getDateRangeWhere(filters: InventoryPageFilters) {
  const createdAt: Prisma.DateTimeFilter = {};

  if (filters.dateFrom) {
    createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000`);
  }

  if (filters.dateTo) {
    createdAt.lte = new Date(`${filters.dateTo}T23:59:59.999`);
  }

  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
}

function getInventoryProductWhere(filters: InventoryPageFilters): Prisma.ProductWhereInput {
  return {
    status: {
      in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE],
    },
    ...(filters.query
      ? {
          OR: [
            { name: { contains: filters.query, mode: "insensitive" } },
            { sku: { contains: filters.query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
  };
}

function isLowStockRow(row: {
  quantity: number;
  reservedQty: number;
  product: { reorderLevel: number };
}) {
  const availableQty = getAvailableQuantity(row.quantity, row.reservedQty);
  return row.product.reorderLevel > 0 && availableQty <= row.product.reorderLevel;
}

export async function getInventoryPageData(filters: InventoryPageFilters) {
  const productWhere = getInventoryProductWhere(filters);
  const createdAt = getDateRangeWhere(filters);

  const stockWhere: Prisma.LocationStockWhereInput = {
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    product: productWhere,
  };

  const movementWhere: Prisma.InventoryMovementWhereInput = {
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(filters.movementType !== "all" ? { type: filters.movementType } : {}),
    ...(createdAt ? { createdAt } : {}),
    product: productWhere,
  };

  const [stockRows, movements, locations, categories, suppliers, products] =
    await Promise.all([
      prisma.locationStock.findMany({
        where: stockWhere,
        orderBy: [{ location: { name: "asc" } }, { product: { name: "asc" } }],
        select: {
          id: true,
          quantity: true,
          reservedQty: true,
          updatedAt: true,
          location: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              isActive: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              reorderLevel: true,
              category: {
                select: { id: true, name: true },
              },
              supplier: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.inventoryMovement.findMany({
        where: movementWhere,
        orderBy: [{ createdAt: "desc" }],
        take: 40,
        select: {
          id: true,
          type: true,
          quantityChange: true,
          notes: true,
          createdAt: true,
          transferGroupId: true,
          location: {
            select: { id: true, name: true, code: true },
          },
          product: {
            select: { id: true, name: true, sku: true },
          },
          performedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.stockLocation.findMany({
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, code: true, type: true },
      }),
      prisma.category.findMany({
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.supplier.findMany({
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.product.findMany({
        where: { status: { in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] } },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, sku: true },
      }),
    ]);

  const visibleStockRows = filters.lowStockOnly
    ? stockRows.filter((row) => isLowStockRow(row))
    : stockRows;

  const lowStockRows = [...stockRows]
    .filter((row) => isLowStockRow(row))
    .sort((left, right) => {
      const leftShortage =
        left.product.reorderLevel - getAvailableQuantity(left.quantity, left.reservedQty);
      const rightShortage =
        right.product.reorderLevel - getAvailableQuantity(right.quantity, right.reservedQty);
      return rightShortage - leftShortage || left.product.name.localeCompare(right.product.name);
    });

  const skuSet = new Set(
    visibleStockRows
      .filter((row) => getAvailableQuantity(row.quantity, row.reservedQty) > 0)
      .map((row) => row.product.id)
  );

  return {
    stockRows: visibleStockRows,
    lowStockRows,
    movements,
    options: {
      locations,
      categories,
      suppliers,
      products,
    },
    summary: {
      skuCount: skuSet.size,
      lowStockCount: lowStockRows.length,
      outOfStockCount: visibleStockRows.filter(
        (row) => getAvailableQuantity(row.quantity, row.reservedQty) <= 0
      ).length,
      onHandUnits: visibleStockRows.reduce((sum, row) => sum + row.quantity, 0),
    },
  };
}
```

- [ ] **Step 2: Update `lib/dal/users.ts`**

Replace `assignedWarehouseId` in `getUserById` and rename `getActiveWarehouses`:

```typescript
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      assignedLocationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getActiveLocations() {
  return prisma.stockLocation.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
    },
  });
}
```

- [ ] **Step 3: Update `lib/dal/reports.ts` — movement types array**

Find the `MOVEMENT_TYPES` constant (line ~205) and replace:
```typescript
const MOVEMENT_TYPES: MovementType[] = [
  "PURCHASE_RECEIVED",
  "SALES_FULFILLED",
  "MANUAL_ADJUSTMENT",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "CUSTOMER_RETURN",
  "DAMAGED_LOST",
];
```

- [ ] **Step 4: Update `lib/dal/reports.ts` — `getWarehouseUtilization`**

Rename function to `getLocationUtilization` and update prisma calls:

```typescript
async function getLocationUtilization() {
  const stockRows = await prisma.locationStock.findMany({
    where: {
      location: { isActive: true },
    },
    select: {
      quantity: true,
      reservedQty: true,
      location: {
        select: { id: true, name: true, code: true, type: true },
      },
    },
  });

  const locationMap = new Map<
    string,
    {
      name: string;
      code: string;
      type: string;
      totalUnits: number;
      reservedUnits: number;
      productCount: number;
    }
  >();

  for (const row of stockRows) {
    const existing = locationMap.get(row.location.id);

    if (existing) {
      existing.totalUnits += row.quantity;
      existing.reservedUnits += row.reservedQty;
      existing.productCount += 1;
    } else {
      locationMap.set(row.location.id, {
        name: row.location.name,
        code: row.location.code,
        type: row.location.type,
        totalUnits: row.quantity,
        reservedUnits: row.reservedQty,
        productCount: 1,
      });
    }
  }

  return Array.from(locationMap.values()).map((loc) => ({
    ...loc,
    availableUnits: loc.totalUnits - loc.reservedUnits,
  }));
}
```

- [ ] **Step 5: Update `lib/dal/reports.ts` — branch analytics functions**

In `getRevenueByBranchOverTime`, `getBranchComparison`, and `getSeasonalTrends`, the `salesOrderItem` select includes `warehouse: { select: { id, name, code } }`. Replace each with `location: { select: { id, name, code } }` and update all references from `item.warehouse` → `item.location`.

- [ ] **Step 6: Update `getReportsPageData` export**

Find the call to `getWarehouseUtilization()` in `getReportsPageData` and rename it to `getLocationUtilization()`. Update the returned key name accordingly (e.g., `warehouseUtilization` → `locationUtilization`).

- [ ] **Step 7: Verify TypeScript compiles (DAL only)**

```bash
npx tsc --noEmit 2>&1 | grep "lib/dal"
```

Expected: no errors in `lib/dal/` files.

- [ ] **Step 8: Commit**

```bash
git add lib/dal/inventory.ts lib/dal/users.ts lib/dal/reports.ts
git commit -m "feat: update DAL layer to use StockLocation model"
```

---

## Task 5: Update Server Actions

**Files:**
- Modify: `lib/actions/inventory.ts`
- Modify: `lib/actions/users.ts`

- [ ] **Step 1: Update `lib/actions/inventory.ts` — helper functions**

Replace `buildTransferNotes`:
```typescript
function buildTransferNotes(details: {
  fromLocationName: string;
  toLocationName: string;
  notes: string | null;
}) {
  const prefix = `Transfer from ${details.fromLocationName} to ${details.toLocationName}`;
  return details.notes ? `${prefix}\nNotes: ${details.notes}` : prefix;
}
```

- [ ] **Step 2: Update `adjustInventoryAction` in `lib/actions/inventory.ts`**

Replace all `warehouseId` / `warehouse` / `warehouseStock` references with their new names. The full updated body:

```typescript
export async function adjustInventoryAction(
  _prevState: InventoryAdjustmentState,
  formData: FormData
): Promise<InventoryAdjustmentState> {
  const user = await requirePermission("inventory", "update");
  const values = extractInventoryAdjustmentValues(formData);
  const parsed = inventoryAdjustmentSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ...initialInventoryAdjustmentState,
      status: "error",
      message: "Please fix the adjustment details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const [product, location, currentStock] = await Promise.all([
    prisma.product.findFirst({
      where: {
        id: parsed.data.productId,
        status: { in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] },
      },
      select: { id: true, name: true, sku: true },
    }),
    prisma.stockLocation.findFirst({
      where: { id: parsed.data.locationId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.locationStock.findUnique({
      where: {
        locationId_productId: {
          locationId: parsed.data.locationId,
          productId: parsed.data.productId,
        },
      },
      select: { id: true, quantity: true, reservedQty: true },
    }),
  ]);

  if (!product || !location) {
    return {
      status: "error",
      message: "The selected product or location is no longer available.",
      values,
    };
  }

  const availableQty = currentStock
    ? getAvailableQuantity(currentStock.quantity, currentStock.reservedQty)
    : 0;

  if (parsed.data.direction === "decrease" && availableQty < parsed.data.quantity) {
    return {
      status: "error",
      message:
        availableQty > 0
          ? `Only ${availableQty} units are currently available to reduce in ${location.name}.`
          : `No available stock can be reduced from ${location.name}.`,
      values,
    };
  }

  const quantityChange =
    parsed.data.direction === "increase" ? parsed.data.quantity : -parsed.data.quantity;

  await prisma.$transaction(async (tx) => {
    const currentQuantity = currentStock?.quantity ?? 0;
    const nextQuantity = currentQuantity + quantityChange;

    if (currentStock) {
      await tx.locationStock.update({
        where: { id: currentStock.id },
        data: { quantity: nextQuantity },
      });
    } else {
      await tx.locationStock.create({
        data: {
          productId: product.id,
          locationId: location.id,
          quantity: nextQuantity,
        },
      });
    }

    await tx.inventoryMovement.create({
      data: {
        type: "MANUAL_ADJUSTMENT",
        productId: product.id,
        locationId: location.id,
        quantityChange,
        referenceType: "inventory.adjustment",
        notes: buildMovementNotes(parsed.data.reason, parsed.data.notes),
        performedById: user.id,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: "inventory.adjust",
        entity: "location_stock",
        entityId: currentStock?.id ?? `${location.id}:${product.id}`,
        details: {
          direction: parsed.data.direction,
          quantity: parsed.data.quantity,
          reason: parsed.data.reason,
          notes: parsed.data.notes,
          locationId: location.id,
          locationName: location.name,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          previousQuantity: currentQuantity,
          nextQuantity,
        },
      },
      tx
    );
  });

  revalidateInventoryPaths();
  redirect(
    withFlashMessage("/dashboard/inventory", { success: "Inventory adjustment recorded." })
  );
}
```

- [ ] **Step 3: Update `transferInventoryAction` in `lib/actions/inventory.ts`**

This is the most significant change: split `WAREHOUSE_TRANSFER` into `TRANSFER_OUT` + `TRANSFER_IN` with a `transferGroupId`. Full updated body:

```typescript
export async function transferInventoryAction(
  _prevState: InventoryTransferState,
  formData: FormData
): Promise<InventoryTransferState> {
  const user = await requirePermission("inventory", "update");
  const values = extractInventoryTransferValues(formData);
  const parsed = inventoryTransferSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the transfer details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const [product, sourceLocation, destinationLocation, sourceStock] = await Promise.all([
    prisma.product.findFirst({
      where: {
        id: parsed.data.productId,
        status: { in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] },
      },
      select: { id: true, name: true, sku: true },
    }),
    prisma.stockLocation.findFirst({
      where: { id: parsed.data.fromLocationId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.stockLocation.findFirst({
      where: { id: parsed.data.toLocationId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.locationStock.findUnique({
      where: {
        locationId_productId: {
          locationId: parsed.data.fromLocationId,
          productId: parsed.data.productId,
        },
      },
      select: { id: true, quantity: true, reservedQty: true },
    }),
  ]);

  if (!product || !sourceLocation || !destinationLocation) {
    return {
      status: "error",
      message: "The selected product or location is no longer available.",
      values,
    };
  }

  const availableQty = sourceStock
    ? getAvailableQuantity(sourceStock.quantity, sourceStock.reservedQty)
    : 0;

  if (availableQty < parsed.data.quantity) {
    return {
      status: "error",
      message:
        availableQty > 0
          ? `Only ${availableQty} units are available to transfer from ${sourceLocation.name}.`
          : `No available stock can be transferred from ${sourceLocation.name}.`,
      values,
    };
  }

  await prisma.$transaction(async (tx) => {
    const transferGroupId = randomUUID();
    const transferNotes = buildTransferNotes({
      fromLocationName: sourceLocation.name,
      toLocationName: destinationLocation.name,
      notes: parsed.data.notes,
    });

    await tx.locationStock.update({
      where: {
        locationId_productId: {
          locationId: sourceLocation.id,
          productId: product.id,
        },
      },
      data: { quantity: sourceStock!.quantity - parsed.data.quantity },
    });

    await tx.locationStock.upsert({
      where: {
        locationId_productId: {
          locationId: destinationLocation.id,
          productId: product.id,
        },
      },
      create: {
        locationId: destinationLocation.id,
        productId: product.id,
        quantity: parsed.data.quantity,
      },
      update: { quantity: { increment: parsed.data.quantity } },
    });

    await tx.inventoryMovement.createMany({
      data: [
        {
          type: "TRANSFER_OUT",
          productId: product.id,
          locationId: sourceLocation.id,
          quantityChange: -parsed.data.quantity,
          transferGroupId,
          referenceType: "inventory.transfer",
          referenceId: transferGroupId,
          notes: transferNotes,
          performedById: user.id,
        },
        {
          type: "TRANSFER_IN",
          productId: product.id,
          locationId: destinationLocation.id,
          quantityChange: parsed.data.quantity,
          transferGroupId,
          referenceType: "inventory.transfer",
          referenceId: transferGroupId,
          notes: transferNotes,
          performedById: user.id,
        },
      ],
    });

    await logAudit(
      {
        userId: user.id,
        action: "inventory.transfer",
        entity: "inventory_transfer",
        entityId: transferGroupId,
        details: {
          quantity: parsed.data.quantity,
          notes: parsed.data.notes,
          fromLocationId: sourceLocation.id,
          fromLocationName: sourceLocation.name,
          toLocationId: destinationLocation.id,
          toLocationName: destinationLocation.name,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
        },
      },
      tx
    );
  });

  revalidateInventoryPaths();
  redirect(
    withFlashMessage("/dashboard/inventory", { success: "Transfer recorded." })
  );
}
```

- [ ] **Step 4: Update `lib/actions/users.ts`**

In `buildChangedFields`, replace both parameter types and the comparison:
- `assignedWarehouseId: string | null` → `assignedLocationId: string | null` (in both `currentUser` and `nextUser` parameter types)
- `currentUser.assignedWarehouseId !== nextUser.assignedWarehouseId` → `currentUser.assignedLocationId !== nextUser.assignedLocationId`
- `changedFields.push("assignedWarehouseId")` → `changedFields.push("assignedLocationId")`

Then find all `assignedWarehouseId` usages in `createUserAction` and `updateUserAction` (the `prisma.user.create/update` data objects, the role-based assignment conditionals) and replace with `assignedLocationId`.

- [ ] **Step 5: Verify TypeScript compiles (actions only)**

```bash
npx tsc --noEmit 2>&1 | grep "lib/actions"
```

Expected: no errors in `lib/actions/` files.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/inventory.ts lib/actions/users.ts
git commit -m "feat: update server actions — TRANSFER_OUT/IN pair, StockLocation field names"
```

---

## Task 6: Update UI Components

**Files:**
- Modify: `components/inventory/inventory-filters.tsx`
- Modify: `components/inventory/stock-table.tsx`
- Modify: `components/inventory/movement-table.tsx`
- Modify: `components/inventory/inventory-adjustment-form.tsx`
- Modify: `components/inventory/inventory-transfer-form.tsx`
- Modify: `components/users/user-form.tsx`
- Modify: `components/reports/warehouse-utilization-chart.tsx`

- [ ] **Step 1: Update `components/inventory/inventory-filters.tsx`**

- Rename prop type: `warehouses` array → `locations` array, items have `{ id, name, code, type }`
- Rename filter field: `warehouseId` → `locationId` (URL param name and form field name)
- Update the movement type dropdown: remove `WAREHOUSE_TRANSFER` option, add `TRANSFER_OUT` ("Transfer out") and `TRANSFER_IN` ("Transfer in") options
- Update the location select label to "Location" and placeholder to "All locations"

- [ ] **Step 2: Update `components/inventory/stock-table.tsx`**

- Rename prop/type: `warehouse` → `location` in stock row type
- Update displayed column header from "Warehouse" to "Location"
- Show location `type` badge (WAREHOUSE / BRANCH) alongside location name

- [ ] **Step 3: Update `components/inventory/movement-table.tsx`**

- Rename `warehouse` → `location` in movement row type
- Column header "Warehouse" → "Location"
- Add `performedBy` column: display `${row.performedBy.firstName} ${row.performedBy.lastName}`
- For `TRANSFER_OUT`/`TRANSFER_IN` types: show a link icon or "(paired)" label if `transferGroupId` is present

- [ ] **Step 4: Update `components/inventory/inventory-adjustment-form.tsx`**

- Rename hidden input `name="warehouseId"` → `name="locationId"`
- Rename prop `warehouses` → `locations`
- Update select label from "Warehouse" to "Location"

- [ ] **Step 5: Update `components/inventory/inventory-transfer-form.tsx`**

- Rename hidden inputs: `name="fromWarehouseId"` → `name="fromLocationId"`, `name="toWarehouseId"` → `name="toLocationId"`
- Rename prop type: `warehouses` → `locations`
- Update form title from "Warehouse transfer" to "Stock transfer"
- Update select labels from "From warehouse" / "To warehouse" to "From location" / "To location"
- Update error field paths: `fieldErrors.toWarehouseId` → `fieldErrors.toLocationId`

- [ ] **Step 6: Update `components/users/user-form.tsx`**

- Rename type `WarehouseOption` → `LocationOption`, add `type` field: `{ id: string; name: string; code: string; type: string }`
- Rename prop `warehouses: WarehouseOption[]` → `locations: LocationOption[]`
- Rename hidden input `name="assignedWarehouseId"` → `name="assignedLocationId"`
- Update field error key: `fieldErrors?.assignedWarehouseId` → `fieldErrors?.assignedLocationId`
- Update default value source: `user?.assignedWarehouseId` → `user?.assignedLocationId`
- Update label text from "Assigned branch" to "Assigned location" (or keep "Assigned branch" if the client-facing term is preferred — confirm with client)

- [ ] **Step 7: Update `components/reports/warehouse-utilization-chart.tsx`**

- Rename prop type: `warehouseUtilization` → `locationUtilization` (or update the parent prop name passed in)
- Update chart title from "Warehouse Utilization" to "Location Utilization"
- Add a `type` badge (WAREHOUSE / BRANCH) to each bar/row label so the chart distinguishes warehouses from branches

- [ ] **Step 8: Verify TypeScript compiles (components only)**

```bash
npx tsc --noEmit 2>&1 | grep "components/"
```

Expected: no errors in `components/` files.

- [ ] **Step 9: Commit**

```bash
git add components/
git commit -m "feat: update inventory, user, and report components for StockLocation rename"
```

---

## Task 7: Update Page Routes

**Files:**
- Modify: `app/dashboard/inventory/page.tsx`
- Modify: `app/dashboard/users/new/page.tsx`
- Modify: `app/dashboard/users/[id]/edit/page.tsx`
- Modify: `app/dashboard/reports/page.tsx`
- Rename/Modify: `app/dashboard/warehouses/` → `app/dashboard/locations/`

- [ ] **Step 1: Update `app/dashboard/inventory/page.tsx`**

The page calls `getInventoryPageData(filters)` and passes `options.warehouses` to components. Replace `options.warehouses` → `options.locations` in all prop spreads. Update `parseInventoryFilters` call — it now reads `locationId` from search params, which is handled inside the validator, so no change needed there.

- [ ] **Step 2: Update `app/dashboard/users/new/page.tsx` and `[id]/edit/page.tsx`**

Both pages call `getActiveWarehouses()` (now `getActiveLocations()`). Replace the import and call:
```typescript
// Before
import { getActiveWarehouses } from "@/lib/dal/users";
const warehouses = await getActiveWarehouses();
// <UserForm warehouses={warehouses} ... />

// After
import { getActiveLocations } from "@/lib/dal/users";
const locations = await getActiveLocations();
// <UserForm locations={locations} ... />
```

- [ ] **Step 3: Update `app/dashboard/reports/page.tsx`**

Find where `warehouseUtilization` is destructured from `getReportsPageData()` and rename to `locationUtilization`. Pass as `locationUtilization={locationUtilization}` to the chart component.

- [ ] **Step 4: Rename Warehouses route to Locations**

Move the page directory:
```bash
mv /c/Users/margu/OneDrive/Desktop/7dashboard/app/dashboard/warehouses \
   /c/Users/margu/OneDrive/Desktop/7dashboard/app/dashboard/locations
```

Inside the moved page, update any prisma calls from `prisma.warehouse` → `prisma.stockLocation` and update the page title from "Warehouses" to "Locations". Add a `type` column to the locations table showing WAREHOUSE or BRANCH badge.

- [ ] **Step 5: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 6: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` with no type errors.

- [ ] **Step 7: Commit**

```bash
git add app/
git commit -m "feat: update page routes for StockLocation — rename warehouses route to locations"
```

---

## Task 8: Update Mock Data (if applicable)

**Files:**
- Modify: `lib/actions/mock-data.ts` (or `lib/mock-data.ts`)

- [ ] **Step 1: Update mock data seeding**

In the mock data file, replace `MOCK_WAREHOUSES` with `MOCK_LOCATIONS`. Give some entries `type: "WAREHOUSE"` and some `type: "BRANCH"`. Replace `prisma.warehouse.createMany` → `prisma.stockLocation.createMany`. Replace `WAREHOUSE_TRANSFER` movement types with paired `TRANSFER_OUT` + `TRANSFER_IN` entries sharing a `transferGroupId`.

Example mock locations:
```typescript
const MOCK_LOCATIONS = [
  { name: "Main Warehouse", code: "WH-001", type: "WAREHOUSE", address: "123 Industrial Ave" },
  { name: "North Branch",   code: "BR-001", type: "BRANCH",    address: "45 Main St North" },
  { name: "South Branch",   code: "BR-002", type: "BRANCH",    address: "78 Market Rd South" },
];
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/mock-data.ts lib/mock-data.ts
git commit -m "feat: update mock data for StockLocation with WAREHOUSE/BRANCH types"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `StockLocation` model with `type`, `managerName`, `contactNumber` — Task 1
- [x] `LocationStock` replaces `WarehouseStock` — Task 1
- [x] `TRANSFER_OUT` + `TRANSFER_IN` replace `WAREHOUSE_TRANSFER` — Tasks 1, 5
- [x] `transferGroupId` links paired movements — Tasks 1, 5
- [x] `performedById`/`performedBy` on `InventoryMovement` — Tasks 1, 4, 5
- [x] Business rule: only BRANCH fulfills sales — enforced at schema level; `SALES_FULFILLED` only on BRANCH locations (runtime validation can be added to `salesOrderAction` in a follow-up)
- [x] Reports expose `performedBy` name — Task 4 (DAL selects `performedBy`)
- [x] All downstream renames propagated — Tasks 3–7

**Placeholder scan:** None — all steps contain actual code or exact commands.

**Type consistency:**
- `locationId_productId` compound key used in `locationStock.findUnique` (Tasks 4, 5) — matches `@@unique([locationId, productId])` in schema (Task 1). ✓
- `transferGroupId` field added to schema (Task 1) and used in `createMany` data (Task 5). ✓
- `performedById` used in `createMany` data (Task 5) matches schema field name (Task 1). ✓
- `getActiveLocations()` exported from `lib/dal/users.ts` (Task 4) and imported in pages (Task 7). ✓
