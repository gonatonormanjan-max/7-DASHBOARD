"use client";

import { useActionState } from "react";
import type { BranchQuotaPageData, BranchQuotaProgressRow, QuotaMetric } from "@/lib/dal/reports";
import { saveBranchQuotaSettingsAction } from "@/lib/actions/reports";
import { formatCurrency } from "@/lib/products";
import { cn } from "@/lib/utils";
import {
  initialBranchQuotaSettingsState,
  type BranchQuotaSettingsFormValues,
} from "@/lib/validators/reports";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatCard } from "@/components/ui/stat-card";

type BranchQuotasManagerProps = {
  data: BranchQuotaPageData;
};

function formatMetricValue(metric: QuotaMetric, value: number) {
  if (metric === "revenue") {
    return formatCurrency(value);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not configured";
  }

  return `${Math.round(value * 100)}%`;
}

function getBandLabel(band: BranchQuotaProgressRow["band"]) {
  if (band === "green") {
    return "On target";
  }

  if (band === "amber") {
    return "Needs push";
  }

  if (band === "red") {
    return "At risk";
  }

  return "Unconfigured";
}

function getBandBadgeClasses(band: BranchQuotaProgressRow["band"]) {
  if (band === "green") {
    return "border-[#c5e7db] bg-[#edf8f4] text-[#11664b]";
  }

  if (band === "amber") {
    return "border-amber-200 bg-amber-50 text-[#8a5610]";
  }

  if (band === "red") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]";
}

function getBandBarClasses(band: BranchQuotaProgressRow["band"]) {
  if (band === "green") {
    return "bg-[#12805c]";
  }

  if (band === "amber") {
    return "bg-[#b67918]";
  }

  if (band === "red") {
    return "bg-[#dc2626]";
  }

  return "bg-[#3b82f6]";
}

function toFormRows(rows: BranchQuotaProgressRow[]): BranchQuotaSettingsFormValues["rows"] {
  return rows.map((row) => ({
    branchId: row.id,
    rollingWindowDays: String(row.rollingWindowDays),
    revenueTarget: row.revenueTarget === null ? "" : String(row.revenueTarget),
    unitsTarget: row.unitsTarget === null ? "" : String(row.unitsTarget),
  }));
}

function getFieldError(
  fieldErrors: Record<string, string[] | undefined> | undefined,
  index: number,
  field: "rollingWindowDays" | "revenueTarget" | "unitsTarget"
) {
  return fieldErrors?.[`rows.${index}.${field}`]?.[0];
}

