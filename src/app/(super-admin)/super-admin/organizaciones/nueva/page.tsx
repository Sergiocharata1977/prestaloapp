"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
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
import type { Organization, OrganizationPlan } from "@/types/super-admin";

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<OrganizationPlan>("free");
  const [adminEmail, setAdminEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const response = await apiFetch("/api/super-admin/organizations", {
        method: "POST",
        body: JSON.stringify({
          name,
          plan,
          adminEmail,
          temporaryPassword,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        organization?: Organization;
      };

      if (!response.ok || !data.organization) {
        setError(data.error ?? "No se pudo crear la organización");
        return;
      }

      router.push(`/super-admin/organizaciones/${data.organization.id}`);
    } catch (submitError) {
      console.error(submitError);
      setError("No se pudo crear la organización");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/super-admin/organizaciones">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Super Admin
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Nueva organización</h1>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-blue-600" />
            Datos iniciales del tenant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Prestalo Centro"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <Select
                  value={plan}
                  onValueChange={(value) => setPlan(value as OrganizationPlan)}
                >
                  <SelectTrigger id="plan">
                    <SelectValue placeholder="Elegí un plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminEmail">Email admin</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder="admin@organizacion.com"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="temporaryPassword">Contraseña temporal</Label>
                <Input
                  id="temporaryPassword"
                  type="password"
                  minLength={8}
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  placeholder="Minimo 8 caracteres"
                  required
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3">
              <Button asChild variant="outline">
                <Link href="/super-admin/organizaciones">Cancelar</Link>
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={saving}
              >
                {saving ? "Creando..." : "Crear organización"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
