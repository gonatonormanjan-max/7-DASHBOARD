# User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a user management system with registration, login, and a protected dashboard using NextAuth v5, Prisma, and PostgreSQL.

**Architecture:** NextAuth v5 (Auth.js) with Credentials provider handles authentication. Prisma ORM manages the PostgreSQL database. Split-screen UI for auth pages (dark branding left, form right). Route protection via Next.js 16 `proxy.ts`.

**Tech Stack:** Next.js 16, NextAuth v5 (Auth.js), Prisma, PostgreSQL, bcryptjs, Tailwind CSS

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install production dependencies**

Run:
```bash
npm install next-auth@latest @auth/prisma-adapter @prisma/client bcryptjs
```

- [ ] **Step 2: Install dev dependencies**

Run:
```bash
npm install --save-dev prisma @types/bcryptjs
```

- [ ] **Step 3: Verify installation**

Run:
```bash
npx prisma --version
```
Expected: Prisma version output (e.g., `prisma : 6.x.x`)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install auth and database dependencies"
```

---

### Task 2: Set Up Prisma Schema and Client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`
- Create: `.env`

- [ ] **Step 1: Initialize Prisma**

Run:
```bash
npx prisma init
```
Expected: Creates `prisma/schema.prisma` and `.env` with `DATABASE_URL` placeholder.

- [ ] **Step 2: Add `.env` to `.gitignore`**

Open `.gitignore` and add at the end:

```
# env
.env
.env.local
```

- [ ] **Step 3: Set DATABASE_URL in `.env`**

Edit `.env`:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
AUTH_SECRET="generate-a-random-secret-here"
```

Generate `AUTH_SECRET` by running:
```bash
npx auth secret
```

- [ ] **Step 4: Write Prisma schema**

Replace the contents of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id             String    @id @default(uuid())
  firstName      String
  lastName       String
  email          String    @unique
  hashedPassword String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  accounts       Account[]
}

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

- [ ] **Step 5: Run migration**

Run:
```bash
npx prisma migrate dev --name init
```
Expected: Migration created and applied. Tables `User` and `Account` created in PostgreSQL.

- [ ] **Step 6: Create Prisma client singleton**

Create `lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma lib/prisma.ts .gitignore
git commit -m "feat: set up Prisma schema with User and Account models"
```

---

### Task 3: Configure NextAuth v5

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create NextAuth configuration**

Create `lib/auth.ts`:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { auth, handlers, signIn, signOut } = NextAuth({
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
});
```

- [ ] **Step 2: Create route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Verify the app compiles**

Run:
```bash
npm run build
```
Expected: Build succeeds (may show warnings about missing env vars if `.env` is not configured yet, but no type errors).

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts app/api/auth/\[...nextauth\]/route.ts
git commit -m "feat: configure NextAuth v5 with Credentials provider"
```

---

### Task 4: Create Registration API Route

**Files:**
- Create: `app/api/auth/register/route.ts`

- [ ] **Step 1: Create registration endpoint**

Create `app/api/auth/register/route.ts`:

```ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, password, confirmPassword } = body;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        hashedPassword,
      },
    });

    return NextResponse.json(
      { message: "User created successfully" },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/register/route.ts
git commit -m "feat: add registration API endpoint"
```

---

### Task 5: Create Split-Screen Auth Layout Component

**Files:**
- Create: `components/auth-layout.tsx`

- [ ] **Step 1: Create the shared auth layout**

Create `components/auth-layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden md:flex md:w-1/2 flex-col justify-center bg-gradient-to-br from-zinc-900 to-zinc-800 px-12">
        <h1 className="text-3xl font-bold text-white">7Dashboard</h1>
        <p className="mt-2 text-zinc-400">Your complete management platform</p>
      </div>

      {/* Right Panel - Form */}
      <div className="flex w-full items-center justify-center px-6 md:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/auth-layout.tsx
git commit -m "feat: add split-screen auth layout component"
```

---

### Task 6: Create Registration Page

**Files:**
- Create: `app/auth/register/page.tsx`

- [ ] **Step 1: Create the registration page**

Create `app/auth/register/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthLayout from "@/components/auth-layout";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    if (data.password !== data.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (data.password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Something went wrong");
        setLoading(false);
        return;
      }

      router.push("/auth/login?registered=true");
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold text-zinc-900">
        Create your account
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Enter your details to get started
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-zinc-700">
              First Name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              maxLength={50}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-zinc-700">
              Last Name
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              maxLength={50}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700">
            Re-enter Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-zinc-900 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth/register/page.tsx
git commit -m "feat: add registration page with split-screen layout"
```

---

### Task 7: Create Login Page

**Files:**
- Create: `app/auth/login/page.tsx`

- [ ] **Step 1: Create the login page**

Create `app/auth/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthLayout from "@/components/auth-layout";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold text-zinc-900">Welcome back</h2>
      <p className="mt-1 text-sm text-zinc-500">Sign in to your account</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {registered && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-600">
            Account created successfully. Please sign in.
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Don&apos;t have an account?{" "}
        <Link href="/auth/register" className="font-medium text-zinc-900 hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth/login/page.tsx
git commit -m "feat: add login page with split-screen layout"
```

---

### Task 8: Create Protected Dashboard Page

**Files:**
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page**

Create `app/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top Bar */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-zinc-900">7Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600">{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/auth/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h2 className="text-2xl font-semibold text-zinc-900">
          Welcome back, {session.user.name?.split(" ")[0]}!
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Here&apos;s an overview of your dashboard.
        </p>

        {/* Stats Cards */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Users", value: "—" },
            { label: "Active Sessions", value: "—" },
            { label: "New Signups", value: "—" },
            { label: "Uptime", value: "99.9%" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-zinc-200 bg-white p-6"
            >
              <p className="text-sm text-zinc-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add protected dashboard page with stats cards"
```

---

### Task 9: Set Up Route Protection with Proxy

**Files:**
- Create: `proxy.ts` (project root)

Note: Next.js 16 renamed `middleware.ts` to `proxy.ts`. The export is `proxy` instead of `middleware`.

- [ ] **Step 1: Create proxy for route protection**

Create `proxy.ts` in the project root:

```ts
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/auth");
  const isDashboard = pathname.startsWith("/dashboard");

  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  // Redirect authenticated users away from auth pages
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users to login
  if (isDashboard && !token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
```

- [ ] **Step 2: Commit**

```bash
git add proxy.ts
git commit -m "feat: add proxy for auth route protection"
```

---

### Task 10: Update Home Page to Redirect

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update home page to redirect to dashboard or login**

Replace the contents of `app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  } else {
    redirect("/auth/login");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: redirect home page based on auth state"
```

---

### Task 11: Verify Full Build

- [ ] **Step 1: Run the build**

Run:
```bash
npm run build
```
Expected: Build completes with no errors.

- [ ] **Step 2: Start dev server and test manually**

Run:
```bash
npm run dev
```

Test the following flow:
1. Visit `http://localhost:3000` — should redirect to `/auth/login`
2. Click "Sign up" → navigate to `/auth/register`
3. Fill out all fields and submit → should redirect to `/auth/login` with success message
4. Log in with the registered credentials → should redirect to `/dashboard`
5. See welcome message with first name and stats cards
6. Click "Sign Out" → should redirect to `/auth/login`
7. Try visiting `/dashboard` directly → should redirect to `/auth/login`

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete user management system with auth flow"
```
