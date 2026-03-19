"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCcw, Rocket } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import type { Column } from "@/components/ui/data-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DemoRequest, Organization, OrganizationPlan } from "@/types/super-admin";

type DemoRequestsResponse = {
  error?: string;
  demoRequests?: DemoRequest[];
};

type ConvertResponse = {
  error?: string;
  demoRequest?: DemoRequest;
  organization?: Organization;
  temporaryPassword?: string;
};

function formatDate(date: string | null) {
  if (!date) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function StatusBadge({ status }: { status: DemoRequest["status"] }) {
  const className =
    status === "approved"
      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
      : status === "processing"
        ? "border-blue-200 bg-blue-100 text-blue-700"
        : status === "rejected"
          ? "border-rose-200 bg-rose-100 text-rose-700"
          : "border-amber-200 bg-amber-100 text-amber-700";

  const label =
    status === "approved"
      ? "Aprobada"
      : status === "processing"
        ? "Procesando"
        : status === "rejected"
          ? "Rechazada"
          : "Pendiente";

  return <Badge className={className}>{label}</Badge>;
}

export default function DemoRequestsPage() {
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [provisioningResult, setProvisioningResult] = useState<{
    organizationId: string;
    temporaryPassword: string;
  } | null>(null);

  useEffect(() => {
    void loadDemoRequests();
  }, []);

  async function loadDemoRequests() {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch("/api/super-admin/demo-requests");
      const data = (await response.json()) as DemoRequestsResponse;

      if (!response.ok) {
        setError(data.error ?? "No se pudieron cargar las solicitudes");
        return;
      }

      setDemoRequests(data.demoRequests ?? []);
    } catch (fetchError) {
      console.error(fetchError);
      setError("No se pudieron cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  }

  async function handleConvert(request: DemoRequest) {
    const confirmed = window.confirm(
      `Convertir la solicitud de ${request.organizationName} en organización activa?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setBusyId(request.id);
      setError(null);
      setSuccess(null);
      setProvisioningResult(null);

      const response = await apiFetch("/api/super-admin/demo-requests", {
        method: "POST",
        body: JSON.stringify({
          requestId: request.id,
          plan: request.requestedPlan as OrganizationPlan,
        }),
      });
      const data = (await response.json()) as ConvertResponse;

      if (!response.ok || !data.demoRequest || !data.organization || !data.temporaryPassword) {
        setError(data.error ?? "No se pudo convertir la solicitud");
        return;
      }

      setDemoRequests((current) =>
        current.map((item) => (item.id === data.demoRequest?.id ? data.demoRequest : item))
      );
      setProvisioningResult({
        organizationId: data.organization.id,
        temporaryPassword: data.temporaryPassword,
      });
      setSuccess("Solicitud convertida en organización activa");
    } catch (convertError) {
      console.error(convertError);
      setError("No se pudo convertir la solicitud");
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(() => {
    const pending = demoRequests.filter((request) => request.status === "pending").length;
    const approved = demoRequests.filter((request) => request.status === "approved").length;
    return {
      total: demoRequests.length,
      pending,
      approved,
    };
  }, [demoRequests]);

  const columns: Column<DemoRequest>[] = [
    {
      key: "organizationName",
      header: "Solicitud",
      render: (request) => (
        <div>
          <div className="font-medium text-slate-900">{request.organizationName}</div>
          <div className="mt-1 text-xs text-slate-500">
            {request.contactName} · {request.email}
          </div>
        </div>
      ),
    },
    {
      key: "requestedPlan",
      header: "Plan",
      width: "110px",
      render: (request) => request.requestedPlan,
    },
    {
      key: "status",
      header: "Estado",
      width: "120px",
      render: (request) => <StatusBadge status={request.status} />,
    },
    {
      key: "createdAt",
      header: "Ingresó",
      width: "180px",
      render: (request) => formatDate(request.createdAt),
    },
    {
      key: "actions",
      header: "Acciones",
      width: "260px",
      className: "text-right",
      render: (request) => (
        <div
          className="flex items-center justify-end gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          {request.approvedOrganizationId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/super-admin/organizaciones/${request.approvedOrganizationId}`}>
                Ver org
              </Link>
            </Button>
          ) : null}
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={request.status !== "pending" || busyId === request.id}
            onClick={() => void handleConvert(request)}
          >
            <Rocket className="h-4 w-4" />
            Convertir
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Super Admin
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Demo requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Solicitudes entrantes desde la landing y conversión a tenant activo.
          </p>
        </div>

        <Button variant="outline" onClick={() => void loadDemoRequests()}>
          <RefreshCcw className="h-4 w-4" />
          Recargar
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      {provisioningResult ? (
        <Card className="border-blue-200 bg-blue-50/70">
          <CardHeader>
            <CardTitle className="text-base text-blue-950">Provisioning completado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-900">
            <p>Organización creada: {provisioningResult.organizationId}</p>
            <p>Contraseña temporal del admin: {provisioningResult.temporaryPassword}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Pendientes</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Aprobadas</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.approved}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            Solicitudes registradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={demoRequests}
            loading={loading}
            emptyMessage="Todavía no ingresaron solicitudes de demo."
          />
        </CardContent>
      </Card>
    </div>
  );
}
