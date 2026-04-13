import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const SALES_STAFF_ACTIVE_LOCATION_COOKIE = "salesStaffActiveLocationId";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/auth");
  const isRegisterPage = pathname === "/auth/register";
  const isSelectLocationPage = pathname.startsWith("/auth/select-location");
  const isDashboard = pathname.startsWith("/dashboard");

  // Validate the JWT once at the top — all redirect decisions use this result.
  // Previously the proxy checked raw cookie presence (a string), which is truthy
  // even when the JWT inside is expired or invalidated (e.g. after AUTH_SECRET
  // rotation). That caused a redirect loop: cookie present → redirect to
  // /dashboard → server-side requireUser() rejects invalid token → redirect back
  // to /auth/login → repeat. Using getToken() here makes "authenticated" mean
  // "has a valid, verifiable JWT" — the same thing requireUser() checks server-side.
  const authToken = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  const isAuthenticated = Boolean(authToken);

  if (isRegisterPage) {
    return NextResponse.redirect(
      new URL(isAuthenticated ? "/dashboard" : "/auth/login", request.url)
    );
  }

  if (isSelectLocationPage && !isAuthenticated) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Redirect authenticated users away from auth pages (except select-location,
  // which authenticated SALES_STAFF need to visit on first dashboard access).
  if (isAuthPage && isAuthenticated && !isSelectLocationPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users away from protected pages.
  if (isDashboard && !isAuthenticated) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Enforce branch selection for SALES_STAFF before they reach any dashboard page.
  if (isDashboard && isAuthenticated) {
    const role = typeof authToken?.role === "string" ? authToken.role : null;
    const hasSelectedLocation = Boolean(
      request.cookies.get(SALES_STAFF_ACTIVE_LOCATION_COOKIE)?.value?.trim()
    );

    if (role === "SALES_STAFF" && !hasSelectedLocation) {
      const nextPath = `${pathname}${request.nextUrl.search}`;
      const redirectUrl = new URL("/auth/select-location", request.url);
      redirectUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
