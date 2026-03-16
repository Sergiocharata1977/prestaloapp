'use client'

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type AuthGuardProps = {
  children: ReactNode;
  requiredRole?: string;
};

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const router = useRouter();
  const { loading, role, user } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requiredRole && role !== requiredRole) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-sm text-slate-600">
          No tenes permisos para acceder a esta seccion.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
