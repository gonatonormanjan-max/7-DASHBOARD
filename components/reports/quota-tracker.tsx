import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import type { ReportsQuotaData } from "@/lib/dal/reports";
import { formatCurrency } from "@/lib/products";
import { cn } from "@/lib/utils";

type QuotaTrackerProps = {
  data: ReportsQuotaData;
  basePath?: string;
};

function formatMetricValue(metric: ReportsQuotaData["metric"], value: number) {
  if (metric === "revenue") {
    return formatCurrency(value);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatPercent(ratio: number | null) {
  if (ratio === null) {
    return "Set a target";
  }

  return `${Math.round(ratio * 100)}%`;
}

function getStatusLabel(reached: boolean | null) {
  if (reached === null) {
    return "Target needed";
  }

  return reached ? "Reached" : "Below target";
}

function getStatusClasses(reached: boolean | null) {
  if (reached === null) {
    return "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]";
  }

  return reached
    ? "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]"
    : "border-[#f2d2a2] bg-[#fff4e4] text-[#8a5610]";
}

export function QuotaTracker({
  data,
  basePath = "/dashboard/reports",
}: QuotaTrackerProps) {
  const metricLabel = data.metric === "revenue" ? "Revenue" : "Units sold";
  const quotaDescription = data.target
    ? `${metricLabel} target set to ${formatMetricValue(data.metric, data.target)} across ${data.days} days.`
    : `Enter a ${metricLabel.toLowerCase()} target and day range to evaluate branch quota attainment.`;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Quota Tracker</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Test branch targets without changing stored settings. This is ideal for
              quick planning conversations with your client or managers.
            </p>
          </div>

          <form action={basePath} className="grid gap-3 sm:grid-cols-3 lg:min-w-[620px]">
            <input name="view" type="hidden" value="quota" />

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Metric
              </span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                defaultValue={data.metric}
                name="quotaMetric"
              >
                <option value="revenue">Revenue</option>
                <option value="units">Units sold</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Days
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                defaultValue={String(data.days)}
                min="1"
                name="quotaDays"
                step="1"
                type="number"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Quota target
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                defaultValue={data.target ? String(data.target) : ""}
                min="0"
                name="quotaTarget"
                placeholder={data.metric === "revenue" ? "50000" : "500"}
                step={data.metric === "revenue" ? "0.01" : "1"}
                type="number"
              />
            </label>

            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit">Apply quota check</Button>
            </div>
          </form>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">{quotaDescription}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tracked branches"
          value={String(data.branchCount)}
          description={`Active branches evaluated in the last ${data.days} days.`}
        />
        <StatCard
          label="Reached quota"
          value={data.target ? `${data.reachedCount} / ${data.branchCount}` : "Pending"}
          tone={data.target ? "success" : "default"}
          description={
            data.target
              ? "Branches that met or exceeded the target."
              : "Set a target to calculate quota attainment."
          }
        />
        <StatCard
          label="Average attainment"
          value={formatPercent(data.averageAttainment)}
          tone={
            data.target
              ? data.averageAttainment && data.averageAttainment >= 1
                ? "success"
                : "warning"
              : "default"
          }
          description="Average progress toward the target across tracked branches."
        />
        <StatCard
          label="Best performer"
          value={
            data.bestPerformer
              ? formatMetricValue(data.metric, data.bestPerformer.value)
              : "No sales yet"
          }
          tone="primary"
          description={
            data.bestPerformer
              ? `${data.bestPerformer.name} leads the selected window.`
              : "No branch activity recorded in the selected period."
          }
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Branch results</h3>
            <p className="text-sm leading-6 text-slate-500">
              Review actual performance, daily pacing, and quota progress for each branch.
            </p>
          </div>
        </div>

        {data.rows.length === 0 ? (
          <div className="mt-6 flex h-52 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
            No active branches are available for quota tracking yet.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="pb-3 pr-4">Branch</th>
                  <th className="pb-3 pr-4">Actual</th>
                  <th className="pb-3 pr-4">Avg / Day</th>
                  <th className="pb-3 pr-4">Best Day</th>
                  <th className="pb-3 pr-4">Active Days</th>
                  <th className="pb-3 pr-4">Progress</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const progressRatio = row.attainmentRatio ?? 0;
                  const progressWidth = `${Math.min(progressRatio * 100, 100)}%`;

                  return (
                    <tr key={row.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-950">{row.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                          {row.code}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">
                        {formatMetricValue(data.metric, row.currentValue)}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {formatMetricValue(data.metric, row.averagePerDay)}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {formatMetricValue(data.metric, row.bestDayValue)}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{row.activeSalesDays}</td>
                      <td className="py-3 pr-4">
                        {data.target ? (
                          <div className="min-w-[220px] space-y-2">
                            <div className="h-2.5 rounded-full bg-slate-200">
                              <div
                                className={cn(
                                  "h-2.5 rounded-full",
                                  row.reached ? "bg-[#12805c]" : "bg-[#b67918]"
                                )}
                                style={{ width: progressWidth }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{formatPercent(row.attainmentRatio)}</span>
                              <span>
                                {row.remainingToTarget
                                  ? `${formatMetricValue(data.metric, row.remainingToTarget)} remaining`
                                  : "Target achieved"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="max-w-[220px] text-xs leading-5 text-slate-500">
                            Set a target to calculate progress and remaining quota.
                          </p>
                        )}
                      </td>
                      <td className="py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                            getStatusClasses(row.reached)
                          )}
                        >
                          {getStatusLabel(row.reached)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
