import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Module augmentation for NextAuth v5 (Auth.js).
 *
 * NextAuth's built-in Session["user"] only carries name/email/image.
 * We extend it here so that session.user.id and session.user.role are
 * type-safe everywhere they are accessed, without touching library source.
 *
 * Mirror any additions here in the JWT interface below so the jwt() and
 * session() callbacks in lib/auth.ts remain consistent.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"]; // keeps name, email, image
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
