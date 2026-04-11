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

type SupplierRow = {
  supplierId: string;
  isPrimary: boolean;
  costPrice: string;
  leadTimeDays: string;
  notes: string;
};

type ProductFormProps = {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  mode: "create" | "edit";
  categories: Option[];
  brands: Option[];
  suppliers: Option[];
  canCreateCategory: boolean;
  existingSuppliers?: SupplierRow[];
  product?: {
    id: string;
    name: string;
    sku: string;
    categoryId: string;
    brandId: string | null;
    unitPrice: string;
    costPrice: string;
    reorderLevel?: number;
    imageUrl?: string | null;
    description: string | null;
    status: ProductStatus;
  };
};

function normalizeSupplierRows(rows: SupplierRow[]) {
  let hasPrimarySupplier = false;

  return rows.map((row) => {
    const isPrimary = row.isPrimary && !hasPrimarySupplier;

    if (isPrimary) {
      hasPrimarySupplier = true;
    }

    return {
      ...row,
      isPrimary,
    };
  });
}

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
  brands,
  suppliers,
  canCreateCategory,
  existingSuppliers,
  product,
}: ProductFormProps) {
  const [state, formAction] = useActionState(action, initialProductFormState);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [supplierRows, setSupplierRows] = useState<SupplierRow[]>(() =>
    normalizeSupplierRows(existingSuppliers ?? [])
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    fieldValue(state, "categoryId", product?.categoryId ?? categories[0]?.id ?? "")
  );
  const currentCategoryId = state.values?.categoryId ?? selectedCategoryId;
  const selectedSupplierIds = new Set(
    supplierRows
      .map((row) => row.supplierId)
      .filter((supplierId) => supplierId.length > 0)
  );
  const canAddSupplier = suppliers.length > 0 && selectedSupplierIds.size < suppliers.length;

  function updateSupplierRow(index: number, nextRow: SupplierRow) {
    setSupplierRows((currentRows) =>
      currentRows.map((row, rowIndex) => (rowIndex === index ? nextRow : row))
    );
  }

  function removeSupplierRow(index: number) {
    setSupplierRows((currentRows) => currentRows.filter((_, rowIndex) => rowIndex !== index));
  }

  function setPrimarySupplier(index: number, checked: boolean) {
    setSupplierRows((currentRows) =>
      currentRows.map((row, rowIndex) => ({
        ...row,
        isPrimary: checked ? rowIndex === index : rowIndex === index ? false : row.isPrimary,
      }))
    );
  }

  function addSupplierRow() {
    setSupplierRows((currentRows) => {
      const currentSupplierIds = new Set(
        currentRows
          .map((row) => row.supplierId)
          .filter((supplierId) => supplierId.length > 0)
      );
      const nextSupplier = suppliers.find((supplier) => !currentSupplierIds.has(supplier.id));

      if (!nextSupplier) {
        return currentRows;
      }

      return [
        ...currentRows,
        {
          supplierId: nextSupplier.id,
          isPrimary: false,
          costPrice: "",
          leadTimeDays: "",
          notes: "",
        },
      ];
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-6 rounded-lg border border-border bg-card p-6 shadow-sm lg:grid-cols-2">
        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Product name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
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
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm uppercase tracking-[0.08em] text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
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
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
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
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
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
          <span className="text-sm font-medium text-slate-700">Brand</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "brandId", product?.brandId)}
            name="brandId"
          >
            <option value="">No brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.brandId ? (
            <p className="text-sm text-destructive">{state.fieldErrors.brandId[0]}</p>
          ) : null}
        </label>

        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-slate-700">Linked Suppliers</h2>
            <p className="text-sm text-slate-500">
              Assign one or more suppliers to this product.
            </p>
          </div>

          {supplierRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No suppliers linked yet.
            </div>
          ) : null}

          <div className="space-y-4">
            {supplierRows.map((row, index) => {
              const availableSuppliers = suppliers.filter(
                (supplier) =>
                  supplier.id === row.supplierId ||
                  !supplierRows.some(
                    (candidateRow, candidateIndex) =>
                      candidateIndex !== index && candidateRow.supplierId === supplier.id
                  )
              );

              return (
                <div
                  key={`${row.supplierId || "supplier"}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto_auto]">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Supplier</span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                        onChange={(event) =>
                          updateSupplierRow(index, {
                            ...row,
                            supplierId: event.target.value,
                          })
                        }
                        value={row.supplierId}
                      >
                        <option value="" disabled>
                          Select supplier
                        </option>
                        {availableSuppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Cost Price</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                        onChange={(event) =>
                          updateSupplierRow(index, {
                            ...row,
                            costPrice: event.target.value,
                          })
                        }
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={row.costPrice}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Lead Time (days)</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30"
                        onChange={(event) =>
                          updateSupplierRow(index, {
                            ...row,
                            leadTimeDays: event.target.value,
                          })
                        }
                        placeholder="0"
                        type="number"
                        value={row.leadTimeDays}
                      />
                    </label>

                    <label className="flex items-center justify-center gap-2 pt-5">
                      <input
                        checked={row.isPrimary}
                        className="h-4 w-4 accent-[var(--ring)]"
                        onChange={(event) => setPrimarySupplier(index, event.target.checked)}
                        type="checkbox"
                      />
                      <span className="text-sm font-medium text-slate-700">Primary</span>
                    </label>

                    <button
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 disabled:cursor-not-allowed pt-5"
                      onClick={() => removeSupplierRow(index)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>

                  <textarea
                    className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-ring/30 resize-none"
                    onChange={(event) =>
                      updateSupplierRow(index, {
                        ...row,
                        notes: event.target.value,
                      })
                    }
                    placeholder="Add notes about this supplier (optional)"
                    rows={2}
                    value={row.notes}
                  />

                  <input
                    name={`suppliers[${index}].supplierId`}
                    type="hidden"
                    value={row.supplierId}
                  />
                  <input
                    name={`suppliers[${index}].isPrimary`}
                    type="hidden"
                    value={row.isPrimary ? "true" : "false"}
                  />
                  <input
                    name={`suppliers[${index}].costPrice`}
                    type="hidden"
                    value={row.costPrice}
                  />
                  <input
                    name={`suppliers[${index}].leadTimeDays`}
                    type="hidden"
                    value={row.leadTimeDays}
                  />
                  <input
                    name={`suppliers[${index}].notes`}
                    type="hidden"
                    value={row.notes}
                  />
                </div>
              );
            })}
          </div>

          {canAddSupplier ? (
            <button
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring/30"
              onClick={addSupplierRow}
              type="button"
            >
              Add another supplier
            </button>
          ) : null}

          {state.fieldErrors?.suppliers ? (
            <p className="text-sm text-destructive">{state.fieldErrors.suppliers[0]}</p>
          ) : null}
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Unit Price</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "unitPrice", product?.unitPrice)}
            name="unitPrice"
            placeholder="0.00"
            required
            step="0.01"
            type="number"
          />
          {state.fieldErrors?.unitPrice ? (
            <p className="text-sm text-destructive">{state.fieldErrors.unitPrice[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Cost Price</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "costPrice", product?.costPrice)}
            name="costPrice"
            placeholder="0.00"
            required
            step="0.01"
            type="number"
          />
          {state.fieldErrors?.costPrice ? (
            <p className="text-sm text-destructive">{state.fieldErrors.costPrice[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Reorder Level</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "reorderLevel", product?.reorderLevel?.toString())}
            name="reorderLevel"
            placeholder="10"
            required
            type="number"
          />
          {state.fieldErrors?.reorderLevel ? (
            <p className="text-sm text-destructive">{state.fieldErrors.reorderLevel[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Image URL</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "imageUrl", product?.imageUrl)}
            name="imageUrl"
            placeholder="https://example.com/image.jpg"
            type="url"
          />
          {state.fieldErrors?.imageUrl ? (
            <p className="text-sm text-destructive">{state.fieldErrors.imageUrl[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Description</span>
          <textarea
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 resize-none"
            defaultValue={fieldValue(state, "description", product?.description)}
            name="description"
            placeholder="Product description..."
            rows={4}
          />
          {state.fieldErrors?.description ? (
            <p className="text-sm text-destructive">{state.fieldErrors.description[0]}</p>
          ) : null}
        </label>
      </div>

      <div className="flex gap-3">
        <Link
          className="rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring/30"
          href={mode === "create" ? "/dashboard/products" : `/dashboard/products/${product?.id}`}
        >
          Cancel
        </Link>
        <SubmitButton className="flex-1 rounded-2xl bg-blue-500 px-6 py-2.5 text-sm font-medium text-white outline-none transition hover:bg-blue-600 focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed">
          {mode === "create" ? "Create Product" : "Update Product"}
        </SubmitButton>
      </div>
    </form>
  );
}