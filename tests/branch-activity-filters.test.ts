import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRANCH_ACTIVITY_WINDOW_DAYS,
  MAX_BRANCH_ACTIVITY_WINDOW_DAYS,
  parseBranchActivityFilters,
} from "@/lib/validators/reports";

describe("branch activity report filters", () => {
  it("defaults to all branches and the last 7 business dates", () => {
    const filters = parseBranchActivityFilters({}, "2026-05-10");

    expect(filters).toEqual({
      branchId: null,
      dateFrom: "2026-05-04",
      dateTo: "2026-05-10",
      days: DEFAULT_BRANCH_ACTIVITY_WINDOW_DAYS,
    });
  });

  it("accepts a valid branch id and custom dates", () => {
    const filters = parseBranchActivityFilters(
      {
        branchId: "11111111-1111-4111-8111-111111111111",
        dateFrom: "2026-05-01",
        dateTo: "2026-05-03",
      },
      "2026-05-10"
    );

    expect(filters).toEqual({
      branchId: "11111111-1111-4111-8111-111111111111",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-03",
      days: 3,
    });
  });

  it("defaults invalid branch ids and invalid dates safely", () => {
    const filters = parseBranchActivityFilters(
      {
        branchId: "not-a-branch",
        dateFrom: "bad-date",
        dateTo: "still-bad",
      },
      "2026-05-10"
    );

    expect(filters.branchId).toBeNull();
    expect(filters.dateFrom).toBe("2026-05-04");
    expect(filters.dateTo).toBe("2026-05-10");
  });

  it("caps long ranges to 90 inclusive days", () => {
    const filters = parseBranchActivityFilters(
      {
        dateFrom: "2026-01-01",
        dateTo: "2026-05-10",
      },
      "2026-05-10"
    );

    expect(filters.days).toBe(MAX_BRANCH_ACTIVITY_WINDOW_DAYS);
    expect(filters.dateFrom).toBe("2026-02-10");
    expect(filters.dateTo).toBe("2026-05-10");
  });

  it("collapses reversed ranges to the selected end date", () => {
    const filters = parseBranchActivityFilters(
      {
        dateFrom: "2026-05-12",
        dateTo: "2026-05-10",
      },
      "2026-05-10"
    );

    expect(filters.dateFrom).toBe("2026-05-10");
    expect(filters.dateTo).toBe("2026-05-10");
    expect(filters.days).toBe(1);
  });
});
