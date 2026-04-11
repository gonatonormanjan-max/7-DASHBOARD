"use client";

import Link from "next/link";
import { useRef } from "react";
import type { ProductListFilters } from "@/lib/validators/products";
import { Button } from "@/components/ui/button";

type Option = {
  id: string;
  name: string;
};

type ProductsFiltersProps = {
  filters: ProductListFilters;
  categories: Option[];
  brands: Option[];
};

export function ProductsFilters({
  filters,
  categories,
  brands,
}: ProductsFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <form
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      method="get"
      ref={formRef}
    >
      <input name="page" type="hidden" value="1" />
      <input name="pageSize" type="hidden" value={String(filters.pageSize)} />

      <div className="grid gap-4 xl:grid-cols-[2fr_repeat(3,minmax(0,1fr))]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Search</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
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
          <span className="text-sm font-medium text-foreground">Category</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
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
          <span className="text-sm font-medium text-foreground">Brand</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.brandId ?? ""}
            name="brandId"
          >
            <option value="">All brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Status</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
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

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Archived products stay hidden by default and should not be used for new transactions.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/products">
            <Button type="button" variant="outline">
              Clear
            </Button>
          </Link>
          <Button type="submit">Apply filters</Button>
        </div>
      </div>
    </form>
  );
}
