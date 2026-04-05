import type { FinCheque } from "@/types/fin-cheque";
import type { FinCliente } from "@/types/fin-cliente";
import type { FinCredito } from "@/types/fin-credito";

export type FinMoraEtapa = "sin_gestion" | "pre_judicial" | "judicial";

export type FinMoraAccionClase = "pre_judicial" | "judicial";

export type FinMoraAccionTipo =
  | "llamado"
  | "whatsapp"
  | "email"
  | "carta_documento"
  | "visita"
  | "acuerdo"
  | "derivacion_estudio"
  | "demanda"
  | "nota_interna";

export interface FinMoraAccion {
  id: string;
  organization_id: string;
  cliente_id: string;
  clase: FinMoraAccionClase;
  tipo: FinMoraAccionTipo;
  resultado: string;
  notas?: string;
  proxima_accion_at?: string;
  created_at: string;
  created_by: {
    user_id: string;
    nombre: string;
  };
}

export interface FinClienteMoraResumen extends FinCliente {
  mora_etapa: FinMoraEtapa;
  mora_estado: "normal" | "en_mora" | "pre_judicial" | "judicial";
  creditos_en_mora_count: number;
  creditos_incobrables_count: number;
  cheques_observados_count: number;
  saldo_vencido: number;
  dias_max_mora: number;
  ultima_accion_at?: string;
  proxima_accion_at?: string;
  acciones_count: number;
  creditos_relacionados: Pick<
    FinCredito,
    "id" | "numero_credito" | "estado" | "saldo_capital" | "fecha_primer_vencimiento"
  >[];
  cheques_relacionados: Pick<
    FinCheque,
    "id" | "numero" | "estado" | "importe" | "fecha_pago"
  >[];
}
