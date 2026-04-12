import { describe, expect, it } from "vitest";
import {
  extractPurchaseOrderReceiveValues,
  parsePurchaseOrderListFilters,
} from "@/lib/validators/purchase-orders";

const ITEM_ONE = "33333333-3333-4333-8333-333333333333";
const ITEM_TWO = "44444444-4444-4444-8444-444444444444";

describe("purchase order receiving form parsing", () => {
  it("sorts sparse receive-line indexes before building the payload", () => {
    const formData = new FormData();
    formData.set("warehouseId", "55555555-5555-4555-8555-555555555555");
    formData.set("notes", "Truck arrived late");
    formData.set("items[2].itemId", ITEM_TWO);
    formData.set("items[2].quantity", "5");
    formData.set("items[0].itemId", ITEM_ONE);
    formData.set("items[0].quantity", "3");

    const values = extractPurchaseOrderReceiveValues(formData);

    expect(values).toEqual({
      warehouseId: "55555555-5555-4555-8555-555555555555",
      notes: "Truck arrived late",
      items: [
        { itemId: ITEM_ONE, quantity: "3" },
        { itemId: ITEM_TWO, quantity: "5" },
      ],
    });
  });

  it("normalizes reversed purchase order date filters", () => {
    const filters = parsePurchaseOrderListFilters({
      dateFrom: "2026-05-18",
      dateTo: "2026-05-01",
      status: "APPROVED",
      page: "3",
    });

    expect(filters.dateFrom).toBe("2026-05-01");
    expect(filters.dateTo).toBe("2026-05-18");
    expect(filters.status).toBe("APPROVED");
    expect(filters.page).toBe(3);
  });
});
