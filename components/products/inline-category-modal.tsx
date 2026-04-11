"use client";

import { useActionState, useEffect, useEffectEvent, useState } from "react";
import { createInlineCategoryAction } from "@/lib/actions/categories";
import { initialInlineCategoryState } from "@/lib/validators/products";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type InlineCategoryModalProps = {
  onCategoryCreated: (category: { id: string; name: string }) => void;
};

export function InlineCategoryModal({
  onCategoryCreated,
}: InlineCategoryModalProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    createInlineCategoryAction,
    initialInlineCategoryState
  );
  const handleCreatedCategory = useEffectEvent((category: { id: string; name: string }) => {
    onCategoryCreated(category);
    setOpen(false);
  });

  useEffect(() => {
    if (state.status === "success" && state.createdCategory) {
      handleCreatedCategory(state.createdCategory);
    }
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
        New category
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-[28px] border border-border bg-white p-6 shadow-[0_40px_80px_-40px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Inline category creation
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  Add a category without leaving the form
                </h2>
              </div>
              <Button onClick={() => setOpen(false)} type="button" variant="ghost">
                Close
              </Button>
            </div>

            <form action={formAction} className="mt-6 space-y-4">
              {state.message ? (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    state.status === "success"
                      ? "bg-[#edf8f4] text-[#11664b]"
                      : "bg-[#fff4e4] text-[#8a5610]"
                  }`}
                >
                  {state.message}
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Category name</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                  defaultValue={state.values?.name ?? ""}
                  name="name"
                  placeholder="Finished Goods"
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
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                  defaultValue={state.values?.description ?? ""}
                  name="description"
                  placeholder="Optional context for filtering and organization."
                />
                {state.fieldErrors?.description ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.description[0]}</p>
                ) : null}
              </label>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <Button onClick={() => setOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <SubmitButton pendingLabel="Creating...">Create category</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
