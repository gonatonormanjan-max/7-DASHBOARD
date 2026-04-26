import "server-only";

import PDFDocumentModule from "pdfkit";
import type { Role } from "@prisma/client";
import {
  REPORT_OVERVIEW_WINDOW_DAYS,
  type QuotaMetric,
  type ReportMetricContext,
  type ReportsAnalyticsData,
  type ReportsOverviewData,
  type ReportsQuotaData,
} from "@/lib/dal/reports";
import { formatCurrency } from "@/lib/products";
import { formatDateMNL, formatDateTimeMNL } from "@/lib/timezone";

type ReportsPdfView = "overview" | "analytics" | "quota";

type ReportsPdfInput = {
  view: ReportsPdfView;
  generatedAt: Date;
  generatedBy: {
    firstName: string;
    lastName: string;
    email: string;
    role: Role;
  };
  scopeLabel: string;
  analyticsDays: number;
  quotaDays: number;
  quotaMetric: QuotaMetric;
  quotaTarget: number | null;
  overview?: ReportsOverviewData;
  analytics?: ReportsAnalyticsData;
  quota?: ReportsQuotaData;
};

type TableColumn = {
  key: string;
  header: string;
  width: number;
  align?: "left" | "right" | "center";
};

type TableRow = Record<string, string>;

const CONTENT_TEXT_COLOR = "#0f172a";
const MUTED_TEXT_COLOR = "#475569";
const TABLE_HEADER_BG = "#f8fafc";
const TABLE_BORDER = "#cbd5e1";

type PdfDocumentConstructor = new (options?: PDFKit.PDFDocumentOptions) => PDFKit.PDFDocument;

const PDFDocument = (
  PDFDocumentModule as unknown as { default?: PdfDocumentConstructor }
).default ?? (PDFDocumentModule as unknown as PdfDocumentConstructor);

function toPdfSafeText(value: string) {
  return value
    .replace(/\u20b1/g, "PHP ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E]/g, "");
}

function getViewTitle(view: ReportsPdfView) {
  if (view === "analytics") {
    return "Analytics Report";
  }

  if (view === "quota") {
    return "Quota Tracker Report";
  }

  return "Overview Report";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}%`;
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");
}

function normalizeCell(value: string, maxLength = 60) {
  const cleaned = toPdfSafeText(value).replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1)}...`;
}

function getPrintableWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function getBottomLimit(doc: PDFKit.PDFDocument) {
  return doc.page.height - doc.page.margins.bottom;
}

function ensureVerticalSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
  if (doc.y + neededHeight <= getBottomLimit(doc)) {
    return;
  }

  doc.addPage();
}

function writeSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  description?: string
) {
  ensureVerticalSpace(doc, 54);
  doc.moveDown(0.2);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(CONTENT_TEXT_COLOR)
    .text(toPdfSafeText(title));

  if (description) {
    doc
      .moveDown(0.15)
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(MUTED_TEXT_COLOR)
      .text(toPdfSafeText(description));
  }

  doc.moveDown(0.35);
}

