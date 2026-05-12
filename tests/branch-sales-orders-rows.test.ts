import { describe, expect, it } from "vitest";
import {
  buildBranchSalesOrderReportRows,
  type BranchSalesOrderReportSourceItem,
} from "@/lib/reports/branch-sales-orders";

function item(
  overrides: Partial<BranchSalesOrderReportSourceItem>
): BranchSalesOrderReportSourceItem {
  return {
    id: "line-1",
    quantity: 1,
    unitPrice: 100,
    product: {
      name: "Product A",
      sku: "SKU-A",
    },
    location: {
      id: "branch-a",
      name: "Branch A",
      code: "A",
    },
    salesOrder: {
      id: "order-1",
      orderNumber: "SO-1",
      customerName: "Walk-in Customer",
      status: "COMPLETED",
      paymentMode: "CASH",
      createdAt: "2026-05-10T01:00:00.000Z",
      createdByName: "Admin User",
    },
    ...overrides,
  };
}

describe("branch sales orders report rows", () => {
  it("splits a mixed-branch sales order into branch-specific rows", () => {
    const report = buildBranchSalesOrderReportRows([
      item({
        id: "line-a",
        quantity: 2,
        unitPrice: 100,
        location: {
          id: "branch-a",
          name: "Branch A",
          code: "A",
        },
      }),
      item({
        id: "line-b",
        quantity: 3,
        unitPrice: 50,
        location: {
          id: "branch-b",
          name: "Branch B",
          code: "B",
        },
      }),
    ]);

    expect(report.rows).toHaveLength(2);
    expect(report.rows.find((row) => row.branchId === "branch-a")).toMatchObject({
      units: 2,
      branchSubtotal: 200,
    });
    expect(report.rows.find((row) => row.branchId === "branch-b")).toMatchObject({
      units: 3,
      branchSubtotal: 150,
    });
    expect(report.summary.filteredSalesValue).toBe(350);
    expect(report.summary.salesOrderRows).toBe(2);
  });

  it("keeps expanded line items limited to the row branch", () => {
    const report = buildBranchSalesOrderReportRows([
      item({
        id: "line-a-1",
        quantity: 1,
        product: { name: "Branch A Product 1", sku: "A-1" },
        location: { id: "branch-a", name: "Branch A", code: "A" },
      }),
      item({
        id: "line-a-2",
        quantity: 2,
        product: { name: "Branch A Product 2", sku: "A-2" },
        location: { id: "branch-a", name: "Branch A", code: "A" },
      }),
      item({
        id: "line-b-1",
        quantity: 3,
        product: { name: "Branch B Product", sku: "B-1" },
        location: { id: "branch-b", name: "Branch B", code: "B" },
      }),
    ]);

    const branchARow = report.rows.find((row) => row.branchId === "branch-a");

    expect(branchARow?.lineItems).toHaveLength(2);
    expect(branchARow?.lineItems.map((line) => line.sku)).toEqual(["A-1", "A-2"]);
  });
});
