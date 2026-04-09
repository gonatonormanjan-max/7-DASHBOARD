import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { getBrandListData } from "@/lib/dal/brands";
import { parseBrandListFilters } from "@/lib/validators/brands";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { TabToggle } from "@/components/ui/tab-toggle";
import { BrandsFilters } from "@/components/brands/brands-filters";
import { BrandsTable } from "@/components/brands/brands-table";

type BrandsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BrandsPage({ searchParams }: BrandsPageProps) {
  const user = await requirePermission("categories", "read");
  const filters = parseBrandListFilters(await searchParams);
  const { brands, pagination, summary } = await getBrandListData(filters);
  const canCreate = hasPermission(user.role, "categories", "create");
  const canManage = hasPermission(user.role, "categories", "update");
  const canDelete = hasPermission(user.role, "categories", "delete");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog Structure"
        title="Brands"
        description="Manage the brand list used to classify products by manufacturer or label."
        action={
          canCreate ? (
            <Link href="/dashboard/categories/brands/new">
              <Button>Create brand</Button>
            </Link>
          ) : null
        }
      />

      <TabToggle
        tabs={[
          {
            label: "Categories",
            href: "/dashboard/categories",
            active: false,
          },
          {
            label: "Brands",
            href: "/dashboard/categories/brands",
            active: true,
          },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Total brand records available across the shared catalog."
          label="Total brands"
          tone="primary"
          value={String(summary.total)}
        />
        <StatCard
          description="Brands already assigned to one or more products."
          label="In Use"
          tone="success"
          value={String(summary.inUse)}
        />
        <StatCard
          description="Brands with no linked products yet."
          label="Empty"
          tone="warning"
          value={String(summary.empty)}
        />
        <StatCard
          description="Products currently linked to a brand record."
          label="Linked Products"
          value={String(summary.linkedProducts)}
        />
      </section>

      <BrandsFilters filters={filters} />

      <BrandsTable
        brands={brands}
        canDelete={canDelete}
        canManage={canManage}
      />

      <Pagination
        basePath="/dashboard/categories/brands"
        itemLabel="brands"
        pagination={pagination}
        query={{
          query: filters.query || undefined,
          pageSize:
            pagination.pageSize === DEFAULT_PAGE_SIZE ? undefined : pagination.pageSize,
        }}
      />
    </div>
  );
}
