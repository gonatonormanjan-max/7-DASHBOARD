"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import {
  categoryFormSchema,
  extractCategoryFormValues,
  type CategoryFormState,
} from "@/lib/validators/categories";
import {
  extractInlineCategoryValues,
  inlineCategorySchema,
  type InlineCategoryState,
} from "@/lib/validators/products";

function revalidateCategoryPaths(categoryId?: string) {
  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/products");

  if (categoryId) {
    revalidatePath(`/dashboard/categories/${categoryId}`);
    revalidatePath(`/dashboard/categories/${categoryId}/edit`);
  }
}

async function findCategoryNameConflict(name: string, categoryId?: string) {
  return prisma.category.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
      ...(categoryId ? { NOT: { id: categoryId } } : {}),
    },
    select: {
      id: true,
    },
  });
}

function buildCategoryChangedFields(
  currentCategory: {
    name: string;
    description: string | null;
  },
  nextCategory: {
    name: string;
    description: string | null;
  }
) {
  const changedFields: string[] = [];

  if (currentCategory.name !== nextCategory.name) {
    changedFields.push("name");
  }

  if ((currentCategory.description ?? null) !== nextCategory.description) {
    changedFields.push("description");
  }

  return changedFields;
}

export async function createCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const user = await requirePermission("categories", "create");
  const values = extractCategoryFormValues(formData);
  const parsed = categoryFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the category details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const duplicate = await findCategoryNameConflict(parsed.data.name);

  if (duplicate) {
    return {
      status: "error",
      message: "Category name must be unique.",
      fieldErrors: {
        name: ["A category with that name already exists."],
      },
      values,
    };
  }

  const category = await prisma.$transaction(async (tx) => {
    const createdCategory = await tx.category.create({
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
        action: "category.create",
        entity: "category",
        entityId: createdCategory.id,
        details: {
          name: createdCategory.name,
          source: "categories.module",
        },
      },
      tx
    );

    return createdCategory;
  });

  revalidateCategoryPaths(category.id);
  redirect(
    withFlashMessage(`/dashboard/categories/${category.id}`, {
      success: "Category created.",
    })
  );
}

export async function updateCategoryAction(
  categoryId: string,
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const user = await requirePermission("categories", "update");
  const values = extractCategoryFormValues(formData);
  const parsed = categoryFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the category details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const currentCategory = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (!currentCategory) {
    notFound();
  }

  const duplicate = await findCategoryNameConflict(parsed.data.name, categoryId);

  if (duplicate) {
    return {
      status: "error",
      message: "Category name must be unique.",
      fieldErrors: {
        name: ["A category with that name already exists."],
      },
      values,
    };
  }

  const changedFields = buildCategoryChangedFields(currentCategory, parsed.data);

  await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id: categoryId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: "category.update",
        entity: "category",
        entityId: categoryId,
        details: {
          changedFields,
          name: parsed.data.name,
        },
      },
      tx
    );
  });

  revalidateCategoryPaths(categoryId);
  redirect(
    withFlashMessage(`/dashboard/categories/${categoryId}`, {
      success: "Category updated.",
    })
  );
}

export async function deleteCategoryAction(
  categoryId: string,
  returnTo: string,
  formData: FormData
) {
  void formData;
  const user = await requirePermission("categories", "delete");
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
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

  if (!category) {
    notFound();
  }

  if (category._count.products > 0) {
    redirect(
      withFlashMessage(returnTo, {
        error: "This category cannot be deleted while products are still assigned to it.",
      })
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.delete({
      where: { id: categoryId },
    });

    await logAudit(
      {
        userId: user.id,
        action: "category.delete",
        entity: "category",
        entityId: category.id,
        details: {
          name: category.name,
        },
      },
      tx
    );
  });

  revalidateCategoryPaths();
  redirect(
    withFlashMessage("/dashboard/categories", {
      success: "Category deleted.",
    })
  );
}

export async function createInlineCategoryAction(
  _prevState: InlineCategoryState,
  formData: FormData
): Promise<InlineCategoryState> {
  const user = await requirePermission("categories", "create");
  const values = extractInlineCategoryValues(formData);
  const parsed = inlineCategorySchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the category details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const duplicate = await prisma.category.findFirst({
    where: {
      name: {
        equals: parsed.data.name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (duplicate) {
    return {
      status: "error",
      message: "A category with that name already exists.",
      fieldErrors: {
        name: ["Category name must be unique."],
      },
      values,
    };
  }

  const category = await prisma.$transaction(async (tx) => {
    const createdCategory = await tx.category.create({
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
        action: "category.create",
        entity: "category",
        entityId: createdCategory.id,
        details: {
          name: createdCategory.name,
          source: "products.inline-modal",
        },
      },
      tx
    );

    return createdCategory;
  });

  revalidateCategoryPaths();

  return {
    status: "success",
    message: "Category created.",
    createdCategory: category,
  };
}
