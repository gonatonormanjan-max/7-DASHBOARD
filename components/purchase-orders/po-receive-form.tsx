"use client";

import { useActionState, useState } from "react";
import {
  initialPurchaseOrderReceiveState,
  type PurchaseOrderReceiveState,
} from "@/lib/validators/purchase-orders";
import { SubmitButton } from "@/components/ui/submit-button";

type PurchaseOrderItem = {
  id: string;
  quantity: number;
  receivedQty: number;
  product: {
    name: string;
    sku: string;
  };
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type PurchaseOrderReceiveFormProps = {
  action: (
    state: PurchaseOrderReceiveState,
    formData: FormData
  ) => Promise<PurchaseOrderReceiveState>;
  items: PurchaseOrderItem[];
  warehouses: WarehouseOption[];
};

export function PurchaseOrderReceiveForm({
  action,
  items,
  warehouses,
}: PurchaseOrderReceiveFormProps) {
  const [state, formAction] = useActionState(action, initialPurchaseOrderReceiveState);
  const [warehouseId, setWarehouseId] = useState(state.values?.warehouseId ?? "");
  const [notes, setNotes] = useState(state.values?.notes ?? "");

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <div className="rounded-2xl border border-[#f2d2a2] bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Receive stock</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Record what arrived now and keep any remaining balance open for the next receipt.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Warehouse</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              name="warehouseId"
              onChange={(event) => setWarehouseId(event.target.value)}
              value={warehouseId}
            >
              <option value="">Select a warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
            {state.fieldErrors?.warehouseId ? (
              <p className="text-sm text-destructive">{state.fieldErrors.warehouseId[0]}</p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              name="notes"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional receiving notes."
              value={notes}
            />
            {state.fieldErrors?.notes ? (
              <p className="text-sm text-destructive">{state.fieldErrors.notes[0]}</p>
            ) : null}
          </label>
        </div>

        <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Ordered</th>
                <th className="px-4 py-3">Already Received</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Receive Now</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((item, index) => {
                const remaining = item.quantity - item.receivedQty;

                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      <input name={`items[${index}].itemId`} type="hidden" value={item.id} />
                      {item.product.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.product.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.receivedQty}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {remaining}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
                        defaultValue="0"
                        max={remaining}
                        min={0}
                        name={`items[${index}].quantity`}
                        step="1"
                        type="number"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {state.fieldErrors?.items ? (
          <p className="mt-4 text-sm text-destructive">{state.fieldErrors.items[0]}</p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Receiving...">Receive Stock</SubmitButton>
      </div>
    </form>
  );
}
