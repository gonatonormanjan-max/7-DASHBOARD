import type { Role } from "@prisma/client";

export const USER_ROLE_OPTIONS: Role[] = ["ADMIN", "SYSTEM_MANAGER", "SALES_STAFF"];

export function getAssignableRolesForActor(role: Role) {
  switch (role) {
    case "ADMIN":
      return USER_ROLE_OPTIONS;
    case "SYSTEM_MANAGER":
      return USER_ROLE_OPTIONS.filter((item) => item !== "ADMIN");
    case "SALES_STAFF":
      return [];
  }
}

export function canManageTargetUser(actorRole: Role, targetRole: Role) {
  switch (actorRole) {
    case "ADMIN":
      return true;
    case "SYSTEM_MANAGER":
      return targetRole !== "ADMIN";
    case "SALES_STAFF":
      return false;
  }
}

export function getUserStatusLabel(isActive: boolean) {
  return isActive ? "Active" : "Inactive";
}
