"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  TerminalStatusBadge,
  type SerializedTimestamp,
  type TerminalStatus,
} from "@/components/terminal/TerminalStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type Terminal = {
  id: string;
  nombre: string;
  status: TerminalStatus;
  personnel_id?: string | null;
  personnel_nombre?: string | null;
  empleado_nombre?: string | null;
  departamento_nombre?: string | null;
  puesto_nombre?: string | null;
  last_heartbeat?: SerializedTimestamp;
};

type TerminalTableProps = {
  terminals: Terminal[];
  onQuarantine: (id: string) => void;
};

function formatDateTime(timestamp?: SerializedTimestamp) {
  if (!timestamp) {
    return "Sin actividad";
  }

  let date: Date | null = null;

  if ("toDate" in (timestamp as Record<string, unknown>) && typeof (timestamp as { toDate?: () => Date }).toDate === "function") {
    date = (timestamp as { toDate: () => Date }).toDate();
  } else if (
    typeof (timestamp as { seconds?: number }).seconds === "number" ||
    typeof (timestamp as { _seconds?: number })._seconds === "number"
  ) {
    const seconds =
      typeof (timestamp as { seconds?: number }).seconds === "number"
        ? (timestamp as { seconds: number }).seconds
        : (timestamp as { _seconds: number })._seconds;
    const nanoseconds =
      typeof (timestamp as { nanoseconds?: number }).nanoseconds === "number"
        ? (timestamp as { nanoseconds: number }).nanoseconds
        : typeof (timestamp as { _nanoseconds?: number })._nanoseconds === "number"
          ? (timestamp as { _nanoseconds: number })._nanoseconds
          : 0;

    date = new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000));
  }

  if (!date || Number.isNaN(date.getTime())) {
    return "Sin actividad";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function resolveEmployeeName(terminal: Terminal) {
  return terminal.empleado_nombre ?? terminal.personnel_nombre ?? terminal.personnel_id ?? "Sin asignar";
}

export function TerminalTable({ terminals, onQuarantine }: TerminalTableProps) {
  const router = useRouter();
  const [terminalToQuarantine, setTerminalToQuarantine] = useState<Terminal | null>(null);

  if (terminals.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200/80 bg-white">
        <p className="text-sm text-slate-400">No hay terminales para mostrar.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200/80 bg-slate-50/60">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Nombre/Hostname</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Empleado</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Departamento</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Puesto</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Ultima actividad</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {terminals.map((terminal) => (
              <tr
                key={terminal.id}
                className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-amber-50/40 last:border-0"
                onClick={() => router.push(`/terminales/${terminal.id}`)}
              >
                <td className="px-4 py-3 text-slate-900">
                  <Link
                    href={`/terminales/${terminal.id}`}
                    className="block font-medium hover:text-amber-700"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {terminal.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{resolveEmployeeName(terminal)}</td>
                <td className="px-4 py-3 text-slate-700">
                  {terminal.departamento_nombre ?? "Sin departamento"}
                </td>
                <td className="px-4 py-3 text-slate-700">{terminal.puesto_nombre ?? "Sin puesto"}</td>
                <td className="px-4 py-3 text-slate-700">
                  <TerminalStatusBadge
                    status={terminal.status}
                    lastHeartbeat={terminal.last_heartbeat}
                  />
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {formatDateTime(terminal.last_heartbeat)}
                </td>
                <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                  <Dialog
                    open={terminalToQuarantine?.id === terminal.id}
                    onOpenChange={(open) => setTerminalToQuarantine(open ? terminal : null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={terminal.status === "quarantined"}
                      >
                        Cuarentenar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cuarentenar terminal</DialogTitle>
                        <DialogDescription>
                          Esta accion revocara el acceso de <strong>{terminal.nombre}</strong>. Solo
                          continua si queres bloquear la terminal de inmediato.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="mt-6 flex justify-end gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setTerminalToQuarantine(null)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            onQuarantine(terminal.id);
                            setTerminalToQuarantine(null);
                          }}
                        >
                          Confirmar cuarentena
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
