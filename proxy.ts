import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const SALES_STAFF_ACTIVE_LOCATION_COOKIE = "salesStaffActiveLocationId";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/auth");
  const isRegisterPage = pathname === "/auth/register";
  const isSelectLocationPage = pathname.startsWith("/auth/select-location");
  const isDashboard = pathname.startsWith("/dashboard");

  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (isRegisterPage) {
    return NextResponse.redirect(
      new URL(token ? "/dashboard" : "/auth/login", request.url)
    );
  }

  if (isSelectLocationPage && !token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Redirect authenticated users away from auth pages
  if (isAuthPage && token && !isSelectLocationPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users to login
  if (isDashboard && !token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (isDashboard && token) {
    const authToken = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    });
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
