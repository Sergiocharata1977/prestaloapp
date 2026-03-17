export type LedgerEntryType =
  | 'otorgamiento'
  | 'cobro_cuota'
  | 'ajuste_manual'
  | 'mora'
  | 'refinanciacion'

export type FinLedgerEntry = {
  id: string
  organizacion_id: string
  cliente_id: string
  fecha: string
  tipo: LedgerEntryType
  descripcion: string
  credito_id?: string
  cobro_id?: string
  cuota_numero?: number
  debe: number
  haber: number
  saldo_acumulado: number
  created_at: string
}
