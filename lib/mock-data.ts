import "server-only";

import { Prisma, ProductStatus, LocationType, type MovementType } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const MOCK_REFERENCE_TYPE = "mock.seed";
const MOCK_AUDIT_ACTIONS = ["mock_data.seed", "mock_data.clear"] as const;

const MOCK_CATEGORIES = [
  {
    name: "Mock Beverages",
    description: "Mock data category for drinks and ready-to-sell beverage items.",
  },
  {
    name: "Mock Snacks",
    description: "Mock data category for packaged snacks and counter-ready items.",
  },
  {
    name: "Mock Cleaning",
    description: "Mock data category for cleaning and facilities supplies.",
  },
] as const;

const MOCK_SUPPLIERS = [
  {
    name: "Mock Harbor Supply Co.",
    contactName: "Maya Cruz",
    email: "mock-harbor@example.com",
    phone: "+63 917 555 0101",
    address: "Pasig Logistics Hub",
  },
  {
    name: "Mock Summit Goods",
    contactName: "Liam Tan",
    email: "mock-summit@example.com",
    phone: "+63 917 555 0102",
    address: "Makati Distribution Center",
  },
] as const;

const MOCK_LOCATIONS = [
  {
    name: "Mock Central Warehouse",
    code: "MOCK-CENTRAL",
    address: "Quezon City",
    type: LocationType.WAREHOUSE,
  },
  {
    name: "Mock Retail Backroom",
    code: "MOCK-RETAIL",
    address: "Mandaluyong",
    type: LocationType.BRANCH,
  },
] as const;

const MOCK_PRODUCTS = [
  {
    name: "Mock Sparkling Water 330ml",
    sku: "MOCK-SW-330",
    description: "Fast-moving beverage line item for stock and availability demos.",
    unitPrice: 42.5,
    costPrice: 24.2,
    reorderLevel: 60,
    status: ProductStatus.ACTIVE,
    categoryName: "Mock Beverages",
    supplierName: "Mock Harbor Supply Co.",
  },
  {
    name: "Mock Trail Mix 250g",
    sku: "MOCK-TM-250",
    description: "Low-stock snack item to highlight reorder thresholds in the dashboard.",
    unitPrice: 135,
    costPrice: 79.5,
    reorderLevel: 40,
    status: ProductStatus.ACTIVE,
    categoryName: "Mock Snacks",
    supplierName: "Mock Harbor Supply Co.",
  },
  {
    name: "Mock Citrus Cleaner 1L",
    sku: "MOCK-CL-1L",
    description: "Out-of-stock facilities item for shortage and movement examples.",
    unitPrice: 215,
    costPrice: 128,
    reorderLevel: 24,
    status: ProductStatus.ACTIVE,
    categoryName: "Mock Cleaning",
    supplierName: "Mock Summit Goods",
  },
  {
    name: "Mock Coffee Beans 1kg",
    sku: "MOCK-CF-1KG",
    description: "Inactive product example that still carries stock for review flows.",
    unitPrice: 480,
    costPrice: 325,
    reorderLevel: 12,
    status: ProductStatus.INACTIVE,
    categoryName: "Mock Beverages",
    supplierName: "Mock Summit Goods",
  },
  {
    name: "Mock Promo Mug",
    sku: "MOCK-MUG-01",
    description: "Archived catalog sample to demonstrate hidden product states.",
    unitPrice: 180,
    costPrice: 92,
    reorderLevel: 0,
    status: ProductStatus.ARCHIVED,
    categoryName: "Mock Snacks",
    supplierName: "Mock Summit Goods",
  },
] as const;

const MOCK_STOCK_ROWS = [
  {
    locationCode: "MOCK-CENTRAL",
    sku: "MOCK-SW-330",
    quantity: 140,
    reservedQty: 18,
  },
  {
    locationCode: "MOCK-CENTRAL",
    sku: "MOCK-TM-250",
    quantity: 28,
    reservedQty: 4,
  },
  {
    locationCode: "MOCK-RETAIL",
    sku: "MOCK-CL-1L",
    quantity: 0,
    reservedQty: 0,
  },
  {
    locationCode: "MOCK-RETAIL",
    sku: "MOCK-CF-1KG",
    quantity: 12,
    reservedQty: 0,
  },
] as const;

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

