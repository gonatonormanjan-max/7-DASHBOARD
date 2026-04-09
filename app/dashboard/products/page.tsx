import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { getProductListData } from "@/lib/dal/products";
import { parseProductListFilters } from "@/lib/validators/products";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ProductsFilters } from "@/components/products/products-filters";
import { ProductsTable } from "@/components/products/products-table";

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await requirePermission("products", "read");
  const rawSearchParams = await searchParams;
  const filters = parseProductListFilters(rawSearchParams);
  const { products, categories, brands, pagination, summary } = await getProductListData(filters);
  const canCreate = hasPermission(user.role, "products", "create");
  const canManage = hasPermission(user.role, "products", "update");
  const canViewCost = hasPermission(user.role, "products", "update");
  const returnParams = new URLSearchParams();

  if (filters.query) returnParams.set("query", filters.query);
  if (filters.categoryId) returnParams.set("categoryId", filters.categoryId);
  if (filters.brandId) returnParams.set("brandId", filters.brandId);
  if (filters.status !== "visible") returnParams.set("status", filters.status);
  if (filters.sortBy !== "updatedAt") returnParams.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "desc") returnParams.set("sortOrder", filters.sortOrder);
  if (pagination.page !== 1) returnParams.set("page", String(pagination.page));
  if (pagination.pageSize !== DEFAULT_PAGE_SIZE) {
    returnParams.set("pageSize", String(pagination.pageSize));
  }

  const returnQuery = returnParams.toString();
  const returnTo = returnQuery ? `/dashboard/products?${returnQuery}` : "/dashboard/products";

  function buildSortHref(field: string): string {
    const params = new URLSearchParams();
    if (filters.query) params.set("query", filters.query);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.brandId) params.set("brandId", filters.brandId);
    if (filters.status !== "visible") params.set("status", filters.status);
    if (pagination.pageSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(pagination.pageSize));
    }
    params.set("page", "1");
    params.set("sortBy", field);
    params.set(
      "sortOrder",
      filters.sortBy === field && filters.sortOrder === "desc" ? "asc" : "desc"
    );
    const qs = params.toString();
    return qs ? `/dashboard/products?${qs}` : "/dashboard/products";
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Shared Catalog"
        title="Products"
        description="Manage the global product catalog used across internal inventory and order workflows. Archived products stay out of the default list and should not be used for new transactions."
        action={
          canCreate ? (
            <Link href="/dashboard/products/new">
              <Button>Create product</Button>
            </Link>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Active and inactive products visible by default."
          label="Catalog Items"
          tone="primary"
          value={String(summary.totalVisible)}
        />
        <StatCard
          description="Usable for new transactions and catalog browsing."
          label="Active"
          tone="success"
          value={String(summary.active)}
        />
        <StatCard
          description="Still editable but intentionally not active."
          label="Inactive"
          tone="warning"
          value={String(summary.inactive)}
        />
        <StatCard
          description="Hidden from default list views until restored."
          label="Archived"
          value={String(summary.archived)}
        />
      </section>

      <ProductsFilters
        categories={categories}
        brands={brands}
        filters={filters}
      />

      <ProductsTable
        buildSortHref={buildSortHref}
        canManage={canManage}
        canViewCost={canViewCost}
        products={products}
        returnTo={returnTo}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
      />

      <Pagination
        basePath="/dashboard/products"
        pagination={pagination}
        query={{
          query: filters.query || undefined,
          categoryId: filters.categoryId,
          brandId: filters.brandId,
          status: filters.status === "visible" ? undefined : filters.status,
          sortBy: filters.sortBy === "updatedAt" ? undefined : filters.sortBy,
          sortOrder: filters.sortOrder === "desc" ? undefined : filters.sortOrder,
          pageSize:
            pagination.pageSize === DEFAULT_PAGE_SIZE ? undefined : pagination.pageSize,
        }}
      />
    </div>
  );
}
