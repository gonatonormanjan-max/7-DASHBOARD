import Link from "next/link";
import { getRoleLabel, hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/dal/auth";
import { getUserListData } from "@/lib/dal/users";
import { parseUserListFilters } from "@/lib/validators/users";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { UsersFilters } from "@/components/users/users-filters";
import { UsersTable } from "@/components/users/users-table";

type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const user = await requirePermission("users", "read");
  const filters = parseUserListFilters(await searchParams);
  const { users, summary } = await getUserListData(filters);
  const canCreate = hasPermission(user.role, "users", "create");
  const canManage = hasPermission(user.role, "users", "update");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Access Control"
        title="Users"
        description={`Create and manage dashboard accounts for your team. Your current access level is ${getRoleLabel(user.role)}.`}
        action={
          canCreate ? (
            <Link href="/dashboard/users/new">
              <Button>Create account</Button>
            </Link>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Accounts in the current filtered view."
          label="Users"
          tone="primary"
          value={String(summary.total)}
        />
        <StatCard
          description="Highest access across configuration and reporting."
          label="Admins"
          tone="success"
          value={String(summary.admins)}
        />
        <StatCard
          description="Operational leaders with broad but non-owner access."
          label="System Managers"
          value={String(summary.systemManagers)}
        />
        <StatCard
          description={`Managers: ${summary.managers}. Sales Staff: ${summary.salesStaff}. Active accounts: ${summary.active}. Inactive accounts: ${summary.inactive}.`}
          label="Branch Managers"
          tone="warning"
          value={String(summary.managers)}
        />
      </section>

      <UsersFilters filters={filters} />

      <UsersTable canManage={canManage} users={users} />
    </div>
  );
}