export function BranchQuotasManager({ data }: BranchQuotasManagerProps) {
  const [state, formAction] = useActionState(
    saveBranchQuotaSettingsAction,
    initialBranchQuotaSettingsState
  );
  const formRows = state.values?.rows?.length ? state.values.rows : toFormRows(data.rows);
  const metricLabel = data.metric === "revenue" ? "Revenue" : "Units sold";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active branches"
          value={String(data.summary.branchCount)}
          description="Branches included in this quota monitor."
        />
        <StatCard
          label={`Configured ${metricLabel.toLowerCase()} targets`}
          value={`${data.summary.configuredCount} / ${data.summary.branchCount}`}
          tone={data.summary.configuredCount > 0 ? "primary" : "default"}
          description="Targets are set only when value is above zero."
        />
        <StatCard
          label="Reached target"
          value={`${data.summary.reachedCount} / ${data.summary.branchCount}`}
          tone={data.summary.reachedCount > 0 ? "success" : "warning"}
          description="Branches already meeting current target in their own window."
        />
        <StatCard
          label="Average attainment"
          value={formatPercent(data.summary.averageAttainment)}
          tone={
            data.summary.averageAttainment === null
              ? "default"
              : data.summary.averageAttainment >= 1
                ? "success"
                : "warning"
          }
          description="Average progress across configured branches only."
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
            Red: {'<'} 70%
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[#8a5610]">
            Amber: 70% - 99%
          </span>
          <span className="rounded-full border border-[#c5e7db] bg-[#edf8f4] px-2.5 py-1 text-[#11664b]">
            Green: 100%+
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Leave target fields blank to unset a branch quota. If both targets are blank, the
          saved quota setting for that branch is removed.
        </p>
      </section>

      <form action={formAction} className="space-y-4">
        <input name="metric" type="hidden" value={data.metric} />

        {state.message ? (
          <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
            {state.message}
          </div>
        ) : null}

        {state.fieldErrors?.rows ? (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.fieldErrors.rows[0]}
          </div>
        ) : null}

        {data.rows.length === 0 ? (
          <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
            No active branches are available for quota management yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Window (days)</th>
                    <th className="px-4 py-3">Revenue target</th>
                    <th className="px-4 py-3">Units target</th>
                    <th className="px-4 py-3">Actual ({metricLabel})</th>
                    <th className="px-4 py-3">Target ({metricLabel})</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => {
                    const formRow = formRows[index] ?? {
                      branchId: row.id,
                      rollingWindowDays: String(row.rollingWindowDays),
                      revenueTarget: row.revenueTarget === null ? "" : String(row.revenueTarget),
                      unitsTarget: row.unitsTarget === null ? "" : String(row.unitsTarget),
                    };
                    const progressWidth = `${Math.min((row.attainmentRatio ?? 0) * 100, 100)}%`;

                    return (
                      <tr key={row.id} className="border-b border-slate-100 align-top">
                        <td className="px-4 py-4">
                          <input
                            name={`rows[${index}].branchId`}
                            type="hidden"
                            value={formRow.branchId || row.id}
                          />
                          <p className="font-semibold text-slate-900">{row.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                            {row.code}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <input
                            className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                            defaultValue={formRow.rollingWindowDays}
                            min={1}
                            max={365}
                            name={`rows[${index}].rollingWindowDays`}
                            step={1}
                            type="number"
                          />
                          {getFieldError(state.fieldErrors, index, "rollingWindowDays") ? (
                            <p className="mt-1 text-xs text-destructive">
                              {getFieldError(state.fieldErrors, index, "rollingWindowDays")}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <input
                            className="w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                            defaultValue={formRow.revenueTarget}
                            min={0}
                            name={`rows[${index}].revenueTarget`}
                            placeholder="Unset"
                            step="0.01"
                            type="number"
                          />
                          {getFieldError(state.fieldErrors, index, "revenueTarget") ? (
                            <p className="mt-1 text-xs text-destructive">
                              {getFieldError(state.fieldErrors, index, "revenueTarget")}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <input
                            className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
                            defaultValue={formRow.unitsTarget}
                            min={0}
                            name={`rows[${index}].unitsTarget`}
                            placeholder="Unset"
                            step={1}
                            type="number"
                          />
                          {getFieldError(state.fieldErrors, index, "unitsTarget") ? (
                            <p className="mt-1 text-xs text-destructive">
                              {getFieldError(state.fieldErrors, index, "unitsTarget")}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {formatMetricValue(data.metric, row.currentValue)}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {row.targetValue === null
                            ? "Unset"
                            : formatMetricValue(data.metric, row.targetValue)}
                        </td>
                        <td className="px-4 py-4">
                          {row.targetValue === null ? (
                            <p className="max-w-[220px] text-xs leading-5 text-slate-500">
                              Set a {metricLabel.toLowerCase()} target to calculate quota progress.
                            </p>
                          ) : (
                            <div className="min-w-[220px] space-y-2">
                              <div className="h-2.5 rounded-full bg-slate-200">
                                <div
                                  className={cn("h-2.5 rounded-full", getBandBarClasses(row.band))}
                                  style={{ width: progressWidth }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>{formatPercent(row.attainmentRatio)}</span>
                                <span>
                                  {row.remainingToTarget === null
                                    ? ""
                                    : row.remainingToTarget > 0
                                      ? `${formatMetricValue(data.metric, row.remainingToTarget)} remaining`
                                      : "Target achieved"}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                              getBandBadgeClasses(row.band)
                            )}
                          >
                            {getBandLabel(row.band)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.rows.length > 0 ? (
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Saving quotas...">Save branch quotas</SubmitButton>
          </div>
        ) : null}
      </form>
    </div>
  );
}
