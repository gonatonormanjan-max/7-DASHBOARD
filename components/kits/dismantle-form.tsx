"use client";

import { useMemo, useState } from "react";
import { dismantleKitAction } from "@/lib/actions/kits";
import { SubmitButton } from "@/components/ui/submit-button";

type BranchOption = {
  id: string;
  name: string;
  code: string;
};

type KitOption = {
  id: string;
  name: string;
  sku: string;
  kitComponents: Array<{
    id: string;
    componentQty: number;
    componentProduct: {
      id: string;
      name: string;
      sku: string;
    };
  }>;
};

type DismantleFormProps = {
  branches: BranchOption[];
  kits: KitOption[];
  initialBranchId?: string;
  initialKitProductId?: string;
  branchLocked: boolean;
};

export function DismantleForm({
  branches,
  kits,
  initialBranchId,
  initialKitProductId,
  branchLocked,
}: DismantleFormProps) {
  const [locationId, setLocationId] = useState(initialBranchId ?? branches[0]?.id ?? "");
  const [kitProductId, setKitProductId] = useState(initialKitProductId ?? kits[0]?.id ?? "");
  const [qty, setQty] = useState("1");

  const selectedKit = useMemo(
    () => kits.find((kit) => kit.id === kitProductId) ?? null,
    [kitProductId, kits]
  );
  const parsedQty = Math.max(1, Number.parseInt(qty, 10) || 1);

  return (
    <form
      action={dismantleKitAction}
      className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Branch</span>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:bg-slate-100"
            disabled={branchLocked}
            name="locationId"
            onChange={(event) => setLocationId(event.target.value)}
            value={locationId}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Kit product</span>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
            name="kitProductId"
            onChange={(event) => setKitProductId(event.target.value)}
            value={kitProductId}
          >
            {kits.map((kit) => (
              <option key={kit.id} value={kit.id}>
                {kit.name} ({kit.sku})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Qty to dismantle</span>
          <input
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
            min={1}
            name="qty"
            onChange={(event) => setQty(event.target.value)}
            required
            type="number"
            value={qty}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Notes</span>
          <textarea
            className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
            maxLength={500}
            name="notes"
            placeholder="Why are you dismantling this kit stock?"
          />
        </label>
      </div>

      <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4">
        <h2 className="text-base font-semibold text-slate-900">Component preview</h2>
        <p className="mt-1 text-sm text-slate-500">
          This preview shows what will be added back to stock when the selected kit is
          dismantled.
        </p>

        {selectedKit ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/70">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Component</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Qty per kit</th>
                  <th className="px-4 py-3">Inbound qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {selectedKit.kitComponents.map((component) => (
                  <tr key={component.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {component.componentProduct.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {component.componentProduct.sku}
                    </td>
                    <td className="px-4 py-3">{component.componentQty}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {component.componentQty * parsedQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Select a kit to preview its components.</p>
        )}
      </section>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Dismantling...">Confirm dismantle</SubmitButton>
      </div>
    </form>
  );
}
