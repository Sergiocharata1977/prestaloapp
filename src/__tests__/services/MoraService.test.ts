import { MoraAgendaService } from "@/services/MoraAgendaService";
import { buildClienteMoraResumen } from "@/services/MoraService";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinCredito } from "@/types/fin-credito";
import type { FinMoraAccion } from "@/types/fin-mora";

const baseCliente: FinCliente = {
  id: "cl-1",
  organization_id: "org-1",
  tipo: "fisica",
  nombre: "Ana",
  apellido: "Perez",
  cuit: "20111222334",
  creditos_activos_count: 1,
  saldo_total_adeudado: 120000,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by: "u1",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const baseCredito: FinCredito = {
  id: "cr-1",
  organization_id: "org-1",
  sucursal_id: "suc-1",
  cliente_id: "cl-1",
  numero_credito: "0001",
  articulo_descripcion: "Moto",
  capital: 120000,
  tasa_mensual: 5,
  snapshot_tasa_mensual: 5,
  snapshot_tasa_punitoria_mensual: 8,
  cantidad_cuotas: 12,
  sistema: "frances",
  total_intereses: 10000,
  total_credito: 130000,
  valor_cuota_promedio: 10833,
  fecha_otorgamiento: "2025-10-01",
  fecha_primer_vencimiento: "2025-11-01",
  estado: "activo",
  cuotas_count: 12,
  cuotas_pagas: 2,
  saldo_capital: 95000,
  asiento_otorgamiento_id: "as-1",
  created_at: "2025-10-01T00:00:00.000Z",
  created_by: "u1",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("MoraService", () => {
  it("deriva etapa judicial desde credito incobrable y agenda proxima accion", () => {
    const accion: FinMoraAccion = {
      id: "ac-1",
      organization_id: "org-1",
      cliente_id: "cl-1",
      clase: "judicial",
      tipo: "derivacion_estudio",
      resultado: "Enviado a estudio",
      proxima_accion_at: "2026-04-10",
      created_at: "2026-04-04T10:00:00.000Z",
      created_by: {
        user_id: "u1",
        nombre: "Usuario",
      },
    };

    const resumen = buildClienteMoraResumen({
      cliente: baseCliente,
      creditos: [{ ...baseCredito, estado: "incobrable" }],
      cheques: [],
      acciones: [accion],
    });

    expect(resumen.mora_etapa).toBe("judicial");
    expect(resumen.mora_estado).toBe("judicial");
    expect(resumen.saldo_vencido).toBe(95000);
    expect(resumen.proxima_accion_at).toBe("2026-04-10");
    expect(resumen.acciones_count).toBe(1);
    expect(resumen.agenda).toHaveLength(1);
    expect(resumen.timeline).toHaveLength(1);
  });

  it("deriva mora_temprana para creditos en mora sin escalar", () => {
    const resumen = buildClienteMoraResumen({
      cliente: baseCliente,
      creditos: [{ ...baseCredito, estado: "en_mora" }],
      cheques: [],
      acciones: [],
    });

    expect(resumen.mora_etapa).toBe("mora_temprana");
    expect(resumen.mora_estado).toBe("mora_temprana");
    expect(resumen.creditos_en_mora_count).toBe(1);
    expect(resumen.agenda).toEqual([]);
    expect(resumen.timeline).toEqual([]);
  });

  it("escala a pre_judicial por accion aunque el credito siga en mora_temprana", () => {
    const resumen = buildClienteMoraResumen({
      cliente: baseCliente,
      creditos: [{ ...baseCredito, estado: "en_mora" }],
      cheques: [],
      acciones: [
        {
          id: "ac-pre",
          organization_id: "org-1",
          cliente_id: "cl-1",
          etapa: "pre_judicial",
          tipo: "carta_documento",
          estado: "programada",
          proxima_accion_at: "2026-04-09",
          created_at: "2026-04-05T11:00:00.000Z",
          created_by: { user_id: "u1", nombre: "Usuario" },
        },
      ],
    });

    expect(resumen.mora_etapa).toBe("pre_judicial");
    expect(resumen.mora_estado).toBe("pre_judicial");
    expect(resumen.proxima_accion_at).toBe("2026-04-09");
  });

  it("escala a judicial por accion aunque no haya credito incobrable", () => {
    const resumen = buildClienteMoraResumen({
      cliente: baseCliente,
      creditos: [{ ...baseCredito, estado: "activo" }],
      cheques: [],
      acciones: [
        {
          id: "ac-jd",
          organization_id: "org-1",
          cliente_id: "cl-1",
          etapa: "judicial",
          tipo: "demanda",
          estado: "ejecutada",
          executed_at: "2026-04-05T12:00:00.000Z",
          created_at: "2026-04-05T08:00:00.000Z",
          created_by: { user_id: "u2", nombre: "Estudio" },
        },
      ],
    });

    expect(resumen.mora_etapa).toBe("judicial");
    expect(resumen.mora_estado).toBe("judicial");
    expect(resumen.ultima_accion_at).toBe("2026-04-05T12:00:00.000Z");
  });

  it("prioriza pre_judicial por cheque rechazado sobre mora_temprana", () => {
    const resumen = buildClienteMoraResumen({
      cliente: baseCliente,
      creditos: [{ ...baseCredito, estado: "en_mora" }],
      cheques: [
        {
          id: "ch-1",
          organization_id: "org-1",
          cliente_id: "cl-1",
          sucursal_id: "suc-1",
          tipo: "terceros",
          banco: "Banco",
          librador_nombre: "Proveedor",
          numero: "1001",
          importe: 50000,
          fecha_emision: "2026-03-01",
          fecha_pago: "2026-03-15",
          moneda: "ARS",
          estado: "rechazado",
          created_at: "2026-03-01T00:00:00.000Z",
          created_by: "u1",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      acciones: [],
    });

    expect(resumen.mora_etapa).toBe("pre_judicial");
    expect(resumen.mora_estado).toBe("pre_judicial");
  });

  it("prioriza gestion_mora_proxima_accion_at del cliente sobre la agenda calculada", () => {
    const resumen = buildClienteMoraResumen({
      cliente: {
        ...baseCliente,
        gestion_mora_proxima_accion_at: "2026-04-15",
      },
      creditos: [{ ...baseCredito, estado: "en_mora" }],
      cheques: [],
      acciones: [
        {
          id: "ac-ag-1",
          organization_id: "org-1",
          cliente_id: "cl-1",
          etapa: "mora_temprana",
          tipo: "whatsapp",
          estado: "programada",
          proxima_accion_at: "2026-04-08",
          created_at: "2026-04-05T09:00:00.000Z",
          created_by: { user_id: "u1", nombre: "Usuario" },
        },
      ],
    });

    expect(resumen.agenda).toHaveLength(1);
    expect(resumen.agenda?.[0]?.programada_at).toBe("2026-04-08");
    expect(resumen.proxima_accion_at).toBe("2026-04-15");
  });

  it("selecciona la proxima accion mas cercana desde la agenda abierta", () => {
    const resumen = buildClienteMoraResumen({
      cliente: baseCliente,
      creditos: [{ ...baseCredito, estado: "en_mora" }],
      cheques: [],
      acciones: [
        {
          id: "ac-ag-2",
          organization_id: "org-1",
          cliente_id: "cl-1",
          etapa: "mora_temprana",
          tipo: "recordatorio",
          estado: "programada",
          proxima_accion_at: "2026-04-11",
          created_at: "2026-04-05T08:00:00.000Z",
          created_by: { user_id: "u1", nombre: "Usuario" },
        },
        {
          id: "ac-ag-3",
          organization_id: "org-1",
          cliente_id: "cl-1",
          etapa: "mora_temprana",
          tipo: "llamado",
          estado: "vencida",
          proxima_accion_at: "2026-04-06",
          created_at: "2026-04-05T07:00:00.000Z",
          created_by: { user_id: "u1", nombre: "Usuario" },
        },
      ],
    });

    expect(resumen.proxima_accion_at).toBe("2026-04-06");
    expect(resumen.proxima_accion_tipo).toBe("llamado");
    expect(resumen.proxima_accion_estado).toBe("vencida");
  });

  it("expone prioridad, responsable y seguimiento desde la agenda calculada", () => {
    const resumen = buildClienteMoraResumen({
      cliente: baseCliente,
      creditos: [{ ...baseCredito, estado: "en_mora" }],
      cheques: [],
      acciones: [
        {
          id: "ac-seg",
          organization_id: "org-1",
          cliente_id: "cl-1",
          etapa: "mora_temprana",
          tipo: "whatsapp",
          prioridad: "alta",
          responsable_nombre: "Equipo cobranzas",
          proxima_accion_tipo: "llamado",
          proxima_accion_at: "2026-04-07",
          created_at: "2026-04-05T07:00:00.000Z",
          created_by: { user_id: "u1", nombre: "Usuario" },
        },
      ],
    });

    expect(resumen.proxima_accion_at).toBe("2026-04-07");
    expect(resumen.proxima_accion_tipo).toBe("whatsapp");
    expect(resumen.proxima_accion_prioridad).toBe("alta");
    expect(resumen.proxima_accion_responsable).toBe("Equipo cobranzas");
    expect(resumen.agenda?.[0]?.responsable_nombre).toBe("Equipo cobranzas");
  });

  it("mantiene compatibilidad con acciones legacy basadas en clase", () => {
    const legacyAccion: FinMoraAccion = {
      id: "ac-legacy",
      organization_id: "org-1",
      cliente_id: "cl-1",
      clase: "pre_judicial",
      tipo: "nota_interna",
      resultado: "Legado",
      proxima_accion_at: "2026-04-12",
      created_at: "2026-04-05T10:00:00.000Z",
      created_by: { user_id: "u1", nombre: "Usuario" },
    };

    const normalizada = MoraAgendaService.normalizeAccion(legacyAccion);
    const resumen = buildClienteMoraResumen({
      cliente: baseCliente,
      creditos: [{ ...baseCredito, estado: "activo" }],
      cheques: [],
      acciones: [legacyAccion],
    });

    expect(normalizada.etapa).toBe("pre_judicial");
    expect(normalizada.clase).toBe("pre_judicial");
    expect(resumen.mora_etapa).toBe("pre_judicial");
    expect(resumen.agenda?.[0]?.accion_id).toBe("ac-legacy");
  });
});
