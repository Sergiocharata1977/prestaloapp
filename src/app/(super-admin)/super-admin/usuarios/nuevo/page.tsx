"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiFetch";
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
import type { Organization, SuperAdminRole, SuperAdminUser } from "@/types/super-admin";

const ROLE_OPTIONS: Array<{ value: SuperAdminRole; label: string }> = [
  { value: "super_admin", label: "Super admin" },
  { value: "admin", label: "Admin" },
  { value: "gerente", label: "Gerente" },
  { value: "operador", label: "Operador" },
  { value: "manager", label: "Manager" },
  { value: "operator", label: "Operator" },
];

type CreateResponse = {
  error?: string;
  user?: SuperAdminUser;
};

type OrganizationsResponse = {
  error?: string;
  organizations?: Organization[];
};

export default function NewSuperAdminUserPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SuperAdminRole>("operador");
  const [organizationId, setOrganizationId] = useState<string>("none");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadOrganizations();
  }, []);

  async function loadOrganizations() {
    try {
      setLoadingOrganizations(true);
      const response = await apiFetch("/api/super-admin/organizations");
      const data = (await response.json()) as OrganizationsResponse;

      if (!response.ok) {
        setError(data.error ?? "No se pudieron cargar las organizaciones");
        return;
      }

      setOrganizations(data.organizations ?? []);
    } catch (fetchError) {
      console.error(fetchError);
      setError("No se pudieron cargar las organizaciones");
    } finally {
      setLoadingOrganizations(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const response = await apiFetch("/api/super-admin/users", {
        method: "POST",
        body: JSON.stringify({
          displayName,
          email,
          password,
          role,
          organizationId: role === "super_admin" ? null : organizationId,
        }),
      });
      const data = (await response.json()) as CreateResponse;

      if (!response.ok || !data.user) {
        setError(data.error ?? "No se pudo crear el usuario");
        return;
      }

      router.push("/super-admin/usuarios");
    } catch (submitError) {
      console.error(submitError);
      setError("No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/super-admin/usuarios">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Super Admin
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Nuevo usuario global</h1>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-blue-600" />
            Alta inicial de acceso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="displayName">Nombre visible</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Maria Perez"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="maria@prestalo.app"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña temporal</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimo 8 caracteres"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={role} onValueChange={(value) => setRole(value as SuperAdminRole)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizationId">Organización</Label>
                <Select
                  value={role === "super_admin" ? "none" : organizationId}
                  onValueChange={setOrganizationId}
                  disabled={role === "super_admin" || loadingOrganizations}
                >
                  <SelectTrigger id="organizationId">
                    <SelectValue placeholder="Seleccioná una organización" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin organización</SelectItem>
                    {organizations.map((organization) => (
                      <SelectItem key={organization.id} value={organization.id}>
                        {organization.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            ) : null}

            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Si elegís el rol `super_admin`, el usuario se crea sin `organizationId` y con acceso
              global al portal.
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button asChild variant="outline">
                <Link href="/super-admin/usuarios">Cancelar</Link>
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={saving || (role !== "super_admin" && organizationId === "none")}
              >
                {saving ? "Creando..." : "Crear usuario"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
