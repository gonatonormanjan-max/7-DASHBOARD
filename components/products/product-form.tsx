"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ProductStatus } from "@prisma/client";
import {
  initialProductFormState,
  type ProductFormState,
} from "@/lib/validators/products";
import { InlineCategoryModal } from "@/components/products/inline-category-modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";

type Option = {
  id: string;
  name: string;
};

type ProductFormProps = {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  mode: "create" | "edit";
  categories: Option[];
  suppliers: Option[];
  canCreateCategory: boolean;
  product?: {
    id: string;
    name: string;
    sku: string;
    categoryId: string;
    supplierId: string | null;
    unitPrice: string;
    costPrice: string;
    reorderLevel?: number;
    imageUrl?: string | null;
    description: string | null;
    status: ProductStatus;
  };
};

function fieldValue(
  state: ProductFormState,
  key: string,
  fallback: string | null | undefined
) {
  return state.values?.[key] ?? fallback ?? "";
}

export function ProductForm({
  action,
  mode,
  categories,
  suppliers,
  canCreateCategory,
  product,
}: ProductFormProps) {
  const [state, formAction] = useActionState(action, initialProductFormState);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    fieldValue(state, "categoryId", product?.categoryId ?? categories[0]?.id ?? "")
  );
  const currentCategoryId = state.values?.categoryId ?? selectedCategoryId;

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)] lg:grid-cols-2">
        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Product name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "name", product?.name)}
            name="name"
            placeholder="Northstar Handheld Scanner"
            required
            type="text"
          />
          {state.fieldErrors?.name ? (
            <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">SKU</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm uppercase tracking-[0.08em] text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "sku", product?.sku)}
            name="sku"
            placeholder="NS-SCN-100"
            required
            type="text"
          />
          {state.fieldErrors?.sku ? (
            <p className="text-sm text-destructive">{state.fieldErrors.sku[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(
              state,
              "status",
              product?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
            )}
            name="status"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          {state.fieldErrors?.status ? (
            <p className="text-sm text-destructive">{state.fieldErrors.status[0]}</p>
          ) : null}
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700">Category</span>
            {canCreateCategory ? (
              <InlineCategoryModal
                onCategoryCreated={(category) => {
                  setCategoryOptions((current) =>
                    [...current, category].sort((left, right) =>
                      left.name.localeCompare(right.name)
                    )
                  );
                  setSelectedCategoryId(category.id);
                }}
              />
            ) : null}
          </div>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            name="categoryId"
            onChange={(event) => setSelectedCategoryId(event.target.value)}
            required
            value={currentCategoryId}
          >
            <option value="" disabled>
              Select category
            </option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.categoryId ? (
            <p className="text-sm text-destructive">{state.fieldErrors.categoryId[0]}</p>
          ) : null}
          {categoryOptions.length === 0 ? (
            <p className="text-sm text-slate-500">
              Create at least one category before saving a product.
            </p>
          ) : null}
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Supplier</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "supplierId", product?.supplierId)}
            name="supplierId"
          >
            <option value="">No supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.supplierId ? (
            <p className="text-sm text-destructive">{state.fieldErrors.supplierId[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Unit price</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "unitPrice", product?.unitPrice)}
            min="0"
            name="unitPrice"
            required
            step="0.01"
            type="number"
          />
          {state.fieldErrors?.unitPrice ? (
            <p className="text-sm text-destructive">{state.fieldErrors.unitPrice[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Cost</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "costPrice", product?.costPrice)}
            min="0"
            name="costPrice"
            required
            step="0.01"
            type="number"
          />
          {state.fieldErrors?.costPrice ? (
            <p className="text-sm text-destructive">{state.fieldErrors.costPrice[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            Reorder Alert Level (units)
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(
              state,
              "reorderLevel",
              String(product?.reorderLevel ?? 0)
            )}
            min="0"
            name="reorderLevel"
            step="1"
            type="number"
          />
          <p className="text-sm text-slate-500">
            Stock alerts trigger when quantity at any branch falls below this number.
          </p>
          {state.fieldErrors?.reorderLevel ? (
            <p className="text-sm text-destructive">{state.fieldErrors.reorderLevel[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Product Image URL</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "imageUrl", product?.imageUrl)}
            name="imageUrl"
            placeholder="https://..."
            type="url"
          />
          <p className="text-sm text-slate-500">
            Paste a direct image URL. Image upload will be supported in a future update.
          </p>
          {state.fieldErrors?.imageUrl ? (
            <p className="text-sm text-destructive">{state.fieldErrors.imageUrl[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Description</span>
          <textarea
            className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "description", product?.description)}
            name="description"
            placeholder="Optional internal notes about this product."
          />
          {state.fieldErrors?.description ? (
            <p className="text-sm text-destructive">{state.fieldErrors.description[0]}</p>
          ) : null}
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link href={product ? `/dashboard/products/${product.id}` : "/dashboard/products"}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <SubmitButton
          disabled={categoryOptions.length === 0}
          pendingLabel={mode === "create" ? "Creating..." : "Saving..."}
        >
          {mode === "create" ? "Create product" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
