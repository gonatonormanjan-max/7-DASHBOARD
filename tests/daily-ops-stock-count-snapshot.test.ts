import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const BRANCH_ID = "11111111-1111-4111-8111-111111111111";
  const USER_ID = "22222222-2222-4222-8222-222222222222";
  const PRODUCT_A_ID = "33333333-3333-4333-8333-333333333333";
  const PRODUCT_B_ID = "44444444-4444-4444-8444-444444444444";
  const COUNT_ID = "55555555-5555-4555-8555-555555555555";

  const branch = {
    id: BRANCH_ID,
    name: "DISPOZ - AMPAYON",
    code: "BR-003",
  };

  const products = {
    productA: {
      id: PRODUCT_A_ID,
      name: "BLACK POD FORMULA",
      sku: "EJC-001",
    },
    productB: {
      id: PRODUCT_B_ID,
      name: "CHILLAX INFINITE KIT",
      sku: "DVC-009",
    },
  };

  const rootLocationStockFindMany = vi.fn();
  const stockCountFindUnique = vi.fn();
  const stockLocationFindFirst = vi.fn();
  const revalidatePath = vi.fn();
  const redirect = vi.fn();
  const logAudit = vi.fn(async () => undefined);

  const tx = {
    stockLocation: {
      findFirst: vi.fn(),
    },
    stockCount: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    locationStock: {
      findMany: vi.fn(),
    },
    stockCountLine: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    adjustmentRequest: {
      createMany: vi.fn(),
    },
  };

  const transaction = vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx));

  function reset() {
    rootLocationStockFindMany.mockReset();
    stockCountFindUnique.mockReset();
    stockLocationFindFirst.mockReset();
    revalidatePath.mockReset();
    redirect.mockReset();
    logAudit.mockClear();
    transaction.mockClear();

    tx.stockLocation.findFirst.mockReset();
    tx.stockCount.findUnique.mockReset();
    tx.stockCount.update.mockReset();
    tx.stockCount.create.mockReset();
    tx.locationStock.findMany.mockReset();
    tx.stockCountLine.deleteMany.mockReset();
    tx.stockCountLine.createMany.mockReset();
    tx.adjustmentRequest.createMany.mockReset();
  }

  return {
    BRANCH_ID,
    USER_ID,
    PRODUCT_A_ID,
    PRODUCT_B_ID,
    COUNT_ID,
    branch,
    products,
    rootLocationStockFindMany,
    stockCountFindUnique,
    stockLocationFindFirst,
    revalidatePath,
    redirect,
    logAudit,
    tx,
    transaction,
    reset,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: harness.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: harness.redirect,
}));

vi.mock("@/lib/dal/auth", () => ({
  getSalesStaffActiveLocationId: vi.fn(async () => null),
  requirePermission: vi.fn(async () => ({
    id: harness.USER_ID,
    role: "ADMIN",
  })),
}));

vi.mock("@/lib/dal/scope", () => ({
  getBranchScope: vi.fn(() => null),
}));

vi.mock("@/lib/flash-toast", () => ({
  withFlashMessage: (path: string) => path,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: harness.logAudit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stockLocation: {
      findFirst: harness.stockLocationFindFirst,
    },
    stockCount: {
      findUnique: harness.stockCountFindUnique,
    },
    locationStock: {
      findMany: harness.rootLocationStockFindMany,
    },
    $transaction: harness.transaction,
  },
}));

import { saveStockCountAction, submitStockCountAction } from "@/lib/actions/daily-ops";
import { getTodayStockCount } from "@/lib/dal/daily-ops";

function buildLinesPayload(lines: Array<{ productId: string; countedQty: number }>) {
  const formData = new FormData();
  formData.set("countId", harness.COUNT_ID);
  formData.set("locationId", harness.BRANCH_ID);
  formData.set("type", "OPENING");
  formData.set("countDate", "2026-05-12");
  formData.set(
    "linesPayload",
    JSON.stringify(lines.map((line) => ({ ...line, notes: "" })))
  );
  return formData;
}

