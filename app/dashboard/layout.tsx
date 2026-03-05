import { redirect } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/tenant";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuth();

  const church = session.user.churchId
    ? await db.church.findUnique({
        where: { id: session.user.churchId },
        select: { name: true },
      })
    : null;

  if (session.user.churchId && !church) {
    redirect("/login");
  }

  const unreadNotifications = session.user.churchId
    ? await db.notification.count({
        where: { churchId: session.user.churchId, userId: session.user.id, isRead: false },
      })
    : 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_45%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.07),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(148,163,184,0.12),_transparent_45%)] lg:flex lg:h-screen lg:overflow-hidden">
      <Sidebar role={session.user.role} churchName={church?.name} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-24 lg:min-h-0 lg:pb-0">
        <Topbar
          role={session.user.role}
          name={session.user.name}
          churchName={church?.name}
          unreadNotifications={unreadNotifications}
        />
        <main className="page-enter flex-1 px-3 py-4 sm:px-5 md:py-5 lg:overflow-y-auto lg:px-8">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>
      <MobileNav role={session.user.role} />
    </div>
  );
}
