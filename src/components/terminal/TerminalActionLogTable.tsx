"use client";

import type { ActionResult } from "@/types/agent-terminal";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type LogTimestamp =
  | {
      toDate: () => Date;
    }
  | {
      seconds?: number;
      nanoseconds?: number;
      _seconds?: number;
      _nanoseconds?: number;
    };

type TerminalActionLogRow = {
  id: string;
  terminal_id: string;
  personnel_id: string | null;
  puesto_id: string | null;
  departamento_id: string | null;
  organization_id: string;
  tool: string;
  params: Record<string, unknown>;
  result: ActionResult;
  duration_ms?: number;
  proceso_id?: string;
  required_approval?: boolean;
  justification?: string;
  block_reason?: string;
  approved_by?: string | null;
  timestamp: LogTimestamp;
};

type TerminalActionLogTableProps = {
  logs: TerminalActionLogRow[];
  onApprove?: (logId: string) => void;
  onReject?: (logId: string) => void;
};

const resultStyles: Record<ActionResult, string> = {
  success: "border-transparent bg-green-100 text-green-800",
  blocked: "border-transparent bg-red-100 text-red-800",
  pending_approval: "border-transparent bg-amber-100 text-amber-900",
  error: "border-transparent bg-orange-100 text-orange-800",
  approved: "border-transparent bg-emerald-100 text-emerald-800",
  rejected: "border-transparent bg-red-200 text-red-900",
};

const resultLabels: Record<ActionResult, string> = {
  success: "Exito",
  blocked: "Bloqueado",
  pending_approval: "Pendiente",
  error: "Error",
  approved: "Aprobado",
  rejected: "Rechazado",
};

function summarizeParams(params: Record<string, unknown>) {
  const entries = Object.entries(params).slice(0, 3);

  if (entries.length === 0) {
    return "Sin parametros";
  }

  const summary = entries
    .map(([key, value]) => {
      const rendered =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : Array.isArray(value)
            ? `[${value.length}]`
            : value && typeof value === "object"
              ? "{...}"
              : String(value);

      return `${key}: ${rendered}`;
    })
    .join(" · ");

  return summary.length > 80 ? `${summary.slice(0, 77)}...` : summary;
}

function formatDuration(durationMs?: number) {
  if (typeof durationMs !== "number") {
    return "-";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 0 : 1)} s`;
}

function formatDate(timestamp: LogTimestamp) {
  if ("toDate" in timestamp && typeof timestamp.toDate === "function") {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(timestamp.toDate());
  }

  const raw = timestamp as {
    seconds?: number;
    nanoseconds?: number;
    _seconds?: number;
    _nanoseconds?: number;
  };
  const seconds =
    typeof raw.seconds === "number"
      ? raw.seconds
      : typeof raw._seconds === "number"
        ? raw._seconds
        : null;
  const nanoseconds =
    typeof raw.nanoseconds === "number"
      ? raw.nanoseconds
      : typeof raw._nanoseconds === "number"
        ? raw._nanoseconds
        : 0;

  if (seconds === null) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000)));
}

export function TerminalActionLogTable({
  logs,
  onApprove,
  onReject,
}: TerminalActionLogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200/80 bg-white">
        <p className="text-sm text-slate-400">No hay acciones registradas.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200/80 bg-slate-50/60">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Tool</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Parametros</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Resultado</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Proceso</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Duracion</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const canReview =
              log.result === "pending_approval" && typeof onApprove === "function" && typeof onReject === "function";

            return (
              <tr key={log.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{log.tool}</td>
                <td className="max-w-xs px-4 py-3 text-slate-600">{summarizeParams(log.params)}</td>
                <td className="px-4 py-3 text-slate-700">
                  <div className="flex items-center gap-2">
                    <Badge className={resultStyles[log.result]}>{resultLabels[log.result]}</Badge>
                    {canReview ? (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => onApprove(log.id)}>
                          Aprobar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onReject(log.id)}>
                          Rechazar
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{log.proceso_id ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{formatDuration(log.duration_ms)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(log.timestamp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
