import { describe, expect, it } from "vitest";
import {
  canAccessAllBranchActivityReport,
  canAccessBranchSalesOrdersReport,
  canFilterReportsAnalyticsByBranch,
  hasPermission,
} from "@/lib/permissions";

describe("branch quota permissions", () => {
  it("allows ADMIN and SYSTEM_MANAGER to update reports", () => {
    expect(hasPermission("ADMIN", "reports", "update")).toBe(true);
    expect(hasPermission("SYSTEM_MANAGER", "reports", "update")).toBe(true);
  });

  it("blocks SALES_STAFF from reports access", () => {
    expect(hasPermission("SALES_STAFF", "reports", "read")).toBe(false);
    expect(hasPermission("SALES_STAFF", "reports", "update")).toBe(false);
  });

  it("limits all-branch activity reporting to ADMIN and SYSTEM_MANAGER", () => {
    expect(canAccessAllBranchActivityReport("ADMIN")).toBe(true);
    expect(canAccessAllBranchActivityReport("SYSTEM_MANAGER")).toBe(true);
    expect(canAccessAllBranchActivityReport("MANAGER")).toBe(false);
    expect(canAccessAllBranchActivityReport("SALES_STAFF")).toBe(false);
  });

  it("limits branch sales orders reporting to ADMIN and SYSTEM_MANAGER", () => {
    expect(canAccessBranchSalesOrdersReport("ADMIN")).toBe(true);
    expect(canAccessBranchSalesOrdersReport("SYSTEM_MANAGER")).toBe(true);
    expect(canAccessBranchSalesOrdersReport("MANAGER")).toBe(false);
    expect(canAccessBranchSalesOrdersReport("SALES_STAFF")).toBe(false);
  });

  it("limits analytics branch filtering to ADMIN and SYSTEM_MANAGER", () => {
    expect(canFilterReportsAnalyticsByBranch("ADMIN")).toBe(true);
    expect(canFilterReportsAnalyticsByBranch("SYSTEM_MANAGER")).toBe(true);
    expect(canFilterReportsAnalyticsByBranch("MANAGER")).toBe(false);
    expect(canFilterReportsAnalyticsByBranch("SALES_STAFF")).toBe(false);
  });
});
