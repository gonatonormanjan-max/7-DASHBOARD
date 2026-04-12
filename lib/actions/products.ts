"use server";

import { Prisma, ProductStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/dal/auth";
import { withFlashMessage } from "@/lib/flash-toast";
import { prisma } from "@/lib/prisma";
import {
  extractProductFormValues,
  productFormSchema,
  type ProductFormState,
} from "@/lib/validators/products";

type ProductSupplierMutationInput = {
  supplierId: string;
  isPrimary: boolean;
  costPrice: number;
  leadTimeDays: number | null;
  notes: string | null;
};

function normalizeMoney(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function revalidateProductPaths(productId?: string) {
  revalidatePath("/dashboard/products");

  if (productId) {
    revalidatePath(`/dashboard/products/${productId}`);
    revalidatePath(`/dashboard/products/${productId}/edit`);
  }
}

function resolveProductActionReturnTo(returnTo?: string) {
  if (typeof returnTo === "string" && returnTo.trim().length > 0) {
    return returnTo;
  }

  return "/dashboard/products";
}

function redirectProductActionError(returnTo: string | undefined, message: string): never {
  redirect(
    withFlashMessage(resolveProductActionReturnTo(returnTo), {
      error: message,
    })
  );
}

async function validateProductRelations(
  categoryId: string,
  brandId: string | null
) {
  const [category, brand] = await Promise.all([
    prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    }),
    brandId
      ? prisma.brand.findUnique({
          where: { id: brandId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  return { category, brand };
}

function readProductSupplierRows(formData: FormData) {
  const rows: Array<{
    supplierId: string;
    isPrimary: boolean;
    costPrice: string;
    leadTimeDays: string;
    notes: string;
  }> = [];

  for (let index = 0; ; index += 1) {
    const supplierId = String(formData.get(`suppliers[${index}].supplierId`) ?? "").trim();

    if (!supplierId) {
      break;
    }

    rows.push({
      supplierId,
      isPrimary: String(formData.get(`suppliers[${index}].isPrimary`) ?? "") === "true",
      costPrice: String(formData.get(`suppliers[${index}].costPrice`) ?? "").trim(),
      leadTimeDays: String(formData.get(`suppliers[${index}].leadTimeDays`) ?? "").trim(),
      notes: String(formData.get(`suppliers[${index}].notes`) ?? "").trim(),
    });
  }

  return rows;
}

function normalizePrimarySuppliers<T extends { isPrimary: boolean }>(rows: T[]) {
  let hasPrimarySupplier = false;

  return rows.map((row) => {
    const isPrimary = row.isPrimary && !hasPrimarySupplier;

    if (isPrimary) {
      hasPrimarySupplier = true;
    }

    return {
      ...row,
      isPrimary,
    };
  });
}

async function parseProductSupplierRows(formData: FormData): Promise<
  | { status: "success"; rows: ProductSupplierMutationInput[] }
  | { status: "error"; fieldErrors: ProductFormState["fieldErrors"] }
> {
  const rawRows = normalizePrimarySuppliers(readProductSupplierRows(formData));

  if (rawRows.length === 0) {
    return {
      status: "success",
      rows: [],
    };
  }

  const seenSupplierIds = new Set<string>();
  const parsedRows: ProductSupplierMutationInput[] = [];

  for (const row of rawRows) {
    if (seenSupplierIds.has(row.supplierId)) {
      return {
        status: "error",
        fieldErrors: {
          suppliers: ["Each supplier can only be linked once."],
        },
      };
    }

    seenSupplierIds.add(row.supplierId);

    const costPrice = Number(row.costPrice);

    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      return {
        status: "error",
        fieldErrors: {
          suppliers: ["Each supplier needs a cost price greater than zero."],
        },
      };
    }

    const leadTimeDays =
      row.leadTimeDays.length === 0 ? null : Number.parseInt(row.leadTimeDays, 10);

    if (
      leadTimeDays !== null &&
      (!Number.isInteger(leadTimeDays) || leadTimeDays < 0)
    ) {
      return {
        status: "error",
        fieldErrors: {
          suppliers: ["Lead time must be a whole number of days or left blank."],
        },
      };
    }

    parsedRows.push({
      supplierId: row.supplierId,
      isPrimary: row.isPrimary,
      costPrice,
      leadTimeDays,
      notes: row.notes || null,
    });
  }

  const supplierIds = parsedRows.map((row) => row.supplierId);
  const suppliers = await prisma.supplier.findMany({
    where: {
      id: {
        in: supplierIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (suppliers.length !== supplierIds.length) {
    return {
      status: "error",
      fieldErrors: {
        suppliers: ["Select valid suppliers."],
      },
    };
  }

  return {
    status: "success",
    rows: parsedRows,
  };
}

async function getProductUniquenessConflicts(
  sku: string,
  productId?: string
) {
  const skuConflict = await prisma.product.findFirst({
    where: {
      sku,
      ...(productId ? { NOT: { id: productId } } : {}),
    },
    select: { id: true },
  });

  return { skuConflict };
}

function buildProductSupplierCreateManyData(
  productId: string,
  rows: ProductSupplierMutationInput[]
) {
  return rows.map((row) => ({
    productId,
    supplierId: row.supplierId,
    isPrimary: row.isPrimary,
    costPrice: normalizeMoney(row.costPrice),
    leadTimeDays: row.leadTimeDays,
    notes: row.notes,
  }));
}

function buildChangedFields(
  currentProduct: {
    name: string;
    sku: string;
    categoryId: string;
    brandId: string | null;
    unitPrice: Prisma.Decimal;
    costPrice: Prisma.Decimal;
    reorderLevel: number;
    imageUrl: string | null;
    description: string | null;
    status: ProductStatus;
  },
  nextValues: {
    name: string;
    sku: string;
    categoryId: string;
    brandId: string | null;
    unitPrice: Prisma.Decimal;
    costPrice: Prisma.Decimal;
    reorderLevel: number;
    imageUrl: string | null;
    description: string | null;
    status: "ACTIVE" | "INACTIVE";
  }
) {
  const changedFields: string[] = [];

  if (currentProduct.name !== nextValues.name) changedFields.push("name");
  if (currentProduct.sku !== nextValues.sku) changedFields.push("sku");
  if (currentProduct.categoryId !== nextValues.categoryId) changedFields.push("categoryId");
  if (currentProduct.brandId !== nextValues.brandId) changedFields.push("brandId");
  if (!currentProduct.unitPrice.equals(nextValues.unitPrice)) changedFields.push("unitPrice");
  if (!currentProduct.costPrice.equals(nextValues.costPrice)) changedFields.push("costPrice");
  if (currentProduct.reorderLevel !== nextValues.reorderLevel) changedFields.push("reorderLevel");
  if ((currentProduct.imageUrl ?? null) !== nextValues.imageUrl) changedFields.push("imageUrl");
  if ((currentProduct.description ?? null) !== nextValues.description) changedFields.push("description");
  if (currentProduct.status !== nextValues.status) changedFields.push("status");

  return changedFields;
}

function haveSupplierLinksChanged(
  currentSuppliers: Array<{
    supplierId: string;
    isPrimary: boolean;
    costPrice: Prisma.Decimal;
    leadTimeDays: number | null;
    notes: string | null;
  }>,
  nextSuppliers: ProductSupplierMutationInput[]
) {
  if (currentSuppliers.length !== nextSuppliers.length) {
    return true;
  }

  const sortedCurrentSuppliers = [...currentSuppliers].sort((left, right) =>
    left.supplierId.localeCompare(right.supplierId)
  );
  const sortedNextSuppliers = [...nextSuppliers].sort((left, right) =>
    left.supplierId.localeCompare(right.supplierId)
  );

  return sortedCurrentSuppliers.some((currentSupplier, index) => {
    const nextSupplier = sortedNextSuppliers[index];

    return (
      currentSupplier.supplierId !== nextSupplier.supplierId ||
      currentSupplier.isPrimary !== nextSupplier.isPrimary ||
      !currentSupplier.costPrice.equals(normalizeMoney(nextSupplier.costPrice)) ||
      currentSupplier.leadTimeDays !== nextSupplier.leadTimeDays ||
      (currentSupplier.notes ?? null) !== nextSupplier.notes
    );
  });
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requirePermission("products", "create");
  const values = extractProductFormValues(formData);
  const parsed = productFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the product details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const supplierRowsResult = await parseProductSupplierRows(formData);

  if (supplierRowsResult.status === "error") {
    return {
      status: "error",
      message: "Please fix the supplier details.",
      fieldErrors: supplierRowsResult.fieldErrors,
      values,
    };
  }

  const { category, brand } = await validateProductRelations(
    parsed.data.categoryId,
    parsed.data.brandId
  );

  if (!category) {
    return {
      status: "error",
      message: "Select a valid category.",
      fieldErrors: {
        categoryId: ["Category is required."],
      },
      values,
    };
  }

  if (parsed.data.brandId && !brand) {
    return {
      status: "error",
      message: "Select a valid brand.",
      fieldErrors: {
        brandId: ["Select a valid brand."],
      },
      values,
    };
  }

  const { skuConflict } = await getProductUniquenessConflicts(parsed.data.sku);

  if (skuConflict) {
    return {
      status: "error",
      message: "Product values must be unique.",
      fieldErrors: {
        sku: ["SKU already exists."],
      },
      values,
    };
  }

  const product = await prisma.$transaction(async (tx) => {
    const createdProduct = await tx.product.create({
      data: {
        name: parsed.data.name,
        sku: parsed.data.sku,
        categoryId: parsed.data.categoryId,
        brandId: parsed.data.brandId,
        unitPrice: normalizeMoney(parsed.data.unitPrice),
        costPrice: normalizeMoney(parsed.data.costPrice),
        reorderLevel: parsed.data.reorderLevel,
        imageUrl: parsed.data.imageUrl,
        description: parsed.data.description,
        status: parsed.data.status,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        status: true,
      },
    });

    if (supplierRowsResult.rows.length > 0) {
      await tx.productSupplier.createMany({
        data: buildProductSupplierCreateManyData(createdProduct.id, supplierRowsResult.rows),
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: "product.create",
        entity: "product",
        entityId: createdProduct.id,
        details: {
          name: createdProduct.name,
          sku: createdProduct.sku,
          status: createdProduct.status,
          supplierCount: supplierRowsResult.rows.length,
        },
      },
      tx
    );

    return createdProduct;
  });

  revalidateProductPaths();
  redirect(`/dashboard/products/${product.id}`);
}

export async function updateProductAction(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requirePermission("products", "update");
  const values = extractProductFormValues(formData);
  const parsed = productFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the product details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const supplierRowsResult = await parseProductSupplierRows(formData);

  if (supplierRowsResult.status === "error") {
    return {
      status: "error",
      message: "Please fix the supplier details.",
      fieldErrors: supplierRowsResult.fieldErrors,
      values,
    };
  }

  const currentProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      categoryId: true,
      brandId: true,
      unitPrice: true,
      costPrice: true,
      reorderLevel: true,
      imageUrl: true,
      description: true,
      status: true,
      suppliers: {
        select: {
          supplierId: true,
          isPrimary: true,
          costPrice: true,
          leadTimeDays: true,
          notes: true,
        },
      },
    },
  });

  if (!currentProduct) {
    notFound();
  }

  const { category, brand } = await validateProductRelations(
    parsed.data.categoryId,
    parsed.data.brandId
  );

  if (!category) {
    return {
      status: "error",
      message: "Select a valid category.",
      fieldErrors: { categoryId: ["Category is required."] },
      values,
    };
  }

  if (parsed.data.brandId && !brand) {
    return {
      status: "error",
      message: "Select a valid brand.",
      fieldErrors: { brandId: ["Select a valid brand."] },
      values,
    };
  }

  const { skuConflict } = await getProductUniquenessConflicts(parsed.data.sku, productId);

  if (skuConflict) {
    return {
      status: "error",
      message: "Product values must be unique.",
      fieldErrors: { sku: ["SKU already exists."] },
      values,
    };
  }

  const nextValues = {
    name: parsed.data.name,
    sku: parsed.data.sku,
    categoryId: parsed.data.categoryId,
    brandId: parsed.data.brandId,
    unitPrice: normalizeMoney(parsed.data.unitPrice),
    costPrice: normalizeMoney(parsed.data.costPrice),
    reorderLevel: parsed.data.reorderLevel,
    imageUrl: parsed.data.imageUrl,
    description: parsed.data.description,
    status: parsed.data.status,
  };

  const changedFields = buildChangedFields(currentProduct, nextValues);
  const suppliersChanged = haveSupplierLinksChanged(
    currentProduct.suppliers,
    supplierRowsResult.rows
  );

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: nextValues,
    });

    if (suppliersChanged) {
      await tx.productSupplier.deleteMany({ where: { productId } });

      if (supplierRowsResult.rows.length > 0) {
        await tx.productSupplier.createMany({
          data: buildProductSupplierCreateManyData(productId, supplierRowsResult.rows),
        });
      }
    }

    if (changedFields.length > 0 || suppliersChanged) {
      await logAudit(
        {
          userId: user.id,
          action: "product.update",
          entity: "product",
          entityId: productId,
          details: {
            changedFields,
            suppliersChanged,
          },
        },
        tx
      );
    }
  });

  revalidateProductPaths(productId);
  redirect(`/dashboard/products/${productId}`);
}

export async function archiveProductAction(productId: string, returnTo?: string): Promise<void> {
  const user = await requirePermission("products", "update");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, sku: true, status: true },
  });

  if (!product) {
    redirectProductActionError(returnTo, "Product not found.");
  }

  if (product.status === ProductStatus.ARCHIVED) {
    redirectProductActionError(returnTo, "Product is already archived.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { status: ProductStatus.ARCHIVED },
    });

    await logAudit(
      {
        userId: user.id,
        action: "product.archive",
        entity: "product",
        entityId: productId,
        details: { name: product.name, sku: product.sku },
      },
      tx
    );
  });

  revalidateProductPaths(productId);
  redirect(
    withFlashMessage(resolveProductActionReturnTo(returnTo), {
      success: `${product.name} archived.`,
    })
  );
}

