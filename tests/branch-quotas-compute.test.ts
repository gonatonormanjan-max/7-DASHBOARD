import { describe, expect, it } from "vitest";
import { computeBranchQuotaRows } from "@/lib/reports/branch-quotas";

describe("computeBranchQuotaRows", () => {
  it("applies branch-specific rolling windows when computing progress", () => {
    const rows = computeBranchQuotaRows({
      metric: "revenue",
      today: new Date(2026, 3, 15, 12, 0, 0),
      branches: [
        {
          id: "branch-a",
          name: "Branch A",
          code: "A",
          rollingWindowDays: 30,
          revenueTarget: 1000,
          unitsTarget: 100,
        },
        {
          id: "branch-b",
          name: "Branch B",
          code: "B",
          rollingWindowDays: 7,
          revenueTarget: 400,
          unitsTarget: 40,
        },
      ],
      sales: [
        { branchId: "branch-a", dateKey: "2026-04-15", revenue: 100, units: 10 },
        { branchId: "branch-a", dateKey: "2026-04-10", revenue: 200, units: 20 },
        { branchId: "branch-a", dateKey: "2026-03-25", revenue: 300, units: 30 },
        { branchId: "branch-a", dateKey: "2026-03-10", revenue: 900, units: 90 },
        { branchId: "branch-b", dateKey: "2026-04-14", revenue: 50, units: 5 },
        { branchId: "branch-b", dateKey: "2026-04-12", revenue: 150, units: 15 },
        { branchId: "branch-b", dateKey: "2026-04-08", revenue: 100, units: 10 },
      ],
    });

    expect(rows).toHaveLength(2);

    const branchA = rows.find((row) => row.id === "branch-a");
    const branchB = rows.find((row) => row.id === "branch-b");

    expect(branchA?.currentValue).toBe(600);
    expect(branchA?.totalUnits).toBe(60);
    expect(branchA?.averagePerDay).toBe(20);
    expect(branchA?.attainmentRatio).toBeCloseTo(0.6, 6);

    expect(branchB?.currentValue).toBe(200);
    expect(branchB?.totalUnits).toBe(20);
    expect(branchB?.averagePerDay).toBeCloseTo(28.57, 2);
    expect(branchB?.attainmentRatio).toBeCloseTo(0.5, 6);

    expect(branchB?.bestDayValue).toBe(150);
    expect(branchB?.activeSalesDays).toBe(2);
  });
});
