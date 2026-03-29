# User Management System — Design Spec

## Overview

A user management system for 7Dashboard with registration, login, and a protected dashboard page. Uses NextAuth.js with Credentials provider, Prisma ORM, and PostgreSQL.

## Stack

- **Framework:** Next.js 16 (App Router) + Tailwind CSS
- **Auth:** NextAuth.js (Auth.js) with Credentials provider
- **ORM:** Prisma with PostgreSQL
- **Password hashing:** bcrypt
- **Session strategy:** JWT

## Database Schema

### User Table

| Column         | Type      | Constraints              |
|----------------|-----------|--------------------------|
| id             | UUID      | Primary key, auto-generated |
| firstName      | String    | Required                 |
| lastName       | String    | Required                 |
| email          | String    | Required, unique         |
| hashedPassword | String    | Required                 |
| createdAt      | DateTime  | Auto-set                 |
| updatedAt      | DateTime  | Auto-updated             |

### NextAuth Tables

The Prisma adapter connects NextAuth to the User table. Since we use JWT strategy, the `Session` table is not required for auth checks. The `Account` and `VerificationToken` tables are included in the schema for future OAuth/email verification support but are not actively used in the initial build.

## Pages & Routes

| Route                          | Type       | Purpose                                                    |
|--------------------------------|------------|------------------------------------------------------------|
| `/auth/register`               | Page       | Registration form: First Name, Last Name, Email, Password, Re-enter Password |
| `/auth/login`                  | Page       | Login form: Email, Password                                |
| `/dashboard`                   | Page       | Protected landing page with welcome message and stats cards |
| `/api/auth/[...nextauth]`      | API Route  | NextAuth handler (login, session, signout)                 |
| `/api/auth/register`           | API Route  | Custom registration endpoint                               |

## Auth Flow

### Registration

1. User fills out registration form (First Name, Last Name, Email, Password, Re-enter Password)
2. Client-side validation: all fields required, email format, password minimum 8 characters, passwords match
3. POST to `/api/auth/register`
4. Server-side validation: same checks as client + check email uniqueness
5. Hash password with bcrypt (salt rounds: 10)
6. Create user in PostgreSQL via Prisma
7. Return success → redirect to `/auth/login`

### Login

1. User fills out login form (Email, Password)
2. Call NextAuth `signIn("credentials", { email, password })`
3. NextAuth Credentials provider `authorize()` function:
   - Look up user by email via Prisma
   - Compare password with bcrypt
   - Return user object or null
4. On success: NextAuth creates JWT session → redirect to `/dashboard`
5. On failure: display error message on login page

### Session Management

- JWT strategy (no DB session table needed for auth checks)
- `useSession()` on client components for session data
- `getServerSession()` on server components / API routes
- JWT includes: `id`, `email`, `firstName`, `lastName`

### Route Protection

- `/dashboard` requires authentication
- Unauthenticated users redirected to `/auth/login`
- Middleware or server-side check in layout/page

## UI Design

### Layout: Split Screen

- **Left panel (dark):** Full-height dark background with 7Dashboard branding, tagline
- **Right panel (white):** Auth form with inputs and submit button
- **Responsive:** On mobile (< 768px), left panel hidden, form takes full width

### Registration Page

- Heading: "Create your account"
- Subtext: "Enter your details to get started"
- Fields: First Name + Last Name (side by side), Email, Password, Re-enter Password
- Button: "Create Account" (dark, full width)
- Footer link: "Already have an account? Sign in" → links to `/auth/login`

### Login Page

- Heading: "Welcome back"
- Subtext: "Sign in to your account"
- Fields: Email, Password
- Button: "Sign In" (dark, full width)
- Footer link: "Don't have an account? Sign up" → links to `/auth/register`

### Dashboard Page

- Top bar with user name and sign out button
- Welcome message: "Welcome back, {firstName}!"
- 3-4 placeholder stat cards in a grid (e.g., "Total Users", "Active Sessions")
- Clean, minimal layout with Tailwind

## File Structure

```
app/
  auth/
    login/page.tsx          # Login page
    register/page.tsx       # Registration page
  dashboard/page.tsx        # Protected dashboard
  api/
    auth/
      [...nextauth]/route.ts  # NextAuth API handler
      register/route.ts       # Registration API endpoint
lib/
  auth.ts                   # NextAuth configuration & options
  prisma.ts                 # Prisma client singleton
prisma/
  schema.prisma             # Database schema
components/
  auth-layout.tsx           # Split-screen layout (shared by login/register)
```

## Validation Rules

| Field          | Rules                                      |
|----------------|--------------------------------------------|
| firstName      | Required, 1-50 characters                  |
| lastName       | Required, 1-50 characters                  |
| email          | Required, valid email format, unique        |
| password       | Required, minimum 8 characters             |
| confirmPassword| Required, must match password               |

## Error Handling

- **Registration:** duplicate email → "An account with this email already exists"
- **Login:** invalid credentials → "Invalid email or password" (generic to prevent enumeration)
- **Form validation:** inline error messages below each field
- **Server errors:** generic "Something went wrong" message

## Out of Scope

- Email verification
- Password reset / forgot password
- OAuth providers (Google, GitHub, etc.)
- Role-based access control
- Profile editing

These can be added incrementally in future iterations.
