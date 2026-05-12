"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDateMNL } from "@/lib/timezone";
import { ChartCard } from "./chart-card";

type BranchActivityTrendPoint = {
  date: string;
  revenue: number;
  unitsSold: number;
  movementVolume: number;
};

type BranchActivityTrendChartProps = {
  data: BranchActivityTrendPoint[];
};

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCurrencyTick(value: number) {
  if (value >= 1000) {
    return `PHP ${(value / 1000).toFixed(1)}k`;
  }

  return `PHP ${value}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(date: string) {
  return formatShortDateMNL(date);
}

export function BranchActivityTrendChart({ data }: BranchActivityTrendChartProps) {
  const hasActivity = data.some(
    (day) => day.revenue > 0 || day.unitsSold > 0 || day.movementVolume > 0
  );

  if (!hasActivity) {
    return (
      <ChartCard
        title="Daily Activity Trend"
        description="Revenue, units sold, and stock movement volume inside the selected window."
      >
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
          No sales or movement activity recorded in this period.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Daily Activity Trend"
      description="Revenue, units sold, and stock movement volume inside the selected window."
    >
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            minTickGap={24}
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={formatDate}
            tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={formatCurrencyTick}
            width={72}
            yAxisId="revenue"
          />
          <YAxis
            allowDecimals={false}
            orientation="right"
            tick={{ fontSize: 12, fill: "#64748b" }}
            width={44}
            yAxisId="units"
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              fontSize: "13px",
            }}
            formatter={(value, name) => {
              if (name === "Revenue") {
                return [formatCurrency(Number(value)), name];
              }

              return [formatNumber(Number(value)), name];
            }}
            labelFormatter={(label) => formatDate(String(label))}
          />
          <Legend />
          <Area
            activeDot={{ r: 4, strokeWidth: 0 }}
            dataKey="revenue"
            dot={false}
            fill="#d6e7fa"
            fillOpacity={0.7}
            name="Revenue"
            stroke="#1e3a5f"
            strokeWidth={2}
            type="monotone"
            yAxisId="revenue"
          />
          <Bar
            dataKey="unitsSold"
            fill="#12805c"
            maxBarSize={14}
            name="Units Sold"
            radius={[4, 4, 0, 0]}
            yAxisId="units"
          />
          <Bar
            dataKey="movementVolume"
            fill="#b67918"
            maxBarSize={14}
            name="Movement Volume"
            radius={[4, 4, 0, 0]}
            yAxisId="units"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
