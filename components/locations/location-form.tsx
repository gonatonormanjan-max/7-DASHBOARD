"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  initialLocationFormState,
  type LocationFormState,
} from "@/lib/validators/locations";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type LocationFormProps = {
  action: (state: LocationFormState, formData: FormData) => Promise<LocationFormState>;
  mode: "create" | "edit";
  location?: {
    id: string;
    name: string;
    code: string;
    type: "WAREHOUSE" | "BRANCH";
    address: string | null;
    managerName: string | null;
    contactNumber: string | null;
  };
};

function fieldValue(
  state: LocationFormState,
  key: string,
  fallback: string | null | undefined
) {
  return state.values?.[key] ?? fallback ?? "";
}

function getTypeLabel(type: "WAREHOUSE" | "BRANCH") {
  return type === "WAREHOUSE" ? "Warehouse" : "Branch";
}

export function LocationForm({ action, mode, location }: LocationFormProps) {
  const [state, formAction] = useActionState(action, initialLocationFormState);

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && location ? (
        <input name="locationId" type="hidden" value={location.id} />
      ) : null}

      {state.message ? (
        <div className="rounded-2xl bg-[#fff4e4] px-4 py-3 text-sm text-[#8a5610]">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-6 rounded-[24px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)] lg:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Location name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "name", location?.name)}
            name="name"
            placeholder="Central Warehouse"
            required
            type="text"
          />
          {state.fieldErrors?.name ? (
            <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Code</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm uppercase text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "code", location?.code)}
            name="code"
            placeholder="WH-001"
            required
            spellCheck={false}
            type="text"
          />
          {state.fieldErrors?.code ? (
            <p className="text-sm text-destructive">{state.fieldErrors.code[0]}</p>
          ) : null}
        </label>

        {mode === "create" ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Location type</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
              defaultValue={fieldValue(state, "type", location?.type ?? "WAREHOUSE")}
              name="type"
            >
              <option value="WAREHOUSE">Warehouse</option>
              <option value="BRANCH">Branch</option>
            </select>
            {state.fieldErrors?.type ? (
              <p className="text-sm text-destructive">{state.fieldErrors.type[0]}</p>
            ) : null}
          </label>
        ) : location ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Location type</span>
            <input name="type" type="hidden" value={location.type} />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-600 outline-none"
              disabled
              type="text"
              value={getTypeLabel(location.type)}
            />
            <p className="text-sm text-slate-500">
              Location type is locked after creation.
            </p>
          </label>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Manager name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "managerName", location?.managerName)}
            name="managerName"
            placeholder="Ava Santos"
            type="text"
          />
          {state.fieldErrors?.managerName ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.managerName[0]}
            </p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Contact number</span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "contactNumber", location?.contactNumber)}
            name="contactNumber"
            placeholder="+63 917 000 0000"
            type="text"
          />
          {state.fieldErrors?.contactNumber ? (
            <p className="text-sm text-destructive">
              {state.fieldErrors.contactNumber[0]}
            </p>
          ) : null}
        </label>

        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Address</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[var(--ring)]"
            defaultValue={fieldValue(state, "address", location?.address)}
            name="address"
            placeholder="Optional physical address for deliveries, audits, and routing."
          />
          {state.fieldErrors?.address ? (
            <p className="text-sm text-destructive">{state.fieldErrors.address[0]}</p>
          ) : null}
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link href={location ? `/dashboard/locations/${location.id}` : "/dashboard/locations"}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <SubmitButton pendingLabel={mode === "create" ? "Creating..." : "Saving..."}>
          {mode === "create" ? "Create location" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
