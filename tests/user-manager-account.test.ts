import { describe, expect, it } from "vitest";
import { getAssignableRolesForActor } from "@/lib/users";
import {
  createUserFormSchema,
  updateUserFormSchema,
} from "@/lib/validators/users";

describe("manager account flow", () => {
  it("requires an assigned branch when creating a manager account", () => {
    const result = createUserFormSchema.safeParse({
      firstName: "Branch",
      lastName: "Lead",
      email: "manager@example.com",
      role: "MANAGER",
      assignedLocationId: "",
      isActive: "true",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.assignedLocationId).toContain(
      "Assign an active branch to this manager."
    );
  });

  it("allows a manager account when an assigned branch is provided", () => {
    const result = createUserFormSchema.safeParse({
      firstName: "Branch",
      lastName: "Lead",
      email: "manager@example.com",
      role: "MANAGER",
      assignedLocationId: "branch-123",
      isActive: "true",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("preserves the branch requirement when updating a manager account", () => {
    const result = updateUserFormSchema.safeParse({
      firstName: "Branch",
      lastName: "Lead",
      email: "manager@example.com",
      role: "MANAGER",
      assignedLocationId: "",
      isActive: "true",
      password: "",
      confirmPassword: "",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.assignedLocationId).toContain(
      "Assign an active branch to this manager."
    );
  });

  it("lets admins assign the manager role but blocks system managers", () => {
    expect(getAssignableRolesForActor("ADMIN")).toContain("MANAGER");
    expect(getAssignableRolesForActor("SYSTEM_MANAGER")).not.toContain("MANAGER");
  });
});
