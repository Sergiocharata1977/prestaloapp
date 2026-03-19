"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";

type TerminalRecord = {
  id: string;
  nombre?: string;
  departamento_id?: string | null;
  departamento_nombre?: string;
  puesto_id?: string | null;
  puesto_nombre?: string;
};

type TerminalPolicy = {
  id: string;
  nombre?: string;
  prioridad?: number;
  activo?: boolean;
  terminal_id?: string | null;
  puesto_id?: string | null;
  departamento_id?: string | null;
  allowed_tools?: string[];
  require_approval_for?: string[];
  allowed_hours?: { from?: string; to?: string } | null;
};

type ScopeType = "departamento" | "puesto" | "terminal";

type PolicyFormState = {
  nombre: string;
  scopeType: ScopeType;
  scopeValue: string;
  prioridad: string;
  allowedHoursFrom: string;
  allowedHoursTo: string;
  allowedTools: string[];
  requireApprovalFor: string[];
  customTool: string;
};

const DEFAULT_TOOLS = [
  "creditos.create",
  "creditos.view",
  "clientes.create",
  "clientes.view",
  "cobros.create",
  "cajas.open",
  "reportes.export",
];

function initialFormState(): PolicyFormState {
  return {
    nombre: "",
    scopeType: "departamento",
    scopeValue: "",
    prioridad: "0",
    allowedHoursFrom: "",
    allowedHoursTo: "",
    allowedTools: [],
    requireApprovalFor: [],
    customTool: "",
  };
}

