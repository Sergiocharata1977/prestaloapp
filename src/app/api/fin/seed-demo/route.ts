import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now() {
  return Timestamp.now();
}

function isoDate(daysFromNow = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

function isoDateFrom(base: string, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

// Amortización francesa: genera tabla de cuotas
function calcularCuotasFrancesas(
  capital: number,
  tasaMensual: number,
  cantidadCuotas: number,
  fechaPrimerVencimiento: string,
  creditoId: string,
  clienteId: string,
  orgId: string,
  sucursalId: string,
): CuotaSeed[] {
  const i = tasaMensual / 100;
  const cuotaFija = capital * i / (1 - Math.pow(1 + i, -cantidadCuotas));
  const cuotas: CuotaSeed[] = [];
  let saldo = capital;

  for (let n = 1; n <= cantidadCuotas; n++) {
    const interes = Math.round(saldo * i * 100) / 100;
    const cap = Math.round((cuotaFija - interes) * 100) / 100;
    const saldoFin = Math.round((saldo - cap) * 100) / 100;
    const fechaVenc = isoDateFrom(fechaPrimerVencimiento, n - 1);

    cuotas.push({
      organization_id: orgId,
      sucursal_id: sucursalId,
      credito_id: creditoId,
      cliente_id: clienteId,
      numero_cuota: n,
      fecha_vencimiento: fechaVenc,
      capital: cap,
      interes,
      total: Math.round(cuotaFija * 100) / 100,
      saldo_capital_inicio: Math.round(saldo * 100) / 100,
      saldo_capital_fin: Math.max(0, saldoFin),
      estado: new Date(fechaVenc) < new Date() ? "vencida" : "pendiente",
      created_at: now(),
      updated_at: now(),
    });

    saldo = Math.max(0, saldoFin);
  }
  return cuotas;
}

type CuotaSeed = {
  organization_id: string;
  sucursal_id: string;
  credito_id: string;
  cliente_id: string;
  numero_cuota: number;
  fecha_vencimiento: string;
  capital: number;
  interes: number;
  total: number;
  saldo_capital_inicio: number;
  saldo_capital_fin: number;
  estado: "pendiente" | "vencida";
  created_at: Timestamp;
  updated_at: Timestamp;
};

// ---------------------------------------------------------------------------
// Datos demo
// ---------------------------------------------------------------------------

const CLIENTES_DEMO = [
  { nombre: "Carlos",   apellido: "Rodríguez",  cuit: "20-12345678-3", dni: "12345678", tel: "3813-456789", email: "carlos.r@email.com",   domicilio: "San Martín 456",     localidad: "San Miguel de Tucumán" },
  { nombre: "María",    apellido: "González",   cuit: "27-23456789-4", dni: "23456789", tel: "3814-567890", email: "maria.g@email.com",    domicilio: "Belgrano 123",        localidad: "San Miguel de Tucumán" },
  { nombre: "Roberto",  apellido: "Fernández",  cuit: "20-34567890-2", dni: "34567890", tel: "3815-678901", email: "roberto.f@email.com",  domicilio: "Lavalle 789",         localidad: "Yerba Buena" },
  { nombre: "Laura",    apellido: "Martínez",   cuit: "27-45678901-5", dni: "45678901", tel: "3816-789012", email: "laura.m@email.com",    domicilio: "Avenida Alem 234",    localidad: "Concepción" },
  { nombre: "Diego",    apellido: "López",      cuit: "20-56789012-9", dni: "56789012", tel: "3817-890123", email: "diego.l@email.com",    domicilio: "Rivadavia 567",       localidad: "Famaillá" },
  { nombre: "Ana",      apellido: "Sánchez",    cuit: "27-67890123-6", dni: "67890123", tel: "3818-901234", email: "ana.s@email.com",      domicilio: "Independencia 890",   localidad: "Monteros" },
  { nombre: "Marcelo",  apellido: "Pérez",      cuit: "20-78901234-7", dni: "78901234", tel: "3819-012345", email: "marcelo.p@email.com",  domicilio: "Tucumán 321",         localidad: "Aguilares" },
  { nombre: "Verónica", apellido: "Torres",     cuit: "27-89012345-8", dni: "89012345", tel: "3810-123456", email: "veronica.t@email.com", domicilio: "Urquiza 654",         localidad: "Banda del Río Salí" },
];

const CREDITOS_DEMO = [
  { capital: 150000,  cuotas: 12, tasa: 4.5, articulo: "Electrodomésticos — Heladera Electrolux",  diasDesde: -90  },
  { capital: 80000,   cuotas: 6,  tasa: 4.5, articulo: "Electrónica — Smart TV 50\"",              diasDesde: -60  },
  { capital: 300000,  cuotas: 24, tasa: 4.5, articulo: "Moto — Zanella 150cc",                     diasDesde: -120 },
  { capital: 50000,   cuotas: 3,  tasa: 4.0, articulo: "Ropa y calzado — Lote comerciante",        diasDesde: -30  },
  { capital: 200000,  cuotas: 18, tasa: 4.5, articulo: "Computadora — Notebook HP",                diasDesde: -45  },
  { capital: 120000,  cuotas: 12, tasa: 4.5, articulo: "Electrodomésticos — Lavarropas Samsung",   diasDesde: -75  },
  { capital: 400000,  cuotas: 24, tasa: 5.0, articulo: "Auto usado — Fiat Palio 2018",             diasDesde: -10  },
  { capital: 60000,   cuotas: 6,  tasa: 4.0, articulo: "Herramientas — Juego completo taller",     diasDesde: -50  },
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const POST = withAuth(
  async (_req, _ctx, { organizationId, user }) => {
    const orgId = organizationId!;
    const db = getAdminFirestore();

    // Guard: verificar si ya hay clientes
    const existing = await db.collection(FIN_COLLECTIONS.clientes(orgId)).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json(
        { error: "Ya existen datos en esta organización. El seed solo corre en organizaciones vacías." },
        { status: 409 }
      );
    }

    // 1. Tipo de cliente
    const tipoRef = await db.collection(FIN_COLLECTIONS.tiposCliente(orgId)).add({
      organization_id: orgId,
      codigo: "PF-EST",
      nombre: "Persona Física Estándar",
      descripcion: "Cliente persona física, segmento general",
      tipo_base: "persona",
      activo: true,
      requiere_legajo: false,
      requiere_evaluacion_vigente: false,
      permite_cheques_propios: true,
      permite_cheques_terceros: true,
      created_at: now(),
      updated_at: now(),
    });

    // 2. Política crediticia
    const politicaRef = await db.collection(FIN_COLLECTIONS.politicasCrediticias(orgId)).add({
      organization_id: orgId,
      codigo: "POL-CONS",
      nombre: "Consumo Estándar",
      tipo_operacion: "consumo",
      activa: true,
      requiere_legajo: false,
      requiere_evaluacion_vigente: false,
      limite_mensual: 500000,
      limite_total: 2000000,
      created_at: now(),
      updated_at: now(),
    });

    // 3. Plan de financiación
    const planRef = await db.collection(FIN_COLLECTIONS.planesFinanciacion(orgId)).add({
      organization_id: orgId,
      nombre: "Plan Cuotas Fijas",
      descripcion: "Sistema francés — 3 a 24 cuotas",
      activo: true,
      sistema: "frances",
      tasa_punitoria_mensual: 6.0,
      tramos_tasa: [
        { cantidad_cuotas: 3,  tasa_mensual: 4.0 },
        { cantidad_cuotas: 6,  tasa_mensual: 4.0 },
        { cantidad_cuotas: 12, tasa_mensual: 4.5 },
        { cantidad_cuotas: 18, tasa_mensual: 4.5 },
        { cantidad_cuotas: 24, tasa_mensual: 5.0 },
      ],
      created_at: now(),
      updated_at: now(),
    });

    // 4. Sucursal + caja
    const sucursalRef = await db.collection(FIN_COLLECTIONS.sucursales(orgId)).add({
      organization_id: orgId,
      nombre: "Casa Central",
      codigo: "CC",
      activa: true,
      created_at: now(),
      updated_at: now(),
    });
    const sucursalId = sucursalRef.id;

    await db.collection(FIN_COLLECTIONS.cajas(orgId, sucursalId)).add({
      organization_id: orgId,
      sucursal_id: sucursalId,
      nombre: "Caja 1",
      codigo: "C01",
      activa: true,
      saldo_actual: 0,
      created_at: now(),
      updated_at: now(),
    });

    // Snapshots para créditos
    const politicaSnap = {
      id: politicaRef.id,
      codigo: "POL-CONS",
      nombre: "Consumo Estándar",
      tipo_operacion: "consumo",
      requiere_legajo: false,
      requiere_evaluacion_vigente: false,
      limite_mensual: 500000,
      limite_total: 2000000,
    };

    const planSnap = {
      id: planRef.id,
      nombre: "Plan Cuotas Fijas",
      tramos_tasa: [
        { cantidad_cuotas: 3,  tasa_mensual: 4.0 },
        { cantidad_cuotas: 6,  tasa_mensual: 4.0 },
        { cantidad_cuotas: 12, tasa_mensual: 4.5 },
        { cantidad_cuotas: 18, tasa_mensual: 4.5 },
        { cantidad_cuotas: 24, tasa_mensual: 5.0 },
      ],
      tasa_punitoria_mensual: 6.0,
    };

    const tipoSnap = {
      id: tipoRef.id,
      codigo: "PF-EST",
      nombre: "Persona Física Estándar",
      tipo_base: "persona",
    };

    // 5. Clientes + créditos + cuotas
    let creditoNum = 1000;
    const createdBy = user?.uid ?? "seed";

    for (let idx = 0; idx < CLIENTES_DEMO.length; idx++) {
      const c = CLIENTES_DEMO[idx];
      const demo = CREDITOS_DEMO[idx];

      const clienteRef = await db.collection(FIN_COLLECTIONS.clientes(orgId)).add({
        organization_id: orgId,
        tipo: "fisica",
        nombre: c.nombre,
        apellido: c.apellido,
        cuit: c.cuit,
        dni: c.dni,
        telefono: c.tel,
        email: c.email,
        domicilio: c.domicilio,
        localidad: c.localidad,
        provincia: "Tucumán",
        tipo_cliente_id: tipoRef.id,
        tipo_cliente_nombre: "Persona Física Estándar",
        creditos_activos_count: 1,
        saldo_total_adeudado: demo.capital * 0.7, // aproximado
        created_at: now(),
        created_by: createdBy,
        updated_at: now(),
      });
      const clienteId = clienteRef.id;

      const fechaOtorg = isoDate(demo.diasDesde);
      const fechaPrimerVenc = isoDateFrom(fechaOtorg, 1);

      const i = demo.tasa / 100;
      const cuotaFija = demo.capital * i / (1 - Math.pow(1 + i, -demo.cuotas));
      const totalIntereses = Math.round((cuotaFija * demo.cuotas - demo.capital) * 100) / 100;
      const totalCredito = Math.round(cuotaFija * demo.cuotas * 100) / 100;

      creditoNum++;
      const numeroCred = `CRED-${creditoNum}`;

      const creditoRef = await db.collection(FIN_COLLECTIONS.creditos(orgId)).add({
        organization_id: orgId,
        sucursal_id: sucursalId,
        cliente_id: clienteId,
        tipo_cliente_id: tipoRef.id,
        numero_credito: numeroCred,
        articulo_descripcion: demo.articulo,
        tipo_operacion: "consumo",
        politica_crediticia_id: politicaRef.id,
        plan_financiacion_id: planRef.id,
        tipo_cliente_snapshot: tipoSnap,
        politica_snapshot: politicaSnap,
        plan_snapshot: planSnap,
        capital: demo.capital,
        tasa_mensual: demo.tasa,
        snapshot_tasa_mensual: demo.tasa,
        snapshot_tasa_punitoria_mensual: 6.0,
        cantidad_cuotas: demo.cuotas,
        sistema: "frances",
        total_intereses: totalIntereses,
        total_credito: totalCredito,
        valor_cuota_promedio: Math.round(cuotaFija * 100) / 100,
        fecha_otorgamiento: fechaOtorg,
        fecha_primer_vencimiento: fechaPrimerVenc,
        estado: "activo",
        cuotas_count: demo.cuotas,
        cuotas_pagas: 0,
        saldo_capital: demo.capital,
        asiento_otorgamiento_id: "",
        created_at: now(),
        created_by: createdBy,
        updated_at: now(),
      });

      // Cuotas
      const cuotas = calcularCuotasFrancesas(
        demo.capital,
        demo.tasa,
        demo.cuotas,
        fechaPrimerVenc,
        creditoRef.id,
        clienteId,
        orgId,
        sucursalId,
      );
      for (const cuota of cuotas) {
        await db.collection(FIN_COLLECTIONS.cuotas(orgId)).add(cuota);
      }
    }

    return NextResponse.json({
      ok: true,
      clientes: CLIENTES_DEMO.length,
      creditos: CREDITOS_DEMO.length,
      tipoCliente: tipoRef.id,
      politica: politicaRef.id,
      plan: planRef.id,
    }, { status: 201 });
  },
  { roles: ["admin", "manager"] }
);
