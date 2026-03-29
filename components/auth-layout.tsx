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
