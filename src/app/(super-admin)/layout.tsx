import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { SuperAdminSidebar } from "@/components/layout/SuperAdminSidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function SuperAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <AuthGuard requiredRole="super_admin">
      <div className="min-h-screen bg-slate-100 text-slate-900 lg:pl-72">
        <SuperAdminSidebar />
        <div className="flex min-h-screen flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
