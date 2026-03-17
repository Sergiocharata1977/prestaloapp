export type FinCajaEstado = 'abierta' | 'cerrada'

export type FinCaja = {
  id: string
  organizacion_id: string
  sucursal_id: string
  fecha: string           // ISO date YYYY-MM-DD
  estado: FinCajaEstado
  monto_inicial: number
  monto_final?: number
  diferencia?: number
  cobros_del_dia: number
  monto_cobrado: number
  abierta_por: string     // uid
  cerrada_por?: string
  created_at: string
  closed_at?: string
}

export type FinCajaCreateInput = {
  sucursal_id: string
  monto_inicial: number
  fecha: string
}
