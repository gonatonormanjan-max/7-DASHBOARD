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

type StockMovementChartProps = {
  data: Array<Record<string, string | number>>;
};

const MOVEMENT_CONFIG: Array<{
  key: string;
  label: string;
  color: string;
}> = [
  { key: "PURCHASE_RECEIVED", label: "Purchases", color: "#12805c" },
  { key: "SALES_FULFILLED", label: "Sales", color: "#1e3a5f" },
  { key: "MANUAL_ADJUSTMENT", label: "Adjustments", color: "#6366f1" },
  { key: "WAREHOUSE_TRANSFER", label: "Transfers", color: "#0891b2" },
  { key: "CUSTOMER_RETURN", label: "Returns", color: "#b67918" },
  { key: "DAMAGED_LOST", label: "Damaged/Lost", color: "#dc2626" },
];

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
}

export function StockMovementChart({ data }: StockMovementChartProps) {
  const hasMovements = data.some((day) =>
    MOVEMENT_CONFIG.some((m) => (day[m.key] as number) > 0)
  );

  if (!hasMovements) {
    return (
      <ChartCard
        title="Stock Movements (30 days)"
        description="Inventory movement volume by type over time."
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          No inventory movements recorded in the last 30 days.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Stock Movements (30 days)"
      description="Inventory movement volume by type over time."
    >
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: "#64748b" }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
          <Tooltip
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {MOVEMENT_CONFIG.map((movement) => (
            <Area
              key={movement.key}
              type="monotone"
              dataKey={movement.key}
              name={movement.label}
              stackId="1"
              stroke={movement.color}
              fill={movement.color}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
