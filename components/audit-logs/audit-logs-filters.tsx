import Link from "next/link";
import {
  AUDIT_LOG_MODULES,
  AUDIT_LOG_MODULE_LABELS,
  type AuditLogFilters,
} from "@/lib/validators/audit-logs";
import { Button } from "@/components/ui/button";

type AuditLogsFiltersProps = {
  filters: AuditLogFilters;
};

function toDateInputValue(date: Date | undefined): string {
  if (!date) return "";
  // Format as YYYY-MM-DD for the date input
  return date.toISOString().slice(0, 10);
}

export function AuditLogsFilters({ filters }: AuditLogsFiltersProps) {
  return (
    <form
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
      method="get"
    >
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Module</span>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={filters.module}
            name="module"
          >
            {AUDIT_LOG_MODULES.map((mod) => (
              <option key={mod} value={mod}>
                {AUDIT_LOG_MODULE_LABELS[mod]}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">From date</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={toDateInputValue(filters.dateFrom)}
            name="dateFrom"
            type="date"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">To date</span>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={toDateInputValue(filters.dateTo)}
            name="dateTo"
            type="date"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Audit logs are immutable. Every write action across the system is recorded here automatically.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/audit-logs">
            <Button type="button" variant="outline">
              Clear
            </Button>
          </Link>
          <Button type="submit">Apply filters</Button>
        </div>
      </div>
    </form>
  );
}
