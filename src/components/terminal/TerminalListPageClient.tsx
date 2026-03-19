"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { Copy, Loader2, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  TerminalTable,
  type Terminal,
} from "@/components/terminal/TerminalTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";

type PersonnelOption = {
  id: string;
  nombre: string;
  puesto_nombre?: string;
  departamento_nombre?: string;
};

type CreatedTerminal = Terminal & {
  pairing_code?: string;
};

type TerminalListPageClientProps = {
  initialTerminals: Terminal[];
  initialError?: string | null;
};

function buildPairCommand(pairingCode: string) {
  return `don-candido-agent pair --code ${pairingCode}`;
}

export function TerminalListPageClient({
  initialTerminals,
  initialError = null,
}: TerminalListPageClientProps) {
  const router = useRouter();
  const [terminals, setTerminals] = useState(initialTerminals);
  const [error, setError] = useState<string | null>(initialError);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuarantining, setIsQuarantining] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [terminalName, setTerminalName] = useState("");
  const [personnelSearch, setPersonnelSearch] = useState("");
  const deferredSearch = useDeferredValue(personnelSearch);
  const [personnelOptions, setPersonnelOptions] = useState<PersonnelOption[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelOption | null>(null);

  useEffect(() => {
    setTerminals(initialTerminals);
  }, [initialTerminals]);

  useEffect(() => {
    let cancelled = false;

    const loadPersonnel = async () => {
      setPersonnelLoading(true);

      try {
        const query = deferredSearch.trim();
        const url = query
          ? `/api/rrhh/personnel?search=${encodeURIComponent(query)}`
          : "/api/rrhh/personnel";
        const response = await apiFetch(url);

        if (!response.ok) {
          throw new Error("No se pudo buscar empleados");
        }

        const data = (await response.json()) as { personnel?: PersonnelOption[] };
        if (!cancelled) {
          setPersonnelOptions(data.personnel ?? []);
        }
      } catch (nextError) {
        if (!cancelled) {
          setPersonnelOptions([]);
          setError(nextError instanceof Error ? nextError.message : "No se pudo buscar empleados");
        }
      } finally {
        if (!cancelled) {
          setPersonnelLoading(false);
        }
      }
    };

    void loadPersonnel();

    return () => {
      cancelled = true;
    };
  }, [deferredSearch]);

  const resetCreateForm = () => {
    setTerminalName("");
    setPersonnelSearch("");
    setSelectedPersonnel(null);
  };

  const handleCreateTerminal = async () => {
    if (!terminalName.trim() || !selectedPersonnel) {
      setError("Completá el nombre y seleccioná un empleado.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch("/api/admin/terminals", {
        method: "POST",
        body: JSON.stringify({
          nombre: terminalName.trim(),
          personnel_id: selectedPersonnel.id,
        }),
      });

      const data = (await response.json()) as CreatedTerminal & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo crear la terminal");
      }

      setTerminals((current) => [data, ...current]);
      setPairingCode(data.pairing_code ?? null);
      setIsCreateOpen(false);
      setIsPairingOpen(Boolean(data.pairing_code));
      resetCreateForm();
      startTransition(() => router.refresh());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo crear la terminal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuarantine = async (id: string) => {
    setIsQuarantining(id);
    setError(null);

    try {
      const response = await apiFetch(`/api/admin/terminals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "quarantined" }),
      });

      const data = (await response.json()) as Terminal & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo cuarentenar la terminal");
      }

      setTerminals((current) => current.map((terminal) => (terminal.id === id ? data : terminal)));
      startTransition(() => router.refresh());
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "No se pudo cuarentenar la terminal"
      );
    } finally {
      setIsQuarantining(null);
    }
  };

  const handleCopy = async () => {
    if (!pairingCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildPairCommand(pairingCode));
      setCopyFeedback("Comando copiado.");
    } catch {
      setCopyFeedback("No se pudo copiar el comando.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Terminales</h1>
          <p className="text-sm text-slate-500">
            Alta, emparejamiento y bloqueo de terminales asignadas a empleados.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva terminal
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isQuarantining ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Actualizando estado de la terminal...
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Inventario</CardTitle>
          <CardDescription>
            Estado actual y asignaciÃ³n de terminales registradas en la organizaciÃ³n.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TerminalTable terminals={terminals} onQuarantine={handleQuarantine} />
        </CardContent>
      </Card>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            resetCreateForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva terminal</DialogTitle>
            <DialogDescription>
              CreÃ¡ la terminal y asignala a un empleado para generar el cÃ³digo de pairing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="terminal-name">Nombre de la terminal</Label>
              <Input
                id="terminal-name"
                placeholder="Ej: Caja-Oficina-01"
                value={terminalName}
                onChange={(event) => setTerminalName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terminal-personnel-search">Empleado</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="terminal-personnel-search"
                  className="pl-9"
                  placeholder="Buscar empleado..."
                  value={personnelSearch}
                  onChange={(event) => setPersonnelSearch(event.target.value)}
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                {personnelLoading ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando empleados...
                  </div>
                ) : personnelOptions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    No se encontraron empleados.
                  </div>
                ) : (
                  personnelOptions.map((option) => {
                    const isSelected = selectedPersonnel?.id === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`flex w-full flex-col items-start gap-1 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 ${
                          isSelected ? "bg-amber-50 text-amber-950" : "hover:bg-slate-50"
                        }`}
                        onClick={() => {
                          setSelectedPersonnel(option);
                          setPersonnelSearch(option.nombre);
                        }}
                      >
                        <span className="font-medium">{option.nombre}</span>
                        <span className="text-xs text-slate-500">
                          {option.departamento_nombre ?? "Sin departamento"} ·{" "}
                          {option.puesto_nombre ?? "Sin puesto"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  resetCreateForm();
                }}
              >
                Cancelar
              </Button>
              <Button disabled={isSubmitting} onClick={handleCreateTerminal}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear terminal"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPairingOpen}
        onOpenChange={(open) => {
          setIsPairingOpen(open);
          if (!open) {
            setCopyFeedback(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CÃ³digo de emparejamiento</DialogTitle>
            <DialogDescription>
              EjecutÃ¡ en la terminal del empleado:{" "}
              {pairingCode ? buildPairCommand(pairingCode) : "don-candido-agent pair --code DC-XXXX-XXXX"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Pairing code</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-amber-950">
                {pairingCode ?? "Sin cÃ³digo"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
              {pairingCode
                ? buildPairCommand(pairingCode)
                : "don-candido-agent pair --code DC-XXXX-XXXX"}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Este cÃ³digo expira en 24 horas y no se mostrarÃ¡ de nuevo.
              </p>
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
            </div>

            {copyFeedback ? (
              <p className="text-sm text-slate-600">{copyFeedback}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
