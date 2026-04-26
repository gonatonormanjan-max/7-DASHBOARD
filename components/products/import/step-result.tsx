"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importProducts, type ImportRow, type ImportResult } from "@/lib/actions/import-products";
import {
  getMappedValue,
  computeImportSummary,
  type SystemField,
  type RawRow,
  type ValidatedRow,
} from "@/lib/validators/product-import";

type StepResultProps = {
  validatedRows: ValidatedRow[];
  parsedRows: RawRow[];
  columnMapping: Record<string, SystemField | null>;
  categoryNameMap: Map<string, string>;
  categoryResolutions: Record<string, "create" | "skip">;
  onBack: () => void;
  onStartOver: () => void;
};

export function StepResult({
  validatedRows,
  parsedRows,
  columnMapping,
  categoryNameMap,
  categoryResolutions,
  onBack,
  onStartOver,
}: StepResultProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const summary = computeImportSummary(
    validatedRows,
    parsedRows,
    columnMapping,
    categoryNameMap,
    categoryResolutions
  );

  const categoriesToCreate = Object.entries(categoryResolutions)
    .filter(([, resolution]) => resolution === "create")
    .map(([name]) => name);

  function buildPayloadRows(): ImportRow[] {
    return validatedRows
      .filter((row) => {
        if (!row.isValid) return false;
        const cat = getMappedValue(row.raw, columnMapping, "category").trim();
        if (!cat) return false;
        if (categoryNameMap.has(cat.toLowerCase())) return true;
        return (categoryResolutions[cat] ?? "skip") === "create";
      })
      .map((row) => ({
        rowIndex: row.index,
        name: getMappedValue(row.raw, columnMapping, "name"),
        sku: getMappedValue(row.raw, columnMapping, "sku"),
        category: getMappedValue(row.raw, columnMapping, "category"),
        unitPrice: getMappedValue(row.raw, columnMapping, "unitPrice"),
        costPrice: getMappedValue(row.raw, columnMapping, "costPrice"),
        brand: getMappedValue(row.raw, columnMapping, "brand"),
        status: getMappedValue(row.raw, columnMapping, "status"),
        reorderLevel: getMappedValue(row.raw, columnMapping, "reorderLevel"),
        description: getMappedValue(row.raw, columnMapping, "description"),
      }));
  }

  async function handleImport() {
    setIsImporting(true);
    setImportError(null);

    try {
      const rows = buildPayloadRows();
      const importResult = await importProducts({
        rows,
        newCategoriesToCreate: categoriesToCreate,
      });
      setResult(importResult);
    } catch {
      setImportError("An unexpected error occurred. Please try again.");
    } finally {
      setIsImporting(false);
    }
  }

  // ---- Result state (after import fires) ----
  if (result) {
    return (
      <div className="space-y-6">
        <div className="rounded-[20px] border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">Import complete</h3>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-500" strokeWidth={2} />
              <span className="text-sm font-semibold text-slate-900">
                {result.created} product{result.created !== 1 ? "s" : ""} created
              </span>
            </div>

            {result.skipped > 0 && (
              <div className="flex items-center gap-3">
                <XCircle className="size-5 text-red-400" strokeWidth={2} />
                <span className="text-sm text-slate-700">
                  {result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped
                </span>
              </div>
            )}

            {categoriesToCreate.length > 0 && result.created > 0 && (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-500" strokeWidth={2} />
                <span className="text-sm text-slate-700">
                  {categoriesToCreate.length} new{" "}
                  {categoriesToCreate.length === 1 ? "category" : "categories"} created:{" "}
                  {categoriesToCreate.map((c) => `"${c}"`).join(", ")}
                </span>
              </div>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 text-sm font-semibold text-slate-800">Skipped rows</h4>
              <div className="overflow-hidden rounded-[16px] border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-4 py-3">Row</th>
                      <th className="px-4 py-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {result.errors.map((err, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">
                          {err.rowIndex > 0 ? `Row ${err.rowIndex}` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-red-700">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3">
          <Button variant="outline" onClick={onStartOver}>
            Import another batch
          </Button>
          <Link href="/dashboard/products">
            <Button>Go to Products →</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ---- Confirm state (before import fires) ----
  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Ready to import</h3>
        <p className="mt-1 text-sm text-slate-500">
          Review what will happen, then confirm to proceed.
        </p>

        <ul className="mt-5 space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" strokeWidth={2} />
            <span className="text-sm text-slate-700">
              <strong className="font-semibold text-slate-900">{summary.readyCount}</strong>{" "}
              product{summary.readyCount !== 1 ? "s" : ""} will be created
            </span>
          </li>

          {summary.errorCount + summary.skippedCategoryCount > 0 && (
            <li className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2} />
              <span className="text-sm text-slate-700">
                <strong className="font-semibold text-slate-900">
                  {summary.errorCount + summary.skippedCategoryCount}
                </strong>{" "}
                row{summary.errorCount + summary.skippedCategoryCount !== 1 ? "s" : ""} will be
                skipped (errors or unresolved categories)
              </span>
            </li>
          )}

          {categoriesToCreate.length > 0 && (
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" strokeWidth={2} />
              <span className="text-sm text-slate-700">
                <strong className="font-semibold text-slate-900">{categoriesToCreate.length}</strong>{" "}
                new {categoriesToCreate.length === 1 ? "category" : "categories"} will be
                created:{" "}
                <span className="font-mono font-semibold text-slate-800">
                  {categoriesToCreate.map((c) => `"${c}"`).join(", ")}
                </span>
              </span>
            </li>
          )}
        </ul>
      </div>

      {importError && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {importError}
        </p>
      )}

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
          ← Back
        </Button>
        <Button onClick={handleImport} disabled={isImporting}>
          {isImporting ? "Importing…" : "Import Products"}
        </Button>
      </div>
    </div>
  );
}
