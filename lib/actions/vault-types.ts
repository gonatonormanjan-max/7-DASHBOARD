// Shared form-state type for vault server actions.
// Lives in a plain (non-"use server") module so it can be imported by both
// the server actions file and client components without violating the Next.js
// rule that "use server" files may only export async functions.

export type VaultFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialVaultFormState: VaultFormState = {
  status: "idle",
};
