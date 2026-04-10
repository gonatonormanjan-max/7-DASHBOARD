export type SystemField =
  | "name"
  | "sku"
  | "category"
  | "unitPrice"
  | "costPrice"
  | "brand"
  | "status"
  | "reorderLevel"
  | "description";

export const SYSTEM_FIELDS: SystemField[] = [
  "name",
  "sku",
  "category",
  "unitPrice",
  "costPrice",
  "brand",
  "status",
  "reorderLevel",
  "description",
];

export const SYSTEM_FIELD_LABELS: Record<SystemField, string> = {
  name: "Name",
  sku: "SKU",
  category: "Category",
  unitPrice: "Unit Price",
  costPrice: "Cost Price",
  brand: "Brand",
  status: "Status",
  reorderLevel: "Reorder Level",
  description: "Description",
};

export const REQUIRED_FIELDS: SystemField[] = [
  "name",
  "sku",
  "category",
  "unitPrice",
  "costPrice",
];

// All accepted column header aliases, mapped to SystemField
const COLUMN_ALIASES: Record<string, SystemField> = {
  name: "name",
  "product name": "name",
  "product": "name",
  sku: "sku",
  "item code": "sku",
  code: "sku",
  category: "category",
  cat: "category",
  "unit price": "unitPrice",
  unitprice: "unitPrice",
  price: "unitPrice",
  "selling price": "unitPrice",
  "cost price": "costPrice",
  costprice: "costPrice",
  cost: "costPrice",
  brand: "brand",
  status: "status",
  "reorder level": "reorderLevel",
  reorderlevel: "reorderLevel",
  reorder: "reorderLevel",
  description: "description",
  desc: "description",
};

export const IMPORT_ROW_LIMIT = 100;

const VALID_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

// A row as key-value pairs keyed by the original header string
export type RawRow = Record<string, string>;

export type RowError = {
  field: SystemField | "_row";
  message: string;
};

export type ValidatedRow = {
  index: number; // 1-based row number (not counting header)
  raw: RawRow;
  errors: RowError[];
  isValid: boolean;
  isDuplicateInBatch: boolean;
  isDuplicateInDb: boolean;
};

// ----------------------------------------------------------------
// Parsing
// ----------------------------------------------------------------

export function parseTabSeparated(text: string): {
  headers: string[];
  rows: RawRow[];
  totalDataRows: number; // before the 100-row cap
} {
  const lines = text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return { headers: [], rows: [], totalDataRows: 0 };
  }

  const headers = lines[0].split("\t").map((h) => h.trim());
  const dataLines = lines.slice(1);
  const totalDataRows = dataLines.length;
  const cappedLines = dataLines.slice(0, IMPORT_ROW_LIMIT);

  const rows: RawRow[] = cappedLines.map((line) => {
    const cells = line.split("\t");
    const row: RawRow = {};
    headers.forEach((header, i) => {
      row[header] = (cells[i] ?? "").trim();
    });
    return row;
  });

  return { headers, rows, totalDataRows };
}

// ----------------------------------------------------------------
// Column mapping
// ----------------------------------------------------------------

export function autoMapColumns(
  headers: string[]
): Record<string, SystemField | null> {
  const mapping: Record<string, SystemField | null> = {};
  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    mapping[header] = COLUMN_ALIASES[normalized] ?? null;
  }
  return mapping;
}

// ----------------------------------------------------------------
// Value extraction
// ----------------------------------------------------------------

export function getMappedValue(
  row: RawRow,
  mapping: Record<string, SystemField | null>,
  field: SystemField
): string {
  const header = Object.keys(mapping).find((h) => mapping[h] === field);
  if (!header) return "";
  return (row[header] ?? "").trim();
}

// ----------------------------------------------------------------
// Validation
// ----------------------------------------------------------------

