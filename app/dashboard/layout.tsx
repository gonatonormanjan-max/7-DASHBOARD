import { getNavItems } from "@/lib/permissions";
import { requireUser } from "@/lib/dal/auth";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MobileBottomNav } from "@/components/dashboard/mobile-nav";
import { DashboardThemeProvider } from "@/components/theme/dashboard-theme-provider";
import { PageTransition } from "@/components/ui/page-transition";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const navItems = getNavItems(user.role);

  return (
    <DashboardThemeProvider>
      <div className="min-h-screen lg:flex">
        <DashboardSidebar navItems={navItems} user={user} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <main className="flex-1 px-4 py-5 pb-20 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <MobileBottomNav navItems={navItems} />
      </div>
    </DashboardThemeProvider>
  );
}
