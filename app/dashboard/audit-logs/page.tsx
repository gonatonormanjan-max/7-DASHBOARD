import { ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/dal/auth";
import { getAuditLogListData } from "@/lib/dal/audit-logs";
import { parseAuditLogFilters, AUDIT_LOG_MODULE_LABELS } from "@/lib/validators/audit-logs";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Pagination } from "@/components/ui/pagination";
import { AuditLogsFilters } from "@/components/audit-logs/audit-logs-filters";
import { AuditLogsTable } from "@/components/audit-logs/audit-logs-table";

type AuditLogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  await requirePermission("audit_logs", "read");

  const filters = parseAuditLogFilters(await searchParams);
  const { logs, pagination } = await getAuditLogListData(filters);

  const activeModuleLabel =
    filters.module && filters.module !== "all"
      ? AUDIT_LOG_MODULE_LABELS[filters.module]
      : "All modules";

  // Build query object for pagination links (preserve active filters)
  const paginationQuery: Record<string, string> = {};
  if (filters.module && filters.module !== "all") {
    paginationQuery.module = filters.module;
  }
  if (filters.dateFrom) {
    paginationQuery.dateFrom = filters.dateFrom.toISOString().slice(0, 10);
  }
  if (filters.dateTo) {
    paginationQuery.dateTo = filters.dateTo.toISOString().slice(0, 10);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System"
        title="Audit Logs"
        description="Immutable record of every write action across the system — who did what, when, and where."
        action={
          <div className="flex items-center gap-2 rounded-full border border-[#c5e7db] bg-[#edf8f4] px-3 py-1.5">
            <ShieldCheck className="size-4 text-[#11664b]" strokeWidth={2.2} />
            <span className="text-xs font-semibold text-[#11664b] uppercase tracking-[0.18em]">
              Read-only
            </span>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total entries"
          value={String(pagination.totalCount)}
          description="Matching the current filter selection."
          tone="primary"
        />
        <StatCard
          label="Current page"
          value={`${pagination.page} / ${pagination.totalPages}`}
          description={`Showing ${pagination.from}–${pagination.to} of ${pagination.totalCount} entries.`}
        />
        <StatCard
          label="Module filter"
          value={activeModuleLabel}
          description="Use the filter form below to narrow by module or date."
          tone={filters.module !== "all" ? "warning" : undefined}
        />
      </section>

      <AuditLogsFilters filters={filters} />

      <AuditLogsTable logs={logs} />

      <Pagination
        basePath="/dashboard/audit-logs"
        pagination={pagination}
        query={paginationQuery}
        itemLabel="entries"
      />
    </div>
  );
}
