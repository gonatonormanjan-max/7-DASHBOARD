import Link from "next/link";
import type { Role } from "@prisma/client";
import { getRoleLabel } from "@/lib/permissions";
import { getUserStatusLabel } from "@/lib/users";
import { formatDatePH } from "@/lib/timezone";
import { Button } from "@/components/ui/button";

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
};

type UsersTableProps = {
  users: UserRow[];
  canManage: boolean;
};

export function UsersTable({ users, canManage }: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-card px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No users found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Create an account here to grant Admin, System Manager, or Sales Staff access.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <th className="px-5 py-4">User</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4">Access level</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Created</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {users.map((user) => (
              <tr key={user.id} className="align-top">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-950">
                    {user.firstName} {user.lastName}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">{user.email}</td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {getRoleLabel(user.role)}
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {getUserStatusLabel(user.isActive)}
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {formatDatePH(user.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    {canManage ? (
                      <Link href={`/dashboard/users/${user.id}/edit`}>
                        <Button variant="outline">Edit</Button>
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
