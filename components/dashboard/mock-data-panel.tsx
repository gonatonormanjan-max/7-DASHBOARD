import { clearMockDataAction, seedMockDataAction } from "@/lib/actions/mock-data";
import { getMockDataSummary } from "@/lib/mock-data";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";

const statItems: Array<keyof Awaited<ReturnType<typeof getMockDataSummary>>> = [
  "categories",
  "suppliers",
  "warehouses",
  "products",
  "stockRows",
  "movements",
];

const labels: Record<(typeof statItems)[number], string> = {
  categories: "Categories",
  suppliers: "Suppliers",
  warehouses: "Warehouses",
  products: "Products",
  stockRows: "Stock Rows",
  movements: "Movements",
};

export async function MockDataPanel() {
  const summary = await getMockDataSummary();
  const totalRecords = Object.values(summary).reduce((sum, value) => sum + value, 0);
  const hasMockData = totalRecords > 0;

  return (
    <section className="rounded-[24px] border border-[#dbe6f5] bg-[linear-gradient(135deg,rgba(236,244,255,0.92),rgba(255,255,255,0.95))] p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Mock data controls</h2>
            <StatusBadge status={hasMockData ? "active" : "draft"} />
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Load a realistic sample catalog with suppliers, warehouses, stock rows, and movement
            history so the current modules render with live-looking data. Clear only removes the
            scoped mock records created by this tool, and keeps any mock items that are already
            linked to real transactions.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <form action={seedMockDataAction}>
            <SubmitButton pendingLabel="Loading mock data...">Load mock data</SubmitButton>
          </form>

          <form action={clearMockDataAction}>
            <ConfirmSubmitButton
              confirmMessage="Remove the mock categories, products, warehouses, stock rows, and movements created by this tool?"
              pendingLabel="Removing mock data..."
              variant="outline"
            >
              Clear mock data
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {statItems.map((key) => (
          <div
            key={key}
            className="rounded-[18px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_20px_45px_-36px_rgba(15,23,42,0.55)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {labels[key]}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {summary[key]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
