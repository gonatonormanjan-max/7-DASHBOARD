"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CashDropDestination, Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { createCashDropInVault } from "@/lib/dal/vault";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// createCashDropAction
//
// Records a cash drop from a branch vault. Only MANAGER (own branch) and
// ADMIN (any branch) may call this. The server action validates input, enforces
// branch scope, and delegates the atomic ledger write to createCashDropInVault.
//
// Returns a form state rather than redirecting so the caller (a modal) can
// close itself on success without navigating away.
// ---------------------------------------------------------------------------

export type CashDropFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialCashDropFormState: CashDropFormState = {
  status: "idle",
};

const cashDropSchema = z
  .object({
    branchId: z.string().trim().min(1, "Branch is required."),
    cashAmount: z.coerce
      .number()
      .positive("Amount must be greater than ₱0.00.")
      .max(9_999_999.99, "Amount is too large."),
    destination: z.nativeEnum(CashDropDestination, {
      error: "Select a valid destination.",
    }),
    destinationNote: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.destination === CashDropDestination.OTHERS &&
      (!val.destinationNote || val.destinationNote.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationNote"],
        message: "Describe the destination when 'Others' is selected.",
      });
    }
  });

export async function createCashDropAction(
  _prevState: CashDropFormState,
  formData: FormData
): Promise<CashDropFormState> {
  const user = await requirePermission("vault", "create");

  const raw = {
    branchId: formData.get("branchId"),
    cashAmount: formData.get("cashAmount"),
    destination: formData.get("destination"),
    // Empty string from textarea → treat as absent.
    destinationNote: formData.get("destinationNote") || undefined,
    notes: formData.get("notes") || undefined,
  };

  const parsed = cashDropSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the form errors.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }

  const { branchId, cashAmount, destination, destinationNote, notes } =
    parsed.data;

  // Branch scope: MANAGERs can only drop cash from their assigned branch.
  if (user.role === "MANAGER" && user.assignedLocationId !== branchId) {
    return {
      status: "error",
      message: "You can only record cash drops for your assigned branch.",
    };
  }

  // Verify the branch is still active.
  const branch = await prisma.stockLocation.findFirst({
    where: { id: branchId, isActive: true, type: "BRANCH" },
    select: { id: true, name: true },
  });

  if (!branch) {
    return {
      status: "error",
      message: "Branch not found or no longer active.",
    };
  }

  // Round to 2 d.p. to match Decimal(12,2) column precision.
  const cashAmountDecimal = new Prisma.Decimal(cashAmount.toFixed(2));

  try {
    await prisma.$transaction(async (tx) => {
      const vaultTx = await createCashDropInVault(tx, {
        branchId,
        cashAmount: cashAmountDecimal,
        destination,
        destinationNote: destinationNote || null,
        notes: notes || null,
        performedById: user.id,
      });

      await logAudit(
        {
          userId: user.id,
          action: "cash_drop.create",
          entity: "vault_transaction",
          entityId: vaultTx.id,
          details: {
            branchId,
            branchName: branch.name,
            cashAmount: cashAmountDecimal.toFixed(2),
            destination,
            destinationNote: destinationNote || null,
            notes: notes || null,
          },
        },
        tx
      );
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return { status: "error", message };
  }

  revalidatePath("/dashboard/vault");

  return {
    status: "success",
    message: "Cash drop recorded successfully.",
  };
}
