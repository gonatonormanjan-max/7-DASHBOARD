import { describe, expect, it } from "vitest";
import { branchQuotaSettingsSchema } from "@/lib/validators/reports";

describe("branchQuotaSettingsSchema", () => {
  it("accepts valid payloads and normalizes blank targets to null", () => {
    const parsed = branchQuotaSettingsSchema.parse({
      metric: "revenue",
      rows: [
        {
          branchId: "9f72d086-fad1-4ae8-a4d5-8a0cdf75a82a",
          rollingWindowDays: "30",
          revenueTarget: "",
          unitsTarget: "120",
        },
      ],
    });

    expect(parsed.rows[0].rollingWindowDays).toBe(30);
    expect(parsed.rows[0].revenueTarget).toBeNull();
    expect(parsed.rows[0].unitsTarget).toBe(120);
  });

  it("rejects negative targets and invalid window values", () => {
    const result = branchQuotaSettingsSchema.safeParse({
      metric: "units",
      rows: [
        {
          branchId: "9f72d086-fad1-4ae8-a4d5-8a0cdf75a82a",
          rollingWindowDays: 400,
          revenueTarget: -1,
          unitsTarget: -5,
        },
      ],
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    const issues = result.error.issues.map((issue) => issue.path.join("."));
    expect(issues).toContain("rows.0.rollingWindowDays");
    expect(issues).toContain("rows.0.revenueTarget");
    expect(issues).toContain("rows.0.unitsTarget");
  });

  it("rejects fractional unit targets", () => {
    const result = branchQuotaSettingsSchema.safeParse({
      metric: "units",
      rows: [
        {
          branchId: "9f72d086-fad1-4ae8-a4d5-8a0cdf75a82a",
          rollingWindowDays: 14,
          revenueTarget: "5000",
          unitsTarget: "12.25",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
