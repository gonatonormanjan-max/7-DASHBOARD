"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal/auth";
import { canAccessLocation } from "@/lib/dal/scope";
import { logAudit } from "@/lib/audit";

// ────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ────────────────────────────────────────────────────────────────────────────

const setPriceSchema = z.object({
  productId: z.string().min(1, "Product ID is required."),
  locationId: z.string().min(1, "Branch ID is required."),
  price: z
    .string()
    .trim()
    .refine((v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) && n >= 0;
    }, "Price must be a valid non-negative number.")
    .transform((v) => parseFloat(v)),
});

const deletePriceSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
});

// ────────────────────────────────────────────────────────────────────────────
// Action: set (upsert) a branch-level price override
// ────────────────────────────────────────────────────────────────────────────

export type BranchPricingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function setLocationProductPriceAction(
  _prev: BranchPricingActionState,
  formData: FormData
): Promise<BranchPricingActionState> {
  const user = await requirePermission("branch_pricing", "update");

  const raw = {
    productId: String(formData.get("productId") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
    price: String(formData.get("price") ?? ""),
  };

  const parsed = setPriceSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }

  const { productId, locationId, price } = parsed.data;

  // Branch-scope guard: MANAGER may only manage their own branch.
  if (!canAccessLocation(user, locationId)) {
    return {
      status: "error",
      message: "You can only manage pricing for your assigned branch.",
    };
  }

  // Use raw SQL so this works even when the Prisma client has not been
  // regenerated after the migration. The upsert ensures idempotency.
  try {
    await prisma.$executeRaw`
      INSERT INTO "LocationProductPrice" (id, "locationId", "productId", price, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${locationId}, ${productId}, ${price}, NOW(), NOW())
      ON CONFLICT ("locationId", "productId")
      DO UPDATE SET price = EXCLUDED.price, "updatedAt" = NOW()
    `;
  } catch {
    return {
      status: "error",
      message:
        "Branch pricing table is not ready yet. Run `npx prisma migrate dev` locally, then deploy.",
    };
  }

  await logAudit({
    userId: user.id,
    action: "branch_pricing.set",
    entity: "location_product_price",
    entityId: `${locationId}:${productId}`,
    details: { locationId, productId, price: price.toString() },
  });

  revalidatePath(`/dashboard/products/${productId}`);

  return { status: "success", message: "Branch price saved." };
}

// ────────────────────────────────────────────────────────────────────────────
// Action: remove a branch-level price override (falls back to global price)
// ────────────────────────────────────────────────────────────────────────────

export async function deleteLocationProductPriceAction(
  formData: FormData
): Promise<{ status: "success" | "error"; message?: string }> {
  const user = await requirePermission("branch_pricing", "delete");

  const raw = {
    productId: String(formData.get("productId") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
  };

  const parsed = deletePriceSchema.safeParse(raw);

  if (!parsed.success) {
    return { status: "error", message: "Missing required fields." };
  }

  const { productId, locationId } = parsed.data;

  if (!canAccessLocation(user, locationId)) {
    return {
      status: "error",
      message: "You can only manage pricing for your assigned branch.",
    };
  }

  try {
    await prisma.$executeRaw`
      DELETE FROM "LocationProductPrice"
      WHERE "locationId" = ${locationId}
        AND "productId"  = ${productId}
    `;
  } catch {
    return {
      status: "error",
      message: "Branch pricing table is not ready yet.",
    };
  }

  await logAudit({
    userId: user.id,
    action: "branch_pricing.delete",
    entity: "location_product_price",
    entityId: `${locationId}:${productId}`,
    details: { locationId, productId },
  });

  revalidatePath(`/dashboard/products/${productId}`);

  return { status: "success" };
}
