-- Safety guardrail: enforce non-negative stock counters at the database level.
-- These constraints act as a last-resort guard against app-level race conditions
-- or logic bugs that would otherwise silently persist invalid inventory data.
--
-- NOTE: Before applying in production, verify no rows have negative values:
--   SELECT COUNT(*) FROM "LocationStock" WHERE quantity < 0 OR "reservedQty" < 0;
-- Expected result: 0 rows. If any exist, investigate and correct them first.

ALTER TABLE "LocationStock"
  ADD CONSTRAINT "locationstock_quantity_non_negative"
    CHECK (quantity >= 0),
  ADD CONSTRAINT "locationstock_reservedqty_non_negative"
    CHECK ("reservedQty" >= 0);
