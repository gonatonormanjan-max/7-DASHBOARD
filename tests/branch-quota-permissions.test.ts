import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";

describe("branch quota permissions", () => {
  it("allows ADMIN and SYSTEM_MANAGER to update reports", () => {
    expect(hasPermission("ADMIN", "reports", "update")).toBe(true);
    expect(hasPermission("SYSTEM_MANAGER", "reports", "update")).toBe(true);
  });

  it("blocks SALES_STAFF from reports access", () => {
    expect(hasPermission("SALES_STAFF", "reports", "read")).toBe(false);
    expect(hasPermission("SALES_STAFF", "reports", "update")).toBe(false);
  });
});
