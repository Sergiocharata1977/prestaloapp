import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8f4ec_0%,#f5efe4_40%,#efe7d8_100%)] text-slate-900 lg:pl-72">
        <Sidebar />
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
