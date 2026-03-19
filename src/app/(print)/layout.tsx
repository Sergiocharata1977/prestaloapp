import type { ReactNode } from "react";

export default function PrintLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      {children}
    </main>
  );
}
