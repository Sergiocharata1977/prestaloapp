export const FIN_CAJAS = 'fin_cajas'
export const FIN_COBROS = 'fin_cobros'
export const FIN_LEDGER = 'fin_ledger_entries'

export const FIN_COLLECTIONS = {
  orgBase: (orgId: string) => `organizations/${orgId}`,

  clientes: (orgId: string) => `organizations/${orgId}/fin_clientes`,
  cliente: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_clientes/${id}`,

  tiposCliente: (orgId: string) => `organizations/${orgId}/fin_tipos_cliente`,
  tipoCliente: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_tipos_cliente/${id}`,

  politicasCrediticias: (orgId: string) =>
    `organizations/${orgId}/fin_politicas_crediticias`,
  politicaCrediticia: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_politicas_crediticias/${id}`,

  planesFinanciacion: (orgId: string) =>
    `organizations/${orgId}/fin_planes_financiacion`,
  planFinanciacion: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_planes_financiacion/${id}`,

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

  ledgerEntries: (orgId: string) => `organizations/${orgId}/fin_ledger_entries`,
  ledgerEntry: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_ledger_entries/${id}`,

  sucursales: (orgId: string) => `organizations/${orgId}/fin_sucursales`,
  sucursal: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_sucursales/${id}`,
  cajas: (orgId: string, sucursalId: string) =>
    `organizations/${orgId}/fin_sucursales/${sucursalId}/fin_cajas`,
  caja: (orgId: string, sucursalId: string, cajaId: string) =>
    `organizations/${orgId}/fin_sucursales/${sucursalId}/fin_cajas/${cajaId}`,

  evaluaciones: (orgId: string) => `organizations/${orgId}/fin_evaluaciones`,
  evaluacion: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_evaluaciones/${id}`,

  scoringConfig: (orgId: string) =>
    `organizations/${orgId}/fin_configuracion/scoring`,
  clienteNosisConsultas: (orgId: string, clienteId: string) =>
    `organizations/${orgId}/fin_clientes/${clienteId}/fin_consultas_nosis`,
} as const;
