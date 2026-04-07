"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  initialCategoryFormState,
  type CategoryFormState,
} from "@/lib/validators/categories";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type CategoryFormProps = {
  action: (state: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  mode: "create" | "edit";
  category?: {
    id: string;
    name: string;
    description: string | null;
  };
};

function fieldValue(
  state: CategoryFormState,
  key: string,
  fallback: string | null | undefined
) {
  return state.values?.[key] ?? fallback ?? "";
}

export function CategoryForm({ action, mode, category }: CategoryFormProps) {
  const [state, formAction] = useActionState(action, initialCategoryFormState);

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Category name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "name", category?.name)}
            name="name"
            placeholder="Accessories"
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
            defaultValue={fieldValue(state, "description", category?.description)}
            name="description"
            placeholder="Optional internal description for reporting and catalog organization."
          />
          {state.fieldErrors?.description ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.description[0]}
            </p>
          ) : null}
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link href={category ? `/dashboard/categories/${category.id}` : "/dashboard/categories"}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <SubmitButton pendingLabel={mode === "create" ? "Creating..." : "Saving..."}>
          {mode === "create" ? "Create category" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