function drawTable(
  doc: PDFKit.PDFDocument,
  input: {
    columns: TableColumn[];
    rows: TableRow[];
    emptyMessage?: string;
    maxRows?: number;
  }
) {
  const rowHeight = 20;
  const headerHeight = 22;
  const tableWidth = getPrintableWidth(doc);
  const x = doc.page.margins.left;
  const rows = typeof input.maxRows === "number" ? input.rows.slice(0, input.maxRows) : input.rows;

  if (rows.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(MUTED_TEXT_COLOR)
      .text(toPdfSafeText(input.emptyMessage ?? "No data available for this section."));
    doc.moveDown(0.5);
    return;
  }

  const widths = input.columns.map((column, index) => {
    if (index === input.columns.length - 1) {
      const usedWidth = input.columns
        .slice(0, index)
        .reduce((sum, previous) => sum + Math.floor(previous.width * tableWidth), 0);
      return tableWidth - usedWidth;
    }

    return Math.floor(column.width * tableWidth);
  });

  const drawHeader = (startY: number) => {
    let currentX = x;

    doc
      .save()
      .fillColor(TABLE_HEADER_BG)
      .rect(x, startY, tableWidth, headerHeight)
      .fill()
      .restore();

    input.columns.forEach((column, index) => {
      const width = widths[index];

      doc
        .save()
        .rect(currentX, startY, width, headerHeight)
        .lineWidth(0.8)
        .strokeColor(TABLE_BORDER)
        .stroke()
        .restore();

      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(CONTENT_TEXT_COLOR)
        .text(toPdfSafeText(column.header), currentX + 5, startY + 6, {
          width: width - 10,
          align: column.align ?? "left",
          lineBreak: false,
        });

      currentX += width;
    });

    return startY + headerHeight;
  };

  let y = doc.y;
  ensureVerticalSpace(doc, headerHeight + rowHeight);
  y = doc.y;
  y = drawHeader(y);

  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > getBottomLimit(doc)) {
      doc.addPage();
      y = doc.y;
      y = drawHeader(y);
    }

    if (rowIndex % 2 === 1) {
      doc
        .save()
        .fillColor("#fdfefe")
        .rect(x, y, tableWidth, rowHeight)
        .fill()
        .restore();
    }

    let currentX = x;

    input.columns.forEach((column, index) => {
      const width = widths[index];
      const value = normalizeCell(row[column.key] ?? "");

      doc
        .save()
        .rect(currentX, y, width, rowHeight)
        .lineWidth(0.6)
        .strokeColor(TABLE_BORDER)
        .stroke()
        .restore();

      doc
        .font("Helvetica")
        .fontSize(8.8)
        .fillColor(CONTENT_TEXT_COLOR)
        .text(value, currentX + 5, y + 6, {
          width: width - 10,
          align: column.align ?? "left",
          lineBreak: false,
        });

      currentX += width;
    });

    y += rowHeight;
  });

  doc.y = y + 8;

    if (typeof input.maxRows === "number" && input.rows.length > input.maxRows) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(MUTED_TEXT_COLOR)
      .text(
        toPdfSafeText(
          `Showing ${input.maxRows} of ${input.rows.length} rows in this PDF export.`
        ),
        doc.page.margins.left,
        doc.y
      );
    doc.moveDown(0.6);
  }
}

function writeContextSection(doc: PDFKit.PDFDocument, context: ReportMetricContext) {
  writeSectionTitle(doc, "Metric Context");

  const rows: TableRow[] = [
    {
      label: "Valuation method",
      value: context.valuationMethod,
    },
    {
      label: "Included sales statuses",
      value: context.includedStatuses.map((status) => toTitleCase(status)).join(", "),
    },
    {
      label: "Archived orders policy",
      value: toTitleCase(context.archivedOrdersPolicy),
    },
    {
      label: "Confidence",
      value: toTitleCase(context.confidence),
    },
    {
      label: "Estimated cost lines",
      value: `${formatNumber(context.estimatedCostLineCount)} / ${formatNumber(context.totalSalesLines)}`,
    },
    {
      label: "Cost shocks",
      value: `${formatNumber(context.costShockEventsInWindow)} (warning > ${context.costShockWarningThresholdPct.toFixed(0)}%)`,
    },
    {
      label: "Escalations",
      value: `${formatNumber(context.costShockEscalationsInWindow)} (escalation > ${context.costShockEscalationThresholdPct.toFixed(0)}%)`,
    },
    {
      label: "Recalculated at",
      value: formatDateTimeMNL(context.recalculatedAt),
    },
  ];

  drawTable(doc, {
    columns: [
      { key: "label", header: "Metric", width: 0.4 },
      { key: "value", header: "Value", width: 0.6 },
    ],
    rows,
  });
}

