# Fix: Restore Three Truncated Files

## Context

A previous automated fix session partially edited three files but terminated before completing each write. All three files are now truncated — they compile-fail or silently break authentication. Do not attempt to understand or preserve the partial content currently in any of these files. Replace each file entirely with the exact content specified below.

**Files to fix:**
1. `lib/auth.ts`
2. `app/api/auth/[...nextauth]/route.ts`
3. `next.config.ts`

---

## Instructions

For each file below:
- Overwrite the entire file with the exact content in the code block.
- Do not add, remove, or reformat anything. The content is final.
- Do not merge with existing file content. The existing content is broken.
- After writing all three files, verify the project still compiles by running `npx tsc --noEmit`.

---

## File 1: `lib/auth.ts`

**What this file does:** Configures NextAuth v5 with the Credentials provider. This fix adds three things on top of the original working version: (1) AUTH_SECRET validation at startup, (2) a 30-minute JWT maxAge to force session re-validation and limit how long a deactivated account can remain active, (3) rate limiting inside the `authorize` callback keyed by client IP — 10 attempts per 15 minutes — using the already-existing `lib/rate-limit.ts` module.

**Why the authorize callback receives `request`:** NextAuth v5 / `@auth/core` passes the original `Request` object as the second argument to `authorize`. The IP is read from the `x-forwarded-for` header (set by reverse proxies / Vercel) with `x-real-ip` as a fallback.

**Why `assertRole` is in the jwt callback:** The JWT is the source of truth for `session.user.role` throughout the app. Asserting the role at token-creation time ensures a malformed token causes an explicit error rather than silently propagating `undefined` as a role.

Replace `lib/auth.ts` with:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

const authSecret = process.env.AUTH_SECRET;

if (!authSecret) {
  throw new Error(
    "AUTH_SECRET is not set. Define AUTH_SECRET before starting the application."
  );
}

function assertRole(value: unknown): Role {
  if (value === "ADMIN" || value === "SYSTEM_MANAGER" || value === "SALES_STAFF") {
    return value;
  }

  throw new Error("Authentication token is missing a valid role.");
}

const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 30; // 30 minutes

const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: authSecret,
  session: {
    strategy: "jwt",
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const ip = getClientIp(request);
        const rateLimitResult = consumeRateLimit({
          key: `login:${ip}`,
          limit: LOGIN_RATE_LIMIT,
          windowMs: LOGIN_RATE_WINDOW_MS,
        });

        if (!rateLimitResult.allowed) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = assertRole(user.role);
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as typeof session.user.role;
      }
      return session;
    },
  },
});
```

---

## File 2: `app/api/auth/[...nextauth]/route.ts`

**What this file does:** Exposes NextAuth's GET and POST handlers as the Next.js App Router route. The previous attempt tried to add a wrapper here, which was unnecessary — rate limiting is already handled inside the `authorize` callback in `lib/auth.ts`. This file should be the minimal, correct three-line form.

Replace `app/api/auth/[...nextauth]/route.ts` with:

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

---

## File 3: `next.config.ts`

**What this file does:** Adds security response headers for all routes. These are the minimum production-hardening headers for a business web app: clickjacking protection, MIME sniffing prevention, referrer control, HSTS (production only), and a permissive-but-explicit Content Security Policy that does not break Next.js or Tailwind in either dev or production.

**CSP note:** The CSP uses `unsafe-inline` for scripts and styles because Next.js currently injects inline scripts during hydration and Tailwind generates inline styles. This is an intentional tradeoff — it blocks the most common injection vectors (external script loading, framing, object embeds) without breaking the app. Tightening to nonce-based CSP is a separate, larger task.

Replace `next.config.ts` with:

```ts
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "same-origin",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

---

## Verification

After writing all three files, run:

```bash
npx tsc --noEmit
```

Expected result: zero TypeScript errors. If errors appear, do not attempt to auto-fix them — report the full error output instead.

Do not run the dev server, do not run migrations, do not touch any other files.
