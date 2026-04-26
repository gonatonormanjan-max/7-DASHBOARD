import { describe, expect, it } from "vitest";
import { calculateDismantleAllocations } from "@/lib/kits";

describe("calculateDismantleAllocations", () => {
  it("allocates kit cost using component extended cost basis", () => {
    const result = calculateDismantleAllocations({
      kitAvgUnitCost: 120,
      components: [
        {
          componentProductId: "component-a",
          componentQty: 1,
          componentCostPrice: 30,
        },
        {
          componentProductId: "component-b",
          componentQty: 2,
          componentCostPrice: 15,
        },
      ],
    });

    expect(result).toEqual([
      {
        componentProductId: "component-a",
        componentQty: 1,
        allocationShare: 0.5,
        inboundUnitCost: 60,
        totalAllocatedCostPerKit: 60,
      },
      {
        componentProductId: "component-b",
        componentQty: 2,
        allocationShare: 0.5,
        inboundUnitCost: 30,
        totalAllocatedCostPerKit: 60,
      },
    ]);
  });

  it("falls back to quantity-weighted allocation when standard costs are zero", () => {
    const result = calculateDismantleAllocations({
      kitAvgUnitCost: 90,
      components: [
        {
          componentProductId: "component-a",
          componentQty: 1,
          componentCostPrice: 0,
        },
        {
          componentProductId: "component-b",
          componentQty: 2,
          componentCostPrice: 0,
        },
      ],
    });

    expect(result).toEqual([
      {
        componentProductId: "component-a",
        componentQty: 1,
        allocationShare: 1 / 3,
        inboundUnitCost: 30,
        totalAllocatedCostPerKit: 30,
      },
      {
        componentProductId: "component-b",
        componentQty: 2,
        allocationShare: 2 / 3,
        inboundUnitCost: 30,
        totalAllocatedCostPerKit: 60,
      },
    ]);
  });
});
