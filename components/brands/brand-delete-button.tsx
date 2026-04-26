"use client";

import { useActionState } from "react";
import { deleteBrandAction } from "@/lib/actions/brands";
import { initialBrandFormState } from "@/lib/validators/brands";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type BrandDeleteButtonProps = {
  brandId: string;
  brandName: string;
};

export function BrandDeleteButton({
  brandId,
  brandName,
}: BrandDeleteButtonProps) {
  const [state, formAction] = useActionState(
    deleteBrandAction,
    initialBrandFormState
  );

  return (
    <form action={formAction} className="space-y-2">
      <input name="brandId" type="hidden" value={brandId} />
      <ConfirmSubmitButton
        confirmMessage={`Delete ${brandName}? This cannot be undone.`}
        pendingLabel="Deleting..."
        variant="outline"
      >
        Delete
      </ConfirmSubmitButton>
      {state.status === "error" && state.message ? (
        <p className="max-w-56 text-right text-sm text-destructive">{state.message}</p>
      ) : null}
    </form>
  );
}
