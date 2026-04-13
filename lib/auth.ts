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
    const firstForwardedIp = forwarded
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);

    if (firstForwardedIp) {
      return firstForwardedIp;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
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
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) {
          return null;
        }

        const normalizedEmail = email.trim().toLowerCase();
        const ip = getClientIp(request);
        const [ipRateLimitResult, emailRateLimitResult] = await Promise.all([
          consumeRateLimit({
            key: `auth:ip:${ip}`,
            limit: LOGIN_RATE_LIMIT,
            windowMs: LOGIN_RATE_WINDOW_MS,
          }),
          consumeRateLimit({
            key: `auth:email:${normalizedEmail}`,
            limit: LOGIN_RATE_LIMIT,
            windowMs: LOGIN_RATE_WINDOW_MS,
          }),
        ]);

        if (!ipRateLimitResult.allowed || !emailRateLimitResult.allowed) {
          const retryAfterSeconds = Math.max(
            ipRateLimitResult.retryAfterSeconds,
            emailRateLimitResult.retryAfterSeconds
          );

          throw new Error(
            `Too many login attempts. Please try again in ${retryAfterSeconds} seconds.`
          );
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            hashedPassword: true,
            role: true,
            isActive: true,
          },
        });

        if (!user || !user.hashedPassword || !user.isActive) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
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
        if (!user.id) {
          throw new Error("Authentication token is missing a user ID.");
        }

        token.id = user.id;
        token.role = assertRole((user as { role?: unknown }).role);
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.id !== "string") {
        throw new Error("Authentication token is missing a user ID.");
      }

      if (typeof token.role === "undefined") {
        throw new Error("Authentication token is missing a valid role.");
      }

      session.user.id = token.id;
      session.user.role = assertRole(token.role);

      return session;
    },
  },
});
