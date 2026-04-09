import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getCategoryListData } from "@/lib/dal/categories";
import { parseCategoryListFilters } from "@/lib/validators/categories";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TabToggle } from "@/components/ui/tab-toggle";
import { CategoriesFilters } from "@/components/categories/categories-filters";
import { CategoriesTable } from "@/components/categories/categories-table";

type CategoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const user = await requirePermission("categories", "read");
  const filters = parseCategoryListFilters(await searchParams);
  const { categories, summary } = await getCategoryListData(filters);
  const canCreate = hasPermission(user.role, "categories", "create");
  const canManage = hasPermission(user.role, "categories", "update");
  const canDelete = hasPermission(user.role, "categories", "delete");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog Structure"
        title="Categories"
        description="Manage the category structure that keeps the shared catalog consistent across products, reporting, and future order workflows."
        action={
          canCreate ? (
            <Link href="/dashboard/categories/new">
              <Button>Create category</Button>
            </Link>
          ) : null
        }
      />

      <TabToggle
        tabs={[
          {
            label: "Categories",
            href: "/dashboard/categories",
            active: true,
          },
          {
            label: "Brands",
            href: "/dashboard/categories/brands",
            active: false,
          },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Total category records in the catalog."
          label="Categories"
          tone="primary"
          value={String(summary.total)}
        />
        <StatCard
          description="Categories already assigned to at least one product."
          label="In Use"
          tone="success"
          value={String(summary.inUse)}
        />
        <StatCard
          description="Available categories with no product assignments yet."
          label="Empty"
          tone="warning"
          value={String(summary.empty)}
        />
        <StatCard
          description="Products currently grouped by these categories."
          label="Products"
          value={String(summary.totalProducts)}
        />
      </section>

      <CategoriesFilters
        canManage={canManage}
        filters={filters}
      />

      <CategoriesTable
        canDelete={canDelete}
        canManage={canManage}
        categories={categories}
      />
    </div>
  );
}