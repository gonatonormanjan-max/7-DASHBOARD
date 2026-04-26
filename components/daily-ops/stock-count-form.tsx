"use client";

import { useMemo, useState } from "react";
import { saveStockCountAction, submitStockCountAction } from "@/lib/actions/daily-ops";
import { Button } from "@/components/ui/button";

type StockCountLine = {
  productId: string;
  productName: string;
  sku: string;
  systemQty: number;
  countedQty: number;
  discrepancy: number;
  notes: string;
};

type StockCountFormProps = {
  countId?: string;
  countDate: string;
  locationId: string;
  type: "OPENING" | "CLOSING";
  status: "DRAFT" | "SUBMITTED" | "NEW";
  lines: StockCountLine[];
};

export function StockCountForm({
  countId,
  countDate,
  locationId,
  type,
  status,
  lines,
}: StockCountFormProps) {
  const [draftLines, setDraftLines] = useState(lines);
  const isSubmitted = status === "SUBMITTED";
  const discrepancySummary = useMemo(
    () =>
      draftLines.reduce(
        (summary, line) => {
          const discrepancy = line.countedQty - line.systemQty;

          if (discrepancy !== 0) {
            summary.lineCount += 1;
            summary.totalVarianceUnits += Math.abs(discrepancy);
          }

          return summary;
        },
        { lineCount: 0, totalVarianceUnits: 0 }
      ),
    [draftLines]
  );

  return (
    <form action={saveStockCountAction} className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <input name="countId" type="hidden" value={countId ?? ""} />
      <input name="locationId" type="hidden" value={locationId} />
      <input name="type" type="hidden" value={type} />
      <input name="countDate" type="hidden" value={countDate} />
      <input name="linesPayload" type="hidden" value={JSON.stringify(draftLines)} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {type === "OPENING" ? "Opening" : "Closing"} count lines
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Count each product physically at the branch, then save or submit the result for
            discrepancy review.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p>
            Status: <strong>{status === "NEW" ? "Not started" : status}</strong>
          </p>
          <p className="mt-1">
            Discrepancies:{" "}
            <strong>{discrepancySummary.lineCount.toLocaleString("en-US")}</strong> line
            {discrepancySummary.lineCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="max-h-[600px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">System qty</th>
                <th className="px-4 py-3">Counted qty</th>
                <th className="px-4 py-3">Discrepancy</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {draftLines.map((line) => {
                const discrepancy = line.countedQty - line.systemQty;
                const discrepancyClass =
                  discrepancy > 0
                    ? "text-[#11664b]"
                    : discrepancy < 0
                      ? "text-red-700"
                      : "text-slate-500";

                return (
                  <tr key={line.productId}>
                    <td className="px-4 py-3 font-medium text-slate-900">{line.productName}</td>
                    <td className="px-4 py-3 text-slate-500">{line.sku}</td>
                    <td className="px-4 py-3">{line.systemQty}</td>
                    <td className="px-4 py-3">
                      <input
                        className="w-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:bg-slate-100"
                        disabled={isSubmitted}
                        min={0}
                        onChange={(event) => {
                          const countedQty = Number.parseInt(event.target.value, 10);

                          setDraftLines((current) =>
                            current.map((item) =>
                              item.productId === line.productId
                                ? {
                                    ...item,
                                    countedQty:
                                      Number.isFinite(countedQty) && countedQty >= 0
                                        ? countedQty
                                        : 0,
                                  }
                                : item
                            )
                          );
                        }}
                        type="number"
                        value={line.countedQty}
                      />
                    </td>
                    <td className={`px-4 py-3 font-semibold ${discrepancyClass}`}>
                      {discrepancy > 0 ? "+" : ""}
                      {discrepancy}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full min-w-56 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:bg-slate-100"
                        disabled={isSubmitted}
                        maxLength={500}
                        onChange={(event) =>
                          setDraftLines((current) =>
                            current.map((item) =>
                              item.productId === line.productId
                                ? {
                                    ...item,
                                    notes: event.target.value,
                                  }
                                : item
                            )
                          )
                        }
                        placeholder="Optional count notes"
                        value={line.notes}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-slate-500">
          Total variance:{" "}
          <strong>{discrepancySummary.totalVarianceUnits.toLocaleString("en-US")}</strong> unit
          {discrepancySummary.totalVarianceUnits === 1 ? "" : "s"}
        </p>

        <div className="flex gap-3">
          <Button disabled={isSubmitted} type="submit" variant="outline">
            Save as Draft
          </Button>
          <Button disabled={isSubmitted} formAction={submitStockCountAction} type="submit">
            Submit Count
          </Button>
        </div>
      </div>
    </form>
  );
}
