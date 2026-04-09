"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  initialBrandFormState,
  type BrandFormState,
} from "@/lib/validators/brands";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type BrandFormProps = {
  action: (state: BrandFormState, formData: FormData) => Promise<BrandFormState>;
  mode: "create" | "edit";
  brand?: {
    id: string;
    name: string;
    description: string | null;
  };
};

function fieldValue(
  state: BrandFormState,
  key: string,
  fallback: string | null | undefined
) {
  return state.values?.[key] ?? fallback ?? "";
}

export function BrandForm({ action, mode, brand }: BrandFormProps) {
  const [state, formAction] = useActionState(action, initialBrandFormState);

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Brand name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "name", brand?.name)}
            name="name"
            placeholder="Northstar"
            required
            type="text"
          />
          {state.fieldErrors?.name ? (
            <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Description</span>
          <textarea
            className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "description", brand?.description)}
            name="description"
            placeholder="Optional internal description for manufacturer, label, or house-brand grouping."
          />
          {state.fieldErrors?.description ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.description[0]}
            </p>
          ) : null}
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href={brand ? `/dashboard/categories/brands/${brand.id}` : "/dashboard/categories/brands"}
        >
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <SubmitButton pendingLabel={mode === "create" ? "Creating..." : "Saving..."}>
          {mode === "create" ? "Create brand" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
