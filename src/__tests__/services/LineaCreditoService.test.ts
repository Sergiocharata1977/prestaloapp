import { LineaCreditoService } from "@/services/LineaCreditoService";
import type { FinCredito } from "@/types/fin-credito";

describe("LineaCreditoService", () => {
  it("calcula disponible segun limite total y mensual", () => {
    const result = LineaCreditoService.calcularDisponibleActual({
      limite_total: 100000,
      limite_mensual: 30000,
      consumo_actual: 25000,
      consumo_mensual_actual: 12000,
    });

    expect(result.disponible_total_actual).toBe(75000);
    expect(result.disponible_mensual_actual).toBe(18000);
    expect(result.disponible_actual).toBe(18000);
  });

  it("buildFromSources ignora creditos cancelados e incobrables", () => {
    const creditos: Partial<FinCredito>[] = [
      {
        id: "cr-1",
        cliente_id: "cli-1",
        saldo_capital: 20000,
        capital: 25000,
        estado: "activo",
        fecha_otorgamiento: "2026-03-02",
      },
      {
        id: "cr-2",
        cliente_id: "cli-1",
        saldo_capital: 15000,
        capital: 15000,
        estado: "en_mora",
        fecha_otorgamiento: "2026-03-10",
      },
      {
        id: "cr-3",
        cliente_id: "cli-1",
        saldo_capital: 99999,
        capital: 99999,
        estado: "cancelado",
        fecha_otorgamiento: "2026-03-12",
      },
      {
        id: "cr-4",
        cliente_id: "cli-1",
        saldo_capital: 88888,
        capital: 88888,
        estado: "incobrable",
        fecha_otorgamiento: "2026-03-15",
      },
    ];

    const linea = LineaCreditoService.buildFromSources({
      cliente: {
        id: "cli-1",
        organization_id: "org-1",
        limite_credito_asignado: 100000,
        limite_credito_vigente: 90000,
        evaluacion_vigente_hasta: "2099-12-31T00:00:00.000Z",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-18T00:00:00.000Z",
      },
      creditos: creditos as FinCredito[],
      evaluacion: {
        id: "ev-1",
        fecha: "2026-03-01",
        estado: "aprobada",
        tier: "B",
        tier_asignado: "B",
        limite_credito_asignado: 90000,
        limite_sugerido: 80000,
        es_vigente: true,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-18T00:00:00.000Z",
      },
    });

    expect(linea.consumo_actual).toBe(35000);
    expect(linea.consumo_mensual_actual).toBe(40000);
    expect(linea.disponible_total_actual).toBe(55000);
    expect(linea.vigencia.estado).toBe("vigente");
  });
});
