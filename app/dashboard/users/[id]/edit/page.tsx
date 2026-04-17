import { notFound, redirect } from "next/navigation";
import { getRoleLabel } from "@/lib/permissions";
import { withFlashMessage } from "@/lib/flash-toast";
import { updateUserAction } from "@/lib/actions/users";
import { requirePermission } from "@/lib/dal/auth";
import { getManagerBranchOptions, getUserById } from "@/lib/dal/users";
import { canManageTargetUser, getAssignableRolesForActor } from "@/lib/users";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "@/components/users/user-form";

type EditUserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditUserPage({ params }: EditUserPageProps) {
  const actor = await requirePermission("users", "update");
  const { id } = await params;
  const user = await getUserById(id);

  if (!user) {
    notFound();
  }

  if (!canManageTargetUser(actor.role, user.role)) {
    redirect(
      withFlashMessage("/dashboard/users", {
        error: "You cannot manage that account.",
      })
    );
  }

  const roleOptions = getAssignableRolesForActor(actor.role).map((role) => ({
    value: role,
    label: getRoleLabel(role),
  }));
  const branches = await getManagerBranchOptions(user.assignedLocationId ?? undefined);
  const locationOptions = branches.map((branch) => ({
    value: branch.id,
    label: `${branch.name} (${branch.code})${branch.isActive ? "" : " - inactive"}`,
  }));
  const boundUpdateAction = updateUserAction.bind(null, user.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Access Control"
        title={`Edit ${user.firstName} ${user.lastName}`}
        description="Update account access, active status, and profile details without touching warehouse or catalog data."
      />

      <UserForm
        action={boundUpdateAction}
        isSelf={actor.id === user.id}
        locationOptions={locationOptions}
        mode="edit"
        roleOptions={roleOptions}
        user={{
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          assignedLocationId: user.assignedLocationId,
          isActive: user.isActive,
        }}
      />
    </div>
  );
}
