import { getRoleLabel } from "@/lib/permissions";
import { createUserAction } from "@/lib/actions/users";
import { requirePermission } from "@/lib/dal/auth";
import { getManagerBranchOptions } from "@/lib/dal/users";
import { getAssignableRolesForActor } from "@/lib/users";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "@/components/users/user-form";

export default async function NewUserPage() {
  const [user, branches] = await Promise.all([
    requirePermission("users", "create"),
    getManagerBranchOptions(),
  ]);
  const roleOptions = getAssignableRolesForActor(user.role).map((role) => ({
    value: role,
    label: getRoleLabel(role),
  }));
  const locationOptions = branches.map((branch) => ({
    value: branch.id,
    label: `${branch.name} (${branch.code})${branch.isActive ? "" : " - inactive"}`,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Access Control"
        title="Create account"
        description="Create a dashboard account and assign the right access level for that teammate."
      />

      <UserForm
        action={createUserAction}
        locationOptions={locationOptions}
        mode="create"
        roleOptions={roleOptions}
      />
    </div>
  );
}