export function validateRows(
  rows: RawRow[],
  mapping: Record<string, SystemField | null>,
  existingSkus: Set<string>
): ValidatedRow[] {
  // First pass: count SKU occurrences to detect intra-batch duplicates
  const skuCounts = new Map<string, number>();
  for (const row of rows) {
    const sku = getMappedValue(row, mapping, "sku").toUpperCase();
    if (sku) {
      skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
    }
  }

  return rows.map((row, i) => {
    const errors: RowError[] = [];

    // --- name ---
    const name = getMappedValue(row, mapping, "name");
    if (!name) {
      errors.push({ field: "name", message: "Name is required." });
    } else if (name.length > 120) {
      errors.push({ field: "name", message: "Name must be 120 characters or fewer." });
    }

    // --- sku ---
    const sku = getMappedValue(row, mapping, "sku").toUpperCase();
    if (!sku) {
      errors.push({ field: "sku", message: "SKU is required." });
    }

    // --- category ---
    const category = getMappedValue(row, mapping, "category");
    if (!category) {
      errors.push({ field: "category", message: "Category is required." });
    }

    // --- unitPrice ---
    const unitPriceRaw = getMappedValue(row, mapping, "unitPrice");
    if (!unitPriceRaw) {
      errors.push({ field: "unitPrice", message: "Unit price is required." });
    } else {
      const val = Number(unitPriceRaw);
      if (!Number.isFinite(val) || val < 0) {
        errors.push({ field: "unitPrice", message: "Enter a valid non-negative number." });
      }
    }

    // --- costPrice ---
    const costPriceRaw = getMappedValue(row, mapping, "costPrice");
    if (!costPriceRaw) {
      errors.push({ field: "costPrice", message: "Cost price is required." });
    } else {
      const val = Number(costPriceRaw);
      if (!Number.isFinite(val) || val < 0) {
        errors.push({ field: "costPrice", message: "Enter a valid non-negative number." });
      }
    }

    // --- reorderLevel (optional) ---
    const reorderRaw = getMappedValue(row, mapping, "reorderLevel");
    if (reorderRaw) {
      if (!/^\d+$/.test(reorderRaw)) {
        errors.push({ field: "reorderLevel", message: "Must be a whole number of 0 or more." });
      }
    }

    // --- status (optional) ---
    const statusRaw = getMappedValue(row, mapping, "status").toUpperCase();
    if (statusRaw && !VALID_STATUSES.includes(statusRaw as (typeof VALID_STATUSES)[number])) {
      errors.push({ field: "status", message: "Must be ACTIVE, INACTIVE, or ARCHIVED." });
    }

    // --- description (optional) ---
    const description = getMappedValue(row, mapping, "description");
    if (description && description.length > 1500) {
      errors.push({ field: "description", message: "Description must be 1500 characters or fewer." });
    }

    // --- duplicate detection ---
    const isDuplicateInBatch = sku ? (skuCounts.get(sku) ?? 0) > 1 : false;
    const isDuplicateInDb = sku ? existingSkus.has(sku) : false;

    if (isDuplicateInBatch) {
      errors.push({ field: "sku", message: "Duplicate SKU within this import batch." });
    }
    if (isDuplicateInDb) {
      errors.push({ field: "sku", message: "SKU already exists in the database." });
    }

    return {
      index: i + 1,
      raw: row,
      errors,
      isValid: errors.length === 0,
      isDuplicateInBatch,
      isDuplicateInDb,
    };
  });
}

// ----------------------------------------------------------------
// Category helpers
// ----------------------------------------------------------------

export function getUnknownCategoryNames(
  rows: RawRow[],
  mapping: Record<string, SystemField | null>,
  categoryNameMap: Map<string, string>
): string[] {
  const unique = new Set<string>();
  for (const row of rows) {
    const cat = getMappedValue(row, mapping, "category").trim();
    if (cat && !categoryNameMap.has(cat.toLowerCase())) {
      unique.add(cat);
    }
  }
  return [...unique].sort();
}

// Returns row counts for the summary bar
export function computeImportSummary(
  validatedRows: ValidatedRow[],
  rawRows: RawRow[],
  mapping: Record<string, SystemField | null>,
  categoryNameMap: Map<string, string>,
  categoryResolutions: Record<string, "create" | "skip">
): { readyCount: number; errorCount: number; skippedCategoryCount: number; createCategoryCount: number } {
  let readyCount = 0;
  let errorCount = 0;
  let skippedCategoryCount = 0;

  for (const row of validatedRows) {
    if (!row.isValid) {
      errorCount++;
      continue;
    }
    const cat = getMappedValue(row.raw, mapping, "category").trim();
    const catLower = cat.toLowerCase();
    if (categoryNameMap.has(catLower)) {
      readyCount++;
    } else {
      const resolution = categoryResolutions[cat] ?? "skip";
      if (resolution === "create") {
        readyCount++;
      } else {
        skippedCategoryCount++;
      }
    }
  }

  const createCategoryCount = Object.values(categoryResolutions).filter((r) => r === "create").length;

  return { readyCount, errorCount, skippedCategoryCount, createCategoryCount };
}
