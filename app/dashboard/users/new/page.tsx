import { getRoleLabel } from "@/lib/permissions";
import { createUserAction } from "@/lib/actions/users";
import { requirePermission } from "@/lib/dal/auth";
import { getAssignableRolesForActor } from "@/lib/users";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "@/components/users/user-form";

export default async function NewUserPage() {
  const user = await requirePermission("users", "create");
  const roleOptions = getAssignableRolesForActor(user.role).map((role) => ({
    value: role,
    label: getRoleLabel(role),
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
        mode="create"
        roleOptions={roleOptions}
      />
    </div>
  );
}
