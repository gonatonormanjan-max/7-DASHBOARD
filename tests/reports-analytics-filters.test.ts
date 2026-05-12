import { describe, expect, it } from "vitest";
import { parseReportsAnalyticsFilters } from "@/lib/validators/reports";

const DEFAULT_ANALYTICS_WINDOW_DAYS = 90;

describe("reports analytics filters", () => {
  it("defaults to all branches and the default analytics window", () => {
    const filters = parseReportsAnalyticsFilters({}, DEFAULT_ANALYTICS_WINDOW_DAYS);

    expect(filters).toEqual({
      analyticsDays: DEFAULT_ANALYTICS_WINDOW_DAYS,
      branchId: null,
    });
  });

  it("accepts a valid branch id and analytics window", () => {
    const filters = parseReportsAnalyticsFilters(
      {
        branchId: "11111111-1111-4111-8111-111111111111",
        analyticsDays: "180",
      },
      DEFAULT_ANALYTICS_WINDOW_DAYS
    );

    expect(filters).toEqual({
      analyticsDays: 180,
      branchId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("defaults invalid branch ids and invalid windows safely", () => {
    const filters = parseReportsAnalyticsFilters(
      {
        branchId: "not-a-branch",
        analyticsDays: "-1",
      },
      DEFAULT_ANALYTICS_WINDOW_DAYS
    );

    expect(filters).toEqual({
      analyticsDays: DEFAULT_ANALYTICS_WINDOW_DAYS,
      branchId: null,
    });
  });

  it("caps analytics windows to the configured maximum", () => {
    const filters = parseReportsAnalyticsFilters(
      {
        analyticsDays: "999",
      },
      DEFAULT_ANALYTICS_WINDOW_DAYS,
      365
    );

    expect(filters.analyticsDays).toBe(365);
  });
});
