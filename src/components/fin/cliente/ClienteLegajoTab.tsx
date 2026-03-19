"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  FileText,
  FolderOpen,
  Plus,
  Save,
} from "lucide-react";
import type {
  FinCliente,
  FinClienteLegajo,
  FinClienteLegajoChecklistItem,
  FinClienteLegajoDocumento,
  FinClienteLegajoDocumentoEstado,
} from "@/types/fin-cliente";
import { apiFetch } from "@/lib/apiFetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CHECKLIST_BASE: Record<
  FinCliente["tipo"],
  Array<{ clave: string; label: string; obligatorio: boolean }>
> = {
  fisica: [
    { clave: "dni", label: "DNI frente y dorso", obligatorio: true },
    { clave: "cuit", label: "Constancia de CUIT/CUIL", obligatorio: true },
    { clave: "domicilio", label: "Comprobante de domicilio", obligatorio: true },
    { clave: "ingresos", label: "Comprobante de ingresos", obligatorio: true },
    { clave: "referencias", label: "Referencias comerciales o personales", obligatorio: false },
  ],
  juridica: [
    { clave: "estatuto", label: "Estatuto o contrato social", obligatorio: true },
    { clave: "cuit", label: "Constancia de CUIT", obligatorio: true },
    { clave: "autoridades", label: "Acta de autoridades vigente", obligatorio: true },
    { clave: "balance", label: "Balance o estados contables", obligatorio: true },
    { clave: "domicilio", label: "Constancia de domicilio fiscal", obligatorio: true },
  ],
};

const DOCUMENT_STATES: Array<{
  value: FinClienteLegajoDocumentoEstado;
  label: string;
}> = [
  { value: "pendiente", label: "Pendiente" },
  { value: "cargado", label: "Cargado" },
  { value: "observado", label: "Observado" },
];

function buildDefaultLegajo(cliente: FinCliente): FinClienteLegajo {
  const now = new Date().toISOString();
  const checklist = CHECKLIST_BASE[cliente.tipo].map((item, index) => ({
    id: `${cliente.tipo}-${item.clave}-${index}`,
    clave: item.clave,
    label: item.label,
    obligatorio: item.obligatorio,
    completo: false,
    observaciones: "",
    updated_at: now,
  }));

  return {
    estado: "incompleto",
    checklist,
    documentos: [],
    notas: "",
    updated_at: now,
  };
}

function mergeLegajo(cliente: FinCliente): FinClienteLegajo {
  const stored = cliente.legajo;
  const base = buildDefaultLegajo(cliente);

  const checklist = base.checklist.map((baseItem) => {
    const found = stored?.checklist.find((item) => item.clave === baseItem.clave);
    return found
      ? {
          ...baseItem,
          ...found,
          label: found.label || baseItem.label,
          obligatorio:
            typeof found.obligatorio === "boolean" ? found.obligatorio : baseItem.obligatorio,
          completo: Boolean(found.completo),
          observaciones: found.observaciones ?? "",
        }
      : baseItem;
  });

  const customChecklist = (stored?.checklist ?? []).filter(
    (item) => !checklist.some((existing) => existing.clave === item.clave)
  );

  const mergedChecklist = [...checklist, ...customChecklist];
  const required = mergedChecklist.filter((item) => item.obligatorio);
  const estado =
    required.length > 0 && required.every((item) => item.completo) ? "completo" : "incompleto";

  return {
    estado,
    checklist: mergedChecklist,
    documentos: stored?.documentos ?? [],
    notas: stored?.notas ?? "",
    updated_at: stored?.updated_at,
  };
}

function newDocument(): FinClienteLegajoDocumento {
  const now = new Date().toISOString();
  return {
    id: `doc-${now}`,
    nombre: "",
    categoria: "",
    estado: "pendiente",
    archivo_nombre: "",
    observaciones: "",
    updated_at: now,
  };
}

