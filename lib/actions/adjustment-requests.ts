"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, ProductStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { canAccessLocation } from "@/lib/dal/scope";
import { withFlashMessage } from "@/lib/flash-toast";
import { getAvailableQuantity } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import {
  syncLocationCostSnapshot,
} from "@/lib/costing";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type AdjustmentRequestFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export const initialAdjustmentRequestFormState: AdjustmentRequestFormState = {
  status: "idle",
};

export type ReviewRequestState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export const initialReviewRequestState: ReviewRequestState = {
  status: "idle",
};

// ---------------------------------------------------------------------------
// Reason labels (mirrors existing adjustment form)
// ---------------------------------------------------------------------------

const adjustmentReasonLabels: Record<string, string> = {
  count_correction: "Count Correction",
  damage_loss: "Damage / Loss",
  expired: "Expired",
  other: "Other",
};

// ---------------------------------------------------------------------------
// submitAdjustmentRequestAction
// Used by MANAGER to request a stock adjustment that needs admin approval.
// ---------------------------------------------------------------------------

export async function submitAdjustmentRequestAction(
  _prevState: AdjustmentRequestFormState,
  formData: FormData
): Promise<AdjustmentRequestFormState> {
  const user = await requirePermission("adjustment_requests", "create");

  // MANAGER must have an assigned branch
  if (!user.assignedLocationId) {
    return {
      status: "error",
      message: "Your account is not assigned to a branch. Contact your admin.",
    };
  }

  const productId = String(formData.get("productId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // --- Basic validation ---
  const fieldErrors: Record<string, string[]> = {};

  if (!productId) {
    fieldErrors.productId = ["Select a product."];
  }

  if (direction !== "increase" && direction !== "decrease") {
    fieldErrors.direction = ["Select a direction."];
  }

  const quantity = parseInt(quantityRaw, 10);
  if (isNaN(quantity) || quantity < 1) {
    fieldErrors.quantity = ["Enter a whole number greater than zero."];
  }

  const validReasons = ["count_correction", "damage_loss", "expired", "other"];
  if (!validReasons.includes(reason)) {
    fieldErrors.reason = ["Select a valid reason."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the request details.",
      fieldErrors,
      values: { productId, direction, quantity: quantityRaw, reason, notes: notes ?? "" },
    };
  }

  const branchId = user.assignedLocationId;

  // --- Verify product and branch exist ---
  const [product, branch] = await Promise.all([
    prisma.product.findFirst({
      where: {
        id: productId,
        status: { in: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] },
      },
      select: { id: true, name: true, sku: true },
    }),
    prisma.stockLocation.findFirst({
      where: { id: branchId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) {
    return {
      status: "error",
      message: "The selected product is no longer available.",
      fieldErrors: { productId: ["Select a valid product."] },
      values: { productId, direction, quantity: quantityRaw, reason, notes: notes ?? "" },
    };
  }

  if (!branch) {
    return {
      status: "error",
      message: "Your assigned branch is no longer active. Contact your admin.",
    };
  }

  // --- Create the request ---
  const request = await prisma.adjustmentRequest.create({
    data: {
      branchId,
      productId: product.id,
      direction,
      quantity,
      reason,
      notes,
      requestedById: user.id,
    },
    select: { id: true },
  });

  await logAudit({
    userId: user.id,
    action: "adjustment_request.submit",
    entity: "adjustment_request",
    entityId: request.id,
    details: {
      branchId,
      branchName: branch.name,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      direction,
      quantity,
      reason,
      notes,
    },
  });

  revalidatePath("/dashboard/inventory/adjustment-requests");
  redirect(
    withFlashMessage("/dashboard/inventory/adjustment-requests", {
      success: `Adjustment request submitted for ${product.name}. Awaiting admin approval.`,
    })
  );
}

// ---------------------------------------------------------------------------
// approveAdjustmentRequestAction
// ADMIN only. Executes the pending inventory movement.
// ---------------------------------------------------------------------------

export async function approveAdjustmentRequestAction(
  _prevState: ReviewRequestState,
  formData: FormData
): Promise<ReviewRequestState> {
  const reviewer = await requirePermission("adjustment_requests", "approve");

  const requestId = String(formData.get("requestId") ?? "").trim();
  const reviewNotes = String(formData.get("reviewNotes") ?? "").trim() || null;

  if (!requestId) {
    return { status: "error", message: "Invalid request." };
  }

  // Fetch the pending request
  const request = await prisma.adjustmentRequest.findFirst({
    where: { id: requestId, status: "PENDING" },
    select: {
      id: true,
      branchId: true,
      productId: true,
      direction: true,
      quantity: true,
      reason: true,
      notes: true,
      requestedById: true,
      branch: { select: { id: true, name: true, isActive: true } },
      product: { select: { id: true, name: true, sku: true, status: true } },
    },
  });

  if (!request) {
    return {
      status: "error",
      message: "Request not found or already reviewed.",
    };
  }

  if (!request.branch.isActive) {
    return { status: "error", message: "The target branch is no longer active." };
  }

  const movementType =
    request.reason === "damage_loss" || request.reason === "expired"
      ? ("DAMAGED_LOST" as const)
      : ("MANUAL_ADJUSTMENT" as const);

  if (movementType === "DAMAGED_LOST" && request.direction === "increase") {
    return {
      status: "error",
      message: "Damage and expiry adjustments cannot be an increase. Reject this request.",
    };
  }

  const quantityChange =
    request.direction === "increase" ? request.quantity : -request.quantity;

  try {
    await prisma.$transaction(
      async (tx) => {
        // Lock the stock row
        const rows = await tx.$queryRaw<
          { id: string; quantity: number; reservedQty: number }[]
        >(Prisma.sql`
          SELECT "id", "quantity", "reservedQty"
          FROM "LocationStock"
          WHERE "locationId" = ${request.branchId}
            AND "productId" = ${request.productId}
          FOR UPDATE
        `);

        const currentStock = rows[0] ?? null;
        const currentQuantity = currentStock?.quantity ?? 0;
        const currentReservedQty = currentStock?.reservedQty ?? 0;
        const availableQty = currentStock
          ? getAvailableQuantity(currentQuantity, currentReservedQty)
          : 0;

        if (request.direction === "decrease" && availableQty < request.quantity) {
          throw new Error(
            availableQty > 0
              ? `Only ${availableQty} units are available to reduce at ${request.branch.name}.`
              : `No available stock to reduce at ${request.branch.name}.`
          );
        }

        const nextQuantity = currentQuantity + quantityChange;

        if (nextQuantity < 0) {
          throw new Error(
            `Adjustment would result in negative stock (${currentQuantity} + ${quantityChange} = ${nextQuantity}).`
          );
        }

        // Update stock
        if (currentStock) {
          await tx.locationStock.update({
            where: { id: currentStock.id },
            data: { quantity: nextQuantity },
          });
        } else {
          await tx.locationStock.create({
            data: {
              productId: request.productId,
              locationId: request.branchId,
              quantity: nextQuantity,
            },
          });
        }

        await syncLocationCostSnapshot(tx, {
          locationId: request.branchId,
          productId: request.productId,
          onHandQtySnapshot: nextQuantity,
        });

        // Record inventory movement
        await tx.inventoryMovement.create({
          data: {
            type: movementType,
            productId: request.productId,
            locationId: request.branchId,
            quantityChange,
            referenceType: "adjustment_request",
            referenceId: request.id,
            notes: [
              `Approved request from manager.`,
              `Reason: ${adjustmentReasonLabels[request.reason] ?? request.reason}`,
              request.notes ? `Notes: ${request.notes}` : null,
              reviewNotes ? `Admin notes: ${reviewNotes}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            performedById: reviewer.id,
          },
        });

        // Mark request as APPROVED
        await tx.adjustmentRequest.update({
          where: { id: request.id },
          data: {
            status: "APPROVED",
            reviewedById: reviewer.id,
            reviewedAt: new Date(),
            reviewNotes,
          },
        });

        await logAudit(
          {
            userId: reviewer.id,
            action: "adjustment_request.approve",
            entity: "adjustment_request",
            entityId: request.id,
            details: {
              branchId: request.branchId,
              branchName: request.branch.name,
              productId: request.productId,
              productName: request.product.name,
              sku: request.product.sku,
              direction: request.direction,
              quantity: request.quantity,
              quantityChange,
              reason: request.reason,
              requestedById: request.requestedById,
              previousQuantity: currentQuantity,
              nextQuantity,
              reviewNotes,
            },
          },
          tx
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return { status: "error", message };
  }

  revalidatePath("/dashboard/inventory/adjustment-requests");
  revalidatePath(`/dashboard/inventory/${request.branchId}`);
  revalidatePath("/dashboard/inventory");
  redirect(
    withFlashMessage("/dashboard/inventory/adjustment-requests", {
      success: "Adjustment approved and stock updated.",
    })
  );
}

// ---------------------------------------------------------------------------
// rejectAdjustmentRequestAction
// ADMIN only. Closes the request without touching stock.
// ---------------------------------------------------------------------------

export async function rejectAdjustmentRequestAction(
  _prevState: ReviewRequestState,
  formData: FormData
): Promise<ReviewRequestState> {
  const reviewer = await requirePermission("adjustment_requests", "approve");

  const requestId = String(formData.get("requestId") ?? "").trim();
  const reviewNotes = String(formData.get("reviewNotes") ?? "").trim() || null;

  if (!requestId) {
    return { status: "error", message: "Invalid request." };
  }

  const request = await prisma.adjustmentRequest.findFirst({
    where: { id: requestId, status: "PENDING" },
    select: {
      id: true,
      branchId: true,
      productId: true,
      direction: true,
      quantity: true,
      reason: true,
      requestedById: true,
      product: { select: { name: true, sku: true } },
      branch: { select: { name: true } },
    },
  });

  if (!request) {
    return {
      status: "error",
      message: "Request not found or already reviewed.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.adjustmentRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
        reviewNotes,
      },
    });

    await logAudit(
      {
        userId: reviewer.id,
        action: "adjustment_request.reject",
        entity: "adjustment_request",
        entityId: request.id,
        details: {
          branchId: request.branchId,
          branchName: request.branch.name,
          productId: request.productId,
          productName: request.product.name,
          sku: request.product.sku,
          direction: request.direction,
          quantity: request.quantity,
          reason: request.reason,
          requestedById: request.requestedById,
          reviewNotes,
        },
      },
      tx
    );
  });

  revalidatePath("/dashboard/inventory/adjustment-requests");
  redirect(
    withFlashMessage("/dashboard/inventory/adjustment-requests", {
      success: "Adjustment request rejected.",
    })
  );
}
