"use server";

import { LocationType, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { withFlashMessage } from "@/lib/flash-toast";
import { requirePermission } from "@/lib/dal/auth";
import { prisma } from "@/lib/prisma";
import { canManageTargetUser, getAssignableRolesForActor } from "@/lib/users";
import {
  createUserFormSchema,
  extractUserFormValues,
  updateUserFormSchema,
  type UserFormState,
} from "@/lib/validators/users";

function revalidateUserPaths() {
  revalidatePath("/dashboard/users");
}

async function findUserByEmail(email: string, userId?: string) {
  return prisma.user.findFirst({
    where: {
      email,
      ...(userId ? { NOT: { id: userId } } : {}),
    },
    select: {
      id: true,
    },
  });
}

async function resolveAssignedLocation(role: Role, assignedLocationId?: string) {
  if (role !== "MANAGER") {
    return {
      assignedLocationId: null,
      assignedLocationName: null,
    };
  }

  if (!assignedLocationId) {
    return null;
  }

  const branch = await prisma.stockLocation.findFirst({
    where: {
      id: assignedLocationId,
      isActive: true,
      type: LocationType.BRANCH,
    },
    select: {
      id: true,
      name: true,
    },
  });

  return branch
    ? {
        assignedLocationId: branch.id,
        assignedLocationName: branch.name,
      }
    : null;
}

function buildChangedFields(
  currentUser: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    assignedLocationId: string | null;
    isActive: boolean;
  },
  nextUser: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    assignedLocationId: string | null;
    isActive: boolean;
  },
  passwordChanged: boolean
) {
  const changedFields: string[] = [];

  if (currentUser.firstName !== nextUser.firstName) changedFields.push("firstName");
  if (currentUser.lastName !== nextUser.lastName) changedFields.push("lastName");
  if (currentUser.email !== nextUser.email) changedFields.push("email");
  if (currentUser.role !== nextUser.role) changedFields.push("role");
  if (currentUser.assignedLocationId !== nextUser.assignedLocationId) {
    changedFields.push("assignedLocationId");
  }
  if (currentUser.isActive !== nextUser.isActive) changedFields.push("isActive");
  if (passwordChanged) changedFields.push("password");

  return changedFields;
}

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const actor = await requirePermission("users", "create");
  const values = extractUserFormValues(formData);
  const parsed = createUserFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the user details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const assignableRoles = getAssignableRolesForActor(actor.role);

  if (!assignableRoles.includes(parsed.data.role)) {
    return {
      status: "error",
      message: "You cannot assign that role.",
      fieldErrors: {
        role: ["Choose a role you are allowed to assign."],
      },
      values,
    };
  }

  const existingUser = await findUserByEmail(parsed.data.email);

  if (existingUser) {
    return {
      status: "error",
      message: "A user with that email already exists.",
      fieldErrors: {
        email: ["Email address must be unique."],
      },
      values,
    };
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  const assignedLocation = await resolveAssignedLocation(
    parsed.data.role,
    parsed.data.assignedLocationId
  );

  if (!assignedLocation) {
    return {
      status: "error",
      message: "Manager accounts must be assigned to an active branch.",
      fieldErrors: {
        assignedLocationId: ["Choose an active branch for this manager."],
      },
      values,
    };
  }

  await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        hashedPassword,
        role: parsed.data.role,
        isActive: parsed.data.isActive,
        assignedLocationId: assignedLocation.assignedLocationId,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    await logAudit(
      {
        userId: actor.id,
        action: "user.create",
        entity: "user",
        entityId: createdUser.id,
        details: {
          email: createdUser.email,
          role: createdUser.role,
          assignedLocationName: assignedLocation.assignedLocationName,
        },
      },
      tx
    );
  });

  revalidateUserPaths();
  redirect(
    withFlashMessage("/dashboard/users", {
      success: "User account created.",
    })
  );
}

export async function updateUserAction(
  userId: string,
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const actor = await requirePermission("users", "update");
  const values = extractUserFormValues(formData);
  const parsed = updateUserFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the user details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      assignedLocationId: true,
      isActive: true,
    },
  });

  if (!currentUser) {
    notFound();
  }

  if (!canManageTargetUser(actor.role, currentUser.role)) {
    return {
      status: "error",
      message: "You cannot manage that account.",
      values,
    };
  }

  const assignableRoles = getAssignableRolesForActor(actor.role);

  if (!assignableRoles.includes(parsed.data.role)) {
    return {
      status: "error",
      message: "You cannot assign that role.",
      fieldErrors: {
        role: ["Choose a role you are allowed to assign."],
      },
      values,
    };
  }

  if (
    actor.id === userId &&
    (parsed.data.role !== currentUser.role || parsed.data.isActive !== currentUser.isActive)
  ) {
    return {
      status: "error",
      message: "You cannot change your own role or active status from this screen.",
      values,
    };
  }

  const existingUser = await findUserByEmail(parsed.data.email, userId);

  if (existingUser) {
    return {
      status: "error",
      message: "A user with that email already exists.",
      fieldErrors: {
        email: ["Email address must be unique."],
      },
      values,
    };
  }

  const passwordChanged = Boolean(parsed.data.password?.trim());
  const hashedPassword = passwordChanged
    ? await bcrypt.hash(parsed.data.password.trim(), 10)
    : null;
  const assignedLocation = await resolveAssignedLocation(
    parsed.data.role,
    parsed.data.assignedLocationId
  );

  if (!assignedLocation) {
    return {
      status: "error",
      message: "Manager accounts must be assigned to an active branch.",
      fieldErrors: {
        assignedLocationId: ["Choose an active branch for this manager."],
      },
      values,
    };
  }

  const changedFields = buildChangedFields(
    currentUser,
    {
      ...parsed.data,
      assignedLocationId: assignedLocation.assignedLocationId,
    },
    passwordChanged
  );

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        role: parsed.data.role,
        isActive: parsed.data.isActive,
        assignedLocationId: assignedLocation.assignedLocationId,
        ...(hashedPassword ? { hashedPassword } : {}),
      },
    });

    await logAudit(
      {
        userId: actor.id,
        action: "user.update",
        entity: "user",
        entityId: userId,
        details: {
          email: parsed.data.email,
          role: parsed.data.role,
          assignedLocationName: assignedLocation.assignedLocationName,
          changedFields,
        },
      },
      tx
    );
  });

  revalidateUserPaths();
  redirect(
    withFlashMessage("/dashboard/users", {
      success: "User account updated.",
    })
  );
}
