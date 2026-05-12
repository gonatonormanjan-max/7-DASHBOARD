import "server-only";

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";

const MAX_PRODUCT_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type ResolveProductImageUrlInput = {
  formData: FormData;
  currentImageUrl: string | null;
  sku: string;
};

type ResolveProductImageUrlResult =
  | { status: "success"; imageUrl: string | null }
  | { status: "error"; message: string };

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "type" in value &&
    "arrayBuffer" in value
  );
}

function slugifySku(sku: string) {
  return sku
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function validateProductImageFile(file: File): string | null {
  if (file.size <= 0) {
    return null;
  }

  if (!ALLOWED_PRODUCT_IMAGE_TYPES.has(file.type)) {
    return "Upload a JPG, PNG, or WebP image.";
  }

  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return "Product image must be 4 MB or smaller.";
  }

  return null;
}

export async function resolveProductImageUrl({
  formData,
  currentImageUrl,
  sku,
}: ResolveProductImageUrlInput): Promise<ResolveProductImageUrlResult> {
  const fileEntry = formData.get("imageFile");
  const removeCurrentImage = String(formData.get("removeImage") ?? "") === "true";

  if (!isUploadedFile(fileEntry) || fileEntry.size <= 0) {
    return {
      status: "success",
      imageUrl: removeCurrentImage ? null : currentImageUrl,
    };
  }

  const validationError = validateProductImageFile(fileEntry);

  if (validationError) {
    return {
      status: "error",
      message: validationError,
    };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      status: "error",
      message: "Product image storage is not configured. Add BLOB_READ_WRITE_TOKEN before uploading images.",
    };
  }

  const extension = ALLOWED_PRODUCT_IMAGE_TYPES.get(fileEntry.type) ?? "jpg";
  const safeSku = slugifySku(sku) || "product";
  const pathname = `products/${safeSku}-${randomUUID()}.${extension}`;

  try {
    const blob = await put(pathname, fileEntry, {
      access: "public",
    });

    return {
      status: "success",
      imageUrl: blob.url,
    };
  } catch {
    return {
      status: "error",
      message: "Image upload failed. Please try again before saving this product.",
    };
  }
}
