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
} from "recharts";
import { ChartCard } from "./chart-card";

type LocationUtilizationChartProps = {
  data: Array<{
    name: string;
    code: string;
    type: string;
    totalUnits: number;
    reservedUnits: number;
    availableUnits: number;
    productCount: number;
  }>;
};

export function WarehouseUtilizationChart({ data }: LocationUtilizationChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Location Utilization"
        description="Total, reserved, and available stock by location."
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          No active locations with stock data found.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Location Utilization"
      description="Total, reserved, and available stock by location."
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(value, index) => {
              const item = data[index];
              return item ? `${value} (${item.type})` : value;
            }}
          />
          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Legend />
          <Bar
            dataKey="totalUnits"
            name="Total"
            fill="#1e3a5f"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="reservedUnits"
            name="Reserved"
            fill="#b67918"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="availableUnits"
            name="Available"
            fill="#12805c"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
