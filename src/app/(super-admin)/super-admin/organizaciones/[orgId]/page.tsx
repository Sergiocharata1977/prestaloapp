"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Organization,
  OrganizationPlan,
  OrganizationStatus,
} from "@/types/super-admin";

function formatDate(date: string | null) {
  if (!date) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function OrganizationDetailPage() {
  const params = useParams<{ orgId: string }>();
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.orgId) {
      return;
    }

    void loadOrganization(params.orgId);
  }, [params.orgId]);

  async function loadOrganization(orgId: string) {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch(`/api/super-admin/organizations/${orgId}`);
      const data = (await response.json()) as {
        error?: string;
        organization?: Organization;
      };

      if (!response.ok || !data.organization) {
        setError(data.error ?? "No se pudo cargar la organización");
        return;
      }

      setOrganization(data.organization);
    } catch (fetchError) {
      console.error(fetchError);
      setError("No se pudo cargar la organización");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!organization) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await apiFetch(
        `/api/super-admin/organizations/${organization.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: organization.name,
            plan: organization.plan,
            status: organization.status,
          }),
        }
      );
      const data = (await response.json()) as {
        error?: string;
        organization?: Organization;
      };

      if (!response.ok || !data.organization) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }

      setOrganization(data.organization);
    } catch (saveError) {
      console.error(saveError);
      setError("No se pudo actualizar la organización");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!organization) {
      return;
    }

    const confirmed = window.confirm(
      "Esta acción elimina la organización y su usuario admin principal. ¿Continuar?"
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);
      const response = await apiFetch(
        `/api/super-admin/organizations/${organization.id}`,
        { method: "DELETE" }
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "No se pudo eliminar la organización");
        return;
      }

      router.push("/super-admin/organizaciones");
    } catch (deleteError) {
      console.error(deleteError);
      setError("No se pudo eliminar la organización");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/super-admin/organizaciones">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </Button>
        <p className="text-sm text-slate-500">No se encontró la organización.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/super-admin/organizaciones">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
              Organización
            </p>
            <h1 className="text-2xl font-bold text-slate-900">{organization.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{organization.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="org-name">Nombre</Label>
              <Input
                id="org-name"
                value={organization.name}
                onChange={(event) =>
                  setOrganization((current) =>
                    current
                      ? {
                          ...current,
                          name: event.target.value,
                        }
                      : current
                  )
                }
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-plan">Plan</Label>
                <Select
                  value={organization.plan}
                  onValueChange={(value) =>
                    setOrganization((current) =>
                      current
                        ? {
                            ...current,
                            plan: value as OrganizationPlan,
                          }
                        : current
                    )
                  }
                >
                  <SelectTrigger id="org-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-status">Estado</Label>
                <Select
                  value={organization.status}
                  onValueChange={(value) =>
                    setOrganization((current) =>
                      current
                        ? {
                            ...current,
                            status: value as OrganizationStatus,
                          }
                        : current
                    )
                  }
                >
                  <SelectTrigger id="org-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activa</SelectItem>
                    <SelectItem value="inactive">Inactiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-admin-email">Email admin</Label>
                <Input id="org-admin-email" value={organization.adminEmail} readOnly />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">Slug</Label>
                <Input id="org-slug" value={organization.slug} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-500">Estado</span>
                <Badge
                  className={
                    organization.status === "active"
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                      : "border-amber-200 bg-amber-100 text-amber-700"
                  }
                >
                  {organization.status === "active" ? "Activa" : "Inactiva"}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-500">Clientes</span>
                <span className="text-sm font-semibold text-slate-900">
                  {organization.metrics.clients}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-500">Créditos</span>
                <span className="text-sm font-semibold text-slate-900">
                  {organization.metrics.credits}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trazabilidad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Creada</span>
                <span>{formatDate(organization.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Última actualización</span>
                <span>{formatDate(organization.updatedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>UID admin</span>
                <span className="max-w-40 truncate text-right">{organization.adminUid}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
