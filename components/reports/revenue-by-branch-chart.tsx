"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
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

type RevenueByBranchChartProps = {
  data: Array<Record<string, string | number>>;
  branches: string[];
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrencyTick(value: number) {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value}`;
}

export function RevenueByBranchChart({ data, branches }: RevenueByBranchChartProps) {
  if (branches.length === 0) {
    return (
      <ChartCard
        title="Revenue by Branch (30 days)"
        description="Daily revenue breakdown per store branch."
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          No branch sales data available.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Revenue by Branch (30 days)"
      description="Daily revenue breakdown per store branch."
    >
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: "#64748b" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatCurrencyTick}
            tick={{ fontSize: 12, fill: "#64748b" }}
            width={60}
          />
          <Tooltip
            formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Legend />
          {branches.map((branch, index) => (
            <Line
              key={branch}
              type="monotone"
              dataKey={branch}
              name={branch}
              stroke={BRANCH_COLORS[index % BRANCH_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
