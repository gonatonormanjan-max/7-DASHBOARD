"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SYSTEM_FIELDS,
  SYSTEM_FIELD_LABELS,
  REQUIRED_FIELDS,
  getMappedValue,
  computeImportSummary,
  type SystemField,
  type RawRow,
  type ValidatedRow,
  IMPORT_ROW_LIMIT,
} from "@/lib/validators/product-import";

type StepReviewProps = {
  headers: string[];
  parsedRows: RawRow[];
  columnMapping: Record<string, SystemField | null>;
  validatedRows: ValidatedRow[];
  categoryNameMap: Map<string, string>;
  unknownCategories: string[];
  categoryResolutions: Record<string, "create" | "skip">;
  wasTruncated: boolean;
  onMappingChange: (header: string, field: SystemField | null) => void;
  onResolutionChange: (categoryName: string, resolution: "create" | "skip") => void;
  onBack: () => void;
  onContinue: () => void;
};

// Which system fields to show as columns (only mapped + ordered)
const COLUMN_ORDER: SystemField[] = [
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

function getErrorsForField(row: ValidatedRow, field: SystemField) {
  return row.errors.filter((e) => e.field === field);
}

function RowStatusIcon({ row }: { row: ValidatedRow }) {
  if (!row.isValid) {
    return <XCircle className="size-4 text-red-500" strokeWidth={2} />;
  }
  return <CheckCircle2 className="size-4 text-emerald-500" strokeWidth={2} />;
}

export function StepReview({
  headers,
  parsedRows,
  columnMapping,
  validatedRows,
  categoryNameMap,
  unknownCategories,
  categoryResolutions,
  wasTruncated,
  onMappingChange,
  onResolutionChange,
  onBack,
  onContinue,
}: StepReviewProps) {
  // Columns that are currently mapped (in display order)
  const activeMappedFields = useMemo<SystemField[]>(() => {
    const mapped = new Set(Object.values(columnMapping).filter(Boolean) as SystemField[]);
    return COLUMN_ORDER.filter((f) => mapped.has(f));
  }, [columnMapping]);

  const summary = useMemo(
    () =>
      computeImportSummary(
        validatedRows,
        parsedRows,
        columnMapping,
        categoryNameMap,
        categoryResolutions
      ),
    [validatedRows, parsedRows, columnMapping, categoryNameMap, categoryResolutions]
  );

  function isRowSkippedByCategory(row: ValidatedRow): boolean {
    if (!row.isValid) return false;
    const cat = getMappedValue(row.raw, columnMapping, "category").trim();
    if (!cat) return false;
    if (categoryNameMap.has(cat.toLowerCase())) return false;
    return (categoryResolutions[cat] ?? "skip") === "skip";
  }

  return (
    <div className="space-y-6">
      {/* Truncation warning */}
      {wasTruncated && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={2} />
          <p className="text-sm text-amber-800">
            Your paste contained more than {IMPORT_ROW_LIMIT} data rows. Only the first{" "}
            {IMPORT_ROW_LIMIT} rows are shown. Please split your data into batches.
          </p>
        </div>
      )}

      {/* Zone A — Column Mapping */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Column mapping</h3>
        <p className="mt-1 text-xs text-slate-500">
          Detected headers are mapped to system fields automatically. Adjust any incorrect
          mapping using the dropdowns below.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {headers.map((header) => (
            <div
              key={header}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span className="font-mono text-xs font-semibold text-slate-700">{header}</span>
              <span className="text-xs text-slate-400">→</span>
              <select
                className="rounded-lg border-0 bg-transparent py-0 text-xs text-slate-700 outline-none focus:ring-0"
                value={columnMapping[header] ?? ""}
                onChange={(e) =>
                  onMappingChange(header, (e.target.value as SystemField) || null)
                }
              >
                <option value="">— ignore —</option>
                {SYSTEM_FIELDS.map((field) => (
                  <option key={field} value={field}>
                    {SYSTEM_FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field) ? " *" : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Zone B — Preview Table */}
      <div className="rounded-[20px] border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-800">
            Preview ({parsedRows.length} rows)
          </h3>
          <p className="text-xs text-slate-500">
            Red = validation error · Amber = duplicate SKU
          </p>
        </div>

        <div className="overflow-auto" style={{ maxHeight: 420 }}>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3"></th>
                {activeMappedFields.map((field) => (
                  <th key={field} className="px-4 py-3">
                    {SYSTEM_FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field) ? (
                      <span className="ml-0.5 text-red-400">*</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {validatedRows.map((row) => {
                const isSkipped = isRowSkippedByCategory(row);
                return (
                  <tr
                    key={row.index}
                    className={isSkipped || !row.isValid ? "opacity-60" : ""}
                  >
                    <td className="px-4 py-2.5 text-xs text-slate-400">{row.index}</td>
                    <td className="px-4 py-2.5">
                      <RowStatusIcon row={row} />
                    </td>
                    {activeMappedFields.map((field) => {
                      const value = getMappedValue(row.raw, columnMapping, field);
                      const fieldErrors = getErrorsForField(row, field);
                      const isSkuDuplicate =
                        field === "sku" && (row.isDuplicateInBatch || row.isDuplicateInDb);
                      const isCategorySkipped = field === "category" && isSkipped;

                      const cellClass = isSkuDuplicate
                        ? "bg-amber-50 text-amber-800"
                        : fieldErrors.length > 0
                          ? "bg-red-50 text-red-800"
                          : isCategorySkipped
                            ? "text-slate-400 line-through"
                            : "text-slate-700";

                      return (
                        <td
                          key={field}
                          className={`max-w-[200px] truncate px-4 py-2.5 text-xs ${cellClass}`}
                          title={
                            fieldErrors.length > 0
                              ? fieldErrors.map((e) => e.message).join(" ")
                              : isSkuDuplicate
                                ? row.isDuplicateInBatch
                                  ? "Duplicate SKU within this batch"
                                  : "SKU already exists in the database"
                                : value
                          }
                        >
                          {value || (
                            <span className="italic text-slate-400">empty</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zone C — Category Resolution */}
      {unknownCategories.length > 0 && (
        <div className="rounded-[20px] border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2} />
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Unrecognized categories</h3>
              <p className="mt-1 text-xs text-slate-500">
                These category names were not found in the system. Choose what to do with rows
                using each one. Nothing is created without your explicit confirmation.
              </p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {unknownCategories.map((catName) => {
              const resolution = categoryResolutions[catName] ?? "skip";
              return (
                <div
                  key={catName}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <span className="font-mono text-sm font-semibold text-slate-700">
                    &ldquo;{catName}&rdquo;
                  </span>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`cat-resolution-${catName}`}
                        value="create"
                        checked={resolution === "create"}
                        onChange={() => onResolutionChange(catName, "create")}
                        className="accent-primary"
                      />
                      <span className={resolution === "create" ? "font-semibold text-slate-900" : "text-slate-500"}>
                        Create new category
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`cat-resolution-${catName}`}
                        value="skip"
                        checked={resolution === "skip"}
                        onChange={() => onResolutionChange(catName, "skip")}
                        className="accent-primary"
                      />
                      <span className={resolution === "skip" ? "font-semibold text-slate-900" : "text-slate-500"}>
                        Skip rows using this
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary bar + actions */}
      <div className="rounded-[20px] border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-emerald-700">
              {summary.readyCount} rows ready
            </span>
            {summary.errorCount > 0 && (
              <span className="text-red-600">
                {summary.errorCount} row{summary.errorCount !== 1 ? "s" : ""} with errors
                (will be skipped)
              </span>
            )}
            {summary.skippedCategoryCount > 0 && (
              <span className="text-amber-700">
                {summary.skippedCategoryCount} skipped by category
              </span>
            )}
            {summary.createCategoryCount > 0 && (
              <span className="text-slate-600">
                {summary.createCategoryCount} new{" "}
                {summary.createCategoryCount === 1 ? "category" : "categories"} to create
              </span>
            )}
          </div>

          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onBack}>
              ← Back
            </Button>
            <Button disabled={summary.readyCount === 0} onClick={onContinue}>
              Continue →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
