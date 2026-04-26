import type { Role } from "@prisma/client";

export const USER_ROLE_OPTIONS: Role[] = [
  "ADMIN",
  "SYSTEM_MANAGER",
  "MANAGER",
  "SALES_STAFF",
];

export function getAssignableRolesForActor(role: Role): Role[] {
  switch (role) {
    case "ADMIN":
      // Admin can assign any role including MANAGER
      return USER_ROLE_OPTIONS;
    case "SYSTEM_MANAGER":
      // System manager cannot create Admins or Managers
      return USER_ROLE_OPTIONS.filter(
        (item) => item !== "ADMIN" && item !== "MANAGER"
      );
    case "MANAGER":
      // Managers cannot create other users
      return [];
    case "SALES_STAFF":
      return [];
  }
}

export function canManageTargetUser(actorRole: Role, targetRole: Role): boolean {
  switch (actorRole) {
    case "ADMIN":
      return true;
    case "SYSTEM_MANAGER":
      // System manager cannot manage Admins or Managers
      return targetRole !== "ADMIN" && targetRole !== "MANAGER";
    case "MANAGER":
      return false;
    case "SALES_STAFF":
      return false;
  }
}

export function getUserStatusLabel(isActive: boolean) {
  return isActive ? "Active" : "Inactive";
}
