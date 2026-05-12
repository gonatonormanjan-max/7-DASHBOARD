import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRANCH_ACTIVITY_WINDOW_DAYS,
  DEFAULT_BRANCH_SALES_ORDERS_PAGE_SIZE,
  MAX_BRANCH_ACTIVITY_WINDOW_DAYS,
  parseBranchSalesOrdersFilters,
} from "@/lib/validators/reports";

describe("branch sales orders report filters", () => {
  it("defaults safely", () => {
    const filters = parseBranchSalesOrdersFilters({}, "2026-05-10");

    expect(filters).toEqual({
      branchId: null,
      dateFrom: "2026-05-04",
      dateTo: "2026-05-10",
      days: DEFAULT_BRANCH_ACTIVITY_WINDOW_DAYS,
      status: null,
      query: "",
      page: 1,
      pageSize: DEFAULT_BRANCH_SALES_ORDERS_PAGE_SIZE,
    });
  });

  it("accepts valid branch, status, search, dates, and pagination", () => {
    const filters = parseBranchSalesOrdersFilters(
      {
        branchId: "11111111-1111-4111-8111-111111111111",
        dateFrom: "2026-05-01",
        dateTo: "2026-05-03",
        status: "COMPLETED",
        query: "SO-123",
        page: "2",
        pageSize: "100",
      },
      "2026-05-10"
    );

    expect(filters).toEqual({
      branchId: "11111111-1111-4111-8111-111111111111",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-03",
      days: 3,
      status: "COMPLETED",
      query: "SO-123",
      page: 2,
      pageSize: 100,
    });
  });

  it("defaults invalid values safely", () => {
    const filters = parseBranchSalesOrdersFilters(
      {
        branchId: "bad-branch",
        dateFrom: "bad-date",
        dateTo: "also-bad",
        status: "NOT_A_STATUS",
        query: "x".repeat(200),
        page: "-1",
        pageSize: "500",
      },
      "2026-05-10"
    );

    expect(filters.branchId).toBeNull();
    expect(filters.dateFrom).toBe("2026-05-04");
    expect(filters.dateTo).toBe("2026-05-10");
    expect(filters.status).toBeNull();
    expect(filters.query).toBe("");
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(DEFAULT_BRANCH_SALES_ORDERS_PAGE_SIZE);
  });

  it("caps date range to 90 inclusive days", () => {
    const filters = parseBranchSalesOrdersFilters(
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
});
