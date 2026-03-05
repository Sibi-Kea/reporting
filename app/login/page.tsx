import { Church, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function LoginPage() {
  const session = await getServerAuthSession();
  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    });
    if (user?.isActive) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="page-enter flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-2">
        <section className="hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-700 to-emerald-700 p-10 text-white shadow-xl lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="inline-flex rounded-xl bg-white/15 p-3">
              <Church className="h-7 w-7" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold">CRC Reporting</h1>
            <p className="mt-3 max-w-md text-sm text-white/85">
              Multi-tenant church management built for pastors and church admins. Clear workflows, fast screens, and secure data boundaries.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-white/75">Security model</p>
            <p className="mt-2 text-sm text-white/90">
              Credentials authentication with role-based route protection and church-level data isolation.
            </p>
          </div>
        </section>
        <Card className="rounded-3xl p-8 md:p-10">
          <div className="mb-6 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-700" />
            <p className="text-sm font-medium text-slate-600">Secure Staff Access</p>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Sign in to continue</h2>
          <p className="mt-2 text-sm text-slate-500">Use your church staff email and password.</p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </Card>
      </div>
    </main>
  );
}