const MOCK_MOVEMENTS: Array<{
  sku: (typeof MOCK_PRODUCTS)[number]["sku"];
  locationCode: (typeof MOCK_LOCATIONS)[number]["code"];
  type: MovementType;
  quantityChange: number;
  notes: string;
  createdAt: Date;
}> = [
  {
    sku: "MOCK-SW-330",
    locationCode: "MOCK-CENTRAL",
    type: "PURCHASE_RECEIVED",
    quantityChange: 160,
    notes: "Mock seed opening receipt for dashboard demos.",
    createdAt: hoursAgo(120),
  },
  {
    sku: "MOCK-SW-330",
    locationCode: "MOCK-CENTRAL",
    type: "SALES_FULFILLED",
    quantityChange: -20,
    notes: "Mock seed fulfillment to show movement history.",
    createdAt: hoursAgo(36),
  },
  {
    sku: "MOCK-TM-250",
    locationCode: "MOCK-CENTRAL",
    type: "PURCHASE_RECEIVED",
    quantityChange: 36,
    notes: "Mock seed replenishment for low-stock monitoring.",
    createdAt: hoursAgo(96),
  },
  {
    sku: "MOCK-TM-250",
    locationCode: "MOCK-CENTRAL",
    type: "SALES_FULFILLED",
    quantityChange: -8,
    notes: "Mock seed sales issue to push the item near reorder level.",
    createdAt: hoursAgo(18),
  },
  {
    sku: "MOCK-CL-1L",
    locationCode: "MOCK-RETAIL",
    type: "PURCHASE_RECEIVED",
    quantityChange: 24,
    notes: "Mock seed initial stock for cleaning supply demo.",
    createdAt: hoursAgo(144),
  },
  {
    sku: "MOCK-CL-1L",
    locationCode: "MOCK-RETAIL",
    type: "DAMAGED_LOST",
    quantityChange: -24,
    notes: "Mock seed damaged stock write-off to create an out-of-stock row.",
    createdAt: hoursAgo(10),
  },
  {
    sku: "MOCK-CF-1KG",
    locationCode: "MOCK-RETAIL",
    type: "MANUAL_ADJUSTMENT",
    quantityChange: 12,
    notes: "Mock seed count correction for an inactive stocked product.",
    createdAt: hoursAgo(60),
  },
];

const MOCK_CATEGORY_NAMES = MOCK_CATEGORIES.map((category) => category.name);
const MOCK_SUPPLIER_NAMES = MOCK_SUPPLIERS.map((supplier) => supplier.name);
const MOCK_LOCATION_CODES = MOCK_LOCATIONS.map((loc) => loc.code);
const MOCK_PRODUCT_SKUS = MOCK_PRODUCTS.map((product) => product.sku);

