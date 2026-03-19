import "server-only";

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { PlanCuentasService } from "@/services/PlanCuentasService";
import type { FinNaturalezaCuenta } from "@/types/fin-plan-cuentas";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Plan de cuentas mínimo para una financiera (Argentina)
// ---------------------------------------------------------------------------

type RubroSeed = {
  codigo: string;
  nombre: string;
  naturaleza: FinNaturalezaCuenta;
  orden: number;
  cuentas: {
    codigo: string;
    nombre: string;
    imputable: boolean;
    requiere_caja?: boolean;
    requiere_tercero?: boolean;
  }[];
};

const PLAN_FINANCIERA: RubroSeed[] = [
  {
    codigo: "1",
    nombre: "Activo",
    naturaleza: "activo",
    orden: 1,
    cuentas: [
      { codigo: "1.1.01", nombre: "Caja",                          imputable: true,  requiere_caja: true },
      { codigo: "1.1.02", nombre: "Bancos",                        imputable: true },
      { codigo: "1.2.01", nombre: "Creditos por Financiaciones",   imputable: true,  requiere_tercero: true },
      { codigo: "1.2.02", nombre: "Intereses No Devengados",       imputable: true,  requiere_tercero: true },
      { codigo: "1.2.03", nombre: "Deudores Morosos",              imputable: true,  requiere_tercero: true },
      { codigo: "1.2.04", nombre: "Creditos por Cheques",          imputable: true,  requiere_tercero: true },
      { codigo: "1.3.01", nombre: "Otros Creditos",                imputable: true },
      { codigo: "1.4.01", nombre: "Bienes de Uso",                 imputable: false },
    ],
  },
  {
    codigo: "2",
    nombre: "Pasivo",
    naturaleza: "pasivo",
    orden: 2,
    cuentas: [
      { codigo: "2.1.01", nombre: "Deudas Financieras",            imputable: true,  requiere_tercero: true },
      { codigo: "2.1.02", nombre: "Obligaciones a Pagar",          imputable: true,  requiere_tercero: true },
      { codigo: "2.2.01", nombre: "IVA a Pagar",                   imputable: true },
      { codigo: "2.2.02", nombre: "Retenciones Impositivas",       imputable: true },
      { codigo: "2.3.01", nombre: "Otros Pasivos",                 imputable: true },
    ],
  },
  {
    codigo: "3",
    nombre: "Patrimonio Neto",
    naturaleza: "patrimonio_neto",
    orden: 3,
    cuentas: [
      { codigo: "3.1.01", nombre: "Capital Social",                imputable: false },
      { codigo: "3.2.01", nombre: "Resultados Acumulados",         imputable: false },
      { codigo: "3.2.02", nombre: "Resultado del Ejercicio",       imputable: false },
    ],
  },
  {
    codigo: "4",
    nombre: "Ingresos",
    naturaleza: "resultado_positivo",
    orden: 4,
    cuentas: [
      { codigo: "4.1.01", nombre: "Intereses Ganados",             imputable: true,  requiere_tercero: true },
      { codigo: "4.1.02", nombre: "Cargos y Comisiones",           imputable: true },
      { codigo: "4.1.03", nombre: "Punitorios Cobrados",           imputable: true,  requiere_tercero: true },
      { codigo: "4.2.01", nombre: "Ventas Financiadas",            imputable: true,  requiere_tercero: true },
      { codigo: "4.3.01", nombre: "Otros Ingresos",                imputable: true },
    ],
  },
  {
    codigo: "5",
    nombre: "Egresos",
    naturaleza: "resultado_negativo",
    orden: 5,
    cuentas: [
      { codigo: "5.1.01", nombre: "Intereses Pagados",             imputable: true,  requiere_tercero: true },
      { codigo: "5.1.02", nombre: "Gastos Administrativos",        imputable: true },
      { codigo: "5.1.03", nombre: "Sueldos y Cargas Sociales",     imputable: true },
      { codigo: "5.1.04", nombre: "Alquileres",                    imputable: true },
      { codigo: "5.2.01", nombre: "Prevision para Incobrables",    imputable: true,  requiere_tercero: true },
      { codigo: "5.2.02", nombre: "Castigo de Incobrables",        imputable: true,  requiere_tercero: true },
      { codigo: "5.3.01", nombre: "Cargos Bancarios",              imputable: true },
      { codigo: "5.4.01", nombre: "Impuestos y Tasas",             imputable: true },
    ],
  },
];

export const POST = withAuth(
  async (_req, _ctx, { organizationId }) => {
    const orgId = organizationId!;

    // Verificar si ya tiene rubros cargados
    const existing = await PlanCuentasService.getRubros(orgId);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "El plan de cuentas ya está inicializado. Para reiniciar, eliminá los rubros existentes." },
        { status: 409 }
      );
    }

    let rubrosCreados = 0;
    let cuentasCreadas = 0;

    for (const rubro of PLAN_FINANCIERA) {
      const { cuentas, ...rubroData } = rubro;
      const rubroId = await PlanCuentasService.crearRubro(orgId, rubroData);
      rubrosCreados++;

      for (const cuenta of cuentas) {
        await PlanCuentasService.crearCuenta(orgId, {
          rubro_id: rubroId,
          codigo: cuenta.codigo,
          nombre: cuenta.nombre,
          naturaleza: rubro.naturaleza,
          imputable: cuenta.imputable,
          activa: true,
          requiere_sucursal: false,
          requiere_caja: cuenta.requiere_caja ?? false,
          requiere_tercero: cuenta.requiere_tercero ?? false,
        });
        cuentasCreadas++;
      }
    }

    return NextResponse.json(
      { ok: true, rubros: rubrosCreados, cuentas: cuentasCreadas },
      { status: 201 }
    );
  },
  { roles: ["admin", "manager"] }
);
