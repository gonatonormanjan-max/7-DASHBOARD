"use client";

import { useState } from "react";
import { formatDateTimePH } from "@/lib/timezone";

type Movement = {
  id: string;
  type: string;
  quantityChange: number;
  notes: string | null;
  createdAt: Date;
  product: { name: string; sku: string };
  location: { name: string; code: string };
  performedBy: { firstName: string; lastName: string };
};

type POMovementLedgerProps = {
  movements: Movement[];
};

function formatDateTime(date: Date) {
  return formatDateTimePH(date);
}

export function POMovementLedger({ movements }: POMovementLedgerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (movements.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <button
        className="flex w-full items-center justify-between p-6 text-left"
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Movement history</h2>
          <p className="mt-1 text-sm text-slate-500">
            {movements.length} stock movement
            {movements.length !== 1 ? "s" : ""} recorded against this order.
          </p>
        </div>
        <span className="ml-4 flex-shrink-0 text-slate-400 transition-transform duration-200">
          {isOpen ? (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-slate-200 p-6 pt-0 pb-6">
          <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Qty Added</th>
                  <th className="px-4 py-3">Warehouse</th>
                  <th className="px-4 py-3">Performed By</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                      {formatDateTime(movement.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {movement.product.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {movement.product.sku}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        +{movement.quantityChange}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {movement.location.name}{" "}
                      <span className="text-slate-400">({movement.location.code})</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {movement.performedBy.firstName} {movement.performedBy.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {movement.notes ?? <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
