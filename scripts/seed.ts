/**
 * scripts/seed.ts
 * Seed script para datos demo de prestaloapp.
 * Ejecutar con:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { AmortizationService } from '../src/services/AmortizationService';
import type { FinCliente } from '../src/types/fin-cliente';
import type { FinCredito } from '../src/types/fin-credito';
import type { FinCuota } from '../src/types/fin-cuota';
import type { FinCobro } from '../src/types/fin-cobro';
import type { FinAsiento, FinAsientoLinea } from '../src/types/fin-asiento';
import type { FinCuenta } from '../src/types/fin-plan-cuentas';
import type { FinCaja } from '../src/types/fin-sucursal';

// ---------------------------------------------------------------------------
// Firebase Admin initialization — NO usa "server-only", es un script Node.js
// ---------------------------------------------------------------------------

function initAdmin(): Firestore {
  if (getApps().length > 0) {
    return getFirestore(getApps()[0]!);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && rawPrivateKey) {
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
    const app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    return getFirestore(app);
  }

  // Fallback: service-account.json en la raíz del proyecto
  const serviceAccountPath = path.resolve(__dirname, '..', 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require(serviceAccountPath) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    const app = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
    return getFirestore(app);
  }

  throw new Error(
    'No se encontraron credenciales de Firebase Admin. ' +
      'Configurar FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY ' +
      'o colocar service-account.json en la raíz del proyecto.'
  );
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ORGANIZACION_ID = 'org-demo-prestalo';
const SUCURSAL_ID = 'suc-central';
const NOW_ISO = new Date().toISOString();
const TODAY_DATE = NOW_ISO.slice(0, 10); // YYYY-MM-DD

/** Primer día del mes siguiente */
function primerDiaMesSiguiente(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based
  const nextMonth = month + 1;
  const targetYear = nextMonth > 11 ? year + 1 : year;
  const targetMonth = nextMonth > 11 ? 0 : nextMonth;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${targetYear}-${pad(targetMonth + 1)}-01`;
}

const FECHA_PRIMER_VENCIMIENTO = primerDiaMesSiguiente();

// ---------------------------------------------------------------------------
// Helpers para limpiar colecciones
// ---------------------------------------------------------------------------

async function deleteCollection(db: Firestore, collectionPath: string): Promise<number> {
  const snap = await db.collection(collectionPath).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

// ---------------------------------------------------------------------------
// Datos: Plan de cuentas
// Las cuentas van en fin_cuentas (no fin_plan_cuentas)
// ---------------------------------------------------------------------------

function buildCuentas(): FinCuenta[] {
  const base = {
    organization_id: ORGANIZACION_ID,
    rubro_id: 'rub-demo',
    imputable: true,
    activa: true,
    requiere_sucursal: false,
    requiere_caja: false,
    requiere_tercero: false,
  };
  return [
    { ...base, id: 'cta-1101', codigo: '1.1.01', nombre: 'Caja y Bancos', naturaleza: 'activo' },
    { ...base, id: 'cta-1102', codigo: '1.1.02', nombre: 'Préstamos por Cobrar', naturaleza: 'activo' },
    { ...base, id: 'cta-1103', codigo: '1.1.03', nombre: 'Intereses Devengados', naturaleza: 'activo' },
    { ...base, id: 'cta-2101', codigo: '2.1.01', nombre: 'Préstamos a Pagar', naturaleza: 'pasivo' },
    { ...base, id: 'cta-4101', codigo: '4.1.01', nombre: 'Ingresos por Intereses', naturaleza: 'resultado_positivo' },
    { ...base, id: 'cta-5101', codigo: '5.1.01', nombre: 'Gastos Financieros', naturaleza: 'resultado_negativo' },
  ];
}

// ---------------------------------------------------------------------------
// Datos: Clientes
// ---------------------------------------------------------------------------

function buildClientes(): FinCliente[] {
  const base = {
    organization_id: ORGANIZACION_ID,
    tipo: 'fisica' as const,
    creditos_activos_count: 1,
    saldo_total_adeudado: 0,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
    created_by: 'seed-script',
    localidad: 'Rosario',
    provincia: 'Santa Fe',
  };
  return [
    { ...base, id: 'cli-001', nombre: 'Carlos', apellido: 'Mendoza', cuit: '20-28765432-1' },
    { ...base, id: 'cli-002', nombre: 'María', apellido: 'González', cuit: '27-32145678-5' },
    {
      ...base,
      id: 'cli-003',
      nombre: 'Roberto',
      apellido: 'Díaz',
      cuit: '20-19876543-0',
      localidad: 'Córdoba',
      provincia: 'Córdoba',
      creditos_activos_count: 0,
    },
  ];
}

// ---------------------------------------------------------------------------
// Datos: Créditos + cuotas
// ---------------------------------------------------------------------------

interface CreditoSeed {
  credito: FinCredito;
  cuotas: FinCuota[];
}

function buildCreditoConCuotas(params: {
  id: string;
  clienteId: string;
  capital: number;
  tasaMensual: number;
  cantidadCuotas: number;
  numeroCreditoStr: string;
  articuloDescripcion: string;
  asientoOtorgamientoId: string;
}): CreditoSeed {
  const {
    id,
    clienteId,
    capital,
    tasaMensual,
    cantidadCuotas,
    numeroCreditoStr,
    articuloDescripcion,
    asientoOtorgamientoId,
  } = params;

  const tabla = AmortizationService.calcular(
    capital,
    tasaMensual,
    cantidadCuotas,
    'frances',
    FECHA_PRIMER_VENCIMIENTO
  );

  const credito: FinCredito = {
    id,
    organization_id: ORGANIZACION_ID,
    sucursal_id: SUCURSAL_ID,
    cliente_id: clienteId,
    numero_credito: numeroCreditoStr,
    articulo_descripcion: articuloDescripcion,
    capital,
    tasa_mensual: tasaMensual,
    cantidad_cuotas: cantidadCuotas,
    sistema: 'frances',
    total_intereses: tabla.total_intereses,
    total_credito: tabla.total_credito,
    valor_cuota_promedio: tabla.valor_cuota_promedio,
    fecha_otorgamiento: TODAY_DATE,
    fecha_primer_vencimiento: FECHA_PRIMER_VENCIMIENTO,
    estado: 'activo',
    cuotas_count: cantidadCuotas,
    cuotas_pagas: id === 'cre-001' ? 1 : 0,
    saldo_capital: id === 'cre-001'
      ? tabla.cuotas[1]?.saldo_capital_inicio ?? capital
      : capital,
    asiento_otorgamiento_id: asientoOtorgamientoId,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
    created_by: 'seed-script',
  };

  const cuotas: FinCuota[] = tabla.cuotas.map((c, index) => {
    const cuotaId = `${id}-c${String(c.numero_cuota).padStart(2, '0')}`;
    const esPagada = id === 'cre-001' && index === 0;
    const cuota: FinCuota = {
      id: cuotaId,
      organization_id: ORGANIZACION_ID,
      sucursal_id: SUCURSAL_ID,
      credito_id: id,
      cliente_id: clienteId,
      numero_cuota: c.numero_cuota,
      fecha_vencimiento: c.fecha_vencimiento,
      capital: c.capital,
      interes: c.interes,
      total: c.total,
      saldo_capital_inicio: c.saldo_capital_inicio,
      saldo_capital_fin: c.saldo_capital_fin,
      estado: esPagada ? 'pagada' : 'pendiente',
      created_at: NOW_ISO,
      updated_at: NOW_ISO,
    };
    if (esPagada) {
      cuota.cobro_id = 'cob-001';
      cuota.fecha_pago = TODAY_DATE;
    }
    return cuota;
  });

  return { credito, cuotas };
}

// ---------------------------------------------------------------------------
// Datos: Cobros
// ---------------------------------------------------------------------------

function buildCobros(
  cuotaFijaCre001: number,
  cuotaFijaCre002: number,
  cuotasCre001: FinCuota[],
  cuotasCre002: FinCuota[]
): FinCobro[] {
  const CAJA_ID = 'caj-001';

  function fechaDiasAtras(dias: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - dias);
    return d.toISOString().slice(0, 10);
  }

  const cuota1Cre001 = cuotasCre001[0]!;

  // cob-001: pago de cuota 1 de cre-001 (hoy)
  const cob001: FinCobro = {
    id: 'cob-001',
    organization_id: ORGANIZACION_ID,
    sucursal_id: SUCURSAL_ID,
    caja_id: CAJA_ID,
    credito_id: 'cre-001',
    cuota_id: cuota1Cre001.id,
    cliente_id: 'cli-001',
    numero_cuota: 1,
    capital_cobrado: cuota1Cre001.capital,
    interes_cobrado: cuota1Cre001.interes,
    total_cobrado: cuota1Cre001.total,
    medio_pago: 'efectivo',
    fecha_cobro: TODAY_DATE,
    usuario_id: 'seed-script',
    usuario_nombre: 'Seed Script',
    asiento_id: 'asi-cob-001',
    created_at: NOW_ISO,
  };

  // cob-002 a cob-005: cobros de los últimos 4 días (ficticios para dashboard)
  const cobrosExtra: FinCobro[] = [
    {
      id: 'cob-002',
      organization_id: ORGANIZACION_ID,
      sucursal_id: SUCURSAL_ID,
      caja_id: CAJA_ID,
      credito_id: 'cre-002',
      cuota_id: cuotasCre002[0]!.id,
      cliente_id: 'cli-002',
      numero_cuota: 1,
      capital_cobrado: cuotasCre002[0]!.capital,
      interes_cobrado: cuotasCre002[0]!.interes,
      total_cobrado: Math.round(cuotaFijaCre002 * 100) / 100,
      medio_pago: 'efectivo',
      fecha_cobro: fechaDiasAtras(1),
      usuario_id: 'seed-script',
      usuario_nombre: 'Seed Script',
      asiento_id: 'asi-cob-002',
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
    {
      id: 'cob-003',
      organization_id: ORGANIZACION_ID,
      sucursal_id: SUCURSAL_ID,
      caja_id: CAJA_ID,
      credito_id: 'cre-001',
      cuota_id: cuotasCre001[1]?.id ?? `cre-001-c02`,
      cliente_id: 'cli-001',
      numero_cuota: 2,
      capital_cobrado: cuotasCre001[1]?.capital ?? 12000,
      interes_cobrado: cuotasCre001[1]?.interes ?? 3000,
      total_cobrado: Math.round(cuotaFijaCre001 * 100) / 100,
      medio_pago: 'efectivo',
      fecha_cobro: fechaDiasAtras(2),
      usuario_id: 'seed-script',
      usuario_nombre: 'Seed Script',
      asiento_id: 'asi-cob-003',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'cob-004',
      organization_id: ORGANIZACION_ID,
      sucursal_id: SUCURSAL_ID,
      caja_id: CAJA_ID,
      credito_id: 'cre-002',
      cuota_id: cuotasCre002[1]?.id ?? `cre-002-c02`,
      cliente_id: 'cli-002',
      numero_cuota: 2,
      capital_cobrado: cuotasCre002[1]?.capital ?? 12000,
      interes_cobrado: cuotasCre002[1]?.interes ?? 2240,
      total_cobrado: Math.round(cuotaFijaCre002 * 100) / 100,
      medio_pago: 'efectivo',
      fecha_cobro: fechaDiasAtras(3),
      usuario_id: 'seed-script',
      usuario_nombre: 'Seed Script',
      asiento_id: 'asi-cob-004',
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'cob-005',
      organization_id: ORGANIZACION_ID,
      sucursal_id: SUCURSAL_ID,
      caja_id: CAJA_ID,
      credito_id: 'cre-001',
      cuota_id: cuotasCre001[2]?.id ?? `cre-001-c03`,
      cliente_id: 'cli-001',
      numero_cuota: 3,
      capital_cobrado: cuotasCre001[2]?.capital ?? 12500,
      interes_cobrado: cuotasCre001[2]?.interes ?? 2800,
      total_cobrado: Math.round(cuotaFijaCre001 * 100) / 100,
      medio_pago: 'efectivo',
      fecha_cobro: fechaDiasAtras(4),
      usuario_id: 'seed-script',
      usuario_nombre: 'Seed Script',
      asiento_id: 'asi-cob-005',
      created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
  ];

  return [cob001, ...cobrosExtra];
}

// ---------------------------------------------------------------------------
// Datos: Asientos
// ---------------------------------------------------------------------------

function buildAsientos(
  capital1: number,
  capital2: number
): FinAsiento[] {
  const periodo = TODAY_DATE.slice(0, 7); // YYYY-MM

  const lineasOtorgamiento1: FinAsientoLinea[] = [
    {
      cuenta_id: 'cta-1102',
      cuenta_codigo: '1.1.02',
      cuenta_nombre: 'Préstamos por Cobrar',
      debe: capital1,
      haber: 0,
      descripcion: 'Otorgamiento crédito',
    },
    {
      cuenta_id: 'cta-1101',
      cuenta_codigo: '1.1.01',
      cuenta_nombre: 'Caja y Bancos',
      debe: 0,
      haber: capital1,
      descripcion: 'Salida de caja',
    },
  ];

  const lineasOtorgamiento2: FinAsientoLinea[] = [
    {
      cuenta_id: 'cta-1102',
      cuenta_codigo: '1.1.02',
      cuenta_nombre: 'Préstamos por Cobrar',
      debe: capital2,
      haber: 0,
      descripcion: 'Otorgamiento crédito',
    },
    {
      cuenta_id: 'cta-1101',
      cuenta_codigo: '1.1.01',
      cuenta_nombre: 'Caja y Bancos',
      debe: 0,
      haber: capital2,
      descripcion: 'Salida de caja',
    },
  ];

  const asi001: FinAsiento = {
    id: 'asi-001',
    organization_id: ORGANIZACION_ID,
    sucursal_id: SUCURSAL_ID,
    origen: 'credito_otorgado',
    documento_id: 'cre-001',
    documento_tipo: 'credito',
    fecha: TODAY_DATE,
    periodo,
    estado: 'contabilizado',
    lineas: lineasOtorgamiento1,
    total_debe: capital1,
    total_haber: capital1,
    creado_por: {
      usuario_id: 'seed-script',
      nombre: 'Seed Script',
      timestamp: NOW_ISO,
    },
  };

  const asi002: FinAsiento = {
    id: 'asi-002',
    organization_id: ORGANIZACION_ID,
    sucursal_id: SUCURSAL_ID,
    origen: 'credito_otorgado',
    documento_id: 'cre-002',
    documento_tipo: 'credito',
    fecha: TODAY_DATE,
    periodo,
    estado: 'contabilizado',
    lineas: lineasOtorgamiento2,
    total_debe: capital2,
    total_haber: capital2,
    creado_por: {
      usuario_id: 'seed-script',
      nombre: 'Seed Script',
      timestamp: NOW_ISO,
    },
  };

  return [asi001, asi002];
}

// ---------------------------------------------------------------------------
// Datos: Caja
// FinCaja tiene: id, organization_id, sucursal_id, nombre, cuenta_contable_id,
// estado, saldo_actual, updated_at
// ---------------------------------------------------------------------------

function buildCaja(saldoCobrado: number): FinCaja {
  return {
    id: 'caj-001',
    organization_id: ORGANIZACION_ID,
    sucursal_id: SUCURSAL_ID,
    nombre: 'Caja Central',
    cuenta_contable_id: 'cta-1101',
    estado: 'abierta',
    saldo_actual: 5000 + saldoCobrado,
    updated_at: NOW_ISO,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Inicializando Firebase Admin...');
  const db = initAdmin();

  const ORG_BASE = `organizations/${ORGANIZACION_ID}`;

  // -------------------------------------------------------------------------
  // 1. LIMPIAR datos existentes
  // -------------------------------------------------------------------------
  console.log('\nLimpiando datos existentes...');

  await deleteCollection(db, `${ORG_BASE}/fin_cuentas`);
  await deleteCollection(db, `${ORG_BASE}/fin_clientes`);
  await deleteCollection(db, `${ORG_BASE}/fin_creditos`);
  await deleteCollection(db, `${ORG_BASE}/fin_cuotas`);
  await deleteCollection(db, `${ORG_BASE}/fin_cobros`);
  await deleteCollection(db, `${ORG_BASE}/fin_asientos`);
  await deleteCollection(db, `${ORG_BASE}/fin_sucursales/${SUCURSAL_ID}/fin_cajas`);

  console.log('Datos existentes eliminados.');

  // -------------------------------------------------------------------------
  // 2. INSERTAR plan de cuentas
  // -------------------------------------------------------------------------
  const cuentas = buildCuentas();
  for (const cuenta of cuentas) {
    const { id, ...data } = cuenta;
    await db.collection(`${ORG_BASE}/fin_cuentas`).doc(id).set(data);
  }
  console.log(`\u2713 6 cuentas del plan de cuentas insertadas`);

  // -------------------------------------------------------------------------
  // 3. INSERTAR clientes
  // -------------------------------------------------------------------------
  const clientes = buildClientes();
  for (const cliente of clientes) {
    const { id, ...data } = cliente;
    await db.collection(`${ORG_BASE}/fin_clientes`).doc(id).set(data);
  }
  console.log(`\u2713 3 clientes insertados`);

  // -------------------------------------------------------------------------
  // 4. INSERTAR créditos + cuotas
  // -------------------------------------------------------------------------
  const { credito: cre001, cuotas: cuotas001 } = buildCreditoConCuotas({
    id: 'cre-001',
    clienteId: 'cli-001',
    capital: 150000,
    tasaMensual: 0.035,
    cantidadCuotas: 12,
    numeroCreditoStr: '0001',
    articuloDescripcion: 'Electrodomésticos hogar',
    asientoOtorgamientoId: 'asi-001',
  });

  const { credito: cre002, cuotas: cuotas002 } = buildCreditoConCuotas({
    id: 'cre-002',
    clienteId: 'cli-002',
    capital: 80000,
    tasaMensual: 0.028,
    cantidadCuotas: 6,
    numeroCreditoStr: '0002',
    articuloDescripcion: 'Muebles para el hogar',
    asientoOtorgamientoId: 'asi-002',
  });

  // Guardar créditos
  for (const credito of [cre001, cre002]) {
    const { id, ...data } = credito;
    await db.collection(`${ORG_BASE}/fin_creditos`).doc(id).set(data);
  }
  console.log(`\u2713 2 créditos insertados`);

  // Guardar cuotas
  const todasLasCuotas = [...cuotas001, ...cuotas002];
  for (const cuota of todasLasCuotas) {
    const { id, ...data } = cuota;
    await db.collection(`${ORG_BASE}/fin_cuotas`).doc(id).set(data);
  }
  console.log(`\u2713 18 cuotas insertadas (12 + 6)`);

  // -------------------------------------------------------------------------
  // 5. INSERTAR cobros
  // -------------------------------------------------------------------------
  const cobros = buildCobros(
    cre001.valor_cuota_promedio,
    cre002.valor_cuota_promedio,
    cuotas001,
    cuotas002
  );
  for (const cobro of cobros) {
    const { id, ...data } = cobro;
    await db.collection(`${ORG_BASE}/fin_cobros`).doc(id).set(data);
  }
  console.log(`\u2713 5 cobros insertados`);

  // -------------------------------------------------------------------------
  // 6. INSERTAR asientos
  // -------------------------------------------------------------------------
  const asientos = buildAsientos(150000, 80000);
  for (const asiento of asientos) {
    const { id, ...data } = asiento;
    await db.collection(`${ORG_BASE}/fin_asientos`).doc(id).set(data);
  }
  console.log(`\u2713 2 asientos contables insertados`);

  // -------------------------------------------------------------------------
  // 7. INSERTAR caja
  // -------------------------------------------------------------------------

  // Asegurar que la sucursal existe antes de crear su subcollection
  await db.collection(`${ORG_BASE}/fin_sucursales`).doc(SUCURSAL_ID).set({
    organization_id: ORGANIZACION_ID,
    nombre: 'Sucursal Central',
    activa: true,
    created_at: NOW_ISO,
  });

  const caja = buildCaja(cobros[0]!.total_cobrado);
  const { id: cajaId, ...cajaData } = caja;
  await db
    .collection(`${ORG_BASE}/fin_sucursales/${SUCURSAL_ID}/fin_cajas`)
    .doc(cajaId)
    .set(cajaData);
  console.log(`\u2713 1 caja insertada`);

  // -------------------------------------------------------------------------
  // Resumen
  // -------------------------------------------------------------------------
  console.log('');
  console.log('Organización demo: org-demo-prestalo');
  console.log('Dashboard en: http://localhost:3000');
}

main().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
