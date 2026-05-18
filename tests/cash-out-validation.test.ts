import { describe, expect, it } from "vitest";
import {
  cashOutCreateFormSchema,
  parseCashOutListFilters,
} from "@/lib/validators/cash-out";

const BRANCH_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

describe("cash-out validation", () => {
  it("accepts a valid cash-out transaction with a zero fee", () => {
    const parsed = cashOutCreateFormSchema.parse({
      branchId: BRANCH_ID,
      accountId: ACCOUNT_ID,
      cashOutAmount: "1000",
      feeAmount: "0",
      onlineReferenceNumber: "GCASH-REF-123",
    });

    expect(parsed.cashOutAmount).toBe(1000);
    expect(parsed.feeAmount).toBe(0);
    expect(parsed.onlineReferenceNumber).toBe("GCASH-REF-123");
  });

  it("rejects non-positive cash-out amounts", () => {
    const parsed = cashOutCreateFormSchema.safeParse({
      branchId: BRANCH_ID,
      accountId: ACCOUNT_ID,
      cashOutAmount: "0",
      feeAmount: "20",
      onlineReferenceNumber: "GCASH-REF-123",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects negative service fees", () => {
    const parsed = cashOutCreateFormSchema.safeParse({
      branchId: BRANCH_ID,
      accountId: ACCOUNT_ID,
      cashOutAmount: "1000",
      feeAmount: "-1",
      onlineReferenceNumber: "GCASH-REF-123",
    });

    expect(parsed.success).toBe(false);
  });

  it("requires an online transfer reference", () => {
    const parsed = cashOutCreateFormSchema.safeParse({
      branchId: BRANCH_ID,
      accountId: ACCOUNT_ID,
      cashOutAmount: "1000",
      feeAmount: "20",
      onlineReferenceNumber: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("normalizes list filters safely", () => {
    const filters = parseCashOutListFilters({
      status: "NOT_A_STATUS",
      dateFrom: "2026-05-20",
      dateTo: "2026-05-10",
      page: "2",
      pageSize: "100",
    });

    expect(filters.status).toBe("all");
    expect(filters.dateFrom).toBe("2026-05-10");
    expect(filters.dateTo).toBe("2026-05-20");
    expect(filters.page).toBe(2);
    expect(filters.pageSize).toBe(100);
  });
});
