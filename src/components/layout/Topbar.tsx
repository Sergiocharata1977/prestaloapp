"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function Topbar() {
  const router = useRouter();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  const userName = user?.displayName || user?.email || "Usuario";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 backdrop-blur">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
              Panel interno
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              Operación diaria
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{userName}</p>
              <p className="text-xs text-slate-500">Sesión activa</p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
        <Separator />
      </div>
    </header>
  );
}
