import { MoraAgendaService } from "@/services/MoraAgendaService";
import type { FinMoraAccion } from "@/types/fin-mora";

describe("MoraAgendaService", () => {
  it("normaliza acciones v2 con defaults compatibles", () => {
    const accion = MoraAgendaService.normalizeAccion({
      id: "ac-2",
      organization_id: "org-1",
      cliente_id: "cl-1",
      tipo: "whatsapp",
      resultado: "Promesa de pago",
      proxima_accion_at: "2026-04-20",
      created_at: "2026-04-05T10:00:00.000Z",
      created_by: {
        user_id: "u1",
        nombre: "Usuario",
      },
    });

    expect(accion.etapa).toBe("mora_temprana");
    expect(accion.clase).toBe("mora_temprana");
    expect(accion.categoria).toBe("contacto");
    expect(accion.prioridad).toBe("media");
    expect(accion.estado).toBe("programada");
    expect(accion.resultado_texto).toBe("Promesa de pago");
  });

  it("arma agenda con acciones vencidas y pendientes, excluyendo ejecutadas", () => {
    const acciones: FinMoraAccion[] = [
      {
        id: "ac-vencida",
        organization_id: "org-1",
        cliente_id: "cl-1",
        etapa: "pre_judicial",
        tipo: "llamado",
        estado: "vencida",
        proxima_accion_at: "2026-04-03",
        resultado: "Sin contacto",
        created_at: "2026-04-01T08:00:00.000Z",
        created_by: { user_id: "u1", nombre: "Usuario" },
      },
      {
        id: "ac-pendiente",
        organization_id: "org-1",
        cliente_id: "cl-1",
        etapa: "pre_judicial",
        tipo: "tarea",
        estado: "pendiente",
        fecha_vencimiento_accion: "2026-04-09",
        notas: "Preparar documentacion",
        created_at: "2026-04-05T08:00:00.000Z",
        created_by: { user_id: "u2", nombre: "Operador" },
      },
      {
        id: "ac-cerrada",
        organization_id: "org-1",
        cliente_id: "cl-1",
        etapa: "pre_judicial",
        tipo: "nota_interna",
        estado: "ejecutada",
        executed_at: "2026-04-04T10:00:00.000Z",
        created_at: "2026-04-04T09:00:00.000Z",
        created_by: { user_id: "u3", nombre: "Supervisor" },
      },
    ];

    const agenda = MoraAgendaService.listAgenda(acciones);
    const vencidas = MoraAgendaService.listAgenda(acciones, { vencidas: true });

    expect(agenda).toHaveLength(2);
    expect(agenda.map((item) => item.accion_id)).toEqual([
      "ac-vencida",
      "ac-pendiente",
    ]);
    expect(vencidas).toHaveLength(1);
    expect(vencidas[0]?.accion_id).toBe("ac-vencida");
  });

  it("construye timeline ordenado priorizando executed_at sobre created_at", () => {
    const acciones: FinMoraAccion[] = [
      {
        id: "ac-3",
        organization_id: "org-1",
        cliente_id: "cl-1",
        etapa: "pre_judicial",
        tipo: "llamado",
        resultado: "Sin contacto",
        proxima_accion_at: "2026-04-07",
        created_at: "2026-04-05T08:00:00.000Z",
        created_by: { user_id: "u1", nombre: "Usuario" },
      },
      {
        id: "ac-4",
        organization_id: "org-1",
        cliente_id: "cl-1",
        etapa: "pre_judicial",
        tipo: "nota_interna",
        estado: "ejecutada",
        executed_at: "2026-04-06T09:00:00.000Z",
        created_at: "2026-04-05T09:00:00.000Z",
        created_by: { user_id: "u2", nombre: "Operador" },
      },
    ];

    const timeline = MoraAgendaService.listTimeline(acciones);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.accion_id).toBe("ac-4");
    expect(timeline[1]?.accion_id).toBe("ac-3");
  });

  it("mantiene compatibilidad con acciones legacy usando clase y responsable heredado", () => {
    const accion = MoraAgendaService.normalizeAccion({
      id: "ac-legacy",
      organization_id: "org-1",
      cliente_id: "cl-1",
      clase: "judicial",
      tipo: "derivacion_estudio",
      created_at: "2026-04-05T10:00:00.000Z",
      created_by: {
        user_id: "u9",
        nombre: "Estudio externo",
      },
    });

    expect(accion.etapa).toBe("judicial");
    expect(accion.clase).toBe("judicial");
    expect(accion.responsable_user_id).toBe("u9");
    expect(accion.responsable_nombre).toBe("Estudio externo");
    expect(accion.estado).toBe("pendiente");
  });
});