function writeOverviewSection(doc: PDFKit.PDFDocument, overview: ReportsOverviewData) {
  writeSectionTitle(
    doc,
    "Overview Summary",
    `Core performance metrics for the last ${REPORT_OVERVIEW_WINDOW_DAYS} days.`
  );

  drawTable(doc, {
    columns: [
      { key: "label", header: "Metric", width: 0.5 },
      { key: "value", header: "Value", width: 0.5, align: "right" },
    ],
    rows: [
      { label: "Revenue", value: formatCurrency(overview.summary.totalRevenue) },
      { label: "COGS", value: formatCurrency(overview.summary.totalCogs) },
      { label: "Gross profit", value: formatCurrency(overview.summary.totalGrossProfit) },
      { label: "Gross margin", value: formatPercent(overview.summary.grossMarginPct) },
      { label: "Units sold", value: formatNumber(overview.summary.totalUnitsSold) },
      { label: "No-sales days", value: formatNumber(overview.summary.noSalesDays) },
    ],
  });

  writeSectionTitle(doc, "Day Highlights");
  drawTable(doc, {
    columns: [
      { key: "metric", header: "Metric", width: 0.45 },
      { key: "value", header: "Value", width: 0.55 },
    ],
    rows: [
      {
        metric: "Highest grossing day",
        value: overview.summary.highestDay
          ? `${formatDateMNL(overview.summary.highestDay.date)} (${formatCurrency(overview.summary.highestDay.revenue)})`
          : "No sales day available",
      },
      {
        metric: "Lowest non-zero day",
        value: overview.summary.lowestDay
          ? `${formatDateMNL(overview.summary.lowestDay.date)} (${formatCurrency(overview.summary.lowestDay.revenue)})`
          : "No non-zero sales day available",
      },
    ],
  });

  writeSectionTitle(doc, "Daily Sales Trend");
  drawTable(doc, {
    columns: [
      { key: "date", header: "Date", width: 0.24 },
      { key: "revenue", header: "Revenue", width: 0.32, align: "right" },
      { key: "units", header: "Units Sold", width: 0.22, align: "right" },
      { key: "orders", header: "Orders", width: 0.22, align: "right" },
    ],
    rows: overview.salesTrend.map((row) => ({
      date: formatDateMNL(row.date),
      revenue: formatCurrency(row.revenue),
      units: formatNumber(row.unitsSold),
      orders: formatNumber(row.orderCount),
    })),
  });

  writeContextSection(doc, overview.metricContext);
}

function summarizeMovementTotals(
  movementTrends: Array<Record<string, string | number>>
) {
  const totals = new Map<string, number>();

  movementTrends.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (key === "date" || typeof value !== "number") {
        return;
      }

      totals.set(key, (totals.get(key) ?? 0) + value);
    });
  });

  return Array.from(totals.entries())
    .map(([type, total]) => ({
      movementType: toTitleCase(type),
      totalUnits: formatDecimal(total),
    }))
    .sort((a, b) => Number(b.totalUnits.replace(/,/g, "")) - Number(a.totalUnits.replace(/,/g, "")));
}

function summarizeBranchRevenue(analytics: ReportsAnalyticsData) {
  const totals = analytics.revenueByBranch.branches.map((branchName) => {
    const totalRevenue = analytics.revenueByBranch.data.reduce((sum, row) => {
      const value = row[branchName];
      return sum + (typeof value === "number" ? value : 0);
    }, 0);

    return {
      branch: branchName,
      totalRevenue: formatCurrency(totalRevenue),
    };
  });

  return totals.sort(
    (left, right) =>
      Number(right.totalRevenue.replace(/[^\d.-]/g, "")) -
      Number(left.totalRevenue.replace(/[^\d.-]/g, ""))
  );
}

