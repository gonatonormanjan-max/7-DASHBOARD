"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ChartCard } from "./chart-card";

type TopProductsChartProps = {
  data: Array<{ name: string; sku: string; revenue: number; unitsSold: number }>;
};

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Top Products by Revenue"
        description="Highest-earning products across posted sales (confirmed, delivered, completed)."
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          No product sales recorded yet.
        </div>
      </ChartCard>
    );
  }

  const chartData = data.map((p) => ({
    ...p,
    label: truncate(p.name, 20),
  }));

  return (
    <ChartCard
      title="Top Products by Revenue"
      description="Highest-earning products across posted sales (confirmed, delivered, completed)."
    >
      <ResponsiveContainer width="100%" height={Math.max(320, data.length * 44)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(value: number) =>
              value >= 1000 ? `₱${(value / 1000).toFixed(1)}k` : `₱${value}`
            }
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <Tooltip
            formatter={(value, name) =>
              name === "Revenue"
                ? [`₱${Number(value).toFixed(2)}`, name]
                : [value, name]
            }
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Bar dataKey="revenue" name="Revenue" fill="#1e3a5f" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
