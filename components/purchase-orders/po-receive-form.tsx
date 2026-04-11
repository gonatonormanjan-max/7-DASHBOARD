"use client";

import { useActionState, useState, useTransition } from "react";
import {
  initialPurchaseOrderReceiveState,
  type PurchaseOrderReceiveState,
} from "@/lib/validators/purchase-orders";
import { getStockLevelsForReceivingAction } from "@/lib/actions/purchase-orders";
import { SubmitButton } from "@/components/ui/submit-button";

type PurchaseOrderItem = {
  id: string;
  productId: string;
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

  // Controlled receive quantities (default 0 for each item)
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const item of items) {
      initial[item.id] = 0;
    }
    return initial;
  });

  // Current stock at selected warehouse, keyed by productId
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [, startTransition] = useTransition();

  async function handleWarehouseChange(newWarehouseId: string) {
    setWarehouseId(newWarehouseId);
    setStockLevels({});

    if (!newWarehouseId) return;

    setIsLoadingStock(true);
    startTransition(async () => {
      try {
        const productIds = items.map((item) => item.productId);
        const result = await getStockLevelsForReceivingAction(productIds, newWarehouseId);
        const map: Record<string, number> = {};
        for (const s of result) {
          map[s.productId] = s.quantity;
        }
        setStockLevels(map);
      } finally {
        setIsLoadingStock(false);
      }
    });
  }

  const showStockPreview = warehouseId && !isLoadingStock && Object.keys(stockLevels).length >= 0;
  const hasWarehouseData = warehouseId && !isLoadingStock;

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <div className="rounded-2xl border border-[#f2d2a2] bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Receive stock</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Record what arrived now and keep any remaining balance open for the next
            receipt. Select a warehouse to see the live stock impact before submitting.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Warehouse</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="warehouseId"
              onChange={(event) => handleWarehouseChange(event.target.value)}
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
              <p className="text-sm text-destructive">
                {state.fieldErrors.warehouseId[0]}
              </p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
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

        {isLoadingStock ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
            Loading current stock levels…
          </div>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Ordered</th>
                <th className="px-4 py-3">Already Received</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Receive Now</th>
                {hasWarehouseData ? (
                  <>
                    <th className="px-4 py-3 text-slate-400">Current Stock</th>
                    <th className="px-4 py-3 text-emerald-600">New Balance</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((item, index) => {
                const remaining = item.quantity - item.receivedQty;
                const receiveNow = receiveQtys[item.id] ?? 0;
                const currentStock = stockLevels[item.productId] ?? 0;
                const newBalance = currentStock + receiveNow;

                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      <input name={`items[${index}].itemId`} type="hidden" value={item.id} />
                      {item.product.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {item.product.sku}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {item.receivedQty}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {remaining}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                        max={remaining}
                        min={0}
                        name={`items[${index}].quantity`}
                        onChange={(e) => {
                          const val = Math.max(
                            0,
                            Math.min(remaining, Number(e.target.value) || 0)
                          );
                          setReceiveQtys((prev) => ({ ...prev, [item.id]: val }));
                        }}
                        step="1"
                        type="number"
                        value={receiveQtys[item.id] ?? 0}
                      />
                    </td>
                    {hasWarehouseData ? (
                      <>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {currentStock}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              receiveNow > 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {newBalance}
                          </span>
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {state.fieldErrors?.items ? (
          <p className="mt-4 text-sm text-destructive">{state.fieldErrors.items[0]}</p>
        ) : null}

        {/* Stock impact summary card */}
        {hasWarehouseData &&
        items.some((item) => (receiveQtys[item.id] ?? 0) > 0) ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-800">
              Stock impact preview
            </p>
            <ul className="mt-2 space-y-1">
              {items
                .filter((item) => (receiveQtys[item.id] ?? 0) > 0)
                .map((item) => {
                  const receiveNow = receiveQtys[item.id] ?? 0;
                  const currentStock = stockLevels[item.productId] ?? 0;
                  return (
                    <li key={item.id} className="text-sm text-emerald-700">
                      <span className="font-medium">{item.product.name}</span>:{" "}
                      {currentStock} → {currentStock + receiveNow}{" "}
                      <span className="text-emerald-500">(+{receiveNow})</span>
                    </li>
                  );
                })}
            </ul>
            <p className="mt-1 text-xs text-emerald-600">
              Stock will update immediately once you submit.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Receiving...">Receive Stock</SubmitButton>
      </div>
    </form>
  );
}
