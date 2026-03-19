"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Plus, Users, BarChart3, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface GlobalStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalUsers: number;
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<GlobalStats>({
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      const idToken = await user?.getIdToken();
      const res = await fetch("/api/super-admin/stats", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al cargar estadísticas");
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch (e) {
      setError("Error de conexión");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Super Admin
        </p>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Global</h1>
        <p className="mt-1 text-sm text-slate-500">
          Panel de control del sistema Préstalo
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Organizaciones"
          value={loading ? "..." : stats.totalOrganizations}
          subtitle={`${stats.activeOrganizations} activas`}
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
          href="/super-admin/organizaciones"
          color="blue"
        />
        <StatCard
          title="Usuarios Globales"
          value={loading ? "..." : stats.totalUsers}
          subtitle="En todas las organizaciones"
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          href="/super-admin/usuarios"
          color="emerald"
        />
        <StatCard
          title="Organizaciones Activas"
          value={loading ? "..." : stats.activeOrganizations}
          subtitle={`de ${stats.totalOrganizations} totales`}
          icon={<BarChart3 className="h-5 w-5 text-purple-600" />}
          href="/super-admin/organizaciones"
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-blue-600" />
                Organizaciones
              </CardTitle>
              <Link href="/super-admin/organizaciones/nueva">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-1 h-3 w-3" />
                  Nueva
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <NavLink href="/super-admin/organizaciones" label="Ver todas las organizaciones" />
            <NavLink href="/super-admin/organizaciones/nueva" label="Crear nueva organización" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-emerald-600" />
              Usuarios Globales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <NavLink href="/super-admin/usuarios" label="Ver todos los usuarios" />
            <NavLink href="/super-admin/usuarios/nuevo" label="Crear nuevo usuario" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-amber-600" />
              Demo Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <NavLink href="/super-admin/demo-requests" label="Ver solicitudes de demo" />
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatusItem label="Servidor" status="Operativo" ok />
            <StatusItem label="Base de Datos" status="Operativo" ok />
            <StatusItem label="Autenticación" status="Operativo" ok />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- helpers ---

function StatCard({
  title,
  value,
  subtitle,
  icon,
  href,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
  color: "blue" | "emerald" | "purple";
}) {
  const bg = {
    blue: "bg-blue-50",
    emerald: "bg-emerald-50",
    purple: "bg-purple-50",
  }[color];

  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">{title}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
            </div>
            <div className={`rounded-xl p-3 ${bg}`}>{icon}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      {label}
    </Link>
  );
}

function StatusItem({
  label,
  status,
  ok,
}: {
  label: string;
  status: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span
        className={`rounded px-2 py-0.5 text-xs font-semibold ${
          ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}
      >
        {status}
      </span>
    </div>
  );
}
