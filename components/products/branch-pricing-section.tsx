"use client";

import { useActionState, useState } from "react";
import { formatCurrency } from "@/lib/products";
import type { LocationProductPriceRow } from "@/lib/dal/branch-pricing";
import type {
  setLocationProductPriceAction,
  deleteLocationProductPriceAction,
} from "@/lib/actions/branch-pricing";
import type { BranchPricingActionState } from "@/lib/actions/branch-pricing";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type UnpricedBranch = { id: string; name: string; code: string };

type BranchPricingSectionProps = {
  productId: string;
  productGlobalPrice: string;
  existingPrices: LocationProductPriceRow[];
  unpricedBranches: UnpricedBranch[];
  canManage: boolean; // ADMIN or MANAGER
  setAction: typeof setLocationProductPriceAction;
  deleteAction: typeof deleteLocationProductPriceAction;
};

const initialState: BranchPricingActionState = { status: "idle" };

// ── Single existing override row with inline delete form ──────────────────

function ExistingPriceRow({
  row,
  productId,
  canManage,
  deleteAction,
}: {
  row: LocationProductPriceRow;
  productId: string;
  canManage: boolean;
  deleteAction: typeof deleteLocationProductPriceAction;
}) {
  const [pending, setPending] = useState(false);

  async function handleDelete(formData: FormData) {
    setPending(true);
    await deleteAction(formData);
    // revalidatePath in the action will refresh the page
  }

  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium text-slate-800">
        {row.location.name}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">
        {row.location.code}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
        {formatCurrency(row.price)}
      </td>
      <td className="px-4 py-3 text-right">
        {canManage ? (
          <form action={handleDelete}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="locationId" value={row.locationId} />
            <button
              type="submit"
              disabled={pending}
              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 font-medium"
            >
              {pending ? "Removing…" : "Remove"}
            </button>
          </form>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Add / edit price form ─────────────────────────────────────────────────

function SetPriceForm({
  productId,
  unpricedBranches,
  setAction,
}: {
  productId: string;
  unpricedBranches: UnpricedBranch[];
  setAction: typeof setLocationProductPriceAction;
}) {
  const [state, formAction, isPending] = useActionState(setAction, initialState);
  const [showForm, setShowForm] = useState(false);

  if (unpricedBranches.length === 0) return null;

  return (
    <div className="pt-4">
      {!showForm ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowForm(true)}
          className="text-sm"
        >
          + Add branch override
        </Button>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="productId" value={productId} />

          {state.status === "error" && (
            <p className="text-sm text-red-600">{state.message}</p>
          )}
          {state.status === "success" && (
            <p className="text-sm text-green-600">{state.message}</p>
          )}

          <div className="flex flex-wrap gap-3 items-end">
            {/* Branch selector */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="bp-locationId"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Branch
              </label>
              <select
                id="bp-locationId"
                name="locationId"
                required
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">Select branch…</option>
                {unpricedBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
              {state.fieldErrors?.locationId?.map((e) => (
                <p key={e} className="text-xs text-red-500">{e}</p>
              ))}
            </div>

            {/* Price input */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="bp-price"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Selling price
              </label>
              <input
                id="bp-price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
                className="w-36 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              {state.fieldErrors?.price?.map((e) => (
                <p key={e} className="text-xs text-red-500">{e}</p>
              ))}
            </div>

            <div className="flex gap-2">
              <SubmitButton pendingLabel="Saving…" disabled={isPending}>
                Save price
              </SubmitButton>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="text-sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Main exported section ─────────────────────────────────────────────────

export function BranchPricingSection({
  productId,
  productGlobalPrice,
  existingPrices,
  unpricedBranches,
  canManage,
  setAction,
  deleteAction,
}: BranchPricingSectionProps) {
  return (
    <div className="border-t border-slate-200 pt-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Branch Pricing</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Override the global selling price (
            <span className="font-medium text-slate-700">
              {formatCurrency(productGlobalPrice)}
            </span>
            ) for specific branches. Branches without an override use the global
            price.
          </p>
        </div>
      </div>

      {existingPrices.length === 0 ? (
        <p className="text-sm text-slate-500">
          No branch overrides set. All branches use the global price.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50/80">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Override price</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {existingPrices.map((row) => (
                <ExistingPriceRow
                  key={row.id}
                  row={row}
                  productId={productId}
                  canManage={canManage}
                  deleteAction={deleteAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <SetPriceForm
          productId={productId}
          unpricedBranches={unpricedBranches}
          setAction={setAction}
        />
      )}
    </div>
  );
}
