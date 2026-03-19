"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { TerminalActionLogTable } from "@/components/terminal/TerminalActionLogTable";
import { TerminalStatusBadge } from "@/components/terminal/TerminalStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import type { ActionResult, ToolName } from "@/types/agent-terminal";

type TimestampLike =
  | string
  | number
  | Date
  | { seconds?: number; nanoseconds?: number; _seconds?: number; _nanoseconds?: number }
  | null
  | undefined;

type TerminalRecord = {
  id: string;
  nombre?: string;
  hostname?: string;
  os?: string;
  status?: string;
  personnel_id?: string | null;
  personnel_nombre?: string;
  empleado_nombre?: string;
  departamento_id?: string | null;
  departamento_nombre?: string;
  puesto_id?: string | null;
  puesto_nombre?: string;
  agent_version?: string;
  version_agente?: string;
  pairing_code?: string;
  activated_at?: TimestampLike;
  created_at?: TimestampLike;
  first_seen_at?: TimestampLike;
  allowed_tools?: ToolName[];
  require_approval_for?: ToolName[];
};

type TerminalLogRecord = {
  id: string;
  terminal_id?: string;
  tool: string;
  params: Record<string, unknown>;
  result: ActionResult;
  duration_ms?: number;
  proceso_id?: string;
  justification?: string;
  required_approval?: boolean;
  personnel_id?: string | null;
  puesto_id?: string | null;
  departamento_id?: string | null;
  organization_id?: string;
  approved_by?: string | null;
  timestamp?: TimestampLike;
};

type TerminalPolicy = {
  id: string;
  nombre?: string;
  activo?: boolean;
  prioridad?: number;
  terminal_id?: string | null;
  puesto_id?: string | null;
  departamento_id?: string | null;
  allowed_tools?: ToolName[];
  require_approval_for?: ToolName[];
};

type EffectivePolicyView = {
  allowed_tools: ToolName[];
  require_approval_for: ToolName[];
  sources: TerminalPolicy[];
  defaultPolicy?: TerminalPolicy;
};

type ReviewAction = "approve" | "reject";

function parseTimestamp(value: TimestampLike): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const seconds = value.seconds ?? value._seconds;
  const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;

  if (typeof seconds !== "number") {
    return null;
  }

  return new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000));
}

