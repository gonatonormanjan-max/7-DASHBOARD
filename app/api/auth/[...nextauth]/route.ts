import { type NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";

export const GET = handlers.GET;

// Route-level rate limit: coarse DDoS/abuse filter before auth logic runs.
// A tighter per-IP limit also fires inside the authorize callback in lib/auth.ts.
const ROUTE_RATE_LIMIT = 20;
const ROUTE_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function buildLoginUrl(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/auth/login", req.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.href;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const result = await consumeRateLimit({
      key: `route:${ip}`,
      limit: ROUTE_RATE_LIMIT,
      windowMs: ROUTE_RATE_WINDOW_MS,
    });

    if (!result.allowed) {
      return NextResponse.json(
        { url: buildLoginUrl(req, { error: "AccessDenied", code: "rate_limited" }) },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfterSeconds) },
        }
      );
    }

    return handlers.POST(req);
  } catch (error) {
    console.error("Auth route failed before responding.", error);

    return NextResponse.json(
      { url: buildLoginUrl(req, { error: "Configuration" }) },
      { status: 500 }
    );
  }
}
