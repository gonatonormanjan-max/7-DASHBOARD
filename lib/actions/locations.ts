"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { withFlashMessage } from "@/lib/flash-toast";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import {
  extractLocationFormValues,
  initialLocationFormState,
  locationFormSchema,
  type LocationFormData,
  type LocationFormState,
} from "@/lib/validators/locations";

function revalidateLocationPaths(locationId?: string) {
  revalidatePath("/dashboard/locations");
  revalidatePath("/dashboard/locations/new");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/users/new");

  if (locationId) {
    revalidatePath(`/dashboard/locations/${locationId}`);
    revalidatePath(`/dashboard/locations/${locationId}/edit`);
  }
}

async function findLocationNameConflict(name: string, locationId?: string) {
  return prisma.stockLocation.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
      ...(locationId ? { NOT: { id: locationId } } : {}),
    },
    select: {
      id: true,
    },
  });
}

async function findLocationCodeConflict(code: string, locationId?: string) {
  return prisma.stockLocation.findFirst({
    where: {
      code: {
        equals: code,
        mode: "insensitive",
      },
      ...(locationId ? { NOT: { id: locationId } } : {}),
    },
    select: {
      id: true,
    },
  });
}

function buildLocationChangedFields(
  currentLocation: {
    name: string;
    code: string;
    type: "WAREHOUSE" | "BRANCH";
    address: string | null;
    managerName: string | null;
    contactNumber: string | null;
  },
  nextLocation: LocationFormData
) {
  const changedFields: string[] = [];

  if (currentLocation.name !== nextLocation.name) {
    changedFields.push("name");
  }

  if (currentLocation.code !== nextLocation.code) {
    changedFields.push("code");
  }

  if (currentLocation.type !== nextLocation.type) {
    changedFields.push("type");
  }

  if ((currentLocation.address ?? null) !== nextLocation.address) {
    changedFields.push("address");
  }

  if ((currentLocation.managerName ?? null) !== nextLocation.managerName) {
    changedFields.push("managerName");
  }

  if ((currentLocation.contactNumber ?? null) !== nextLocation.contactNumber) {
    changedFields.push("contactNumber");
  }

  return changedFields;
}

export async function createLocationAction(
  _prevState: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const user = await requirePermission("locations", "create");
  const values = extractLocationFormValues(formData);
  const parsed = locationFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the location details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const [nameConflict, codeConflict] = await Promise.all([
    findLocationNameConflict(parsed.data.name),
    findLocationCodeConflict(parsed.data.code),
  ]);

  if (nameConflict) {
    return {
      status: "error",
      message: "Location name must be unique.",
      fieldErrors: {
        name: ["A location with that name already exists."],
      },
      values,
    };
  }

  if (codeConflict) {
    return {
      status: "error",
      message: "Location code must be unique.",
      fieldErrors: {
        code: ["A location with that code already exists."],
      },
      values,
    };
  }

  const location = await prisma.$transaction(async (tx) => {
    const createdLocation = await tx.stockLocation.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        type: parsed.data.type,
        address: parsed.data.address,
        managerName: parsed.data.managerName,
        contactNumber: parsed.data.contactNumber,
      },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: "location.create",
        entity: "stock_location",
        entityId: createdLocation.id,
        details: {
          name: createdLocation.name,
          code: createdLocation.code,
          type: createdLocation.type,
          source: "locations.module",
        },
      },
      tx
    );

    return createdLocation;
  });

  revalidateLocationPaths(location.id);
  redirect(
    withFlashMessage(`/dashboard/locations/${location.id}`, {
      success: "Location created.",
    })
  );
}

export async function updateLocationAction(
  _prevState: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const user = await requirePermission("locations", "update");
  const locationId = String(formData.get("locationId") ?? "");
  const currentLocation = await prisma.stockLocation.findUnique({
    where: { id: locationId },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      address: true,
      managerName: true,
      contactNumber: true,
    },
  });

  if (!currentLocation) {
    notFound();
  }

  const values = extractLocationFormValues(formData);
  const parsed = locationFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the location details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const [nameConflict, codeConflict] = await Promise.all([
    findLocationNameConflict(parsed.data.name, currentLocation.id),
    findLocationCodeConflict(parsed.data.code, currentLocation.id),
  ]);

  if (nameConflict) {
    return {
      status: "error",
      message: "Location name must be unique.",
      fieldErrors: {
        name: ["A location with that name already exists."],
      },
      values,
    };
  }

  if (codeConflict) {
    return {
      status: "error",
      message: "Location code must be unique.",
      fieldErrors: {
        code: ["A location with that code already exists."],
      },
      values,
    };
  }

  const nextLocation: LocationFormData = { ...parsed.data };
  const changedFields = buildLocationChangedFields(currentLocation, nextLocation);

  await prisma.$transaction(async (tx) => {
    await tx.stockLocation.update({
      where: { id: currentLocation.id },
      data: {
        name: nextLocation.name,
        code: nextLocation.code,
        type: nextLocation.type,
        address: nextLocation.address,
        managerName: nextLocation.managerName,
        contactNumber: nextLocation.contactNumber,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: "location.update",
        entity: "stock_location",
        entityId: currentLocation.id,
        details: {
          name: nextLocation.name,
          code: nextLocation.code,
          type: nextLocation.type,
          previousType: changedFields.includes("type") ? currentLocation.type : undefined,
          changedFields,
        },
      },
      tx
    );
  });

  revalidateLocationPaths(currentLocation.id);
  redirect(
    withFlashMessage(`/dashboard/locations/${currentLocation.id}`, {
      success: "Location updated.",
    })
  );
}

export async function toggleLocationActiveAction(
  _prevState: LocationFormState,
  formData: FormData
): Promise<LocationFormState> {
  const user = await requirePermission("locations", "update");
  const locationId = String(formData.get("locationId") ?? "");
  const targetIsActive = String(formData.get("targetIsActive") ?? "") === "true";
  const returnTo = String(formData.get("returnTo") ?? "") || "/dashboard/locations";

  const currentLocation = await prisma.stockLocation.findUnique({
    where: { id: locationId },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  });

  if (!currentLocation) {
    return {
      ...initialLocationFormState,
      status: "error",
      message: "Location not found.",
    };
  }

  const remainingStockCount = await prisma.$transaction(async (tx) => {
    const stockedProducts = targetIsActive
      ? 0
      : await tx.locationStock.count({
          where: {
            locationId: currentLocation.id,
            quantity: {
              gt: 0,
            },
          },
        });

    await tx.stockLocation.update({
      where: { id: currentLocation.id },
      data: {
        isActive: targetIsActive,
      },
    });

    await logAudit(
      {
        userId: user.id,
        action: targetIsActive ? "location.activate" : "location.deactivate",
        entity: "stock_location",
        entityId: currentLocation.id,
        details: {
          previousIsActive: currentLocation.isActive,
          nextIsActive: targetIsActive,
          stockedProducts,
        },
      },
      tx
    );

    return stockedProducts;
  });

  revalidateLocationPaths(currentLocation.id);

  if (targetIsActive) {
    redirect(
      withFlashMessage(returnTo, {
        success: "Location activated.",
      })
    );
  }

  if (remainingStockCount > 0) {
    redirect(
      withFlashMessage(returnTo, {
        success: `Location deactivated. Warning: ${remainingStockCount} products still have stock at this location. Transfer stock out before fully retiring it.`,
      })
    );
  }

  redirect(
    withFlashMessage(returnTo, {
      success: "Location deactivated.",
    })
  );
}
