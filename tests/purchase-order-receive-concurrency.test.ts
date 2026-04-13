import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const PO_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const ITEM_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const WAREHOUSE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const PRODUCT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  let receiveQueue = Promise.resolve();
  const state = {
    receivedQty: 0,
    orderedQty: 10,
    warehouseQty: 0,
  };

  function reset() {
    state.receivedQty = 0;
    state.orderedQty = 10;
    state.warehouseQty = 0;
    receiveQueue = Promise.resolve();
  }

  async function withReceiveLock<T>(work: () => Promise<T> | T) {
    const previous = receiveQueue;
    let release: () => void = () => undefined;
    receiveQueue = new Promise<void>((resolve) => {
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
      id: PO_ID,
      orderNumber: "PO-TEST-0001",
      status: "APPROVED",
      items: [
        {
          id: ITEM_ID,
          productId: PRODUCT_ID,
          quantity: state.orderedQty,
          receivedQty: 0,
          unitCost: 100,
          product: {
            id: PRODUCT_ID,
            name: "Widget X",
            sku: "WX-001",
          },
        },
      ],
    };
  }

  return {
    PO_ID,
    ITEM_ID,
    WAREHOUSE_ID,
    PRODUCT_ID,
    state,
    reset,
    withReceiveLock,
    buildOrderSnapshot,
  };
});

const revalidatePathMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn(async () => undefined));
const applyInboundMovingAverageMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/dal/auth", () => ({
  requirePermission: vi.fn(async () => ({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    role: "ADMIN",
  })),
}));

vi.mock("@/lib/flash-toast", () => ({
  withFlashMessage: (path: string) => path,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}));

vi.mock("@/lib/costing", () => ({
  applyInboundMovingAverage: applyInboundMovingAverageMock,
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    purchaseOrderItem: {
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { receivedQty: { lte: number } };
          data: { receivedQty: { increment: number } };
        }) =>
          harness.withReceiveLock(async () => {
            if (harness.state.receivedQty > where.receivedQty.lte) {
              return { count: 0 };
            }

            harness.state.receivedQty += data.receivedQty.increment;
            return { count: 1 };
          })
      ),
      findUnique: vi.fn(async () => ({
        quantity: harness.state.orderedQty,
        receivedQty: harness.state.receivedQty,
        product: { name: "Widget X" },
      })),
    },
    locationStock: {
      findUnique: vi.fn(async () => ({ quantity: harness.state.warehouseQty })),
      upsert: vi.fn(
        async ({
          create,
          update,
        }: {
          create: { quantity: number };
          update: { quantity: { increment: number } };
        }) => {
          if (harness.state.warehouseQty === 0) {
            harness.state.warehouseQty = create.quantity;
            return;
          }

          harness.state.warehouseQty += update.quantity.increment;
        }
      ),
    },
    inventoryMovement: {
      create: vi.fn(async () => undefined),
    },
    purchaseOrder: {
      update: vi.fn(async () => undefined),
    },
  };

  return {
    prisma: {
      purchaseOrder: {
        findUnique: vi.fn(async () => harness.buildOrderSnapshot()),
      },
      stockLocation: {
        findFirst: vi.fn(async () => ({
          id: harness.WAREHOUSE_ID,
          name: "Main Warehouse",
          code: "WH-01",
        })),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

import { receivePurchaseOrderAction } from "@/lib/actions/purchase-orders";

function buildReceiveFormData(itemId: string, quantity: number) {
  const formData = new FormData();
  formData.set("warehouseId", harness.WAREHOUSE_ID);
  formData.set("notes", "Concurrent receive attempt");
  formData.set("items[0].itemId", itemId);
  formData.set("items[0].quantity", String(quantity));
  return formData;
}

describe("receivePurchaseOrderAction concurrency guards", () => {
  beforeEach(() => {
    harness.reset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
    logAuditMock.mockClear();
    applyInboundMovingAverageMock.mockClear();
  });

  it("allows only one full receive when two requests race on the same PO line", async () => {
    const formDataA = buildReceiveFormData(harness.ITEM_ID, 10);
    const formDataB = buildReceiveFormData(harness.ITEM_ID, 10);

    const [resultA, resultB] = await Promise.all([
      receivePurchaseOrderAction(harness.PO_ID, { status: "idle" }, formDataA),
      receivePurchaseOrderAction(harness.PO_ID, { status: "idle" }, formDataB),
    ]);

    const results = [resultA, resultB];
    const successCount = results.filter((result) => result === undefined).length;
    const errorResults = results.filter((result) => result?.status === "error");

    expect(successCount).toBe(1);
    expect(errorResults).toHaveLength(1);
    expect(errorResults[0]?.message).toContain("can only receive 0 more unit");
    expect(harness.state.receivedQty).toBe(10);
    expect(harness.state.warehouseQty).toBe(10);
  });
});
