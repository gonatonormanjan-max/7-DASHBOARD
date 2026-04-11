"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  initialSupplierFormState,
  type SupplierFormState,
} from "@/lib/validators/suppliers";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type SupplierFormProps = {
  action: (
    state: SupplierFormState,
    formData: FormData
  ) => Promise<SupplierFormState>;
  defaultValues?: {
    name?: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    isActive?: boolean;
  };
  cancelHref: string;
  submitLabel?: string;
  pendingLabel?: string;
};

export function SupplierForm({
  action,
  defaultValues,
  cancelHref,
  submitLabel = "Save Supplier",
  pendingLabel = "Saving...",
}: SupplierFormProps) {
  const [state, formAction] = useActionState(action, initialSupplierFormState);

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <div className="rounded-2xl border border-[#f2d2a2] bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <h2 className="text-base font-semibold text-slate-950">Supplier details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Basic contact information used when creating purchase orders.
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Supplier name <span className="text-destructive">*</span>
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={state.values?.name ?? defaultValues?.name ?? ""}
              name="name"
              placeholder="e.g. Metro Supplies Corp."
              type="text"
            />
            {state.fieldErrors?.name ? (
              <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Contact name</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={
                state.values?.contactName ?? defaultValues?.contactName ?? ""
              }
              name="contactName"
              placeholder="Primary contact person"
              type="text"
            />
            {state.fieldErrors?.contactName ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.contactName[0]}
              </p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={state.values?.email ?? defaultValues?.email ?? ""}
              name="email"
              placeholder="supplier@example.com"
              type="email"
            />
            {state.fieldErrors?.email ? (
              <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
            ) : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Phone</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={state.values?.phone ?? defaultValues?.phone ?? ""}
              name="phone"
              placeholder="+63 900 000 0000"
              type="tel"
            />
            {state.fieldErrors?.phone ? (
              <p className="text-sm text-destructive">{state.fieldErrors.phone[0]}</p>
            ) : null}
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Address</span>
            <textarea
              className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={state.values?.address ?? defaultValues?.address ?? ""}
              name="address"
              placeholder="Street, city, province"
            />
            {state.fieldErrors?.address ? (
              <p className="text-sm text-destructive">{state.fieldErrors.address[0]}</p>
            ) : null}
          </label>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <h2 className="text-base font-semibold text-slate-950">Status</h2>
        <p className="mt-1 text-sm text-slate-500">
          Inactive suppliers are hidden from purchase order creation.
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-3">
          <input
            className="h-4 w-4 rounded border-slate-300 accent-primary"
            defaultChecked={
              state.values?.isActive !== undefined
                ? state.values.isActive === "true"
                : (defaultValues?.isActive ?? true)
            }
            name="isActive"
            type="checkbox"
            value="true"
          />
          <span className="text-sm font-medium text-slate-700">
            Active — available for new purchase orders
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link href={cancelHref}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