function writeAnalyticsSection(doc: PDFKit.PDFDocument, analytics: ReportsAnalyticsData) {
  writeSectionTitle(
    doc,
    "Analytics Summary",
    `Expanded analytics across ${analytics.analyticsDays} days.`
  );

  drawTable(doc, {
    columns: [
      { key: "label", header: "Metric", width: 0.52 },
      { key: "value", header: "Value", width: 0.48, align: "right" },
    ],
    rows: [
      {
        label: `Revenue (${analytics.analyticsDays} days)`,
        value: formatCurrency(analytics.financialSummary.totalRevenue),
      },
      {
        label: `COGS (${analytics.analyticsDays} days)`,
        value: formatCurrency(analytics.financialSummary.totalCogs),
      },
      {
        label: "Gross profit",
        value: formatCurrency(analytics.financialSummary.totalGrossProfit),
      },
      {
        label: "Gross margin",
        value: formatPercent(analytics.financialSummary.grossMarginPct),
      },
      {
        label: "Units sold",
        value: formatNumber(analytics.financialSummary.totalUnitsSold),
      },
      {
        label: "Low / out-of-stock products",
        value: formatNumber(analytics.inventorySummary.lowStockCount),
      },
      {
        label: "Active products tracked",
        value: formatNumber(analytics.inventorySummary.activeProductCount),
      },
    ],
  });

  writeSectionTitle(doc, "Revenue by Category");
  drawTable(doc, {
    columns: [
      { key: "category", header: "Category", width: 0.62 },
      { key: "revenue", header: "Revenue", width: 0.38, align: "right" },
    ],
    rows: analytics.revenueByCategory.map((row) => ({
      category: row.category,
      revenue: formatCurrency(row.revenue),
    })),
    maxRows: 15,
  });

  writeSectionTitle(doc, "Top Products");
  drawTable(doc, {
    columns: [
      { key: "product", header: "Product", width: 0.4 },
      { key: "sku", header: "SKU", width: 0.18 },
      { key: "revenue", header: "Revenue", width: 0.24, align: "right" },
      { key: "units", header: "Units", width: 0.18, align: "right" },
    ],
    rows: analytics.topProducts.map((row) => ({
      product: row.name,
      sku: row.sku,
      revenue: formatCurrency(row.revenue),
      units: formatNumber(row.unitsSold),
    })),
    maxRows: 20,
  });

  writeSectionTitle(doc, "Order Status Distribution");
  drawTable(doc, {
    columns: [
      { key: "status", header: "Status", width: 0.7 },
      { key: "count", header: "Count", width: 0.3, align: "right" },
    ],
    rows: analytics.orderStatusDistribution.map((row) => ({
      status: row.status,
      count: formatNumber(row.count),
    })),
  });

  writeSectionTitle(doc, "Inventory Health Snapshot");
  drawTable(doc, {
    columns: [
      { key: "product", header: "Product", width: 0.35 },
      { key: "sku", header: "SKU", width: 0.16 },
      { key: "available", header: "Available", width: 0.14, align: "right" },
      { key: "reorder", header: "Reorder", width: 0.14, align: "right" },
      { key: "status", header: "Status", width: 0.21 },
    ],
    rows: analytics.inventoryHealth.map((row) => ({
      product: row.productName,
      sku: row.sku,
      available: formatNumber(row.available),
      reorder: formatNumber(row.reorderLevel),
      status: toTitleCase(row.status),
    })),
    maxRows: 25,
  });

  writeSectionTitle(doc, "Location Utilization");
  drawTable(doc, {
    columns: [
      { key: "location", header: "Location", width: 0.3 },
      { key: "code", header: "Code", width: 0.12 },
      { key: "type", header: "Type", width: 0.14 },
      { key: "available", header: "Available Units", width: 0.18, align: "right" },
      { key: "reserved", header: "Reserved Units", width: 0.14, align: "right" },
      { key: "products", header: "Products", width: 0.12, align: "right" },
    ],
    rows: analytics.locationUtilization.map((row) => ({
      location: row.name,
      code: row.code,
      type: toTitleCase(row.type),
      available: formatNumber(row.availableUnits),
      reserved: formatNumber(row.reservedUnits),
      products: formatNumber(row.productCount),
    })),
    maxRows: 25,
  });

  writeSectionTitle(doc, "Branch Comparison");
  drawTable(doc, {
    columns: [
      { key: "branch", header: "Branch", width: 0.21 },
      { key: "revenue", header: "Revenue", width: 0.19, align: "right" },
      { key: "orders", header: "Orders", width: 0.1, align: "right" },
      { key: "units", header: "Units", width: 0.1, align: "right" },
      { key: "avgOrder", header: "Avg Order Value", width: 0.18, align: "right" },
      { key: "topProduct", header: "Top Product", width: 0.22 },
    ],
    rows: analytics.branchComparison.map((row) => ({
      branch: `${row.name} (${row.code})`,
      revenue: formatCurrency(row.totalRevenue),
      orders: formatNumber(row.orderCount),
      units: formatNumber(row.totalUnits),
      avgOrder: formatCurrency(row.avgOrderValue),
      topProduct: row.topProduct,
    })),
    maxRows: 20,
  });

  writeSectionTitle(doc, "Movement Totals by Type");
  drawTable(doc, {
    columns: [
      { key: "movementType", header: "Movement Type", width: 0.7 },
      { key: "totalUnits", header: "Total Units", width: 0.3, align: "right" },
    ],
    rows: summarizeMovementTotals(analytics.movementTrends),
  });

  writeSectionTitle(doc, "Revenue by Branch Totals");
  drawTable(doc, {
    columns: [
      { key: "branch", header: "Branch", width: 0.7 },
      { key: "totalRevenue", header: "Total Revenue", width: 0.3, align: "right" },
    ],
    rows: summarizeBranchRevenue(analytics),
  });

  writeContextSection(doc, analytics.metricContext);
}

