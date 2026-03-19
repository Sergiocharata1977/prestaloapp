import { ChequeService } from "@/services/ChequeService";

describe("ChequeService.buildPreview", () => {
  it("calcula descuento, gastos e importe neto", () => {
    const preview = ChequeService.buildPreview({
      cliente_id: "cli-1",
      sucursal_id: "suc-1",
      politica_crediticia_id: "pol-1",
      tipo: "cheque_terceros",
      fecha_liquidacion: "2026-03-01",
      fecha_pago: "2026-03-31",
      importe_bruto: 100000,
      tasa_mensual: 6,
      gastos_fijos: [{ concepto: "sellado", importe: 1500 }],
      gastos_variables: [{ concepto: "comision", porcentaje: 2 }],
    });

    expect(preview.dias_corridos).toBe(30);
    expect(preview.descuento).toBeCloseTo(6000, 2);
    expect(preview.gastos_fijos_total).toBe(1500);
    expect(preview.gastos_variables_total).toBe(2000);
    expect(preview.total_gastos).toBe(3500);
    expect(preview.importe_neto_liquidado).toBeCloseTo(90500, 2);
  });

  it("rechaza fechas invertidas", () => {
    expect(() =>
      ChequeService.buildPreview({
        cliente_id: "cli-1",
        sucursal_id: "suc-1",
        politica_crediticia_id: "pol-1",
        tipo: "cheque_propio",
        fecha_liquidacion: "2026-03-20",
        fecha_pago: "2026-03-19",
        importe_bruto: 50000,
      })
    ).toThrow("fecha_pago debe ser posterior o igual a fecha_liquidacion");
  });
});
