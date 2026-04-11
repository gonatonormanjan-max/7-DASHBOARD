import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/dal/auth";
import {
  listCategoryOptionsForImport,
  listBrandOptionsForImport,
} from "@/lib/dal/products";
import { PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "@/components/products/import/import-wizard";

// ----------------------------------------------------------------
// Async sub-component — fetches data, wrapped in Suspense below.
// This lets the static shell (PageHeader + back button) render and
// stream to the client immediately while the DB queries resolve.
// ----------------------------------------------------------------

async function WizardLoader() {
  const [categories, brands] = await Promise.all([
    listCategoryOptionsForImport(),
    listBrandOptionsForImport(),
  ]);

  return <ImportWizard initialCategories={categories} initialBrands={brands} />;
}

function WizardFallback() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="space-y-4">
        <div className="h-24 rounded-[20px] bg-slate-100" />
        <div className="h-48 rounded-[20px] bg-slate-100" />
        <div className="flex justify-end">
          <div className="h-10 w-28 rounded-2xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Page — auth runs first, then the static shell renders immediately.
// The wizard streams in behind a Suspense boundary.
// ----------------------------------------------------------------

export default async function ProductImportPage() {
  await requirePermission("products", "create");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Shared Catalog"
        title="Import Products"
        description="Paste rows from Excel or Google Sheets to create multiple products at once. Products are created with zero stock — use the Initial Stock Load tool to set opening quantities per location."
        action={
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            Back to Products
          </Link>
        }
      />

      <Suspense fallback={<WizardFallback />}>
        <WizardLoader />
      </Suspense>
    </div>
  );
}
