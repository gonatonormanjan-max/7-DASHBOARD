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

type OrderStatusChartProps = {
  data: Array<{ status: string; count: number }>;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  CONFIRMED: "#1e3a5f",
  DELIVERED: "#0891b2",
  COMPLETED: "#12805c",
  CANCELLED: "#dc2626",
};

export function OrderStatusChart({ data }: OrderStatusChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Order Status Distribution"
        description="Breakdown of sales orders by current status."
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          No orders recorded yet.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Order Status Distribution"
      description="Breakdown of sales orders by current status."
    >
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={110}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell
                key={entry.status}
                fill={
                  STATUS_COLORS[entry.status.replace(/ /g, "_").toUpperCase()] ??
                  "#94a3b8"
                }
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [value, "Orders"]}
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
