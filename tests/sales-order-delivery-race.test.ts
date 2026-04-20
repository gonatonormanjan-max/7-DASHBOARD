import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const ORDER_ID = "11111111-1111-4111-8111-111111111111";
  const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
  const LOCATION_ID = "33333333-3333-4333-8333-333333333333";

  let orderStatus: "CONFIRMED" | "DELIVERED" = "CONFIRMED";
  let stockQty = 5;
  let reservedQty = 5;
  const movements: Array<{ productId: string; locationId: string; quantityChange: number }> = [];

  let deliveryQueue = Promise.resolve();

  function reset() {
    orderStatus = "CONFIRMED";
    stockQty = 5;
    reservedQty = 5;
    movements.length = 0;
    deliveryQueue = Promise.resolve();
  }

  async function withDeliveryLock<T>(work: () => Promise<T> | T) {
    const previous = deliveryQueue;
    let release: () => void = () => undefined;
    deliveryQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  function buildOrderSnapshot() {
    return {
      id: ORDER_ID,
      orderNumber: "SO-RACE-0001",
      customerName: "Walk-in",
      status: "CONFIRMED",
      items: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          productId: PRODUCT_ID,
          locationId: LOCATION_ID,
          quantity: 5,
          unitPrice: 200,
          unitCostAtSale: 120,
          product: {
            name: "Widget Y",
            sku: "WY-001",
          },
          location: {
            id: LOCATION_ID,
            name: "Branch A",
          },
        },
      ],
    };
  }

  return {
    ORDER_ID,
    PRODUCT_ID,
    LOCATION_ID,
    get orderStatus() {
      return orderStatus;
    },
    set orderStatus(value: "CONFIRMED" | "DELIVERED") {
      orderStatus = value;
    },
    get stockQty() {
      return stockQty;
    },
    set stockQty(value: number) {
      stockQty = value;
    },
    get reservedQty() {
      return reservedQty;
    },
    set reservedQty(value: number) {
      reservedQty = value;
    },
    movements,
    reset,
    withDeliveryLock,
    buildOrderSnapshot,
  };
});

const revalidatePathMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn(async () => undefined));
const syncLocationCostSnapshotMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/dal/auth", () => ({
  requirePermission: vi.fn(async () => ({
    id: "55555555-5555-4555-8555-555555555555",
    role: "ADMIN",
  })),
  requireSalesStaffActiveLocationId: vi.fn(async () => null),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}));

vi.mock("@/lib/costing", () => ({
  applyInboundMovingAverage: vi.fn(async () => undefined),
  getSaleCostSnapshot: vi.fn(async () => ({
    unitCost: 100,
    isEstimatedCost: false,
    source: "location_avg",
  })),
  syncLocationCostSnapshot: syncLocationCostSnapshotMock,
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    $queryRaw: vi.fn(async () => [
      {
        productId: harness.PRODUCT_ID,
        locationId: harness.LOCATION_ID,
        quantity: harness.stockQty,
        reservedQty: harness.reservedQty,
      },
    ]),
    salesOrder: {
      updateMany: vi.fn(
        async ({
          where,
        }: {
          where: { status: "CONFIRMED" };
        }) =>
          harness.withDeliveryLock(async () => {
            if (harness.orderStatus !== where.status) {
              return { count: 0 };
            }

            harness.orderStatus = "DELIVERED";
            return { count: 1 };
          })
      ),
    },
    inventoryMovement: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: { productId: string; locationId: string; quantityChange: number };
        }) => {
          harness.movements.push({
            productId: data.productId,
            locationId: data.locationId,
            quantityChange: data.quantityChange,
          });
        }
      ),
    },
    locationStock: {
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { quantity: { gte: number }; reservedQty: { gte: number } };
          data: { quantity: { decrement: number }; reservedQty: { decrement: number } };
        }) => {
          if (
            harness.stockQty < where.quantity.gte ||
            harness.reservedQty < where.reservedQty.gte
          ) {
            return { count: 0 };
          }

          harness.stockQty -= data.quantity.decrement;
          harness.reservedQty -= data.reservedQty.decrement;
          return { count: 1 };
        }
      ),
      findUnique: vi.fn(async () => ({
        quantity: harness.stockQty,
        reservedQty: harness.reservedQty,
      })),
    },
  };

  return {
    prisma: {
      salesOrder: {
        findUnique: vi.fn(async () => harness.buildOrderSnapshot()),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

import { deliverSalesOrderAction } from "@/lib/actions/sales-orders";

function buildDeliverFormData(orderId: string) {
  const formData = new FormData();
  formData.set("orderId", orderId);
  return formData;
}

describe("deliverSalesOrderAction concurrency guards", () => {
  beforeEach(() => {
    harness.reset();
    revalidatePathMock.mockClear();
    logAuditMock.mockClear();
    syncLocationCostSnapshotMock.mockClear();
  });

  it("keeps reserved stock non-negative when two delivery requests race", async () => {
    const formDataA = buildDeliverFormData(harness.ORDER_ID);
    const formDataB = buildDeliverFormData(harness.ORDER_ID);

    const [resultA, resultB] = await Promise.all([
      deliverSalesOrderAction({ status: "idle" }, formDataA),
      deliverSalesOrderAction({ status: "idle" }, formDataB),
    ]);

    const results = [resultA, resultB];
    const successCount = results.filter((result) => result.status === "success").length;
    const errorCount = results.filter((result) => result.status === "error").length;

    expect(successCount).toBe(1);
    expect(errorCount).toBe(1);
    expect(harness.reservedQty).toBe(0);
    expect(harness.reservedQty).toBeGreaterThanOrEqual(0);
    expect(harness.stockQty).toBe(0);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/vault");
  });
});
