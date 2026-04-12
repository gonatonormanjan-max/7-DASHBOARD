import { describe, expect, it } from "vitest";
import { calculateWeightedAverageCost } from "@/lib/costing";

describe("calculateWeightedAverageCost", () => {
  it("uses the inbound cost when the location has no stock on hand", () => {
    const result = calculateWeightedAverageCost({
      onHandBefore: 0,
      prevAvgUnitCost: 125,
      inboundQty: 8,
      inboundUnitCost: 140,
    });

    expect(result).toEqual({
      nextAvgUnitCost: 140,
      onHandAfter: 8,
    });
  });

  it("blends existing and inbound inventory using weighted average costing", () => {
    const result = calculateWeightedAverageCost({
      onHandBefore: 10,
      prevAvgUnitCost: 100,
      inboundQty: 5,
      inboundUnitCost: 130,
    });

    expect(result.onHandAfter).toBe(15);
    expect(result.nextAvgUnitCost).toBeCloseTo(110, 6);
  });

  it("keeps the current average when inbound quantity is zero", () => {
    const result = calculateWeightedAverageCost({
      onHandBefore: 14,
      prevAvgUnitCost: 87.5,
      inboundQty: 0,
      inboundUnitCost: 140,
    });

    expect(result).toEqual({
      nextAvgUnitCost: 87.5,
      onHandAfter: 14,
    });
  });
});
