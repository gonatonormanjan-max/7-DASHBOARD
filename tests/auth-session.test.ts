import { describe, expect, it } from "vitest";
import { resolveAuthSessionMaxAgeSeconds } from "@/lib/auth-session";

describe("auth session duration", () => {
  it("defaults to 12 hours when unset", () => {
    expect(resolveAuthSessionMaxAgeSeconds(undefined)).toBe(43_200);
  });

  it("uses a valid configured duration", () => {
    expect(resolveAuthSessionMaxAgeSeconds("86400")).toBe(86_400);
  });

  it("falls back to 12 hours for invalid values", () => {
    expect(resolveAuthSessionMaxAgeSeconds("not-a-number")).toBe(43_200);
    expect(resolveAuthSessionMaxAgeSeconds("60")).toBe(43_200);
    expect(resolveAuthSessionMaxAgeSeconds("999999999")).toBe(43_200);
  });
});

