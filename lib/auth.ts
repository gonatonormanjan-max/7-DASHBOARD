import NextAuth, { getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { AuthOptions, Session } from "next-auth";
import type { NextRequest } from "next/server";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

// auth() — server-side session helper (NextAuth v4 equivalent of v5 auth())
export async function auth(): Promise<Session | null> {
  return getServerSession(authOptions);
}

// handlers — App Router GET/POST handlers
const handler = NextAuth(authOptions);

interface RouteHandlerContext {
  params: Promise<{ nextauth: string[] }>;
}

export const handlers = {
  GET: (req: NextRequest, context: RouteHandlerContext) =>
    handler(req, context as any),
  POST: (req: NextRequest, context: RouteHandlerContext) =>
    handler(req, context as any),
};

// signIn / signOut — re-exported for convenience (client-side usage via next-auth/react)
export { signIn, signOut } from "next-auth/react";
