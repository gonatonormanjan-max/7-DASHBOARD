import { describe, expect, it } from "vitest";
import {
  computeImportSummary,
  getUnknownCategoryNames,
  validateRows,
  type RawRow,
} from "@/lib/validators/product-import";
import { inventoryTransferSchema } from "@/lib/validators/inventory";

describe("product import validation", () => {
  const mapping = {
    Name: "name",
    SKU: "sku",
    Category: "category",
    "Unit Price": "unitPrice",
    "Cost Price": "costPrice",
  } as const;

  const rows: RawRow[] = [
    {
      Name: "Widget A",
      SKU: "SKU-001",
      Category: "Existing",
      "Unit Price": "125.50",
      "Cost Price": "80.25",
    },
    {
      Name: "Widget B",
      SKU: "SKU-001",
      Category: "Existing",
      "Unit Price": "220",
      "Cost Price": "150",
    },
    {
      Name: "Widget C",
      SKU: "SKU-NEW",
      Category: "New Category",
      "Unit Price": "210",
      "Cost Price": "140",
    },
    {
      Name: "Widget D",
      SKU: "SKU-DB",
      Category: "New Category",
      "Unit Price": "200",
      "Cost Price": "bad",
    },
  ];

  it("flags duplicate SKUs in the batch and existing SKUs in the database", () => {
    const validatedRows = validateRows(rows, mapping, new Set(["SKU-DB"]));

    expect(validatedRows[0].isValid).toBe(false);
    expect(validatedRows[0].errors.map((error) => error.message)).toContain(
      "Duplicate SKU within this import batch."
    );
    expect(validatedRows[1].errors.map((error) => error.message)).toContain(
      "Duplicate SKU within this import batch."
    );
    expect(validatedRows[3].errors.map((error) => error.message)).toContain(
      "SKU already exists in the database."
    );
    expect(validatedRows[3].errors.map((error) => error.message)).toContain(
      "Enter a valid non-negative number."
    );
  });

  it("summarizes unknown categories based on create-or-skip decisions", () => {
    const validatedRows = validateRows(rows, mapping, new Set(["SKU-DB"]));
    const categoryNameMap = new Map([["existing", "cat-1"]]);
    const unknownCategories = getUnknownCategoryNames(rows, mapping, categoryNameMap);

    expect(unknownCategories).toEqual(["New Category"]);

    const summary = computeImportSummary(validatedRows, rows, mapping, categoryNameMap, {
      "New Category": "create",
    });

    expect(summary).toEqual({
      readyCount: 1,
      errorCount: 3,
      skippedCategoryCount: 0,
      createCategoryCount: 1,
    });
  });
});

describe("inventory transfer validation", () => {
  it("prevents transfers to the same location", () => {
    const result = inventoryTransferSchema.safeParse({
      productId: "66666666-6666-4666-8666-666666666666",
      fromLocationId: "77777777-7777-4777-8777-777777777777",
      toLocationId: "77777777-7777-4777-8777-777777777777",
      quantity: 5,
      notes: "Cycle balancing",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Choose different locations for the transfer.");
  });
});