function formatMetricValue(metric: QuotaMetric, value: number) {
  if (metric === "revenue") {
    return formatCurrency(value);
  }

  return formatDecimal(value);
}

function writeQuotaSection(
  doc: PDFKit.PDFDocument,
  quota: ReportsQuotaData,
  quotaTarget: number | null
) {
  writeSectionTitle(
    doc,
    "Quota Summary",
    `Branch target analysis over ${quota.days} days.`
  );

  drawTable(doc, {
    columns: [
      { key: "label", header: "Metric", width: 0.58 },
      { key: "value", header: "Value", width: 0.42, align: "right" },
    ],
    rows: [
      { label: "Quota metric", value: quota.metric === "revenue" ? "Revenue" : "Units sold" },
      { label: "Quota window", value: `${quota.days} days` },
      {
        label: "Quota target",
        value: quotaTarget ? formatMetricValue(quota.metric, quotaTarget) : "Not set",
      },
      { label: "Tracked branches", value: formatNumber(quota.branchCount) },
      {
        label: "Reached target",
        value: quotaTarget
          ? `${formatNumber(quota.reachedCount)} / ${formatNumber(quota.branchCount)}`
          : "Target not set",
      },
      {
        label: "Average attainment",
        value:
          quota.averageAttainment === null
            ? "Target not set"
            : `${(quota.averageAttainment * 100).toFixed(1)}%`,
      },
      {
        label: "Best performer",
        value: quota.bestPerformer
          ? `${quota.bestPerformer.name} (${formatMetricValue(quota.metric, quota.bestPerformer.value)})`
          : "No branch activity",
      },
    ],
  });

  writeSectionTitle(doc, "Branch Results");
  drawTable(doc, {
    columns: [
      { key: "branch", header: "Branch", width: 0.16 },
      { key: "code", header: "Code", width: 0.08 },
      { key: "actual", header: "Actual", width: 0.12, align: "right" },
      { key: "avgDay", header: "Avg / Day", width: 0.12, align: "right" },
      { key: "bestDay", header: "Best Day", width: 0.12, align: "right" },
      { key: "activeDays", header: "Active Days", width: 0.1, align: "right" },
      { key: "attainment", header: "Attainment", width: 0.1, align: "right" },
      { key: "remaining", header: "Remaining", width: 0.1, align: "right" },
      { key: "status", header: "Status", width: 0.1 },
    ],
    rows: quota.rows.map((row) => ({
      branch: row.name,
      code: row.code,
      actual: formatMetricValue(quota.metric, row.currentValue),
      avgDay: formatMetricValue(quota.metric, row.averagePerDay),
      bestDay: formatMetricValue(quota.metric, row.bestDayValue),
      activeDays: formatNumber(row.activeSalesDays),
      attainment:
        row.attainmentRatio === null ? "N/A" : `${(row.attainmentRatio * 100).toFixed(1)}%`,
      remaining:
        row.remainingToTarget === null
          ? "N/A"
          : formatMetricValue(quota.metric, row.remainingToTarget),
      status:
        row.reached === null ? "Target needed" : row.reached ? "Reached" : "Below target",
    })),
    maxRows: 30,
  });
}

