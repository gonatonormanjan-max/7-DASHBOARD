"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import { prisma } from "@/lib/prisma";
import {
  checkSupplierNameConflict,
  getSupplierById,
} from "@/lib/dal/suppliers";
import {
  supplierFormSchema,
  inlineSupplierSchema,
  extractSupplierFormValues,
  extractInlineSupplierValues,
  initialSupplierFormState,
  type SupplierFormState,
  type InlineSupplierState,
} from "@/lib/validators/suppliers";

function revalidateSupplierPaths(supplierId?: string) {
  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/purchase-orders/new");

  if (supplierId) {
    revalidatePath(`/dashboard/suppliers/${supplierId}`);
    revalidatePath(`/dashboard/suppliers/${supplierId}/edit`);
  }
}

export async function createSupplierAction(
  _prevState: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  const user = await requirePermission("suppliers", "create");
  const values = extractSupplierFormValues(formData);
  const parsed = supplierFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the supplier details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const duplicate = await checkSupplierNameConflict(parsed.data.name);

  if (duplicate) {
    return {
      status: "error",
      message: "A supplier with that name already exists.",
      fieldErrors: { name: ["A supplier with that name already exists."] },
      values,
    };
  }

  const supplier = await prisma.$transaction(async (tx) => {
    const created = await tx.supplier.create({
      data: {
        name: parsed.data.name,
        contactName: parsed.data.contactName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        address: parsed.data.address,
        isActive: parsed.data.isActive,
      },
      select: { id: true, name: true },
    });

    await logAudit(
      {
        userId: user.id,
        action: "supplier.create",
        entity: "supplier",
        entityId: created.id,
        details: { name: created.name, isActive: parsed.data.isActive },
      },
      tx
    );

    return created;
  });

  revalidateSupplierPaths(supplier.id);
  redirect(
    withFlashMessage(`/dashboard/suppliers/${supplier.id}`, {
      success: "Supplier created.",
    })
  );
}

export async function updateSupplierAction(
  supplierId: string,
  _prevState: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  const user = await requirePermission("suppliers", "update");
  const values = extractSupplierFormValues(formData);
  const parsed = supplierFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the supplier details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const existing = await getSupplierById(supplierId);

  if (!existing) {
    return {
      status: "error",
      message: "Supplier not found.",
      values,
    };
  }

  const duplicate = await checkSupplierNameConflict(parsed.data.name, supplierId);

  if (duplicate) {
    return {
      status: "error",
      message: "A supplier with that name already exists.",
      fieldErrors: { name: ["A supplier with that name already exists."] },
      values,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.supplier.update({
      where: { id: supplierId },
      data: {
        name: parsed.data.name,
        contactName: parsed.data.contactName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        address: parsed.data.address,
        isActive: parsed.data.isActive,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: "supplier.update",
        entity: "supplier",
        entityId: supplierId,
        details: {
          name: parsed.data.name,
          isActive: parsed.data.isActive,
        },
      },
      tx
    );
  });

  revalidateSupplierPaths(supplierId);
  redirect(
    withFlashMessage(`/dashboard/suppliers/${supplierId}`, {
      success: "Supplier updated.",
    })
  );
}

export async function toggleSupplierStatusAction(
  supplierId: string
): Promise<{ status: "success" | "error"; message: string }> {
  const user = await requirePermission("suppliers", "update");

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true, isActive: true },
  });

  if (!supplier) {
    return { status: "error", message: "Supplier not found." };
  }

  const nextActive = !supplier.isActive;

  await prisma.$transaction(async (tx) => {
    await tx.supplier.update({
      where: { id: supplierId },
      data: { isActive: nextActive },
    });

    await logAudit(
      {
        userId: user.id,
        action: nextActive ? "supplier.activate" : "supplier.deactivate",
        entity: "supplier",
        entityId: supplierId,
        details: { name: supplier.name, isActive: nextActive },
      },
      tx
    );
  });

  revalidateSupplierPaths(supplierId);

  return {
    status: "success",
    message: nextActive
      ? `${supplier.name} is now active.`
      : `${supplier.name} has been deactivated.`,
  };
}

export async function createInlineSupplierAction(
  _prevState: InlineSupplierState,
  formData: FormData
): Promise<InlineSupplierState> {
  const user = await requirePermission("suppliers", "create");
  const values = extractInlineSupplierValues(formData);
  const parsed = inlineSupplierSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the supplier details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const duplicate = await checkSupplierNameConflict(parsed.data.name);

  if (duplicate) {
    return {
      status: "error",
      message: "A supplier with that name already exists.",
      fieldErrors: { name: ["A supplier with that name already exists."] },
      values,
    };
  }

  const supplier = await prisma.$transaction(async (tx) => {
    const created = await tx.supplier.create({
      data: {
        name: parsed.data.name,
        contactName: parsed.data.contactName,
        email: parsed.data.email,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    await logAudit(
      {
        userId: user.id,
        action: "supplier.create",
        entity: "supplier",
        entityId: created.id,
        details: { name: created.name, source: "purchase-orders.inline-modal" },
      },
      tx
    );

    return created;
  });

  revalidateSupplierPaths();

  return {
    status: "success",
    message: "Supplier created.",
    createdSupplier: supplier,
  };
}
