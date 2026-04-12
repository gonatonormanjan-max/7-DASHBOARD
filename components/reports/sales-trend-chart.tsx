"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ChartCard } from "./chart-card";

type SalesTrendChartProps = {
  data: Array<{ date: string; revenue: number; unitsSold: number; orderCount?: number }>;
  days?: number;
  title?: string;
  description?: string;
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

function formatWholeNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

export function SalesTrendChart({
  data,
  days = 30,
  title = `Revenue and Units (${days} days)`,
  description = "Daily revenue and unit volume.",
}: SalesTrendChartProps) {
  if (data.every((d) => d.revenue === 0 && d.unitsSold === 0)) {
    return (
      <ChartCard title={title} description={description}>
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          No sales data recorded in the selected period.
        </div>
      </ChartCard>
    );
  }

  const totalRevenue = data.reduce((sum, day) => sum + day.revenue, 0);
  const totalUnits = data.reduce((sum, day) => sum + day.unitsSold, 0);
  const activeDays = data.filter((day) => day.revenue > 0 || day.unitsSold > 0).length;
  const averageRevenuePerActiveDay =
    activeDays > 0 ? totalRevenue / activeDays : 0;

  return (
    <ChartCard title={title} description={description}>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total revenue</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total units</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatWholeNumber(totalUnits)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Active days</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {activeDays} / {data.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Avg revenue/day</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatCurrency(averageRevenuePerActiveDay)}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: "#64748b" }}
            minTickGap={24}
            tickMargin={8}
          />
          <YAxis
            yAxisId="revenue"
            tickFormatter={formatCurrencyTick}
            tick={{ fontSize: 12, fill: "#64748b" }}
            width={60}
          />
          <YAxis
            yAxisId="units"
            orientation="right"
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
            width={40}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === "Revenue") {
                return [formatCurrency(Number(value)), name];
              }

              if (name === "Units Sold") {
                return [formatWholeNumber(Number(value)), name];
              }

              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload as
                | { orderCount?: number }
                | undefined;
              const orderSuffix =
                typeof row?.orderCount === "number"
                  ? ` • ${row.orderCount} order${row.orderCount === 1 ? "" : "s"}`
                  : "";
              return `${formatDate(String(label))}${orderSuffix}`;
            }}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Legend />
          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            fill="#d6e7fa"
            fillOpacity={0.65}
            stroke="#1e3a5f"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Bar
            yAxisId="units"
            dataKey="unitsSold"
            name="Units Sold"
            fill="#12805c"
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
