export const CAPABILITIES = {
  TERMINAL_CONTROL:     'terminal_control',
  PROYECCION_COBRANZAS: 'proyeccion_cobranzas',
  ANALYTICS_COMERCIAL:  'analytics_comercial',
  SUCURSALES_MULTI:     'sucursales_multi',
  PRODUCTOS:            'productos',
} as const;

export type Capability = typeof CAPABILITIES[keyof typeof CAPABILITIES];

/** Capabilities que se gestionan como plugins activables por organización */
export const PLUGIN_CAPABILITIES: { value: Capability; label: string; description: string }[] = [
  {
    value: CAPABILITIES.PROYECCION_COBRANZAS,
    label: 'Proyección de cobranzas',
    description: 'Tabla de flujo de fondos esperado mes a mes según cuotas pendientes',
  },
  {
    value: CAPABILITIES.ANALYTICS_COMERCIAL,
    label: 'Indicadores comerciales',
    description: 'Ticket promedio, mix de cuotas, tendencia mensual y analítica de cartera',
  },
  {
    value: CAPABILITIES.SUCURSALES_MULTI,
    label: 'Multi-sucursal',
    description: 'Permite gestionar múltiples sucursales y seleccionarla al otorgar créditos',
  },
  {
    value: CAPABILITIES.PRODUCTOS,
    label: 'Productos y Compra Financiada',
    description: 'ABM de productos, tasas por segmento y financiación de bienes con valor de contado',
  },
];