describe("daily ops stock count snapshots", () => {
  beforeEach(() => {
    harness.reset();
  });

  it("displays saved system quantities for an existing count instead of live stock", async () => {
    harness.stockLocationFindFirst.mockResolvedValue(harness.branch);
    harness.stockCountFindUnique.mockResolvedValue({
      id: harness.COUNT_ID,
      locationId: harness.BRANCH_ID,
      type: "OPENING",
      countDate: new Date("2026-05-12T00:00:00.000Z"),
      status: "SUBMITTED",
      lines: [
        {
          productId: harness.PRODUCT_A_ID,
          systemQty: 19,
          countedQty: 19,
          notes: null,
          product: harness.products.productA,
        },
      ],
    });
    harness.rootLocationStockFindMany.mockResolvedValue([
      {
        productId: harness.PRODUCT_A_ID,
        quantity: 16,
        product: harness.products.productA,
      },
    ]);

    const result = await getTodayStockCount(harness.BRANCH_ID, "OPENING");

    expect(result?.lines).toEqual([
      {
        productId: harness.PRODUCT_A_ID,
        productName: "BLACK POD FORMULA",
        sku: "EJC-001",
        systemQty: 19,
        countedQty: 19,
        discrepancy: 0,
        notes: "",
      },
    ]);
    expect(harness.rootLocationStockFindMany).not.toHaveBeenCalled();
  });

  it("uses current stock quantities for a brand-new count", async () => {
    harness.stockLocationFindFirst.mockResolvedValue(harness.branch);
    harness.stockCountFindUnique.mockResolvedValue(null);
    harness.rootLocationStockFindMany.mockResolvedValue([
      {
        productId: harness.PRODUCT_A_ID,
        quantity: 16,
        product: harness.products.productA,
      },
    ]);

    const result = await getTodayStockCount(harness.BRANCH_ID, "CLOSING");

    expect(result?.lines).toEqual([
      {
        productId: harness.PRODUCT_A_ID,
        productName: "BLACK POD FORMULA",
        sku: "EJC-001",
        systemQty: 16,
        countedQty: 16,
        discrepancy: 0,
        notes: "",
      },
    ]);
  });

  it("preserves saved system quantities when an existing draft is saved after sales", async () => {
    harness.stockLocationFindFirst.mockResolvedValue(harness.branch);
    harness.tx.stockLocation.findFirst.mockResolvedValue(harness.branch);
    harness.tx.stockCount.findUnique.mockResolvedValue({
      id: harness.COUNT_ID,
      status: "DRAFT",
      lines: [
        {
          productId: harness.PRODUCT_A_ID,
          systemQty: 19,
        },
        {
          productId: harness.PRODUCT_B_ID,
          systemQty: 18,
        },
      ],
    });
    harness.tx.stockCount.update.mockResolvedValue({ id: harness.COUNT_ID });

    await saveStockCountAction(
      buildLinesPayload([
        { productId: harness.PRODUCT_A_ID, countedQty: 19 },
        { productId: harness.PRODUCT_B_ID, countedQty: 18 },
      ])
    );

    expect(harness.tx.locationStock.findMany).not.toHaveBeenCalled();
    expect(harness.tx.stockCountLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          stockCountId: harness.COUNT_ID,
          productId: harness.PRODUCT_A_ID,
          systemQty: 19,
          countedQty: 19,
          notes: null,
        },
        {
          stockCountId: harness.COUNT_ID,
          productId: harness.PRODUCT_B_ID,
          systemQty: 18,
          countedQty: 18,
          notes: null,
        },
      ],
    });
  });

  it("creates discrepancy requests from the saved snapshot when an existing draft is submitted", async () => {
    harness.stockLocationFindFirst.mockResolvedValue(harness.branch);
    harness.tx.stockLocation.findFirst.mockResolvedValue(harness.branch);
    harness.tx.stockCount.findUnique.mockResolvedValue({
      id: harness.COUNT_ID,
      status: "DRAFT",
      lines: [
        {
          productId: harness.PRODUCT_A_ID,
          systemQty: 19,
        },
      ],
    });
    harness.tx.stockCount.update.mockResolvedValue({ id: harness.COUNT_ID });

    await submitStockCountAction(
      buildLinesPayload([{ productId: harness.PRODUCT_A_ID, countedQty: 16 }])
    );

    expect(harness.tx.locationStock.findMany).not.toHaveBeenCalled();
    expect(harness.tx.adjustmentRequest.createMany).toHaveBeenCalledWith({
      data: [
        {
          branchId: harness.BRANCH_ID,
          productId: harness.PRODUCT_A_ID,
          direction: "decrease",
          quantity: 3,
          reason: "count_correction",
          notes: [
            "OPENING stock count submitted for 2026-05-12.",
            "System quantity: 19.",
            "Counted quantity: 16.",
          ].join("\n"),
          requestedById: harness.USER_ID,
        },
      ],
    });
  });
});
