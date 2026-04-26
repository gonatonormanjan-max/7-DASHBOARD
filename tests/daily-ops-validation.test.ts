import { describe, expect, it } from "vitest";
import {
  parseIssueReportStatusFilter,
  parseStockCountLinesPayload,
  saveStockCountSchema,
} from "@/lib/validators/daily-ops";

describe("daily ops validators", () => {
  it("parses stock count payload lines from form data", () => {
    const formData = new FormData();
    formData.set(
      "linesPayload",
      JSON.stringify([
        {
          productId: "11111111-1111-4111-8111-111111111111",
          countedQty: 8,
          notes: "Shelf recount",
        },
      ])
    );

    expect(parseStockCountLinesPayload(formData)).toEqual([
      {
        productId: "11111111-1111-4111-8111-111111111111",
        countedQty: 8,
        notes: "Shelf recount",
      },
    ]);
  });

  it("defaults invalid issue report filters to all", () => {
    expect(parseIssueReportStatusFilter({ status: "INVALID" })).toBe("all");
    expect(parseIssueReportStatusFilter({ status: "OPEN" })).toBe("OPEN");
  });

  it("rejects negative counted quantities", () => {
    const parsed = saveStockCountSchema.safeParse({
      locationId: "11111111-1111-4111-8111-111111111111",
      type: "OPENING",
      countDate: "2026-04-23",
      lines: [
        {
          productId: "22222222-2222-4222-8222-222222222222",
          countedQty: -1,
          notes: "",
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});
