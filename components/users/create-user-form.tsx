"use client";

import Link from "next/link";
import { useState } from "react";
import {
  initialUserFormState,
  type UserFormState,
} from "@/lib/validators/users";
import { Button } from "@/components/ui/button";

type CreateUserFormProps = {
  roleOptions: Array<{
    value: string;
    label: string;
  }>;
  locationOptions: Array<{
    value: string;
    label: string;
  }>;
};

function fieldValue(
  state: UserFormState,
  key: string,
  fallback: string | null | undefined
) {
  return state.values?.[key] ?? fallback ?? "";
}

export function CreateUserForm({
  locationOptions,
  roleOptions,
}: CreateUserFormProps) {
  const [state, setState] = useState<UserFormState>(initialUserFormState);
  const [selectedRole, setSelectedRole] = useState(
    roleOptions[0]?.value ?? "SALES_STAFF"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const managerRequiresBranch = selectedRole === "MANAGER";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setState(initialUserFormState);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "X-Requested-With": "fetch",
        },
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as
        | (UserFormState & { redirectTo?: string })
        | null;

      if (result?.redirectTo) {
        window.location.href = result.redirectTo;
        return;
      }

      if (result?.status === "error") {
        setState(result);
        return;
      }

      setState({
        status: "error",
        message: "Unable to create the account right now. Please try again.",
      });
    } catch (error) {
      console.error("Create user request failed.", error);
      setState({
        status: "error",
        message: "Unable to create the account right now. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action="/api/users"
      className="space-y-6"
      method="post"
      onSubmit={handleSubmit}
    >
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
            defaultValue={fieldValue(state, "firstName", null)}
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
            defaultValue={fieldValue(state, "lastName", null)}
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
            defaultValue={fieldValue(state, "email", null)}
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
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "role", roleOptions[0]?.value)}
            name="role"
            onChange={(event) => setSelectedRole(event.target.value)}
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.role ? (
            <p className="text-sm text-destructive">{state.fieldErrors.role[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Assigned branch</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "assignedLocationId", null)}
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
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue={fieldValue(state, "isActive", "true")}
            name="isActive"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {state.fieldErrors?.isActive ? (
            <p className="text-sm text-destructive">{state.fieldErrors.isActive[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            name="password"
            placeholder="At least 8 characters"
            required
            type="password"
          />
          {state.fieldErrors?.password ? (
            <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Confirm password</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-ring/30"
            name="confirmPassword"
            placeholder="Repeat the password"
            required
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
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating..." : "Create account"}
        </Button>
      </div>
    </form>
  );
}
