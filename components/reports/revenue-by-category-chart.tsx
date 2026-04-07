"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { ChartCard } from "./chart-card";

type RevenueByCategoryChartProps = {
  data: Array<{ category: string; revenue: number }>;
};

const COLORS = [
  "#1e3a5f",
  "#12805c",
  "#b67918",
  "#6366f1",
  "#e11d48",
  "#0891b2",
  "#7c3aed",
  "#ca8a04",
  "#16a34a",
  "#dc2626",
];

export function RevenueByCategoryChart({ data }: RevenueByCategoryChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Revenue by Category"
        description="Sales revenue distribution across product categories."
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          No sales data available to break down by category.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Revenue by Category"
      description="Sales revenue distribution across product categories."
    >
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={110}
            paddingAngle={2}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: "12px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
