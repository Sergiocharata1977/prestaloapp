"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCcw, ShieldCheck, UserCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrgUser = {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  role: string | null;
  disabled: boolean;
  lastSignInTime: string | null;
};

const ROLE_OPTIONS = [
  { value: "admin",    label: "Admin" },
  { value: "gerente",  label: "Gerente" },
  { value: "operador", label: "Operador" },
];

function RoleBadge({ role }: { role: string | null }) {
  const cls =
    role === "admin"
      ? "border-blue-200 bg-blue-100 text-blue-700"
      : role === "gerente"
      ? "border-purple-200 bg-purple-100 text-purple-700"
      : "border-slate-200 bg-slate-100 text-slate-600";
  return <Badge className={cls}>{role ?? "Sin rol"}</Badge>;
}

function EstadoBadge({ disabled }: { disabled: boolean }) {
  return disabled ? (
    <Badge className="border-amber-200 bg-amber-100 text-amber-700">Suspendido</Badge>
  ) : (
    <Badge className="border-green-200 bg-green-100 text-green-700">Activo</Badge>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}

const columns: Column<OrgUser>[] = [
  {
    key: "displayName",
    header: "Nombre",
    render: (r) => (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <UserCircle2 className="h-4 w-4" />
        </div>
        <span className="font-medium text-slate-900">{r.displayName ?? "—"}</span>
      </div>
    ),
  },
  { key: "email", header: "Email", render: (r) => r.email ?? "—" },
  { key: "role", header: "Rol", render: (r) => <RoleBadge role={r.role} /> },
  { key: "disabled", header: "Estado", render: (r) => <EstadoBadge disabled={r.disabled} /> },
  { key: "lastSignInTime", header: "Último acceso", render: (r) => formatDate(r.lastSignInTime) },
];

export default function UsuariosPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ displayName: "", email: "", password: "", role: "operador" });
  const [formError, setFormError] = useState<string | null>(null);

  const loadUsers = () => {
    setLoading(true);
    setError(null);
    apiFetch("/api/fin/usuarios")
      .then((r) => r.json())
      .then((d) => setUsers((d as { users: OrgUser[] }).users ?? []))
      .catch(() => setError("No se pudieron cargar los usuarios"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    setFormError(null);
    if (!form.displayName || !form.email || !form.password) {
      setFormError("Todos los campos son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/fin/usuarios", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Error al crear usuario");
      }
      setDialogOpen(false);
      setForm({ displayName: "", email: "", password: "", role: "operador" });
      loadUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al crear usuario");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Usuarios</h2>
          <p className="text-sm text-slate-500">
            {users.length} usuario{users.length !== 1 ? "s" : ""} de esta organización
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={loadUsers} title="Actualizar">
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        emptyMessage="No hay usuarios en esta organización."
      />

      {/* Info de roles */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-500" />
          <span><strong>Admin</strong> — acceso total a configuración y reportes</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-purple-500" />
          <span><strong>Gerente</strong> — gestión operativa sin configuración</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          <span><strong>Operador</strong> — cobros, créditos y cheques</span>
        </div>
      </div>

      {/* Dialog nuevo usuario */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nombre completo</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="juan@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña inicial</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
