export const FIN_CAJAS = 'fin_cajas'
export const FIN_COBROS = 'fin_cobros'

export const FIN_COLLECTIONS = {
  orgBase: (orgId: string) => `organizations/${orgId}`,

  clientes: (orgId: string) => `organizations/${orgId}/fin_clientes`,
  cliente: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_clientes/${id}`,

  creditos: (orgId: string) => `organizations/${orgId}/fin_creditos`,
  credito: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_creditos/${id}`,

  cuotas: (orgId: string) => `organizations/${orgId}/fin_cuotas`,
  cuota: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_cuotas/${id}`,

  cobros: (orgId: string) => `organizations/${orgId}/fin_cobros`,
  cobro: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_cobros/${id}`,

  asientos: (orgId: string) => `organizations/${orgId}/fin_asientos`,
  asiento: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_asientos/${id}`,

  rubros: (orgId: string) => `organizations/${orgId}/fin_rubros`,
  cuentas: (orgId: string) => `organizations/${orgId}/fin_cuentas`,
  configCuentas: (orgId: string, plugin: string) =>
    `organizations/${orgId}/fin_config_cuentas/${plugin}`,

  sucursales: (orgId: string) => `organizations/${orgId}/fin_sucursales`,
  sucursal: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_sucursales/${id}`,
  cajas: (orgId: string, sucursalId: string) =>
    `organizations/${orgId}/fin_sucursales/${sucursalId}/fin_cajas`,
  caja: (orgId: string, sucursalId: string, cajaId: string) =>
    `organizations/${orgId}/fin_sucursales/${sucursalId}/fin_cajas/${cajaId}`,
} as const;
