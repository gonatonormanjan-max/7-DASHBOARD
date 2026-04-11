import type { ReportMetricContext } from "@/lib/dal/reports";

type MetricContextStripProps = {
  context: ReportMetricContext;
};

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatConfidence(confidence: ReportMetricContext["confidence"]) {
  if (confidence === "high") return "High";
  if (confidence === "medium") return "Medium";
  return "Low";
}

export function MetricContextStrip({ context }: MetricContextStripProps) {
  const recalculatedAt = new Date(context.recalculatedAt);

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/70 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Metric context
      </p>
      <div className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
        <p>
          <span className="font-medium text-slate-800">Valuation:</span>{" "}
          {context.valuationMethod}
        </p>
        <p>
          <span className="font-medium text-slate-800">Statuses:</span>{" "}
          {context.includedStatuses.map(formatStatus).join(", ")}
        </p>
        <p>
          <span className="font-medium text-slate-800">Confidence:</span>{" "}
          {formatConfidence(context.confidence)}
        </p>
        <p>
          <span className="font-medium text-slate-800">Estimated cost lines:</span>{" "}
          {context.estimatedCostLineCount} / {context.totalSalesLines}
        </p>
        <p>
          <span className="font-medium text-slate-800">Cost shocks:</span>{" "}
          {context.costShockEventsInWindow} (&gt;
          {context.costShockWarningThresholdPct.toFixed(0)}%)
        </p>
        <p>
          <span className="font-medium text-slate-800">Escalations:</span>{" "}
          {context.costShockEscalationsInWindow} (&gt;
          {context.costShockEscalationThresholdPct.toFixed(0)}%)
        </p>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Recalculated {recalculatedAt.toLocaleString("en-US")}. Archived orders are{" "}
        {context.archivedOrdersPolicy}.
      </p>
    </section>
  );
}
