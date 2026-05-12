"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { ReportsBranchSalesOrdersData } from "@/lib/dal/reports";
import type { BranchSalesOrderRow } from "@/lib/reports/branch-sales-orders";
import type { BranchSalesOrdersFilters } from "@/lib/validators/reports";
import { cn } from "@/lib/utils";

type BranchSalesOrdersTableProps = {
  rows: BranchSalesOrderRow[];
  filters: BranchSalesOrdersFilters;
  pagination: ReportsBranchSalesOrdersData["pagination"];
};

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPaymentMode(paymentMode: string | null) {
  if (!paymentMode) {
    return "Not set";
  }

  return formatStatusLabel(paymentMode);
}

function getStatusClass(status: string) {
  switch (status) {
    case "DRAFT":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "CONFIRMED":
      return "border-[#cfe0f4] bg-[#edf5ff] text-[#16324b]";
    case "DELIVERED":
      return "border-[#b8dff0] bg-[#eaf5fb] text-[#0f4f66]";
    case "COMPLETED":
      return "border-[#c5e7db] bg-[#edf8f4] text-[#0a4429]";
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function buildPageHref(filters: BranchSalesOrdersFilters, page: number) {
  const params = new URLSearchParams({
    view: "branch-sales-orders",
    branchId: filters.branchId ?? "all",
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    status: filters.status ?? "all",
    page: String(page),
    pageSize: String(filters.pageSize),
  });

  if (filters.query) {
    params.set("query", filters.query);
  }

  return `/dashboard/reports?${params.toString()}`;
}

export function BranchSalesOrdersTable({
  rows,
  filters,
  pagination,
}: BranchSalesOrdersTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  function toggleRow(rowId: string) {
    setExpandedRows((current) => {
      const next = new Set(current);

      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }

      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Branch Sales Orders</h2>
        <div className="mt-4 flex h-44 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
          No sales orders match this filter.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Branch Sales Orders</h2>
          <p className="text-sm text-muted-foreground">
            One row per sales order and branch. Expand a row to inspect its branch line items.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {pagination.from}-{pagination.to} of {pagination.totalCount}
        </p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-[1120px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <th className="pb-3 pr-4">Sale date</th>
              <th className="pb-3 pr-4">Branch</th>
              <th className="pb-3 pr-4">Order</th>
              <th className="pb-3 pr-4">Customer</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Payment</th>
              <th className="pb-3 pr-4 text-right">Units</th>
              <th className="pb-3 pr-4 text-right">Branch subtotal</th>
              <th className="pb-3 pr-4">Created by</th>
              <th className="pb-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isExpanded = expandedRows.has(row.id);

              return (
                <Fragment key={row.id}>
                  <tr className="border-b border-border/70 last:border-0">
                    <td className="py-3 pr-4 text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-foreground">{row.branchName}</p>
                      <p className="text-xs text-muted-foreground">{row.branchCode}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <Link
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        href={row.detailHref}
                      >
                        {row.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.customerName}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                          getStatusClass(row.status)
                        )}
                      >
                        {formatStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {formatPaymentMode(row.paymentMode)}
                    </td>
                    <td className="py-3 pr-4 text-right text-muted-foreground">
                      {formatNumber(row.units)}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-foreground">
                      {formatCurrency(row.branchSubtotal)}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.createdByName}</td>
                    <td className="py-3">
                      <button
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                        onClick={() => toggleRow(row.id)}
                        type="button"
                      >
                        {isExpanded ? "Hide" : "Expand"}
                      </button>
                    </td>
                  </tr>

                  {isExpanded ? (
                    <tr className="border-b border-border/70">
                      <td className="bg-muted/30 py-4 pl-4 pr-4" colSpan={10}>
                        <div className="overflow-hidden rounded-lg border border-border bg-background">
                          <table className="min-w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                <th className="px-4 py-3">Product</th>
                                <th className="px-4 py-3">SKU</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-right">Unit price</th>
                                <th className="px-4 py-3 text-right">Line total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {row.lineItems.map((item) => (
                                <tr key={item.id}>
                                  <td className="px-4 py-3 font-medium text-foreground">
                                    {item.productName}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {item.sku}
                                  </td>
                                  <td className="px-4 py-3 text-right text-muted-foreground">
                                    {formatNumber(item.quantity)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-muted-foreground">
                                    {formatCurrency(item.unitPrice)}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-foreground">
                                    {formatCurrency(item.lineTotal)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={!pagination.hasPrev}
            className={cn(
              "rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted",
              !pagination.hasPrev && "pointer-events-none opacity-50"
            )}
            href={buildPageHref(filters, pagination.page - 1)}
          >
            Previous
          </Link>
          <Link
            aria-disabled={!pagination.hasNext}
            className={cn(
              "rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted",
              !pagination.hasNext && "pointer-events-none opacity-50"
            )}
            href={buildPageHref(filters, pagination.page + 1)}
          >
            Next
          </Link>
        </div>
      </div>
    </section>
  );
}