function toMoney(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

export type MockDataSummary = {
  categories: number;
  suppliers: number;
  locations: number;
  products: number;
  stockRows: number;
  movements: number;
};

export async function getMockDataSummary(): Promise<MockDataSummary> {
  const [categories, suppliers, locations, products, stockRows, movements] =
    await Promise.all([
      prisma.category.count({
        where: {
          name: {
            in: MOCK_CATEGORY_NAMES,
          },
        },
      }),
      prisma.supplier.count({
        where: {
          name: {
            in: MOCK_SUPPLIER_NAMES,
          },
        },
      }),
      prisma.stockLocation.count({
        where: {
          code: {
            in: MOCK_LOCATION_CODES,
          },
        },
      }),
      prisma.product.count({
        where: {
          sku: {
            in: MOCK_PRODUCT_SKUS,
          },
        },
      }),
      prisma.locationStock.count({
        where: {
          product: {
            sku: {
              in: MOCK_PRODUCT_SKUS,
            },
          },
        },
      }),
      prisma.inventoryMovement.count({
        where: {
          OR: [
            {
              referenceType: MOCK_REFERENCE_TYPE,
            },
            {
              product: {
                sku: {
                  in: MOCK_PRODUCT_SKUS,
                },
              },
            },
            {
              location: {
                code: {
                  in: MOCK_LOCATION_CODES,
                },
              },
            },
          ],
        },
      }),
    ]);

  return {
    categories,
    suppliers,
    locations,
    products,
    stockRows,
    movements,
  };
}

export async function seedMockData(actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    for (const category of MOCK_CATEGORIES) {
      await tx.category.upsert({
        where: { name: category.name },
        update: {
          description: category.description,
        },
        create: category,
      });
    }

    for (const supplier of MOCK_SUPPLIERS) {
      await tx.supplier.upsert({
        where: { name: supplier.name },
        update: {
          contactName: supplier.contactName,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isActive: true,
        },
        create: {
          ...supplier,
          isActive: true,
        },
      });
    }

    for (const loc of MOCK_LOCATIONS) {
      await tx.stockLocation.upsert({
        where: { code: loc.code },
        update: {
          name: loc.name,
          address: loc.address,
          type: loc.type,
          isActive: true,
        },
        create: {
          ...loc,
          isActive: true,
        },
      });
    }

    const [categories, suppliers, stockLocations] = await Promise.all([
      tx.category.findMany({
        where: {
          name: {
            in: MOCK_CATEGORY_NAMES,
          },
        },
        select: {
          id: true,
          name: true,
        },
      }),
      tx.supplier.findMany({
        where: {
          name: {
            in: MOCK_SUPPLIER_NAMES,
          },
        },
        select: {
          id: true,
          name: true,
        },
      }),
      tx.stockLocation.findMany({
        where: {
          code: {
            in: MOCK_LOCATION_CODES,
          },
        },
        select: {
          id: true,
          code: true,
        },
      }),
    ]);

    const categoryIds = new Map(categories.map((category) => [category.name, category.id]));
    const supplierIds = new Map(suppliers.map((supplier) => [supplier.name, supplier.id]));
    const locationIds = new Map(stockLocations.map((loc) => [loc.code, loc.id]));

    for (const product of MOCK_PRODUCTS) {
      await tx.product.upsert({
        where: { sku: product.sku },
        update: {
          name: product.name,
          description: product.description,
          unitPrice: toMoney(product.unitPrice),
          costPrice: toMoney(product.costPrice),
          reorderLevel: product.reorderLevel,
          status: product.status,
          categoryId: categoryIds.get(product.categoryName)!,
          supplierId: supplierIds.get(product.supplierName)!,
        },
        create: {
          name: product.name,
          sku: product.sku,
          description: product.description,
          unitPrice: toMoney(product.unitPrice),
          costPrice: toMoney(product.costPrice),
          reorderLevel: product.reorderLevel,
          status: product.status,
          categoryId: categoryIds.get(product.categoryName)!,
          supplierId: supplierIds.get(product.supplierName)!,
        },
      });
    }

    const products = await tx.product.findMany({
      where: {
        sku: {
          in: MOCK_PRODUCT_SKUS,
        },
      },
      select: {
        id: true,
        sku: true,
      },
    });

    const productIds = new Map(products.map((product) => [product.sku, product.id]));
    const scopedProductIds = products.map((product) => product.id);
    const scopedLocationIds = stockLocations.map((loc) => loc.id);

    await tx.inventoryMovement.deleteMany({
      where: {
        referenceType: MOCK_REFERENCE_TYPE,
      },
    });

    await tx.locationStock.deleteMany({
      where: {
        productId: {
          in: scopedProductIds,
        },
      },
    });

    await tx.locationStock.createMany({
      data: MOCK_STOCK_ROWS.map((row) => ({
        locationId: locationIds.get(row.locationCode)!,
        productId: productIds.get(row.sku)!,
        quantity: row.quantity,
        reservedQty: row.reservedQty,
      })),
    });

    await tx.inventoryMovement.createMany({
      data: MOCK_MOVEMENTS.map((movement) => ({
        type: movement.type,
        productId: productIds.get(movement.sku)!,
        locationId: locationIds.get(movement.locationCode)!,
        quantityChange: movement.quantityChange,
        referenceType: MOCK_REFERENCE_TYPE,
        notes: movement.notes,
        performedById: actorUserId,
        createdAt: movement.createdAt,
      })),
    });

    await logAudit(
      {
        userId: actorUserId,
        action: "mock_data.seed",
        entity: "mock_data",
        entityId: "inventory-module",
        details: {
          categories: MOCK_CATEGORIES.length,
          suppliers: MOCK_SUPPLIERS.length,
          locations: scopedLocationIds.length,
          products: products.length,
          stockRows: MOCK_STOCK_ROWS.length,
          movements: MOCK_MOVEMENTS.length,
        },
      },
      tx
    );

    return {
      categories: MOCK_CATEGORIES.length,
      suppliers: MOCK_SUPPLIERS.length,
      locations: scopedLocationIds.length,
      products: products.length,
      stockRows: MOCK_STOCK_ROWS.length,
      movements: MOCK_MOVEMENTS.length,
    };
  });
}

