"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, RefreshCcw, Users } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import type { Column } from "@/components/ui/data-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Organization } from "@/types/super-admin";

function formatDate(date: string | null) {
  if (!date) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
  }).format(new Date(date));
}

function PlanBadge({ plan }: { plan: Organization["plan"] }) {
  const className = {
    free: "border-slate-200 bg-slate-100 text-slate-700",
    pro: "border-blue-200 bg-blue-100 text-blue-700",
    enterprise: "border-emerald-200 bg-emerald-100 text-emerald-700",
  }[plan];

  return <Badge className={className}>{plan}</Badge>;
}

function StatusBadge({ status }: { status: Organization["status"] }) {
  const className =
    status === "active"
      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
      : "border-amber-200 bg-amber-100 text-amber-700";

  return <Badge className={className}>{status === "active" ? "Activa" : "Inactiva"}</Badge>;
}

export default function SuperAdminOrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);

  useEffect(() => {
    void loadOrganizations();
  }, []);

  async function loadOrganizations() {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch("/api/super-admin/organizations");
      const data = (await response.json()) as {
        error?: string;
        organizations?: Organization[];
      };

      if (!response.ok) {
        setError(data.error ?? "No se pudo cargar la lista");
        return;
      }

      setOrganizations(data.organizations ?? []);
    } catch (fetchError) {
      console.error(fetchError);
      setError("Error de conexión al cargar organizaciones");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(organization: Organization) {
    try {
      setBusyOrgId(organization.id);
      const response = await apiFetch(
        `/api/super-admin/organizations/${organization.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: organization.name,
            plan: organization.plan,
            status: organization.status === "active" ? "inactive" : "active",
          }),
        }
      );
      const data = (await response.json()) as {
        error?: string;
        organization?: Organization;
      };

      if (!response.ok || !data.organization) {
        setError(data.error ?? "No se pudo actualizar el estado");
        return;
      }

      setOrganizations((current) =>
        current.map((item) => (item.id === data.organization?.id ? data.organization : item))
      );
    } catch (updateError) {
      console.error(updateError);
      setError("No se pudo actualizar la organización");
    } finally {
      setBusyOrgId(null);
    }
  }

  const columns = useMemo<Column<Organization>[]>(
    () => [
      {
        key: "name",
        header: "Nombre",
        render: (organization) => (
          <div>
            <div className="font-medium text-slate-900">{organization.name}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span>{organization.adminEmail}</span>
              <StatusBadge status={organization.status} />
            </div>
          </div>
        ),
      },
      {
        key: "plan",
        header: "Plan",
        width: "140px",
        render: (organization) => <PlanBadge plan={organization.plan} />,
      },
      {
        key: "createdAt",
        header: "Creada",
        width: "140px",
        render: (organization) => formatDate(organization.createdAt),
      },
      {
        key: "clients",
        header: "Clientes",
        width: "110px",
        render: (organization) => organization.metrics.clients.toString(),
      },
      {
        key: "credits",
        header: "Créditos",
        width: "110px",
        render: (organization) => organization.metrics.credits.toString(),
      },
      {
        key: "actions",
        header: "Acciones",
        width: "280px",
        className: "text-right",
        render: (organization) => (
          <div
            className="flex items-center justify-end gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <Button asChild variant="outline" size="sm">
              <Link href={`/super-admin/usuarios?orgId=${organization.id}`}>
                <Users className="h-3.5 w-3.5" />
                Usuarios
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/super-admin/organizaciones/${organization.id}`)
              }
            >
              Detalle
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busyOrgId === organization.id}
              onClick={() => void toggleStatus(organization)}
            >
              {organization.status === "active" ? "Desactivar" : "Activar"}
            </Button>
          </div>
        ),
      },
    ],
    [busyOrgId, router]
  );

  const stats = useMemo(() => {
    const active = organizations.filter((item) => item.status === "active").length;
    const clients = organizations.reduce((acc, item) => acc + item.metrics.clients, 0);
    const credits = organizations.reduce((acc, item) => acc + item.metrics.credits, 0);

    return {
      total: organizations.length,
      active,
      clients,
      credits,
    };
  }, [organizations]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Super Admin
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Organizaciones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Alta, activación y seguimiento global de tenants.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => void loadOrganizations()}>
            <RefreshCcw className="h-4 w-4" />
            Recargar
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/super-admin/organizaciones/nueva">
              <Plus className="h-4 w-4" />
              Nueva organización
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total organizaciones</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Activas</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Clientes</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.clients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Créditos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.credits}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-blue-600" />
            Lista de organizaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={organizations}
            loading={loading}
            emptyMessage="Todavía no hay organizaciones registradas."
            onRowClick={(organization) =>
              router.push(`/super-admin/organizaciones/${organization.id}`)
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
