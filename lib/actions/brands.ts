"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import {
  brandFormSchema,
  extractBrandFormValues,
  type BrandFormData,
  type BrandFormState,
} from "@/lib/validators/brands";

function revalidateBrandPaths(brandId?: string) {
  revalidatePath("/dashboard/categories/brands");
  revalidatePath("/dashboard/categories/brands/new");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/products/new");
  revalidatePath("/dashboard/products/[id]", "page");
  revalidatePath("/dashboard/products/[id]/edit", "page");
  revalidatePath("/dashboard/inventory");

  if (brandId) {
    revalidatePath(`/dashboard/categories/brands/${brandId}`);
    revalidatePath(`/dashboard/categories/brands/${brandId}/edit`);
  }
}

async function findBrandNameConflict(name: string, brandId?: string) {
  return prisma.brand.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
      ...(brandId ? { NOT: { id: brandId } } : {}),
    },
    select: {
      id: true,
    },
  });
}

function buildBrandChangedFields(
  currentBrand: {
    name: string;
    description: string | null;
  },
  nextBrand: BrandFormData
) {
  const changedFields: string[] = [];

  if (currentBrand.name !== nextBrand.name) {
    changedFields.push("name");
  }

  if ((currentBrand.description ?? null) !== nextBrand.description) {
    changedFields.push("description");
  }

  return changedFields;
}

export async function createBrandAction(
  _prevState: BrandFormState,
  formData: FormData
): Promise<BrandFormState> {
  const user = await requirePermission("categories", "create");
  const values = extractBrandFormValues(formData);
  const parsed = brandFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the brand details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const duplicate = await findBrandNameConflict(parsed.data.name);

  if (duplicate) {
    return {
      status: "error",
      message: "Brand name must be unique.",
      fieldErrors: {
        name: ["A brand with that name already exists."],
      },
      values,
    };
  }

  const brand = await prisma.$transaction(async (tx) => {
    const createdBrand = await tx.brand.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
      select: {
        id: true,
        name: true,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: "brand.create",
        entity: "brand",
        entityId: createdBrand.id,
        details: {
          name: createdBrand.name,
          source: "brands.module",
        },
      },
      tx
    );

    return createdBrand;
  });

  revalidateBrandPaths(brand.id);
  redirect(
    withFlashMessage(`/dashboard/categories/brands/${brand.id}`, {
      success: "Brand created.",
    })
  );
}

export async function updateBrandAction(
  brandId: string,
  _prevState: BrandFormState,
  formData: FormData
): Promise<BrandFormState> {
  const user = await requirePermission("categories", "update");
  const values = extractBrandFormValues(formData);
  const parsed = brandFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the brand details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const currentBrand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (!currentBrand) {
    notFound();
  }

  const duplicate = await findBrandNameConflict(parsed.data.name, brandId);

  if (duplicate) {
    return {
      status: "error",
      message: "Brand name must be unique.",
      fieldErrors: {
        name: ["A brand with that name already exists."],
      },
      values,
    };
  }

  const changedFields = buildBrandChangedFields(currentBrand, parsed.data);

  await prisma.$transaction(async (tx) => {
    await tx.brand.update({
      where: { id: brandId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: "brand.update",
        entity: "brand",
        entityId: brandId,
        details: {
          changedFields,
          name: parsed.data.name,
        },
      },
      tx
    );
  });

  revalidateBrandPaths(brandId);
  redirect(
    withFlashMessage(`/dashboard/categories/brands/${brandId}`, {
      success: "Brand updated.",
    })
  );
}

export async function deleteBrandAction(
  _prevState: BrandFormState,
  formData: FormData
): Promise<BrandFormState> {
  const user = await requirePermission("categories", "delete");
  const brandId = String(formData.get("brandId") ?? "");
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  if (!brand) {
    notFound();
  }

  if (brand._count.products > 0) {
    return {
      status: "error",
      message:
        "Cannot delete a brand that has products assigned. Reassign or remove products first.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.brand.delete({
      where: { id: brand.id },
    });

    await logAudit(
      {
        userId: user.id,
        action: "brand.delete",
        entity: "brand",
        entityId: brand.id,
        details: {
          name: brand.name,
        },
      },
      tx
    );
  });

  revalidateBrandPaths();
  redirect(
    withFlashMessage("/dashboard/categories/brands", {
      success: "Brand deleted.",
    })
  );
}
