"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import AuthLayout from "@/components/auth-layout";

function resolveSignInErrorMessage(result: {
  error?: string;
  code?: string;
  url?: string | null;
}) {
  const redirectUrl = result.url
    ? new URL(result.url, window.location.origin)
    : null;
  const error = result.error ?? redirectUrl?.searchParams.get("error") ?? undefined;
  const code = result.code ?? redirectUrl?.searchParams.get("code") ?? undefined;

  if (code === "rate_limited") {
    return "Too many login attempts. Please try again later.";
  }

  if (error === "CredentialsSignin" || error === "AccessDenied") {
    return "Invalid email or password";
  }

  if (error === "CallbackRouteError" || error === "Configuration") {
    return "Unable to sign in right now. Please try again.";
  }

  return null;
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo: "/dashboard",
      });

      const errorMessage = result
        ? resolveSignInErrorMessage(result)
        : "Unable to sign in right now. Please try again.";

      if (errorMessage) {
        setError(errorMessage);
        return;
      }

      if (!result?.ok || !result.url) {
        setError("Unable to sign in right now. Please try again.");
        return;
      }

      window.location.href = result.url;
    } catch (error) {
      console.error("Sign-in failed.", error);
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mb-6 flex justify-center">
        <img
          src="/dispoz-logo.png"
          alt="Dispoz Vape Lounge"
          className="h-[336px] w-[336px] object-contain"
        />
      </div>
      <h2 className="text-2xl font-semibold text-zinc-900">Welcome back</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Sign in with the account issued by your administrator.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
    </AuthLayout>
  );
}