export async function deactivateProductAction(productId: string, returnTo?: string): Promise<void> {
  const user = await requirePermission("products", "update");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, sku: true, status: true },
  });

  if (!product) {
    redirectProductActionError(returnTo, "Product not found.");
  }

  if (product.status !== ProductStatus.ACTIVE) {
    redirectProductActionError(returnTo, "Only active products can be deactivated.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { status: ProductStatus.INACTIVE },
    });

    await logAudit(
      {
        userId: user.id,
        action: "product.deactivate",
        entity: "product",
        entityId: productId,
        details: { name: product.name, sku: product.sku },
      },
      tx
    );
  });

  revalidateProductPaths(productId);
  redirect(
    withFlashMessage(resolveProductActionReturnTo(returnTo), {
      success: `${product.name} deactivated.`,
    })
  );
}

export async function restoreProductAction(productId: string, returnTo?: string): Promise<void> {
  const user = await requirePermission("products", "update");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, sku: true, status: true },
  });

  if (!product) {
    redirectProductActionError(returnTo, "Product not found.");
  }

  if (product.status !== ProductStatus.ARCHIVED) {
    redirectProductActionError(returnTo, "Only archived products can be restored.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { status: ProductStatus.ACTIVE },
    });

    await logAudit(
      {
        userId: user.id,
        action: "product.restore",
        entity: "product",
        entityId: productId,
        details: { name: product.name, sku: product.sku },
      },
      tx
    );
  });

  revalidateProductPaths(productId);
  redirect(
    withFlashMessage(resolveProductActionReturnTo(returnTo), {
      success: `${product.name} restored.`,
    })
  );
}