export async function clearMockData(actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const [products, stockLocations] = await Promise.all([
      tx.product.findMany({
        where: {
          sku: {
            in: MOCK_PRODUCT_SKUS,
          },
        },
        select: {
          id: true,
        },
      }),
      tx.stockLocation.findMany({
        where: {
          code: {
            in: MOCK_LOCATION_CODES,
          },
        },
        select: {
          id: true,
        },
      }),
    ]);

    const productIds = products.map((product) => product.id);
    const locationIds = stockLocations.map((loc) => loc.id);

    const deletedMovements = await tx.inventoryMovement.deleteMany({
      where: {
        referenceType: MOCK_REFERENCE_TYPE,
      },
    });

    const deletableProducts =
      productIds.length > 0
        ? await tx.product.findMany({
            where: {
              id: {
                in: productIds,
              },
              purchaseItems: {
                none: {},
              },
              salesItems: {
                none: {},
              },
              movements: {
                none: {},
              },
            },
            select: {
              id: true,
            },
          })
        : [];
    const deletableProductIds = deletableProducts.map((product) => product.id);

    const deletedStockRows =
      deletableProductIds.length > 0
        ? await tx.locationStock.deleteMany({
            where: {
              productId: {
                in: deletableProductIds,
              },
            },
          })
        : { count: 0 };

    const deletedProducts = await tx.product.deleteMany({
      where: {
        id: {
          in: deletableProductIds,
        },
      },
    });

    const deletedCategories = await tx.category.deleteMany({
      where: {
        name: {
          in: MOCK_CATEGORY_NAMES,
        },
        products: {
          none: {},
        },
      },
    });

    const deletedSuppliers = await tx.supplier.deleteMany({
      where: {
        name: {
          in: MOCK_SUPPLIER_NAMES,
        },
        products: {
          none: {},
        },
        purchaseOrders: {
          none: {},
        },
      },
    });

    const deletedLocations = await tx.stockLocation.deleteMany({
      where: {
        id: {
          in: locationIds,
        },
        stock: {
          none: {},
        },
        salesItems: {
          none: {},
        },
        movements: {
          none: {},
        },
      },
    });

    const retainedProducts = productIds.length - deletedProducts.count;
    const retainedLocations = locationIds.length - deletedLocations.count;

    await tx.auditLog.deleteMany({
      where: {
        action: {
          in: [...MOCK_AUDIT_ACTIONS],
        },
      },
    });

    await logAudit(
      {
        userId: actorUserId,
        action: "mock_data.clear",
        entity: "mock_data",
        entityId: "inventory-module",
        details: {
          categories: deletedCategories.count,
          suppliers: deletedSuppliers.count,
          locations: deletedLocations.count,
          products: deletedProducts.count,
          retainedProducts,
          retainedLocations,
          stockRows: deletedStockRows.count,
          movements: deletedMovements.count,
        },
      },
      tx
    );

    return {
      categories: deletedCategories.count,
      suppliers: deletedSuppliers.count,
      locations: deletedLocations.count,
      products: deletedProducts.count,
      retainedProducts,
      retainedLocations,
      stockRows: deletedStockRows.count,
      movements: deletedMovements.count,
    };
  });
}
