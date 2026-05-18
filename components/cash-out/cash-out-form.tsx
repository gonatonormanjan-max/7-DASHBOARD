"use client";

import { useActionState, useMemo, useState } from "react";
import type {
  CashOutAccountOption,
  CashOutBranchOption,
} from "@/lib/dal/cash-out";
import {
  initialCashOutFormState,
  type CashOutFormState,
} from "@/lib/validators/cash-out";
import { formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";

type CashOutFormProps = {
  action: (
    state: CashOutFormState,
    formData: FormData
  ) => Promise<CashOutFormState>;
  branches: CashOutBranchOption[];
  accounts: CashOutAccountOption[];
};

function fieldValue(
  state: CashOutFormState,
  name: string,
  fallback = ""
) {
  return state.values?.[name] ?? fallback;
}

function fieldError(state: CashOutFormState, name: string) {
  return state.fieldErrors?.[name]?.[0];
}

function parseMoney(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CashOutForm({ action, branches, accounts }: CashOutFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialCashOutFormState
  );
  const defaultBranchId = branches[0]?.id ?? "";
  const defaultAccountId = accounts[0]?.id ?? "";
  const [branchId, setBranchId] = useState(
    fieldValue(state, "branchId", defaultBranchId)
  );
  const [cashOutAmount, setCashOutAmount] = useState(
    fieldValue(state, "cashOutAmount")
  );
  const [feeAmount, setFeeAmount] = useState(fieldValue(state, "feeAmount", "0"));

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId) ?? branches[0],
    [branchId, branches]
  );
  const onlineReceived = parseMoney(cashOutAmount) + parseMoney(feeAmount);
  const branchCashBalance = selectedBranch
    ? Number(selectedBranch.cashBalance)
    : 0;
  const wouldOverdraw =
    parseMoney(cashOutAmount) > 0 && parseMoney(cashOutAmount) > branchCashBalance;
  const canSubmit = branches.length > 0 && accounts.length > 0 && !pending;

  return (
    <form action={formAction} className="space-y-6">
      {state.status === "error" && state.message ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      ) : null}

      {branches.length === 0 || accounts.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Cash-out needs at least one active branch and one active online account
          before staff can record a transaction.
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Branch</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              name="branchId"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
            {fieldError(state, "branchId") ? (
              <p className="text-xs text-red-600">{fieldError(state, "branchId")}</p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Online wallet account
            </span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={fieldValue(state, "accountId", defaultAccountId)}
              name="accountId"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                  {account.accountName ? ` - ${account.accountName}` : ""}
                </option>
              ))}
            </select>
            {fieldError(state, "accountId") ? (
              <p className="text-xs text-red-600">{fieldError(state, "accountId")}</p>
            ) : null}
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Current branch cash available:{" "}
          <strong className="text-slate-900">
            {formatCurrency(branchCashBalance)}
          </strong>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Cash-out amounts
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Cash given to customer
            </span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              inputMode="decimal"
              min="0.01"
              name="cashOutAmount"
              step="0.01"
              type="number"
              value={cashOutAmount}
              onChange={(event) => setCashOutAmount(event.target.value)}
            />
            {fieldError(state, "cashOutAmount") ? (
              <p className="text-xs text-red-600">
                {fieldError(state, "cashOutAmount")}
              </p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Service fee
            </span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              inputMode="decimal"
              min="0"
              name="feeAmount"
              step="0.01"
              type="number"
              value={feeAmount}
              onChange={(event) => setFeeAmount(event.target.value)}
            />
            {fieldError(state, "feeAmount") ? (
              <p className="text-xs text-red-600">{fieldError(state, "feeAmount")}</p>
            ) : null}
          </label>

          <div className="rounded-lg border border-[#c5e7db] bg-[#edf8f4] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#11664b]">
              Customer must send
            </p>
            <p className="mt-1 text-2xl font-bold text-[#0a4429]">
              {formatCurrency(onlineReceived)}
            </p>
            <p className="mt-1 text-xs text-[#11664b]">
              Cash-out amount plus service fee.
            </p>
          </div>
        </div>

        {wouldOverdraw ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This branch does not have enough recorded cash for the cash-out
            amount. The server will block this transaction.
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Customer and reference
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Customer name
            </span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={fieldValue(state, "customerName")}
              name="customerName"
              placeholder="Optional"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Customer contact
            </span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={fieldValue(state, "customerContact")}
              name="customerContact"
              placeholder="Optional"
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Online transfer reference
            </span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={fieldValue(state, "onlineReferenceNumber")}
              name="onlineReferenceNumber"
              placeholder="Reference number from the customer's transfer"
            />
            {fieldError(state, "onlineReferenceNumber") ? (
              <p className="text-xs text-red-600">
                {fieldError(state, "onlineReferenceNumber")}
              </p>
            ) : null}
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
              defaultValue={fieldValue(state, "notes")}
              name="notes"
              placeholder="Optional transaction notes"
            />
          </label>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button disabled={pending} type="reset" variant="outline">
          Clear
        </Button>
        <Button disabled={!canSubmit} type="submit">
          {pending ? "Recording..." : "Complete Cash Out"}
        </Button>
      </div>
    </form>
  );
}