function scopeLabel(policy: TerminalPolicy) {
  if (policy.terminal_id) {
    return "Terminal";
  }

  if (policy.puesto_id) {
    return "Puesto";
  }

  if (policy.departamento_id) {
    return "Departamento";
  }

  return "Sin scope";
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function toolSummary(policy: TerminalPolicy | undefined) {
  if (!policy) {
    return "Sin datos todavía";
  }

  const allowed = policy.allowed_tools ?? [];
  const approval = policy.require_approval_for ?? [];

  if (allowed.length === 0 && approval.length === 0) {
    return "Sin tools";
  }

  return `${allowed.length} permitidas / ${approval.length} con aprobación`;
}

export default function TerminalPoliciesPage() {
  const [policies, setPolicies] = useState<TerminalPolicy[]>([]);
  const [terminals, setTerminals] = useState<TerminalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyFormState>(initialFormState);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [policiesRes, terminalsRes] = await Promise.all([
        apiFetch("/api/admin/terminal-policies"),
        apiFetch("/api/admin/terminals"),
      ]);

      if (!policiesRes.ok || !terminalsRes.ok) {
        throw new Error("No se pudieron cargar las políticas");
      }

      const [policiesJson, terminalsJson] = await Promise.all([
        policiesRes.json(),
        terminalsRes.json(),
      ]);

      setPolicies(Array.isArray(policiesJson) ? (policiesJson as TerminalPolicy[]) : []);
      setTerminals(Array.isArray(terminalsJson) ? (terminalsJson as TerminalRecord[]) : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const departmentOptions = useMemo(
    () =>
      uniqueSorted(
        terminals.flatMap((terminal) =>
          terminal.departamento_id
            ? [`${terminal.departamento_id}::${terminal.departamento_nombre ?? terminal.departamento_id}`]
            : []
        )
      ).map((value) => {
        const [id, label] = value.split("::");
        return { id, label };
      }),
    [terminals]
  );

  const positionOptions = useMemo(
    () =>
      uniqueSorted(
        terminals.flatMap((terminal) =>
          terminal.puesto_id
            ? [`${terminal.puesto_id}::${terminal.puesto_nombre ?? terminal.puesto_id}`]
            : []
        )
      ).map((value) => {
        const [id, label] = value.split("::");
        return { id, label };
      }),
    [terminals]
  );

  const toolOptions = useMemo(
    () =>
      uniqueSorted([
        ...DEFAULT_TOOLS,
        ...policies.flatMap((policy) => policy.allowed_tools ?? []),
        ...policies.flatMap((policy) => policy.require_approval_for ?? []),
      ]),
    [policies]
  );

  async function togglePolicy(policy: TerminalPolicy) {
    try {
      const response = await apiFetch(`/api/admin/terminal-policies/${policy.id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: policy.activo === false }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "No se pudo actualizar la política");
      }

      const updated = (await response.json()) as TerminalPolicy;
      setPolicies((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Error inesperado");
    }
  }

  function setFormField<K extends keyof PolicyFormState>(
    key: K,
    value: PolicyFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleTool(tool: string, key: "allowedTools" | "requireApprovalFor") {
    setForm((current) => {
      const exists = current[key].includes(tool);
      return {
        ...current,
        [key]: exists
          ? current[key].filter((item) => item !== tool)
          : [...current[key], tool],
      };
    });
  }

  function addCustomTool() {
    const normalized = form.customTool.trim();
    if (!normalized) {
      return;
    }

    setForm((current) => ({
      ...current,
      customTool: "",
      allowedTools: current.allowedTools.includes(normalized)
        ? current.allowedTools
        : [...current.allowedTools, normalized],
    }));
  }

  async function createPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      nombre: form.nombre,
      allowed_tools: uniqueSorted(form.allowedTools),
      require_approval_for: uniqueSorted(form.requireApprovalFor),
      prioridad: Number.parseInt(form.prioridad, 10) || 0,
    };

    if (form.scopeType === "departamento") {
      payload.departamento_id = form.scopeValue;
    }

    if (form.scopeType === "puesto") {
      payload.puesto_id = form.scopeValue;
    }

    if (form.scopeType === "terminal") {
      payload.terminal_id = form.scopeValue;
    }

    if (form.allowedHoursFrom && form.allowedHoursTo) {
      payload.allowed_hours = {
        from: form.allowedHoursFrom,
        to: form.allowedHoursTo,
      };
    }

    try {
      const response = await apiFetch("/api/admin/terminal-policies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "No se pudo crear la política");
      }

      const created = (await response.json()) as TerminalPolicy;
      setPolicies((current) => [created, ...current]);
      setForm(initialFormState());
      setOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<TerminalPolicy>[] = [
    { key: "nombre", header: "Nombre", render: (row) => row.nombre ?? row.id },
    { key: "scope", header: "Scope", render: (row) => scopeLabel(row) },
    {
      key: "tools",
      header: "Tools permitidas",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {(row.allowed_tools ?? []).slice(0, 4).map((tool) => (
            <Badge key={`${row.id}-${tool}`} className="bg-emerald-100 text-emerald-900">
              {tool}
            </Badge>
          ))}
          {(row.allowed_tools ?? []).length > 4 ? (
            <Badge variant="outline">+{(row.allowed_tools ?? []).length - 4}</Badge>
          ) : null}
          {(row.allowed_tools ?? []).length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "prioridad",
      header: "Prioridad",
      render: (row) => String(row.prioridad ?? 0),
      className: "font-mono",
    },
    {
      key: "estado",
      header: "Estado",
      render: (row) => (
        <button
          type="button"
          className={cn(
            "inline-flex min-w-24 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            row.activo !== false
              ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
          )}
          onClick={() => void togglePolicy(row)}
        >
          {row.activo !== false ? "Activo" : "Inactivo"}
        </button>
      ),
    },
  ];

  const scopeOptions =
    form.scopeType === "departamento"
      ? departmentOptions
      : form.scopeType === "puesto"
        ? positionOptions
        : terminals.map((terminal) => ({
            id: terminal.id,
            label: terminal.nombre ?? terminal.id,
          }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Políticas de terminal</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reglas de ejecución por departamento, puesto o terminal específica.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nueva política
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Nueva política</DialogTitle>
              <DialogDescription>
                Configurá alcance, tools habilitadas y reglas de aprobación.
              </DialogDescription>
            </DialogHeader>

            <form className="grid gap-5" onSubmit={createPolicy}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="policy-name">Nombre</Label>
                  <Input
                    id="policy-name"
                    value={form.nombre}
                    onChange={(event) => setFormField("nombre", event.target.value)}
                    placeholder="Ej. Cobranzas sucursal norte"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="policy-priority">Prioridad</Label>
                  <Input
                    id="policy-priority"
                    type="number"
                    value={form.prioridad}
                    onChange={(event) => setFormField("prioridad", event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3">
                <Label>Scope</Label>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["departamento", "Departamento"],
                    ["puesto", "Puesto"],
                    ["terminal", "Terminal"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                        form.scopeType === value
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          scopeType: value,
                          scopeValue: "",
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Selector del scope</Label>
                <Select
                  value={form.scopeValue}
                  onValueChange={(value) => setFormField("scopeValue", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar alcance" />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scopeOptions.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    No hay opciones disponibles para este scope con los datos actuales.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="hours-from">Horario permitido desde</Label>
                  <Input
                    id="hours-from"
                    type="time"
                    value={form.allowedHoursFrom}
                    onChange={(event) => setFormField("allowedHoursFrom", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hours-to">Horario permitido hasta</Label>
                  <Input
                    id="hours-to"
                    type="time"
                    value={form.allowedHoursTo}
                    onChange={(event) => setFormField("allowedHoursTo", event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-3 rounded-2xl border border-slate-200 p-4">
                  <div>
                    <h3 className="font-medium text-slate-900">Allowed tools</h3>
                    <p className="text-xs text-slate-500">
                      Checklist de ejecución directa.
                    </p>
                  </div>
                  <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                    {toolOptions.map((tool) => (
                      <label
                        key={`allow-${tool}`}
                        className="flex items-center gap-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={form.allowedTools.includes(tool)}
                          onChange={() => toggleTool(tool, "allowedTools")}
                        />
                        <span>{tool}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-slate-200 p-4">
                  <div>
                    <h3 className="font-medium text-slate-900">Require approval</h3>
                    <p className="text-xs text-slate-500">
                      Checklist de tools sujetas a revisión.
                    </p>
                  </div>
                  <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                    {toolOptions.map((tool) => (
                      <label
                        key={`approval-${tool}`}
                        className="flex items-center gap-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={form.requireApprovalFor.includes(tool)}
                          onChange={() => toggleTool(tool, "requireApprovalFor")}
                        />
                        <span>{tool}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="custom-tool">Agregar tool manual</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-tool"
                    value={form.customTool}
                    onChange={(event) => setFormField("customTool", event.target.value)}
                    placeholder="Ej. reportes.sync"
                  />
                  <Button type="button" variant="outline" onClick={addCustomTool}>
                    Agregar
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving || !form.scopeValue}>
                  <Save className={cn("h-4 w-4", saving && "animate-pulse")} />
                  Guardar política
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total</CardTitle>
            <CardDescription>Políticas registradas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{policies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Activas</CardTitle>
            <CardDescription>Aplican en la resolución</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-emerald-700">
              {policies.filter((policy) => policy.activo !== false).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resumen tools</CardTitle>
            <CardDescription>Visión rápida de cobertura</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{toolSummary(policies[0])}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de políticas</CardTitle>
          <CardDescription>
            Nombre, scope, tools permitidas, prioridad y estado editable inline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={policies}
            loading={loading}
            emptyMessage="No hay políticas configuradas."
          />
        </CardContent>
      </Card>
    </div>
  );
}
