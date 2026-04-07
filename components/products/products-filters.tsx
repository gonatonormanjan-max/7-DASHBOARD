"use client";

import Link from "next/link";
import { useRef } from "react";
import type { ProductListFilters } from "@/lib/validators/products";

type Option = {
  id: string;
  name: string;
};

type ProductsFiltersProps = {
  filters: ProductListFilters;
  categories: Option[];
  suppliers: Option[];
};

export function ProductsFilters({
  filters,
  categories,
  suppliers,
}: ProductsFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <form
      className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]"
      method="get"
      ref={formRef}
    >
      <input name="page" type="hidden" value="1" />
      <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

      <div className="grid gap-4 xl:grid-cols-[2fr_repeat(3,minmax(0,1fr))]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Search</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={filters.query}
            name="query"
            onChange={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              timerRef.current = setTimeout(() => {
                formRef.current?.requestSubmit();
              }, 350);
            }}
            placeholder="Search by product name or SKU"
            type="search"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Category</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={filters.categoryId ?? ""}
            name="categoryId"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Supplier</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={filters.supplierId ?? ""}
            name="supplierId"
          >
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={filters.status}
            name="status"
          >
            <option value="visible">Active &amp; Inactive (default)</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
            <option value="all">All statuses</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Archived products stay hidden by default and should not be used for new transactions.
        </p>
        <div className="flex items-center gap-3">
          <Link
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            href="/dashboard/products"
          >
            Clear
          </Link>
          <button
            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-[#16304f]"
            type="submit"
          >
            Apply filters
          </button>
        </div>
      </div>
    </form>
  );
}
