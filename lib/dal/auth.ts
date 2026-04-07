import "server-only";

import { cache } from "react";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  hasPermission,
  type PermissionAction,
  type PermissionResource,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const getCurrentUser = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      assignedLocationId: true,
    },
  });
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (!user.isActive) {
    redirect("/auth/login?error=inactive");
  }

  return user;
}

export async function requireRole(roles: Role[]) {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requirePermission(
  resource: PermissionResource,
  action: PermissionAction
) {
  const user = await requireUser();

  if (!hasPermission(user.role, resource, action)) {
    redirect("/dashboard");
  }

  return user;
}
