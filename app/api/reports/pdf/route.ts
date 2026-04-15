import { NextRequest, NextResponse } from "next/server";
import type { QuotaMetric } from "@/lib/dal/reports";
import {
  DEFAULT_ANALYTICS_WINDOW_DAYS,
  DEFAULT_QUOTA_WINDOW_DAYS,
  getReportsAnalyticsData,
  getReportsOverviewData,
  getReportsQuotaData,
} from "@/lib/dal/reports";
import { getCurrentUser, getSalesStaffActiveLocationId } from "@/lib/dal/auth";
import { hasPermission } from "@/lib/permissions";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import { prisma } from "@/lib/prisma";
import { generateReportsPdf } from "@/lib/reports/pdf";
import { logAudit } from "@/lib/audit";
import { isReportsPdfExportEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportView = "overview" | "analytics" | "quota";

function parseView(value: string | null): ReportView {
  if (value === "analytics" || value === "quota") {
    return value;
  }

  return "overview";
}

function parsePositiveInt(value: string | null, fallback: number, max = 365) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function parsePositiveNumber(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseQuotaMetric(value: string | null): QuotaMetric {
  return value === "units" ? "units" : "revenue";
}

function getFileDatePart(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BUSINESS_TIMEZONE,
  }).format(date);
}

function getViewFileLabel(view: ReportView) {
  if (view === "analytics") {
    return "analytics";
  }

  if (view === "quota") {
    return "quota";
  }

  return "overview";
}

async function resolveScopeLabel(locationId: string | null) {
  if (!locationId) {
    return "All active locations";
  }

  const location = await prisma.stockLocation.findUnique({
    where: { id: locationId },
    select: { name: true, code: true },
  });

  if (!location) {
    return "Scoped to active sales location";
  }

  return `${location.name} (${location.code})`;
}

export async function GET(req: NextRequest) {
  if (!isReportsPdfExportEnabled) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Your account is inactive." }, { status: 403 });
    }

    if (!hasPermission(user.role, "reports", "read")) {
      return NextResponse.json(
        { error: "You do not have permission to export reports." },
        { status: 403 }
      );
    }

    const view = parseView(req.nextUrl.searchParams.get("view"));
    const analyticsDays = parsePositiveInt(
      req.nextUrl.searchParams.get("analyticsDays"),
      DEFAULT_ANALYTICS_WINDOW_DAYS
    );
    const quotaDays = parsePositiveInt(
      req.nextUrl.searchParams.get("quotaDays"),
      DEFAULT_QUOTA_WINDOW_DAYS
    );
    const quotaMetric = parseQuotaMetric(req.nextUrl.searchParams.get("quotaMetric"));
    const quotaTarget = parsePositiveNumber(req.nextUrl.searchParams.get("quotaTarget"));

    const activeLocationId =
      user.role === "SALES_STAFF" ? await getSalesStaffActiveLocationId(user) : null;

    if (user.role === "SALES_STAFF" && !activeLocationId) {
      return NextResponse.json(
        { error: "Select your working branch before exporting reports." },
        { status: 400 }
      );
    }

    const generatedAt = new Date();
    const scopeLabel = await resolveScopeLabel(activeLocationId);

    const pdfBuffer =
      view === "analytics"
        ? await generateReportsPdf({
            view,
            generatedAt,
            generatedBy: {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              role: user.role,
            },
            scopeLabel,
            analyticsDays,
            quotaDays,
            quotaMetric,
            quotaTarget,
            analytics: await getReportsAnalyticsData(analyticsDays, {
              locationId: activeLocationId,
            }),
          })
        : view === "quota"
          ? await generateReportsPdf({
              view,
              generatedAt,
              generatedBy: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
              },
              scopeLabel,
              analyticsDays,
              quotaDays,
              quotaMetric,
              quotaTarget,
              quota: await getReportsQuotaData({
                days: quotaDays,
                metric: quotaMetric,
                target: quotaTarget,
                locationId: activeLocationId,
              }),
            })
          : await generateReportsPdf({
              view,
              generatedAt,
              generatedBy: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
              },
              scopeLabel,
              analyticsDays,
              quotaDays,
              quotaMetric,
              quotaTarget,
              overview: await getReportsOverviewData({
                locationId: activeLocationId,
              }),
            });

    const fileName = `7dashboard-reports-${getViewFileLabel(view)}-${getFileDatePart(generatedAt)}.pdf`;

    try {
      await logAudit({
        userId: user.id,
        action: "reports.export_pdf",
        entity: "report",
        entityId: view,
        details: {
          view,
          analyticsDays,
          quotaDays,
          quotaMetric,
          quotaTarget,
          scopedLocationId: activeLocationId,
          scopeLabel,
          generatedAt: generatedAt.toISOString(),
          fileName,
        },
      });
    } catch (auditError) {
      console.warn("Report PDF export succeeded but audit logging failed.", auditError);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Failed to generate reports PDF export.", error);

    const detail = error instanceof Error ? error.message : String(error);

    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        {
          error:
            "The report PDF could not be generated right now. Please try again in a few seconds.",
          detail,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error:
          "The report PDF could not be generated right now. Please try again in a few seconds.",
      },
      { status: 500 }
    );
  }
}
