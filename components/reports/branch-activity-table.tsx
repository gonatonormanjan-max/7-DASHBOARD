import type { BranchActivityRow } from "@/lib/dal/reports";

type BranchActivityTableProps = {
  rows: BranchActivityRow[];
};

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCountStatus(submittedDays: number, expectedDays: number) {
  return `${submittedDays}/${expectedDays}`;
}

function getCountStatusClass(submittedDays: number, expectedDays: number) {
  if (expectedDays === 0 || submittedDays >= expectedDays) {
    return "bg-success/10 text-success";
  }

  if (submittedDays === 0) {
    return "bg-warning/10 text-warning";
  }

  return "bg-info/10 text-info";
}

export function BranchActivityTable({ rows }: BranchActivityTableProps) {
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Branch Health</h2>
        <div className="mt-4 flex h-44 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
          No active branch data matches this filter.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Branch Health</h2>
          <p className="text-sm text-muted-foreground">
            Sales, movement, count completion, discrepancies, and issue status by branch.
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-[1120px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <th className="pb-3 pr-4">Branch</th>
              <th className="pb-3 pr-4">Revenue</th>
              <th className="pb-3 pr-4">Units</th>
              <th className="pb-3 pr-4">Orders</th>
              <th className="pb-3 pr-4">Inbound</th>
              <th className="pb-3 pr-4">Outbound</th>
              <th className="pb-3 pr-4">Opening</th>
              <th className="pb-3 pr-4">Closing</th>
              <th className="pb-3 pr-4">Variance</th>
              <th className="pb-3 pr-4">Issues</th>
              <th className="pb-3">Low/Out</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/70 last:border-0">
                <td className="py-3 pr-4">
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.code}</p>
                </td>
                <td className="py-3 pr-4 text-foreground">{formatCurrency(row.revenue)}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {formatNumber(row.unitsSold)}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {formatNumber(row.orderCount)}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {formatNumber(row.inboundUnits)}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {formatNumber(row.outboundUnits)}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getCountStatusClass(
                      row.openingSubmittedDays,
                      row.expectedCountDays
                    )}`}
                  >
                    {formatCountStatus(row.openingSubmittedDays, row.expectedCountDays)}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getCountStatusClass(
                      row.closingSubmittedDays,
                      row.expectedCountDays
                    )}`}
                  >
                    {formatCountStatus(row.closingSubmittedDays, row.expectedCountDays)}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={
                      row.discrepancyUnits > 0
                        ? "font-semibold text-warning"
                        : "text-muted-foreground"
                    }
                  >
                    {formatNumber(row.discrepancyUnits)}
                  </span>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {formatNumber(row.openIssueCount)} open /{" "}
                  {formatNumber(row.acknowledgedIssueCount)} ack
                </td>
                <td className="py-3 text-muted-foreground">
                  {formatNumber(row.lowOrOutStockCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
