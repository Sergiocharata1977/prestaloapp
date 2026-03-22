"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, RefreshCcw, Shield, UserCog, Users } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import type { Column } from "@/components/ui/data-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PLUGIN_CAPABILITIES } from "@/lib/capabilities";

type UsersResponse = {
  error?: string;
  users?: SuperAdminUser[];
};

type OrganizationsResponse = {
  error?: string;
  organizations?: Organization[];
};

type UpdateResponse = {
  error?: string;
  user?: SuperAdminUser;
  passwordResetLink?: string | null;
};

const ROLE_OPTIONS: Array<{ value: SuperAdminRole; label: string }> = [
  { value: "super_admin", label: "Super admin" },
  { value: "admin", label: "Admin" },
  { value: "gerente", label: "Gerente" },
  { value: "operador", label: "Operador" },
  { value: "manager", label: "Manager" },
  { value: "operator", label: "Operator" },
];

function formatDate(date: string | null) {
  if (!date) {
    return "Sin registro";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function RoleBadge({ role }: { role: SuperAdminUser["role"] }) {
  const className =
    role === "super_admin"
      ? "border-purple-200 bg-purple-100 text-purple-700"
      : role === "admin"
        ? "border-blue-200 bg-blue-100 text-blue-700"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return <Badge className={className}>{role ?? "Sin rol"}</Badge>;
}

function StatusBadge({ disabled }: { disabled: boolean }) {
  const className = disabled
    ? "border-amber-200 bg-amber-100 text-amber-700"
    : "border-emerald-200 bg-emerald-100 text-emerald-700";

  return <Badge className={className}>{disabled ? "Revocado" : "Activo"}</Badge>;
}

export default function SuperAdminUsersPage() {
  const searchParams = useSearchParams();
  const filterOrgId = searchParams.get("orgId");
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<SuperAdminUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<SuperAdminRole>("operador");
  const [editOrganizationId, setEditOrganizationId] = useState<string>("none");
  const [editDisabled, setEditDisabled] = useState(false);
  const [editCapabilities, setEditCapabilities] = useState<string[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  function openEditDialog(user: SuperAdminUser) {
    setSelectedUser(user);
    setEditDisplayName(user.displayName ?? "");
    setEditRole(user.role ?? "operador");
    setEditOrganizationId(user.organizationId ?? "none");
    setEditDisabled(user.disabled);
    setEditCapabilities(user.capabilities ?? []);
    setResetLink(null);
    setError(null);
    setSuccess(null);
  }

  function closeEditDialog() {
    setSelectedUser(null);
    setResetLink(null);
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [usersResponse, organizationsResponse] = await Promise.all([
        apiFetch("/api/super-admin/users"),
        apiFetch("/api/super-admin/organizations"),
      ]);

      const usersData = (await usersResponse.json()) as UsersResponse;
      const organizationsData = (await organizationsResponse.json()) as OrganizationsResponse;

      if (!usersResponse.ok) {
        setError(usersData.error ?? "No se pudo cargar la lista de usuarios");
        return;
      }

      if (!organizationsResponse.ok) {
        setError(organizationsData.error ?? "No se pudo cargar la lista de organizaciones");
        return;
      }

      setUsers(usersData.users ?? []);
      setOrganizations(organizationsData.organizations ?? []);
    } catch (fetchError) {
      console.error(fetchError);
      setError("Error de conexión al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveUser() {
    if (!selectedUser) {
      return;
    }

    try {
      setBusyUid(selectedUser.uid);
      setError(null);
      setSuccess(null);
      setResetLink(null);

      const response = await apiFetch(`/api/super-admin/users/${selectedUser.uid}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: editDisplayName,
          role: editRole,
          organizationId: editRole === "super_admin" ? null : editOrganizationId,
          disabled: editDisabled,
          capabilities: editCapabilities,
        }),
      });
      const data = (await response.json()) as UpdateResponse;

      if (!response.ok || !data.user) {
        setError(data.error ?? "No se pudo actualizar el usuario");
        return;
      }

      setUsers((current) =>
        current.map((item) => (item.uid === data.user?.uid ? data.user : item))
      );
      setSelectedUser(data.user);
      setEditDisabled(data.user.disabled);
      setSuccess("Usuario actualizado");
    } catch (updateError) {
      console.error(updateError);
      setError("No se pudo actualizar el usuario");
    } finally {
      setBusyUid(null);
    }
  }

  async function handleResetPassword(user: SuperAdminUser) {
    try {
      setBusyUid(user.uid);
      setError(null);
      setSuccess(null);
      setResetLink(null);

      const response = await apiFetch(`/api/super-admin/users/${user.uid}`, {
        method: "PATCH",
        body: JSON.stringify({ resetPassword: true }),
      });
      const data = (await response.json()) as UpdateResponse;

      if (!response.ok) {
        setError(data.error ?? "No se pudo generar el link de reseteo");
        return;
      }

      if (data.user) {
        setUsers((current) =>
          current.map((item) => (item.uid === data.user?.uid ? data.user : item))
        );
        if (selectedUser?.uid === user.uid) {
          setSelectedUser(data.user);
        }
      }

      setResetLink(data.passwordResetLink ?? null);
      setSuccess("Link de reseteo generado");
    } catch (resetError) {
      console.error(resetError);
      setError("No se pudo generar el link de reseteo");
    } finally {
      setBusyUid(null);
    }
  }

  async function handleToggleDisabled(user: SuperAdminUser) {
    try {
      setBusyUid(user.uid);
      setError(null);
      setSuccess(null);

      const response = await apiFetch(`/api/super-admin/users/${user.uid}`, {
        method: "PATCH",
        body: JSON.stringify({ disabled: !user.disabled }),
      });
      const data = (await response.json()) as UpdateResponse;

      if (!response.ok || !data.user) {
        setError(data.error ?? "No se pudo actualizar el acceso");
        return;
      }

      setUsers((current) =>
        current.map((item) => (item.uid === data.user?.uid ? data.user : item))
      );
      if (selectedUser?.uid === user.uid) {
        setSelectedUser(data.user);
        setEditDisabled(data.user.disabled);
      }
      setSuccess(user.disabled ? "Acceso restaurado" : "Acceso revocado");
    } catch (toggleError) {
      console.error(toggleError);
      setError("No se pudo actualizar el acceso");
    } finally {
      setBusyUid(null);
    }
  }

  async function handleDeleteUser(user: SuperAdminUser) {
    if (!window.confirm(`Eliminar al usuario ${user.email ?? user.uid}?`)) {
      return;
    }

    try {
      setBusyUid(user.uid);
      setError(null);
      setSuccess(null);

      const response = await apiFetch(`/api/super-admin/users/${user.uid}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "No se pudo eliminar el usuario");
        return;
      }

      setUsers((current) => current.filter((item) => item.uid !== user.uid));
      if (selectedUser?.uid === user.uid) {
        closeEditDialog();
      }
      setSuccess("Usuario eliminado");
    } catch (deleteError) {
      console.error(deleteError);
      setError("No se pudo eliminar el usuario");
    } finally {
      setBusyUid(null);
    }
  }

  const filteredUsers = useMemo(
    () => filterOrgId ? users.filter((u) => u.organizationId === filterOrgId) : users,
    [users, filterOrgId]
  );

  const filterOrgName = useMemo(
    () => filterOrgId ? (organizations.find((o) => o.id === filterOrgId)?.name ?? filterOrgId) : null,
    [filterOrgId, organizations]
  );

  const stats = useMemo(() => {
    const active = filteredUsers.filter((user) => !user.disabled).length;
    const superAdmins = filteredUsers.filter((user) => user.role === "super_admin").length;

    return {
      total: filteredUsers.length,
      active,
      superAdmins,
    };
  }, [filteredUsers]);

  const columns: Column<SuperAdminUser>[] = [
    {
      key: "email",
      header: "Usuario",
      render: (user) => (
        <div>
          <div className="font-medium text-slate-900">{user.email ?? user.uid}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span>{user.displayName ?? "Sin nombre"}</span>
            <StatusBadge disabled={user.disabled} />
          </div>
        </div>
      ),
    },
    {
      key: "organizationName",
      header: "Organización",
      render: (user) => user.organizationName ?? "Global",
    },
    {
      key: "role",
      header: "Rol",
      width: "140px",
      render: (user) => <RoleBadge role={user.role} />,
    },
    {
      key: "lastSignInAt",
      header: "Último acceso",
      width: "180px",
      render: (user) => formatDate(user.lastSignInAt),
    },
    {
      key: "actions",
      header: "Acciones",
      width: "280px",
      className: "text-right",
      render: (user) => (
        <div
          className="flex items-center justify-end gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busyUid === user.uid}
            onClick={() => void handleResetPassword(user)}
          >
            Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busyUid === user.uid}
            onClick={() => void handleToggleDisabled(user)}
          >
            {user.disabled ? "Restaurar" : "Revocar"}
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
          <h1 className="text-2xl font-bold text-slate-900">Usuarios globales</h1>
          <p className="mt-1 text-sm text-slate-500">
            {filterOrgName ? (
              <>Filtrando por organización: <strong>{filterOrgName}</strong>{" "}
                <Link href="/super-admin/usuarios" className="text-blue-600 hover:underline">Ver todos</Link>
              </>
            ) : "Gestión centralizada de accesos, claims y reseteo de credenciales."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="h-4 w-4" />
            Recargar
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/super-admin/usuarios/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo usuario
            </Link>
          </Button>
        </div>
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

      {resetLink ? (
        <Card className="border-blue-200 bg-blue-50/70">
          <CardHeader>
            <CardTitle className="text-base text-blue-950">Link de reseteo generado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="break-all text-sm text-blue-900">{resetLink}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total usuarios</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Activos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Super admins</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.superAdmins}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-blue-600" />
            Lista de usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredUsers}
            loading={loading}
            emptyMessage="Todavía no hay usuarios registrados."
            onRowClick={openEditDialog}
          />
        </CardContent>
      </Card>

      <Dialog open={selectedUser !== null} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-blue-600" />
              Editar usuario
            </DialogTitle>
            <DialogDescription>
              Ajustá claims, organización y estado de acceso del usuario seleccionado.
            </DialogDescription>
          </DialogHeader>

          {selectedUser ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-displayName">Nombre visible</Label>
                  <Input
                    id="edit-displayName"
                    value={editDisplayName}
                    onChange={(event) => setEditDisplayName(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-role">Rol</Label>
                  <Select
                    value={editRole}
                    onValueChange={(value) => setEditRole(value as SuperAdminRole)}
                  >
                    <SelectTrigger id="edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-organization">Organización</Label>
                  <Select
                    value={editRole === "super_admin" ? "none" : editOrganizationId}
                    onValueChange={setEditOrganizationId}
                    disabled={editRole === "super_admin"}
                  >
                    <SelectTrigger id="edit-organization">
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

              {editRole !== "super_admin" && (
                <div className="space-y-2">
                  <Label>Plugins activos</Label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    {PLUGIN_CAPABILITIES.map((cap) => {
                      const checked = editCapabilities.includes(cap.value);
                      return (
                        <label key={cap.value} className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                            checked={checked}
                            onChange={() =>
                              setEditCapabilities((prev) =>
                                checked ? prev.filter((c) => c !== cap.value) : [...prev, cap.value]
                              )
                            }
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{cap.label}</p>
                            <p className="text-xs text-slate-500">{cap.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                  <p className="mt-1 text-sm text-slate-900">{selectedUser.email ?? "Sin email"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Último acceso</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {formatDate(selectedUser.lastSignInAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Creado</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {formatDate(selectedUser.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  disabled={busyUid === selectedUser.uid}
                  onClick={() => void handleResetPassword(selectedUser)}
                >
                  <Shield className="h-4 w-4" />
                  Generar reset
                </Button>
                <Button
                  variant="outline"
                  disabled={busyUid === selectedUser.uid}
                  onClick={() => {
                    setEditDisabled((current) => !current);
                  }}
                >
                  {editDisabled ? "Marcar activo" : "Marcar revocado"}
                </Button>
                <Button
                  variant="destructive"
                  disabled={busyUid === selectedUser.uid}
                  onClick={() => void handleDeleteUser(selectedUser)}
                >
                  Eliminar usuario
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cerrar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={selectedUser === null || busyUid === selectedUser?.uid}
              onClick={() => void handleSaveUser()}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
