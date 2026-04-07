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

type SalesTrendChartProps = {
  data: Array<{ date: string; revenue: number; orderCount: number }>;
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

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  if (data.every((d) => d.revenue === 0 && d.orderCount === 0)) {
    return (
      <ChartCard
        title="Sales Trend (30 days)"
        description="Daily revenue and order volume."
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          No sales data recorded in the last 30 days.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Sales Trend (30 days)"
      description="Daily revenue and order volume."
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
            yAxisId="revenue"
            tickFormatter={formatCurrencyTick}
            tick={{ fontSize: 12, fill: "#64748b" }}
            width={60}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            tick={{ fontSize: 12, fill: "#64748b" }}
            width={40}
          />
          <Tooltip
            formatter={(value, name) =>
              name === "Revenue"
                ? [`$${Number(value).toFixed(2)}`, name]
                : [value, name]
            }
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Legend />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#1e3a5f"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="orderCount"
            name="Orders"
            stroke="#12805c"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
