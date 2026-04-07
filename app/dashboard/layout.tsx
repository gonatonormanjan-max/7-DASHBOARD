import { getNavItems } from "@/lib/permissions";
import { requireUser } from "@/lib/dal/auth";
import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MobileBottomNav } from "@/components/dashboard/mobile-nav";
import { PageTransition } from "@/components/ui/page-transition";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const navItems = getNavItems(user.role);

  return (
    <div className="min-h-screen lg:flex">
      <DashboardSidebar navItems={navItems} user={user} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader user={user} />
        <main className="flex-1 px-4 py-5 pb-20 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <MobileBottomNav navItems={navItems} />
    </div>
  );
}
