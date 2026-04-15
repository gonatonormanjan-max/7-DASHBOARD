import { describe, expect, it } from "vitest";
import { getQuotaAttainmentBand } from "@/lib/reports/branch-quotas";

describe("getQuotaAttainmentBand", () => {
  it("classifies red, amber, green, and unconfigured thresholds", () => {
    expect(getQuotaAttainmentBand(0.69)).toBe("red");
    expect(getQuotaAttainmentBand(0.7)).toBe("amber");
    expect(getQuotaAttainmentBand(0.99)).toBe("amber");
    expect(getQuotaAttainmentBand(1)).toBe("green");
    expect(getQuotaAttainmentBand(null)).toBe("unconfigured");
  });
});
