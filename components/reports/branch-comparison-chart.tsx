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

type BranchComparisonRow = {
  name: string;
  code: string;
  totalRevenue: number;
  orderCount: number;
  totalUnits: number;
  avgOrderValue: number;
  topProduct: string;
};

type BranchComparisonChartProps = {
  data: BranchComparisonRow[];
};

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BranchComparisonChart({ data }: BranchComparisonChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Branch Comparison"
        description="Side-by-side performance metrics for each store branch."
      >
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 text-sm text-slate-500">
          No branch data available.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Branch Comparison"
      description="Side-by-side performance metrics for each store branch."
    >
      <div className="space-y-6">
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 80)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
              tick={{ fontSize: 12, fill: "#64748b" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 12, fill: "#64748b" }}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === "Revenue") return [formatCurrency(Number(value)), name];
                if (name === "Avg Order") return [formatCurrency(Number(value)), name];
                return [value, name];
              }}
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                fontSize: "13px",
              }}
            />
            <Legend />
            <Bar dataKey="totalRevenue" name="Revenue" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
            <Bar dataKey="avgOrderValue" name="Avg Order" fill="#12805c" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-4">Branch</th>
                <th className="pb-2 pr-4">Revenue</th>
                <th className="pb-2 pr-4">Orders</th>
                <th className="pb-2 pr-4">Units</th>
                <th className="pb-2 pr-4">Avg Order</th>
                <th className="pb-2">Top Product</th>
              </tr>
            </thead>
            <tbody>
              {data.map((branch) => (
                <tr key={branch.code} className="border-b border-slate-100">
                  <td className="py-2.5 pr-4 font-medium text-slate-900">{branch.name}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{formatCurrency(branch.totalRevenue)}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{branch.orderCount}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{branch.totalUnits}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{formatCurrency(branch.avgOrderValue)}</td>
                  <td className="py-2.5 text-slate-600">{branch.topProduct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartCard>
  );
}
