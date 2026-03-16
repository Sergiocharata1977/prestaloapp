import type { ReactNode } from "react";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fdfaf3_0%,#f7f3eb_45%,#efe7d8_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(180,83,9,0.18),transparent_35%)]" />
      <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
        {children}
      </div>
    </div>
  );
}
