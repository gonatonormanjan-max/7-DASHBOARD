export type BranchQuotaMetric = "revenue" | "units";

export type QuotaAttainmentBand = "unconfigured" | "red" | "amber" | "green";

export type BranchQuotaComputationBranch = {
  id: string;
  name: string;
  code: string;
  rollingWindowDays: number;
  revenueTarget: number | null;
  unitsTarget: number | null;
};

export type BranchQuotaDailySales = {
  branchId: string;
  dateKey: string;
  revenue: number;
  units: number;
};

export type BranchQuotaComputedRow = {
  id: string;
  name: string;
  code: string;
  rollingWindowDays: number;
  revenueTarget: number | null;
  unitsTarget: number | null;
  totalRevenue: number;
  totalUnits: number;
  currentValue: number;
  targetValue: number | null;
  attainmentRatio: number | null;
  remainingToTarget: number | null;
  reached: boolean | null;
  band: QuotaAttainmentBand;
  averagePerDay: number;
  bestDayValue: number;
  activeSalesDays: number;
};

const MAX_WINDOW_DAYS = 365;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function roundUnits(value: number) {
  return Math.round(value * 100) / 100;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function clampWindowDays(days: number) {
  if (!Number.isFinite(days)) {
    return 30;
  }

  return Math.min(Math.max(Math.floor(days), 1), MAX_WINDOW_DAYS);
}

function getWindowStartKey(days: number, today: Date) {
  const safeDays = clampWindowDays(days);
  const date = new Date(today);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (safeDays - 1));
  return toDateKey(date);
}

function roundMetric(metric: BranchQuotaMetric, value: number) {
  return metric === "revenue" ? roundCurrency(value) : roundUnits(value);
}

function normalizeTarget(target: number | null) {
  if (target === null || !Number.isFinite(target) || target <= 0) {
    return null;
  }

  return target;
}

export function getQuotaAttainmentBand(attainmentRatio: number | null): QuotaAttainmentBand {
  if (attainmentRatio === null || !Number.isFinite(attainmentRatio)) {
    return "unconfigured";
  }

  if (attainmentRatio < 0.7) {
    return "red";
  }

  if (attainmentRatio < 1) {
    return "amber";
  }

  return "green";
}

export function computeBranchQuotaRows(input: {
  branches: BranchQuotaComputationBranch[];
  sales: BranchQuotaDailySales[];
  metric: BranchQuotaMetric;
  today?: Date;
}): BranchQuotaComputedRow[] {
  const today = input.today ?? new Date();
  const dailyByBranch = new Map<string, Map<string, { revenue: number; units: number }>>();

  for (const sale of input.sales) {
    const branchDaily = dailyByBranch.get(sale.branchId) ?? new Map<string, { revenue: number; units: number }>();
    const existing = branchDaily.get(sale.dateKey) ?? { revenue: 0, units: 0 };

    existing.revenue += sale.revenue;
    existing.units += sale.units;
    branchDaily.set(sale.dateKey, existing);
    dailyByBranch.set(sale.branchId, branchDaily);
  }

  return [...input.branches]
    .map((branch) => {
      const windowDays = clampWindowDays(branch.rollingWindowDays);
      const windowStartKey = getWindowStartKey(windowDays, today);
      const daily = dailyByBranch.get(branch.id);
      let totalRevenue = 0;
      let totalUnits = 0;
      let currentMetricValue = 0;
      let bestDayValue = 0;
      let activeSalesDays = 0;

      if (daily) {
        for (const [dateKey, values] of daily.entries()) {
          if (dateKey < windowStartKey) {
            continue;
          }

          totalRevenue += values.revenue;
          totalUnits += values.units;

          const metricValue = input.metric === "revenue" ? values.revenue : values.units;
          currentMetricValue += metricValue;

          if (metricValue > 0) {
            activeSalesDays += 1;
          }

          if (metricValue > bestDayValue) {
            bestDayValue = metricValue;
          }
        }
      }

      const targetCandidate = input.metric === "revenue" ? branch.revenueTarget : branch.unitsTarget;
      const targetValue = normalizeTarget(targetCandidate);
      const attainmentRatio = targetValue ? currentMetricValue / targetValue : null;
      const remainingToTarget = targetValue ? Math.max(targetValue - currentMetricValue, 0) : null;

      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        rollingWindowDays: windowDays,
        revenueTarget: branch.revenueTarget,
        unitsTarget: branch.unitsTarget,
        totalRevenue: roundCurrency(totalRevenue),
        totalUnits,
        currentValue: roundMetric(input.metric, currentMetricValue),
        targetValue: targetValue === null ? null : roundMetric(input.metric, targetValue),
        attainmentRatio,
        remainingToTarget:
          remainingToTarget === null ? null : roundMetric(input.metric, remainingToTarget),
        reached: targetValue ? currentMetricValue >= targetValue : null,
        band: getQuotaAttainmentBand(attainmentRatio),
        averagePerDay: roundMetric(input.metric, currentMetricValue / windowDays),
        bestDayValue: roundMetric(input.metric, bestDayValue),
        activeSalesDays,
      };
    })
    .sort((left, right) => {
      if (right.currentValue !== left.currentValue) {
        return right.currentValue - left.currentValue;
      }

      return left.name.localeCompare(right.name);
    });
}
