"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  initialUserFormState,
  type UserFormState,
} from "@/lib/validators/users";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type UserFormProps = {
  action: (state: UserFormState, formData: FormData) => Promise<UserFormState>;
  mode: "create" | "edit";
  roleOptions: Array<{
    value: string;
    label: string;
  }>;
  locationOptions: Array<{
    value: string;
    label: string;
  }>;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    assignedLocationId?: string | null;
    isActive: boolean;
  };
  isSelf?: boolean;
};

function fieldValue(
  state: UserFormState,
  key: string,
  fallback: string | null | undefined
) {
  return state.values?.[key] ?? fallback ?? "";
}

export function UserForm({
  action,
  mode,
  locationOptions,
  roleOptions,
  user,
  isSelf = false,
}: UserFormProps) {
  const [state, formAction] = useActionState(action, initialUserFormState);
  const [selectedRole, setSelectedRole] = useState(
    user?.role ?? roleOptions[0]?.value ?? "SALES_STAFF"
  );
  const managerRequiresBranch = selectedRole === "MANAGER";

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-6 rounded-lg border border-border bg-card p-6 shadow-sm lg:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">First name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "firstName", user?.firstName)}
            name="firstName"
            placeholder="Norman"
            required
            type="text"
          />
          {state.fieldErrors?.firstName ? (
            <p className="text-sm text-destructive">{state.fieldErrors.firstName[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Last name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "lastName", user?.lastName)}
            name="lastName"
            placeholder="Jan"
            required
            type="text"
          />
          {state.fieldErrors?.lastName ? (
            <p className="text-sm text-destructive">{state.fieldErrors.lastName[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Email address</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "email", user?.email)}
            name="email"
            placeholder="lead@example.com"
            required
            type="email"
          />
          {state.fieldErrors?.email ? (
            <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Access level</span>
          {isSelf && user ? <input name="role" type="hidden" value={user.role} /> : null}
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
            defaultValue={fieldValue(state, "role", user?.role ?? roleOptions[0]?.value)}
            disabled={isSelf}
            name="role"
            onChange={(event) => setSelectedRole(event.target.value)}
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          {isSelf ? (
            <p className="text-sm text-slate-500">
              You cannot change your own role from this screen.
            </p>
          ) : null}
          {state.fieldErrors?.role ? (
            <p className="text-sm text-destructive">{state.fieldErrors.role[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Assigned branch</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(
              state,
              "assignedLocationId",
              user?.assignedLocationId
            )}
            name="assignedLocationId"
            required={managerRequiresBranch}
          >
            <option value="">
              {managerRequiresBranch ? "Select a branch" : "No branch assignment"}
            </option>
            {locationOptions.map((location) => (
              <option key={location.value} value={location.value}>
                {location.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-slate-500">
            {managerRequiresBranch
              ? "Manager accounts must be assigned to an active branch."
              : "Only manager accounts use a fixed branch assignment."}
          </p>
          {state.fieldErrors?.assignedLocationId ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.assignedLocationId[0]}
            </p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Account status</span>
          {isSelf && user ? (
            <input name="isActive" type="hidden" value={String(user.isActive)} />
          ) : null}
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
            defaultValue={fieldValue(
              state,
              "isActive",
              user ? String(user.isActive) : "true"
            )}
            disabled={isSelf}
            name="isActive"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {isSelf ? (
            <p className="text-sm text-slate-500">
              You cannot deactivate your own account from this screen.
            </p>
          ) : null}
          {state.fieldErrors?.isActive ? (
            <p className="text-sm text-destructive">{state.fieldErrors.isActive[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            {mode === "create" ? "Password" : "New password"}
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            name="password"
            placeholder={mode === "create" ? "At least 8 characters" : "Leave blank to keep current password"}
            required={mode === "create"}
            type="password"
          />
          {state.fieldErrors?.password ? (
            <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            {mode === "create" ? "Confirm password" : "Confirm new password"}
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            name="confirmPassword"
            placeholder="Repeat the password"
            required={mode === "create"}
            type="password"
          />
          {state.fieldErrors?.confirmPassword ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          ) : null}
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link href="/dashboard/users">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <SubmitButton pendingLabel={mode === "create" ? "Creating..." : "Saving..."}>
          {mode === "create" ? "Create account" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
