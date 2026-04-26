import Link from "next/link";
import { TabToggle } from "@/components/ui/tab-toggle";
import { PageHeader } from "@/components/ui/page-header";
import { BranchQuotasManager } from "@/components/reports/branch-quotas-manager";
import { requirePermission } from "@/lib/dal/auth";
import {
  DEFAULT_QUOTA_WINDOW_DAYS,
  getDedicatedBranchQuotaData,
} from "@/lib/dal/reports";
import { parseBranchQuotaMetric } from "@/lib/validators/reports";

type BranchQuotasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BranchQuotasPage({ searchParams }: BranchQuotasPageProps) {
  await requirePermission("reports", "update");

  const resolvedSearchParams = await searchParams;
  const metric = parseBranchQuotaMetric(getSingleParam(resolvedSearchParams.metric));
  const data = await getDedicatedBranchQuotaData({ metric });
  const tabs = [
    {
      label: "Revenue",
      href: "/dashboard/reports/branch-quotas?metric=revenue",
      active: metric === "revenue",
    },
    {
      label: "Units sold",
      href: "/dashboard/reports/branch-quotas?metric=units",
      active: metric === "units",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Decision Support"
        title="Branch Quotas"
        description="Set and monitor persistent branch targets with branch-specific rolling windows."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <TabToggle tabs={tabs} />
            <Link
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              href={`/dashboard/reports?view=quota&quotaDays=${DEFAULT_QUOTA_WINDOW_DAYS}&quotaMetric=${metric}`}
            >
              Back to Quota Tracker
            </Link>
          </div>
        }
      />

      {!data.storageReady ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
          Branch quota storage is not migrated yet, so this view is running in fallback mode
          with default windows and no saved targets. Run the latest Prisma migration to enable
          persisted branch quota settings.
        </section>
      ) : null}

      <BranchQuotasManager data={data} />
    </div>
  );
}
