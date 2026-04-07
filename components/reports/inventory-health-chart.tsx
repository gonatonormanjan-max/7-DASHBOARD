"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { ChartCard } from "./chart-card";

type InventoryHealthRow = {
  productName: string;
  sku: string;
  available: number;
  reorderLevel: number;
  status: "healthy" | "low" | "out";
};

type InventoryHealthChartProps = {
  data: InventoryHealthRow[];
};

const STATUS_FILL: Record<string, string> = {
  healthy: "#12805c",
  low: "#b67918",
  out: "#dc2626",
};

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export function InventoryHealthChart({ data }: InventoryHealthChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Inventory Health"
        description="Stock levels compared to reorder thresholds."
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          No active products with warehouse stock found.
        </div>
      </ChartCard>
    );
  }

  const chartData = data.map((row) => ({
    ...row,
    label: truncate(row.productName, 18),
    fill: STATUS_FILL[row.status],
  }));

  return (
    <ChartCard
      title="Inventory Health"
      description="Stock levels compared to reorder thresholds. Red = out, amber = low, green = healthy."
    >
      <ResponsiveContainer width="100%" height={Math.max(320, data.length * 32)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis
            type="category"
            dataKey="label"
            width={130}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <Tooltip
            formatter={(value, name) => [value, name]}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Legend />
          <Bar
            dataKey="available"
            name="Available"
            radius={[0, 6, 6, 0]}
            fill="#12805c"
          >
            {chartData.map((entry, index) => (
              <rect key={index} fill={entry.fill} />
            ))}
          </Bar>
          <Bar
            dataKey="reorderLevel"
            name="Reorder Level"
            fill="#e2e8f0"
            radius={[0, 6, 6, 0]}
          />
          <ReferenceLine x={0} stroke="#cbd5e1" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
