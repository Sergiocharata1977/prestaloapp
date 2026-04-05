export type FinNaturalezaCuenta =
  | 'activo'
  | 'pasivo'
  | 'patrimonio_neto'
  | 'resultado_positivo'
  | 'resultado_negativo';

export interface FinRubro {
  id: string;
  organization_id: string;
  codigo: string;
  nombre: string;
  naturaleza: FinNaturalezaCuenta;
  orden: number;
}

export interface FinCuenta {
  id: string;
  organization_id: string;
  rubro_id: string;
  codigo: string;
  nombre: string;
  naturaleza: FinNaturalezaCuenta;
  imputable: boolean;
  activa: boolean;
  requiere_sucursal: boolean;
  requiere_caja: boolean;
  requiere_tercero: boolean;
}

export interface FinConfigCuentas {
  organization_id: string;
  plugin: string;
  cuentas: {
    creditos_por_financiaciones: string;
    intereses_no_devengados: string;
    ventas_financiadas: string;
    intereses_ganados: string;
    creditos_ctacte?: string;
    ventas_ctacte?: string;
    ingresos_mora_ctacte?: string;
    ingresos_gastos_adm?: string;
    caja_default?: string;
    cuenta_creditos_ctacte?: string;
    cuenta_ventas_ctacte?: string;
    cuenta_ingresos_mora?: string;
    cuenta_ingresos_gastos_adm?: string;
  };
}

export interface FinConfigCtaCte {
  organization_id: string;
  plugin: string;
  cuentas: {
    creditos_ctacte: string;
    ventas_ctacte: string;
    ingresos_mora_ctacte: string;
    ingresos_gastos_adm: string;
    caja_default: string;
  };
}