function formatDate(value: TimestampLike) {
  const date = parseTimestamp(value);
  if (!date) {
    return "No disponible";
  }

  return date.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRelativeTime(value: TimestampLike) {
  const date = parseTimestamp(value);
  if (!date) {
    return "No disponible";
  }

  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  return formatter.format(Math.round(diffHours / 24), "day");
}

function uniqueTools(tools: ToolName[]) {
  return Array.from(new Set(tools.filter(Boolean))).sort((a, b) => a.localeCompare(b));
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

  return "Default";
}

function resolveEffectivePolicy(
  terminal: TerminalRecord | null,
  policies: TerminalPolicy[]
): EffectivePolicyView {
  if (!terminal) {
    return { allowed_tools: [], require_approval_for: [], sources: [] };
  }

  const defaultPolicy = policies.find((policy) => policy.id === "default");
  const matchedPolicies = policies
    .filter((policy) => policy.id !== "default" && policy.activo !== false)
    .filter((policy) => {
      if (!policy.terminal_id && !policy.puesto_id && !policy.departamento_id) {
        return false;
      }

      if (policy.terminal_id && policy.terminal_id !== terminal.id) {
        return false;
      }

      if (policy.puesto_id && policy.puesto_id !== terminal.puesto_id) {
        return false;
      }

      if (
        policy.departamento_id &&
        policy.departamento_id !== terminal.departamento_id
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => (b.prioridad ?? 0) - (a.prioridad ?? 0));

  const merged = matchedPolicies.reduce(
    (acc, policy) => ({
      allowed_tools:
        acc.allowed_tools.length > 0 ? acc.allowed_tools : policy.allowed_tools ?? [],
      require_approval_for:
        acc.require_approval_for.length > 0
          ? acc.require_approval_for
          : policy.require_approval_for ?? [],
    }),
    { allowed_tools: [] as ToolName[], require_approval_for: [] as ToolName[] }
  );

  return {
    allowed_tools: uniqueTools(
      merged.allowed_tools.length > 0
        ? merged.allowed_tools
        : terminal.allowed_tools ?? defaultPolicy?.allowed_tools ?? []
    ),
    require_approval_for: uniqueTools(
      merged.require_approval_for.length > 0
        ? merged.require_approval_for
        : terminal.require_approval_for ?? defaultPolicy?.require_approval_for ?? []
    ),
    sources: matchedPolicies,
    defaultPolicy,
  };
}

function toTimestampAdapter(value: TimestampLike) {
  const date = parseTimestamp(value);
  return {
    toDate: () => date ?? new Date(0),
  };
}

export default function TerminalDetailPage() {
  const params = useParams<{ id: string }>();
  const terminalId = typeof params?.id === "string" ? params.id : "";
  const [terminal, setTerminal] = useState<TerminalRecord | null>(null);
  const [logs, setLogs] = useState<TerminalLogRecord[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<TerminalLogRecord[]>([]);
  const [policies, setPolicies] = useState<TerminalPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{
    action: ReviewAction;
    log: TerminalLogRecord;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!terminalId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [terminalRes, logsRes, pendingRes, policiesRes] = await Promise.all([
        apiFetch(`/api/admin/terminals/${terminalId}`),
        apiFetch(`/api/admin/terminals/${terminalId}/log`),
        apiFetch(`/api/admin/terminals/${terminalId}/log?result=pending_approval`),
        apiFetch("/api/admin/terminal-policies"),
      ]);

      if (!terminalRes.ok || !logsRes.ok || !pendingRes.ok || !policiesRes.ok) {
        throw new Error("No se pudo cargar el detalle de la terminal");
      }

      const [terminalJson, logsJson, pendingJson, policiesJson] = await Promise.all([
        terminalRes.json(),
        logsRes.json(),
        pendingRes.json(),
        policiesRes.json(),
      ]);

      setTerminal(terminalJson as TerminalRecord);
      setLogs(Array.isArray(logsJson) ? (logsJson as TerminalLogRecord[]) : []);
      setPendingApprovals(
        Array.isArray(pendingJson) ? (pendingJson as TerminalLogRecord[]) : []
      );
      setPolicies(Array.isArray(policiesJson) ? (policiesJson as TerminalPolicy[]) : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [terminalId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const effectivePolicy = useMemo(
    () => resolveEffectivePolicy(terminal, policies),
    [terminal, policies]
  );

  async function patchTerminal(action: "quarantine" | "revoke_reactivate") {
    setBusyAction(action);
    setError(null);

    try {
      const response = await apiFetch(`/api/admin/terminals/${terminalId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "No se pudo actualizar la terminal");
      }

      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Error inesperado");
    } finally {
      setBusyAction(null);
    }
  }

  const reviewLog = useCallback(
    async (logId: string, action: ReviewAction) => {
      setBusyAction(`${action}:${logId}`);
      setError(null);
      setPendingApprovals((current) => current.filter((log) => log.id !== logId));
      setLogs((current) =>
        current.map((log) =>
          log.id === logId
            ? {
                ...log,
                result: action === "approve" ? "success" : "blocked",
              }
            : log
        )
      );

      try {
        const response = await apiFetch(
          `/api/admin/terminals/${terminalId}/log?logId=${logId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ action }),
          }
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "No se pudo actualizar el log");
        }

        await loadData();
      } catch (reviewError) {
        await loadData();
        setError(reviewError instanceof Error ? reviewError.message : "Error inesperado");
      } finally {
        setBusyAction(null);
      }
    },
    [loadData, terminalId]
  );

  const normalizedLogs = useMemo(
    () =>
      logs.map((log) => ({
        ...log,
        terminal_id: log.terminal_id ?? terminalId,
        personnel_id: log.personnel_id ?? null,
        puesto_id: log.puesto_id ?? null,
        departamento_id: log.departamento_id ?? null,
        organization_id: log.organization_id ?? terminal?.id ?? "",
        params: log.params ?? {},
        timestamp: toTimestampAdapter(log.timestamp),
      })),
    [logs, terminal?.id, terminalId]
  );

  const pendingCount = pendingApprovals.length;
  const employeeLabel =
    terminal?.empleado_nombre ?? terminal?.personnel_nombre ?? terminal?.personnel_id ?? "Sin empleado";

  const infoRows = [
    ["Nombre", terminal?.nombre ?? "-"],
    ["Hostname", terminal?.hostname ?? "-"],
    ["OS", terminal?.os ?? "-"],
    ["Empleado", employeeLabel],
    ["Departamento", terminal?.departamento_nombre ?? terminal?.departamento_id ?? "-"],
    ["Puesto", terminal?.puesto_nombre ?? terminal?.puesto_id ?? "-"],
    ["Version agente", terminal?.agent_version ?? terminal?.version_agente ?? "-"],
    [
      "Fecha activacion",
      formatDate(terminal?.activated_at ?? terminal?.first_seen_at ?? terminal?.created_at),
    ],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {terminal?.nombre ?? "Detalle de terminal"}
            </h1>
            {terminal?.status ? (
              <TerminalStatusBadge
                status={terminal.status as "active" | "pending" | "quarantined"}
              />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            ID: <span className="font-mono">{terminalId}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={loading || busyAction !== null}
            onClick={() => void patchTerminal("quarantine")}
          >
            {busyAction === "quarantine" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Cuarentenar
          </Button>
          <Button
            disabled={loading || busyAction !== null}
            onClick={() => void patchTerminal("revoke_reactivate")}
          >
            {busyAction === "revoke_reactivate" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Revocar y reactivar
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Informacion</CardTitle>
          <CardDescription>Estado operativo y asignacion actual de la terminal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {infoRows.map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Pairing code vigente
            </p>
            <p className="mt-2 font-mono text-lg text-slate-800">
              {terminal?.pairing_code ?? "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Politica efectiva</CardTitle>
          <CardDescription>
            Vista compuesta con la logica visual equivalente a `TerminalPolicyService`.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="mb-3 flex items-center gap-2 text-emerald-900">
                <CheckCircle2 className="h-4 w-4" />
                <h3 className="font-medium">Tools permitidas</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {effectivePolicy.allowed_tools.length > 0 ? (
                  effectivePolicy.allowed_tools.map((tool) => (
                    <Badge
                      key={tool}
                      className="border-transparent bg-emerald-600/90 text-white"
                    >
                      {tool}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-emerald-900/80">Sin tools definidas.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
              <div className="mb-3 flex items-center gap-2 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <h3 className="font-medium">Requieren aprobacion</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {effectivePolicy.require_approval_for.length > 0 ? (
                  effectivePolicy.require_approval_for.map((tool) => (
                    <Badge
                      key={tool}
                      className="border-transparent bg-amber-400 text-amber-950"
                    >
                      {tool}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-amber-900/80">
                    Sin tools sujetas a aprobacion.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-900">Raw terminal</p>
              <p className="mt-1 text-xs text-slate-500">
                Override directo registrado en la terminal.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {uniqueTools(terminal?.allowed_tools ?? []).map((tool) => (
                  <Badge
                    key={`terminal-allow-${tool}`}
                    className="bg-emerald-100 text-emerald-900"
                  >
                    {tool}
                  </Badge>
                ))}
                {uniqueTools(terminal?.require_approval_for ?? []).map((tool) => (
                  <Badge
                    key={`terminal-approval-${tool}`}
                    className="bg-amber-100 text-amber-900"
                  >
                    {tool}
                  </Badge>
                ))}
                {!(terminal?.allowed_tools?.length || terminal?.require_approval_for?.length) ? (
                  <p className="text-xs text-slate-400">Sin override local.</p>
                ) : null}
              </div>
            </div>

            {effectivePolicy.sources.map((policy) => (
              <div key={policy.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">
                    {policy.nombre ?? policy.id}
                  </p>
                  <Badge variant="outline">{scopeLabel(policy)}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">Prioridad {policy.prioridad ?? 0}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {uniqueTools(policy.allowed_tools ?? []).map((tool) => (
                    <Badge
                      key={`${policy.id}-allow-${tool}`}
                      className="bg-emerald-100 text-emerald-900"
                    >
                      {tool}
                    </Badge>
                  ))}
                  {uniqueTools(policy.require_approval_for ?? []).map((tool) => (
                    <Badge
                      key={`${policy.id}-approval-${tool}`}
                      className="bg-amber-100 text-amber-900"
                    >
                      {tool}
                    </Badge>
                  ))}
                  {!(policy.allowed_tools?.length || policy.require_approval_for?.length) ? (
                    <p className="text-xs text-slate-400">Sin reglas cargadas.</p>
                  ) : null}
                </div>
              </div>
            ))}

            {effectivePolicy.defaultPolicy ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">
                    {effectivePolicy.defaultPolicy.nombre ?? "Default"}
                  </p>
                  <Badge variant="outline">Default</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {uniqueTools(effectivePolicy.defaultPolicy.allowed_tools ?? []).map((tool) => (
                    <Badge
                      key={`default-allow-${tool}`}
                      className="bg-emerald-100 text-emerald-900"
                    >
                      {tool}
                    </Badge>
                  ))}
                  {uniqueTools(
                    effectivePolicy.defaultPolicy.require_approval_for ?? []
                  ).map((tool) => (
                    <Badge
                      key={`default-approval-${tool}`}
                      className="bg-amber-100 text-amber-900"
                    >
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {pendingCount > 0 ? (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Aprobaciones pendientes
              <Badge className="border-transparent bg-amber-500 text-amber-950">
                {pendingCount}
              </Badge>
            </CardTitle>
            <CardDescription>
              Solicitudes pendientes de esta terminal a la espera de revision manual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingApprovals.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-amber-200 bg-white p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <dl className="grid flex-1 gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Tool solicitada
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900">{log.tool}</dd>
                    </div>
                    <div className="xl:col-span-2">
                      <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Justificacion
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap">
                        {log.justification?.trim() || "Sin justificacion informada."}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Empleado
                      </dt>
                      <dd className="mt-1">
                        {terminal?.empleado_nombre ??
                          terminal?.personnel_nombre ??
                          log.personnel_id ??
                          "Sin empleado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Hace cuanto tiempo
                      </dt>
                      <dd className="mt-1">{formatRelativeTime(log.timestamp)}</dd>
                    </div>
                  </dl>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-500"
                      disabled={busyAction !== null}
                      onClick={() => setReviewDialog({ action: "approve", log })}
                    >
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyAction !== null}
                      onClick={() => setReviewDialog({ action: "reject", log })}
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Acciones recientes</CardTitle>
          <CardDescription>Historial de ejecucion y decisiones de aprobacion.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-sm text-slate-400">
              Cargando acciones...
            </div>
          ) : (
            <TerminalActionLogTable logs={normalizedLogs} />
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewDialog !== null} onOpenChange={(open) => !open && setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === "approve" ? "Aprobar solicitud" : "Rechazar solicitud"}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog?.action === "approve"
                ? "La accion quedara aprobada y el pendiente se removera de esta vista."
                : "La accion quedara rechazada y el pendiente se removera de esta vista."}
            </DialogDescription>
          </DialogHeader>

          {reviewDialog ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p>
                  <span className="font-medium text-slate-900">Tool:</span> {reviewDialog.log.tool}
                </p>
                <p className="mt-2">
                  <span className="font-medium text-slate-900">Justificacion:</span>{" "}
                  {reviewDialog.log.justification?.trim() || "Sin justificacion informada."}
                </p>
                <p className="mt-2">
                  <span className="font-medium text-slate-900">Empleado:</span>{" "}
                  {terminal?.empleado_nombre ??
                    terminal?.personnel_nombre ??
                    reviewDialog.log.personnel_id ??
                    "Sin empleado"}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={busyAction !== null}
                  onClick={() => setReviewDialog(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant={reviewDialog.action === "reject" ? "destructive" : "default"}
                  className={cn(
                    reviewDialog.action === "approve"
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : undefined
                  )}
                  disabled={busyAction !== null}
                  onClick={() => {
                    const currentDialog = reviewDialog;
                    setReviewDialog(null);
                    void reviewLog(currentDialog.log.id, currentDialog.action);
                  }}
                >
                  {busyAction === `${reviewDialog.action}:${reviewDialog.log.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {reviewDialog.action === "approve"
                    ? "Confirmar aprobacion"
                    : "Confirmar rechazo"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