function writeHeader(doc: PDFKit.PDFDocument, input: ReportsPdfInput) {
  const title = getViewTitle(input.view);
  const generatedBy = `${input.generatedBy.firstName} ${input.generatedBy.lastName}`.trim();
  const metadataRows: TableRow[] = [
    { label: "Report", value: title },
    { label: "Generated at", value: formatDateTimeMNL(input.generatedAt) },
    { label: "Generated by", value: `${generatedBy} (${input.generatedBy.email})` },
    { label: "Role", value: toTitleCase(input.generatedBy.role) },
    { label: "Scope", value: input.scopeLabel },
  ];

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(CONTENT_TEXT_COLOR)
    .text(toPdfSafeText("7-Dashboard Reports"));

  doc
    .moveDown(0.2)
    .font("Helvetica")
    .fontSize(10)
    .fillColor(MUTED_TEXT_COLOR)
    .text(
      toPdfSafeText(
        "Operational performance export generated directly from live report data."
      )
    );

  doc.moveDown(0.5);

  drawTable(doc, {
    columns: [
      { key: "label", header: "Export Field", width: 0.3 },
      { key: "value", header: "Value", width: 0.7 },
    ],
    rows: metadataRows,
  });

  if (input.view === "analytics") {
    drawTable(doc, {
      columns: [
        { key: "label", header: "Filter", width: 0.35 },
        { key: "value", header: "Value", width: 0.65 },
      ],
      rows: [{ label: "Analytics window", value: `${input.analyticsDays} days` }],
    });
  } else if (input.view === "quota") {
    drawTable(doc, {
      columns: [
        { key: "label", header: "Filter", width: 0.35 },
        { key: "value", header: "Value", width: 0.65 },
      ],
      rows: [
        { label: "Quota window", value: `${input.quotaDays} days` },
        {
          label: "Quota metric",
          value: input.quotaMetric === "revenue" ? "Revenue" : "Units sold",
        },
        {
          label: "Quota target",
          value:
            input.quotaTarget === null
              ? "Not set"
              : formatMetricValue(input.quotaMetric, input.quotaTarget),
        },
      ],
    });
  }
}

function writePageFooters(doc: PDFKit.PDFDocument, generatedAt: Date) {
  const range = doc.bufferedPageRange();
  const footerStamp = `Generated ${formatDateTimeMNL(generatedAt)} | 7-Dashboard`;

  for (let pageIndex = 0; pageIndex < range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const y = doc.page.height - doc.page.margins.bottom + 14;
    const contentWidth = getPrintableWidth(doc);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED_TEXT_COLOR)
      .text(toPdfSafeText(footerStamp), doc.page.margins.left, y, {
        width: contentWidth * 0.72,
        align: "left",
      });

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED_TEXT_COLOR)
      .text(
        toPdfSafeText(`Page ${pageIndex + 1} of ${range.count}`),
        doc.page.margins.left,
        y,
        {
        width: contentWidth,
        align: "right",
        }
      );
  }
}

export async function generateReportsPdf(input: ReportsPdfInput) {
  const doc = new PDFDocument({
    autoFirstPage: true,
    size: "A4",
    margin: 48,
    bufferPages: true,
    info: {
      Title: `7-Dashboard - ${getViewTitle(input.view)}`,
      Author: "7-Dashboard",
      Subject: "Operational reports export",
      Keywords: "7-dashboard,reports,analytics,quota,pdf",
      CreationDate: input.generatedAt,
      ModDate: input.generatedAt,
    },
  });

  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    doc.on("error", (error) => {
      reject(error);
    });

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    writeHeader(doc, input);

    if (input.view === "analytics") {
      if (!input.analytics) {
        reject(new Error("Analytics data was not provided for analytics PDF view."));
        return;
      }

      writeAnalyticsSection(doc, input.analytics);
    } else if (input.view === "quota") {
      if (!input.quota) {
        reject(new Error("Quota data was not provided for quota PDF view."));
        return;
      }

      writeQuotaSection(doc, input.quota, input.quotaTarget);
    } else {
      if (!input.overview) {
        reject(new Error("Overview data was not provided for overview PDF view."));
        return;
      }

      writeOverviewSection(doc, input.overview);
    }

    writePageFooters(doc, input.generatedAt);
    doc.end();
  });
}
