import { describe, expect, it } from "vitest";
import {
  resolveSalesOrderPayment,
  salesOrderAmountsMatchTotal,
} from "@/lib/sales-order-payments";
import {
  extractSalesOrderFormValues,
  parseSalesOrderListFilters,
} from "@/lib/validators/sales-orders";

const BRANCH_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

describe("sales order payment validation", () => {
  it("accepts mixed payments only when the allocation matches the order total", () => {
    const result = resolveSalesOrderPayment({
      paymentMode: "MIXED",
      cashAmount: "125.25",
      onlineAmount: "74.75",
      orderTotal: 200,
      intent: "record",
    });

    expect(result).toEqual({
      ok: true,
      paymentMode: "MIXED",
      cashAmount: 125.25,
      onlineAmount: 74.75,
    });
  });

  it("returns a field error when mixed payments do not add up to the sale total", () => {
    const result = resolveSalesOrderPayment({
      paymentMode: "MIXED",
      cashAmount: "120",
      onlineAmount: "60",
      orderTotal: 200,
      intent: "record",
    });

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        onlineAmount: ["Cash and online amounts must add up to 200.00."],
      },
    });
  });

  it("ignores payment allocation during draft saves", () => {
    const result = resolveSalesOrderPayment({
      paymentMode: "MIXED",
      cashAmount: "10",
      onlineAmount: "5",
      orderTotal: 15,
      intent: "draft",
    });

    expect(result).toEqual({
      ok: true,
      paymentMode: null,
      cashAmount: null,
      onlineAmount: null,
    });
  });

  it("treats tiny floating point differences as a valid total match", () => {
    expect(salesOrderAmountsMatchTotal(199.999, 200)).toBe(true);
    expect(salesOrderAmountsMatchTotal(199.99, 200)).toBe(false);
  });
});

describe("sales order form parsing", () => {
  it("falls back to the remembered branch when the explicit branch field is empty", () => {
    const formData = new FormData();
    formData.set("defaultLocationId", BRANCH_ID);
    formData.set("locationId", "");
    formData.set("customerName", "Walk-in");
    formData.set(
      "itemsPayload",
      JSON.stringify([
        {
          productId: PRODUCT_ID,
          quantity: 2,
          unitPrice: 150,
        },
      ])
    );

    const values = extractSalesOrderFormValues(formData);

    expect(values.locationId).toBe(BRANCH_ID);
    expect(values.items).toEqual([
      {
        productId: PRODUCT_ID,
        quantity: 2,
        unitPrice: 150,
      },
    ]);
  });

  it("normalizes reversed date filters for list pages", () => {
    const filters = parseSalesOrderListFilters({
      dateFrom: "2026-04-20",
      dateTo: "2026-04-10",
      status: "COMPLETED",
      page: "2",
      pageSize: "50",
    });

    expect(filters.dateFrom).toBe("2026-04-10");
    expect(filters.dateTo).toBe("2026-04-20");
    expect(filters.status).toBe("COMPLETED");
    expect(filters.page).toBe(2);
    expect(filters.pageSize).toBe(50);
  });
});
