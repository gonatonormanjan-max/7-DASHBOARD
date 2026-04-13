"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ChartCard } from "./chart-card";

const BRANCH_COLORS = [
  "#1e3a5f",
  "#12805c",
  "#b67918",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#059669",
  "#d97706",
];

type SeasonalTrendsChartProps = {
  data: Array<Record<string, string | number>>;
  branches: string[];
};

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatCurrencyTick(value: number) {
  if (value >= 1000) {
    return `₱${(value / 1000).toFixed(1)}k`;
  }
  return `₱${value}`;
}

export function SeasonalTrendsChart({ data, branches }: SeasonalTrendsChartProps) {
  if (data.length === 0 || branches.length === 0) {
    return (
      <ChartCard
        title="Seasonal Revenue Trends"
        description="Monthly revenue patterns by branch over all recorded history."
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          Not enough data to show seasonal trends.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Seasonal Revenue Trends"
      description="Monthly revenue patterns by branch over all recorded history."
    >
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            tickFormatter={formatCurrencyTick}
            tick={{ fontSize: 12, fill: "#64748b" }}
            width={60}
          />
          <Tooltip
            formatter={(value, name) => [`₱${Number(value).toFixed(2)}`, name]}
            labelFormatter={(label) => formatMonth(String(label))}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Legend />
          {branches.map((branch, index) => (
            <Area
              key={branch}
              type="monotone"
              dataKey={branch}
              name={branch}
              stroke={BRANCH_COLORS[index % BRANCH_COLORS.length]}
              fill={BRANCH_COLORS[index % BRANCH_COLORS.length]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
