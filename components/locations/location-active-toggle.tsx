"use client";

import { useActionState } from "react";
import { toggleLocationActiveAction } from "@/lib/actions/locations";
import { initialLocationFormState } from "@/lib/validators/locations";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type LocationActiveToggleProps = {
  locationId: string;
  locationName: string;
  isActive: boolean;
  returnTo: string;
  variant?: "default" | "outline" | "ghost";
};

export function LocationActiveToggle({
  locationId,
  locationName,
  isActive,
  returnTo,
  variant = "outline",
}: LocationActiveToggleProps) {
  const [state, formAction] = useActionState(
    toggleLocationActiveAction,
    initialLocationFormState
  );

  return (
    <form action={formAction} className="space-y-2">
      <input name="locationId" type="hidden" value={locationId} />
      <input name="targetIsActive" type="hidden" value={String(!isActive)} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <ConfirmSubmitButton
        confirmMessage={
          isActive
            ? `Deactivate ${locationName}?`
            : `Activate ${locationName}?`
        }
        pendingLabel={isActive ? "Deactivating..." : "Activating..."}
        variant={variant}
      >
        {isActive ? "Deactivate" : "Activate"}
      </ConfirmSubmitButton>
      {state.status === "error" && state.message ? (
        <p className="max-w-64 text-sm text-destructive">{state.message}</p>
      ) : null}
    </form>
  );
}
