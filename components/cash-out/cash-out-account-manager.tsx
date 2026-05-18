"use client";

import { useActionState } from "react";
import type { CashOutAccountOption } from "@/lib/dal/cash-out";
import {
  initialCashOutFormState,
  type CashOutFormState,
} from "@/lib/validators/cash-out";
import { Button } from "@/components/ui/button";

type CashOutAccountManagerProps = {
  action: (
    state: CashOutFormState,
    formData: FormData
  ) => Promise<CashOutFormState>;
  accounts: CashOutAccountOption[];
};

function Field({
  defaultValue,
  form,
  name,
  placeholder,
}: {
  defaultValue?: string | null;
  form?: string;
  name: string;
  placeholder: string;
}) {
  return (
    <input
      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
      defaultValue={defaultValue ?? ""}
      form={form}
      name={name}
      placeholder={placeholder}
    />
  );
}

export function CashOutAccountManager({
  action,
  accounts,
}: CashOutAccountManagerProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialCashOutFormState
  );

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Wallet accounts
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Active accounts are available when staff record a new cash-out
            transaction.
          </p>
        </div>
        {state.message ? (
          <p
            className={
              state.status === "success"
                ? "text-sm text-emerald-700"
                : "text-sm text-red-600"
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>

      <form
        action={formAction}
        className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]"
      >
        <Field name="name" placeholder="Account name, e.g. GCash Main" />
        <Field name="provider" placeholder="Provider" />
        <Field name="accountName" placeholder="Account holder" />
        <Field name="accountNumber" placeholder="Account number" />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input defaultChecked name="isActive" type="checkbox" />
          Active
        </label>
        <Button disabled={pending} type="submit">
          Add
        </Button>
      </form>

      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Holder</th>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <form
                    id={`account-${account.id}`}
                    action={formAction}
                    className="contents"
                  >
                    <input name="accountId" type="hidden" value={account.id} />
                    <Field defaultValue={account.name} name="name" placeholder="Name" />
                  </form>
                </td>
                <td className="px-4 py-3">
                  <Field
                    defaultValue={account.provider}
                    form={`account-${account.id}`}
                    name="provider"
                    placeholder="Provider"
                  />
                </td>
                <td className="px-4 py-3">
                  <Field
                    defaultValue={account.accountName}
                    form={`account-${account.id}`}
                    name="accountName"
                    placeholder="Holder"
                  />
                </td>
                <td className="px-4 py-3">
                  <Field
                    defaultValue={account.accountNumber}
                    form={`account-${account.id}`}
                    name="accountNumber"
                    placeholder="Number"
                  />
                </td>
                <td className="px-4 py-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      defaultChecked={account.isActive}
                      form={`account-${account.id}`}
                      name="isActive"
                      type="checkbox"
                    />
                    Active
                  </label>
                </td>
                <td className="px-4 py-3">
                  <Button
                    disabled={pending}
                    form={`account-${account.id}`}
                    type="submit"
                    variant="outline"
                  >
                    Save
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
