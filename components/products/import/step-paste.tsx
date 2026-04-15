"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseTabSeparated, IMPORT_ROW_LIMIT, type RawRow } from "@/lib/validators/product-import";

type StepPasteProps = {
  initialText: string;
  onParsed: (params: {
    headers: string[];
    rows: RawRow[];
    rawText: string;
    wasTruncated: boolean;
  }) => void;
};

const COLUMN_REFERENCE = [
  { name: "name", required: true, notes: "Max 120 chars" },
  { name: "sku", required: true, notes: "Auto-uppercased, must be unique" },
  { name: "category", required: true, notes: "Must match existing or be created" },
  { name: "unitPrice", required: true, notes: "Numeric, e.g. 99.50" },
  { name: "costPrice", required: true, notes: "Numeric, e.g. 45.00" },
  { name: "brand", required: false, notes: "Unrecognized names are ignored" },
  { name: "status", required: false, notes: "ACTIVE / INACTIVE (default: ACTIVE)" },
  { name: "reorderLevel", required: false, notes: "Whole number, default: 0" },
  { name: "description", required: false, notes: "Max 1500 chars" },
];

const COLUMN_ALIASES: Record<string, string> = {
  name: "name, product name, product",
  sku: "sku, item code, code",
  category: "category, cat",
  unitPrice: "unit price, unitprice, price, selling price",
  costPrice: "cost price, costprice, cost",
  brand: "brand",
  status: "status",
  reorderLevel: "reorder level, reorderlevel, reorder",
  description: "description, desc",
};

export function StepPaste({ initialText, onParsed }: StepPasteProps) {
  const [text, setText] = useState(initialText);
  const [showReference, setShowReference] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleParse() {
    setError(null);
    const trimmed = text.trim();

    if (!trimmed) {
      setError("Paste your spreadsheet data first.");
      return;
    }

    const { headers, rows, totalDataRows } = parseTabSeparated(trimmed);

    if (headers.length === 0) {
      setError("Could not detect any columns. Make sure you include the header row.");
      return;
    }

    if (rows.length === 0) {
      setError("No data rows found. Make sure you have at least one row below the header.");
      return;
    }

    onParsed({
      headers,
      rows,
      rawText: trimmed,
      wasTruncated: totalDataRows > IMPORT_ROW_LIMIT,
    });
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
        <p className="text-sm leading-6 text-slate-600">
          Copy your rows from <strong className="font-semibold text-slate-800">Excel</strong> or{" "}
          <strong className="font-semibold text-slate-800">Google Sheets</strong> and paste below.
          Include the <strong className="font-semibold text-slate-800">header row</strong> as the
          first line — the system will detect your columns automatically. Maximum{" "}
          <strong className="font-semibold text-slate-800">{IMPORT_ROW_LIMIT} rows</strong> per
          batch.
        </p>
      </div>

      {/* Column reference */}
      <div className="rounded-[20px] border border-slate-200">
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          onClick={() => setShowReference((prev) => !prev)}
        >
          <span className="text-sm font-semibold text-slate-800">Accepted column names</span>
          {showReference ? (
            <ChevronDown className="size-4 text-slate-400" strokeWidth={2} />
          ) : (
            <ChevronRight className="size-4 text-slate-400" strokeWidth={2} />
          )}
        </button>

        {showReference && (
          <div className="border-t border-slate-200 px-5 pb-5">
            <table className="mt-4 min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="pb-2 pr-6">Column</th>
                  <th className="pb-2 pr-6">Required</th>
                  <th className="pb-2 pr-6">Accepted names (case-insensitive)</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COLUMN_REFERENCE.map((col) => (
                  <tr key={col.name}>
                    <td className="py-2 pr-6 font-mono text-xs font-semibold text-slate-700">
                      {col.name}
                    </td>
                    <td className="py-2 pr-6">
                      {col.required ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Required
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Optional</span>
                      )}
                    </td>
                    <td className="py-2 pr-6 font-mono text-xs text-slate-500">
                      {COLUMN_ALIASES[col.name]}
                    </td>
                    <td className="py-2 text-xs text-slate-500">{col.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Textarea */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Paste your spreadsheet data
        </label>
        <textarea
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-5 text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
          rows={14}
          placeholder={`name\tsku\tcategory\tunitPrice\tcostPrice\nProduct One\tPROD-001\tBeverages\t120.00\t80.00\nProduct Two\tPROD-002\tSnacks\t45.00\t28.00`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
      </div>

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button disabled={!text.trim()} onClick={handleParse}>
          Parse data →
        </Button>
      </div>
    </div>
  );
}
