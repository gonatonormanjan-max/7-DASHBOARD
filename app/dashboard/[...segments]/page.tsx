import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">404</p>
      <h1 className="mt-3 text-2xl font-semibold text-slate-950">Page not found</h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
        This page doesn&apos;t exist or hasn&apos;t been built yet. Head back to the dashboard to
        find what you&apos;re looking for.
      </p>
      <Link
        className="mt-6 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-[#16304f]"
        href="/dashboard"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