function normalizeLegajoForSave(legajo: FinClienteLegajo): FinClienteLegajo {
  const checklist = legajo.checklist.map((item) => ({
    ...item,
    observaciones: item.observaciones?.trim() || undefined,
  }));
  const required = checklist.filter((item) => item.obligatorio);
  const estado =
    required.length > 0 && required.every((item) => item.completo) ? "completo" : "incompleto";

  return {
    ...legajo,
    estado,
    checklist,
    documentos: legajo.documentos
      .map((documento) => ({
        ...documento,
        nombre: documento.nombre.trim(),
        categoria: documento.categoria.trim(),
        archivo_nombre: documento.archivo_nombre?.trim() || undefined,
        observaciones: documento.observaciones?.trim() || undefined,
      }))
      .filter((documento) => documento.nombre && documento.categoria),
    notas: legajo.notas?.trim() || undefined,
    updated_at: new Date().toISOString(),
  };
}

interface ClienteLegajoTabProps {
  cliente: FinCliente;
  onClienteUpdated: (cliente: FinCliente) => void;
}

export function ClienteLegajoTab({
  cliente,
  onClienteUpdated,
}: ClienteLegajoTabProps) {
  const [legajo, setLegajo] = useState<FinClienteLegajo>(() => mergeLegajo(cliente));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLegajo(mergeLegajo(cliente));
  }, [cliente]);

  const stats = useMemo(() => {
    const required = legajo.checklist.filter((item) => item.obligatorio);
    const completed = required.filter((item) => item.completo).length;
    const documentsLoaded = legajo.documentos.filter((item) => item.estado === "cargado").length;
    const estado =
      required.length > 0 && completed === required.length ? "completo" : "incompleto";

    return {
      requiredTotal: required.length,
      completed,
      documentsLoaded,
      estado,
    };
  }, [legajo]);

  const setChecklistItem = (
    itemId: string,
    updater: (item: FinClienteLegajoChecklistItem) => FinClienteLegajoChecklistItem
  ) => {
    setLegajo((current) => ({
      ...current,
      checklist: current.checklist.map((item) =>
        item.id === itemId
          ? updater({ ...item, updated_at: new Date().toISOString() })
          : item
      ),
    }));
  };

  const setDocument = (
    documentId: string,
    updater: (item: FinClienteLegajoDocumento) => FinClienteLegajoDocumento
  ) => {
    setLegajo((current) => ({
      ...current,
      documentos: current.documentos.map((item) =>
        item.id === documentId
          ? updater({ ...item, updated_at: new Date().toISOString() })
          : item
      ),
    }));
  };

  const saveLegajo = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = normalizeLegajoForSave(legajo);
      const response = await apiFetch(`/api/fin/clientes/${cliente.id}`, {
        method: "PATCH",
        body: JSON.stringify({ legajo: payload }),
      });

      const body = (await response.json().catch(() => null)) as
        | { cliente?: FinCliente; error?: string }
        | null;

      if (!response.ok || !body?.cliente) {
        throw new Error(body?.error ?? "No se pudo guardar el legajo");
      }

      setLegajo(mergeLegajo(body.cliente));
      onClienteUpdated(body.cliente);
      setMessage("Legajo guardado.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el legajo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {stats.estado === "completo" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <CircleDashed className="h-4 w-4 text-amber-600" />
              )}
              Estado del legajo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge
              className={
                stats.estado === "completo"
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }
            >
              {stats.estado === "completo" ? "Completo" : "Incompleto"}
            </Badge>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <span className="text-slate-500">Checklist requerido</span>
                <span className="font-medium text-slate-900">
                  {stats.completed}/{stats.requiredTotal}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <span className="text-slate-500">Documentos cargados</span>
                <span className="font-medium text-slate-900">{stats.documentsLoaded}</span>
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-slate-500">
                Tipo base: {cliente.tipo === "fisica" ? "Persona fisica" : "Persona juridica"}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="legajo-notas">Notas del legajo</Label>
              <Textarea
                id="legajo-notas"
                value={legajo.notas ?? ""}
                onChange={(event) =>
                  setLegajo((current) => ({ ...current, notas: event.target.value }))
                }
                placeholder="Observaciones internas, pendientes o validaciones."
              />
            </div>
            {message ? <p className="text-sm text-green-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button onClick={saveLegajo} disabled={saving} className="w-full">
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar legajo"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-slate-500" />
              Checklist por tipo de cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {legajo.checklist.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setChecklistItem(item.id, (current) => ({
                            ...current,
                            completo: !current.completo,
                          }))
                        }
                        className="rounded-full"
                      >
                        {item.completo ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <CircleDashed className="h-5 w-5 text-slate-400" />
                        )}
                      </button>
                      <div className="font-medium text-slate-900">{item.label}</div>
                      <Badge variant="outline">
                        {item.obligatorio ? "Obligatorio" : "Opcional"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {item.completo
                        ? "Marcado como presentado y validado."
                        : "Pendiente de presentacion o revision."}
                    </p>
                  </div>
                  <div className="min-w-72 flex-1 xl:max-w-md">
                    <Label htmlFor={`obs-${item.id}`}>Observaciones</Label>
                    <Textarea
                      id={`obs-${item.id}`}
                      value={item.observaciones ?? ""}
                      onChange={(event) =>
                        setChecklistItem(item.id, (current) => ({
                          ...current,
                          observaciones: event.target.value,
                        }))
                      }
                      placeholder="Detalle de faltantes, validacion o vencimiento."
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-slate-500" />
            Documentos cargados
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setLegajo((current) => ({
                ...current,
                documentos: [...current.documentos, newDocument()],
              }))
            }
          >
            <Plus className="h-4 w-4" />
            Agregar documento
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {legajo.documentos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No hay documentos registrados en el legajo.
            </div>
          ) : null}

          {legajo.documentos.map((documento) => (
            <div
              key={documento.id}
              className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[1.2fr_1fr_180px]"
            >
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={`nombre-${documento.id}`}>Nombre</Label>
                  <Input
                    id={`nombre-${documento.id}`}
                    value={documento.nombre}
                    onChange={(event) =>
                      setDocument(documento.id, (current) => ({
                        ...current,
                        nombre: event.target.value,
                      }))
                    }
                    placeholder="Ej: DNI, balance 2025, contrato social"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`archivo-${documento.id}`}>Archivo o referencia</Label>
                  <Input
                    id={`archivo-${documento.id}`}
                    value={documento.archivo_nombre ?? ""}
                    onChange={(event) =>
                      setDocument(documento.id, (current) => ({
                        ...current,
                        archivo_nombre: event.target.value,
                      }))
                    }
                    placeholder="Nombre del PDF, enlace o referencia interna"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={`categoria-${documento.id}`}>Categoria</Label>
                  <Input
                    id={`categoria-${documento.id}`}
                    value={documento.categoria}
                    onChange={(event) =>
                      setDocument(documento.id, (current) => ({
                        ...current,
                        categoria: event.target.value,
                      }))
                    }
                    placeholder="Identidad, fiscal, societario, ingresos"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`obsdoc-${documento.id}`}>Observaciones</Label>
                  <Textarea
                    id={`obsdoc-${documento.id}`}
                    value={documento.observaciones ?? ""}
                    onChange={(event) =>
                      setDocument(documento.id, (current) => ({
                        ...current,
                        observaciones: event.target.value,
                      }))
                    }
                    placeholder="Version, vencimiento o nota de control"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <FileText className="h-4 w-4 text-slate-500" />
                    Estado
                  </div>
                  <div className="space-y-2">
                    {DOCUMENT_STATES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDocument(documento.id, (current) => ({
                            ...current,
                            estado: option.value,
                          }))
                        }
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                          documento.estado === option.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>{option.label}</span>
                        {documento.estado === option.value ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() =>
                    setLegajo((current) => ({
                      ...current,
                      documentos: current.documentos.filter((item) => item.id !== documento.id),
                    }))
                  }
                >
                  Quitar documento
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
