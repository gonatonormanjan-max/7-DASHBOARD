import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  return {
    stockLocationFindMany: vi.fn(),
    salesOrderItemFindMany: vi.fn(),
    queryRaw: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stockLocation: {
      findMany: harness.stockLocationFindMany,
    },
    salesOrderItem: {
      findMany: harness.salesOrderItemFindMany,
    },
    $queryRaw: harness.queryRaw,
  },
}));

import { getDedicatedBranchQuotaData } from "@/lib/dal/reports";

describe("getDedicatedBranchQuotaData storage fallback", () => {
  beforeEach(() => {
    harness.stockLocationFindMany.mockReset();
    harness.salesOrderItemFindMany.mockReset();
    harness.queryRaw.mockReset();
  });

  it("uses defaults and marks storage unavailable when settings table is missing", async () => {
    harness.stockLocationFindMany.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "North Branch",
        code: "NB-01",
      },
    ]);
    harness.queryRaw.mockResolvedValue([{ tableExists: false }]);
    harness.salesOrderItemFindMany.mockResolvedValue([
      {
        locationId: "11111111-1111-4111-8111-111111111111",
        quantity: 10,
        unitPrice: { toNumber: () => 20 },
        salesOrder: {
          createdAt: new Date(2026, 3, 15, 10, 0, 0),
        },
      },
    ]);

    const result = await getDedicatedBranchQuotaData({ metric: "revenue" });

    expect(result.storageReady).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      rollingWindowDays: 30,
      targetValue: null,
      band: "unconfigured",
      reached: null,
    });
    expect(result.rows[0]?.currentValue).toBe(200);
    expect(result.summary.configuredCount).toBe(0);
    expect(result.summary.bands.unconfigured).toBe(1);
    expect(harness.queryRaw).toHaveBeenCalledTimes(1);
  });
});

