"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CashDropDestination, Prisma, VaultPaymentMethod } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/dal/auth";
import { hasPermission } from "@/lib/permissions";
import { createCashDropInVault, createVaultAdjustmentInVault } from "@/lib/dal/vault";
import { prisma } from "@/lib/prisma";
import type { VaultFormState } from "@/lib/actions/vault-types";

// ---------------------------------------------------------------------------
// createCashDropAction
//
// Records a cash drop from a branch vault. Only MANAGER (own branch) and
// ADMIN (any branch) may call this. Returns form state so the modal can
// close itself on success without navigating away.
//
// Uses getCurrentUser + hasPermission (not requirePermission) so a denied
// call returns an inline error instead of calling redirect() — which would
// surface as an error page inside a useActionState modal flow.
// ---------------------------------------------------------------------------

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
  _prevState: VaultFormState,
  formData: FormData
): Promise<VaultFormState> {
  // Safe auth: return a form error instead of redirecting.
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "vault", "create")) {
    return {
      status: "error",
      message: "You don't have permission to record cash drops.",
    };
  }

  const raw = {
    branchId: formData.get("branchId"),
    cashAmount: formData.get("cashAmount"),
    destination: formData.get("destination"),
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

  const cashAmountDecimal = new Prisma.Decimal(cashAmount.toFixed(2));

  try {
    // Branch existence check is inside the try so any DB error becomes a
    // friendly inline message rather than an unhandled exception.
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

// ---------------------------------------------------------------------------
// createVaultAdjustmentAction
//
// Manual balance adjustment for MANAGER (own branch) and ADMIN (any branch).
// Signed amount: positive = add to balance, negative = deduct from balance.
// Both Cash and Online balances can be adjusted independently.
// Requires a non-empty notes field (this is a contingency tool — audit trail
// is mandatory).
// ---------------------------------------------------------------------------

const vaultAdjustmentSchema = z.object({
  branchId: z.string().trim().min(1, "Branch is required."),
  paymentMethod: z.nativeEnum(VaultPaymentMethod, {
    error: "Select Cash or Online.",
  }),
  // Signed amount: positive = credit, negative = debit.
  // Reject zero — an adjustment of ₱0 is a no-op.
  adjustmentAmount: z.coerce
    .number()
    .refine((n) => n !== 0, { message: "Amount cannot be zero." })
    .refine((n) => Math.abs(n) <= 9_999_999.99, {
      message: "Amount is too large.",
    }),
  notes: z
    .string()
    .trim()
    .min(1, "Notes are required — explain why this adjustment is needed.")
    .max(1000, "Notes must be 1,000 characters or fewer."),
});

export async function createVaultAdjustmentAction(
  _prevState: VaultFormState,
  formData: FormData
): Promise<VaultFormState> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "vault", "create")) {
    return {
      status: "error",
      message: "You don't have permission to adjust vault balances.",
    };
  }

  const raw = {
    branchId: formData.get("branchId"),
    paymentMethod: formData.get("paymentMethod"),
    adjustmentAmount: formData.get("adjustmentAmount"),
    notes: formData.get("notes"),
  };

  const parsed = vaultAdjustmentSchema.safeParse(raw);
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

  const { branchId, paymentMethod, adjustmentAmount, notes } = parsed.data;

  // Branch scope: MANAGERs can only adjust their assigned branch.
  if (user.role === "MANAGER" && user.assignedLocationId !== branchId) {
    return {
      status: "error",
      message: "You can only adjust the vault for your assigned branch.",
    };
  }

  // Round to 2 d.p. — Decimal(12,2) column precision.
  const signedDecimal = new Prisma.Decimal(adjustmentAmount.toFixed(2));

  try {
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

    await prisma.$transaction(async (tx) => {
      const vaultTx = await createVaultAdjustmentInVault(tx, {
        branchId,
        paymentMethod,
        signedAmount: signedDecimal,
        notes,
        performedById: user.id,
      });

      await logAudit(
        {
          userId: user.id,
          action: "vault_adjustment.create",
          entity: "vault_transaction",
          entityId: vaultTx.id,
          details: {
            branchId,
            branchName: branch.name,
            paymentMethod,
            adjustmentAmount: signedDecimal.toFixed(2),
            notes,
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
    message: `${paymentMethod === "CASH" ? "Cash" : "Online"} balance adjusted successfully.`,
  };
}
