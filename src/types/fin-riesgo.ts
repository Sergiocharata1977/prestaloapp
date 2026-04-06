import type { FinClienteNosisConsulta, FinClienteNosisUltimo } from "@/types/fin-cliente";
import type { FinEvaluacion } from "@/types/fin-evaluacion";
import type { FinLineaCredito } from "@/types/fin-linea-credito";

export type FinRiesgoSemaforo = "verde" | "amarillo" | "rojo";

export interface FinClienteRiesgoPayload {
  cliente: {
    id: string;
    tier_crediticio: FinEvaluacion["tier"] | null;
    limite_credito_asignado: number | null;
    limite_credito_vigente: number | null;
    evaluacion_id_ultima: string | null;
    evaluacion_vigente_hasta: string | null;
    saldo_total_adeudado: number;
  };
  evaluacion: {
    actual: FinEvaluacion | null;
    historial: FinEvaluacion[];
  };
  linea: FinLineaCredito | null;
  nosis: {
    ultimo: FinClienteNosisUltimo | null;
    historial: FinClienteNosisConsulta[];
  };
}

export interface FinClienteRiesgoApiResponse {
  success: boolean;
  data: FinClienteRiesgoPayload;
}
