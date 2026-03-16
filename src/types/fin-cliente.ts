export type FinClienteTipo = 'fisica' | 'juridica';

export interface FinClienteNosisUltimo {
  fecha: string;
  score: number | null;
  situacion_bcra: number | null;
  cheques_rechazados: number;
  juicios_activos: number;
  consultado_por: string;
}

export interface FinCliente {
  id: string;
  organization_id: string;
  tipo: FinClienteTipo;
  nombre: string;
  apellido?: string;
  dni?: string;
  cuit: string;
  telefono?: string;
  email?: string;
  domicilio?: string;
  localidad?: string;
  provincia?: string;
  nosis_ultimo?: FinClienteNosisUltimo;
  creditos_activos_count: number;
  saldo_total_adeudado: number;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export type FinClienteCreateInput = Omit<
  FinCliente,
  | 'id'
  | 'organization_id'
  | 'creditos_activos_count'
  | 'saldo_total_adeudado'
  | 'created_at'
  | 'created_by'
  | 'updated_at'
>;
