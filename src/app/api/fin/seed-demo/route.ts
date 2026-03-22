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

function isoDateFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function isoDateFrom(base: string, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
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
    const vencida = new Date(fechaVenc) < new Date();

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
      estado: vencida ? "vencida" : "pendiente",
      created_at: now(),
      updated_at: now(),
    });

    saldo = Math.max(0, saldoFin);
  }
  return cuotas;
}

// ---------------------------------------------------------------------------
// Datos maestros
// ---------------------------------------------------------------------------

const TIPOS_CLIENTE = [
  {
    codigo: "PF-EST",
    nombre: "Persona Física",
    descripcion: "Consumidor final persona física",
    tipo_base: "persona",
  },
  {
    codigo: "EMP-PYM",
    nombre: "Empresa PyME",
    descripcion: "Empresa pequeña o mediana",
    tipo_base: "empresa",
  },
  {
    codigo: "COM-MIN",
    nombre: "Comerciante",
    descripcion: "Comerciante o revendedor minorista",
    tipo_base: "persona",
  },
];

const SUCURSALES = [
  { nombre: "Casa Central", codigo: "CC" },
  { nombre: "Sucursal Norte", codigo: "SN" },
];

// ---------------------------------------------------------------------------
// Clientes demo
// ---------------------------------------------------------------------------

interface ClienteDemo {
  nombre: string;
  apellido?: string;
  cuit: string;
  dni?: string;
  telefono: string;
  email: string;
  domicilio: string;
  localidad: string;
  tipo: "fisica" | "juridica";
  tipoIdx: number;         // índice en TIPOS_CLIENTE
  clasificacion: string;
}

const CLIENTES_DEMO: ClienteDemo[] = [
  // Persona Física (tipoIdx=0) — 4 clientes
  { nombre: "Carlos",   apellido: "Rodríguez",  cuit: "20-12345678-3", dni: "12345678", telefono: "3813-456789", email: "carlos.r@demo.com",   domicilio: "San Martín 456",   localidad: "S.M. de Tucumán", tipo: "fisica", tipoIdx: 0, clasificacion: "A" },
  { nombre: "María",    apellido: "González",   cuit: "27-23456789-4", dni: "23456789", telefono: "3814-567890", email: "maria.g@demo.com",    domicilio: "Belgrano 123",     localidad: "S.M. de Tucumán", tipo: "fisica", tipoIdx: 0, clasificacion: "A" },
  { nombre: "Roberto",  apellido: "Fernández",  cuit: "20-34567890-2", dni: "34567890", telefono: "3815-678901", email: "roberto.f@demo.com",  domicilio: "Lavalle 789",      localidad: "Yerba Buena",     tipo: "fisica", tipoIdx: 0, clasificacion: "B" },
  { nombre: "Laura",    apellido: "Martínez",   cuit: "27-45678901-5", dni: "45678901", telefono: "3816-789012", email: "laura.m@demo.com",    domicilio: "Av. Alem 234",     localidad: "Concepción",      tipo: "fisica", tipoIdx: 0, clasificacion: "B" },
  // Empresa PyME (tipoIdx=1) — 4 clientes
  { nombre: "Distribuidora Del Norte SA", cuit: "30-55667788-9", telefono: "3813-111222", email: "admin@delnorte.com",    domicilio: "Ruta 9 km 1204", localidad: "S.M. de Tucumán", tipo: "juridica", tipoIdx: 1, clasificacion: "A" },
  { nombre: "Metalúrgica Tucumán SRL",    cuit: "30-66778899-0", telefono: "3813-222333", email: "info@metalurgica.com",  domicilio: "Parque Industrial", localidad: "S.M. de Tucumán", tipo: "juridica", tipoIdx: 1, clasificacion: "A" },
  { nombre: "Servicios Integrales SRL",   cuit: "30-77889900-1", telefono: "3814-333444", email: "contacto@servicios.com",domicilio: "Av. Circunvalación 500", localidad: "Yerba Buena", tipo: "juridica", tipoIdx: 1, clasificacion: "B" },
  { nombre: "Constructora Celman SA",     cuit: "30-88990011-2", telefono: "3815-444555", email: "obra@celman.com",       domicilio: "Alberdi 900",    localidad: "Concepción",      tipo: "juridica", tipoIdx: 1, clasificacion: "B" },
  // Comerciante (tipoIdx=2) — 4 clientes
  { nombre: "Diego",    apellido: "López",      cuit: "20-56789012-9", dni: "56789012", telefono: "3817-890123", email: "diego.l@demo.com",    domicilio: "Rivadavia 567",    localidad: "Famaillá",        tipo: "fisica", tipoIdx: 2, clasificacion: "A" },
  { nombre: "Ana",      apellido: "Sánchez",    cuit: "27-67890123-6", dni: "67890123", telefono: "3818-901234", email: "ana.s@demo.com",      domicilio: "Independencia 890",localidad: "Monteros",        tipo: "fisica", tipoIdx: 2, clasificacion: "A" },
  { nombre: "Marcelo",  apellido: "Pérez",      cuit: "20-78901234-7", dni: "78901234", telefono: "3819-012345", email: "marcelo.p@demo.com",  domicilio: "Tucumán 321",      localidad: "Aguilares",       tipo: "fisica", tipoIdx: 2, clasificacion: "B" },
  { nombre: "Verónica", apellido: "Torres",     cuit: "27-89012345-8", dni: "89012345", telefono: "3810-123456", email: "veronica.t@demo.com", domicilio: "Urquiza 654",      localidad: "Monteros",        tipo: "fisica", tipoIdx: 2, clasificacion: "B" },
];

// ---------------------------------------------------------------------------
// Créditos demo — spread últimos 12 meses para indicadores + proyecciones
// ---------------------------------------------------------------------------

interface CreditoDemo {
  clienteIdx: number;
  capital: number;
  cuotas: number;
  tasa: number;
  diasOtorgamiento: number;  // negativo = en el pasado
  planIdx: number;           // 0 = personal, 1 = empresarial
  sucursalIdx: number;
  articulo: string;
  estado?: "activo" | "en_mora";
}

const CREDITOS_DEMO: CreditoDemo[] = [
  // ── Hace ~12 meses ────────────────────────────────────────────────────────
  { clienteIdx: 0, capital: 180000,  cuotas: 24, tasa: 4.5, diasOtorgamiento: -365, planIdx: 0, sucursalIdx: 0, articulo: "Moto — Honda Wave 110cc" },
  { clienteIdx: 4, capital: 500000,  cuotas: 24, tasa: 4.0, diasOtorgamiento: -358, planIdx: 1, sucursalIdx: 0, articulo: "Equipamiento — PC + servidor para oficina" },

  // ── Hace ~10 meses ────────────────────────────────────────────────────────
  { clienteIdx: 1, capital: 90000,   cuotas: 12, tasa: 4.5, diasOtorgamiento: -305, planIdx: 0, sucursalIdx: 1, articulo: "Electrónica — Smart TV 55\"" },
  { clienteIdx: 5, capital: 380000,  cuotas: 18, tasa: 4.0, diasOtorgamiento: -298, planIdx: 1, sucursalIdx: 0, articulo: "Maquinaria — Torno semi-industrial" },

  // ── Hace ~8 meses ─────────────────────────────────────────────────────────
  { clienteIdx: 2, capital: 130000,  cuotas: 12, tasa: 4.5, diasOtorgamiento: -245, planIdx: 0, sucursalIdx: 0, articulo: "Electrodomésticos — Heladera no frost" },
  { clienteIdx: 8, capital: 200000,  cuotas: 18, tasa: 4.5, diasOtorgamiento: -238, planIdx: 0, sucursalIdx: 1, articulo: "Stock — Ropa mayorista lote temporada" },
  { clienteIdx: 6, capital: 650000,  cuotas: 24, tasa: 4.0, diasOtorgamiento: -240, planIdx: 1, sucursalIdx: 0, articulo: "Vehículo — Furgón de reparto Ford Transit" },

  // ── Hace ~6 meses ─────────────────────────────────────────────────────────
  { clienteIdx: 3, capital: 260000,  cuotas: 18, tasa: 4.5, diasOtorgamiento: -182, planIdx: 0, sucursalIdx: 0, articulo: "Auto usado — Fiat Uno 2016" },
  { clienteIdx: 7, capital: 750000,  cuotas: 24, tasa: 4.0, diasOtorgamiento: -176, planIdx: 1, sucursalIdx: 1, articulo: "Maquinaria — Compresor industrial 50 HP" },
  { clienteIdx: 9, capital: 95000,   cuotas:  6, tasa: 4.5, diasOtorgamiento: -178, planIdx: 0, sucursalIdx: 1, articulo: "Stock — Calzado mayorista temporada", estado: "en_mora" },

  // ── Hace ~4 meses ─────────────────────────────────────────────────────────
  { clienteIdx: 0, capital: 160000,  cuotas: 12, tasa: 4.5, diasOtorgamiento: -122, planIdx: 0, sucursalIdx: 0, articulo: "Computadora — Notebook Dell Inspiron" },
  { clienteIdx: 4, capital: 420000,  cuotas: 24, tasa: 4.0, diasOtorgamiento: -118, planIdx: 1, sucursalIdx: 0, articulo: "Vehículo — Camioneta Renault Master" },
  { clienteIdx: 10, capital: 70000,  cuotas:  6, tasa: 4.5, diasOtorgamiento: -115, planIdx: 0, sucursalIdx: 1, articulo: "Herramientas — Kit completo taller" },

  // ── Hace ~2 meses ─────────────────────────────────────────────────────────
  { clienteIdx: 1, capital: 320000,  cuotas: 18, tasa: 4.5, diasOtorgamiento: -62,  planIdx: 0, sucursalIdx: 0, articulo: "Moto — Zanella ZB 150cc" },
  { clienteIdx: 5, capital: 800000,  cuotas: 24, tasa: 4.0, diasOtorgamiento: -58,  planIdx: 1, sucursalIdx: 0, articulo: "Equipamiento gastronómico — Línea industrial" },
  { clienteIdx: 11, capital: 140000, cuotas: 12, tasa: 4.5, diasOtorgamiento: -55,  planIdx: 0, sucursalIdx: 1, articulo: "Stock — Productos ferretería mayorista" },

  // ── Hace ~1 mes ───────────────────────────────────────────────────────────
  { clienteIdx: 2, capital: 210000,  cuotas: 12, tasa: 4.5, diasOtorgamiento: -28,  planIdx: 0, sucursalIdx: 0, articulo: "Electrodomésticos — Aire acondicionado 4500 F" },
  { clienteIdx: 6, capital: 480000,  cuotas: 18, tasa: 4.0, diasOtorgamiento: -22,  planIdx: 1, sucursalIdx: 1, articulo: "Hardware — Servidor NAS + UPS industrial" },
  { clienteIdx: 9, capital: 85000,   cuotas:  6, tasa: 4.5, diasOtorgamiento: -15,  planIdx: 0, sucursalIdx: 1, articulo: "Stock — Indumentaria mayorista lote 2" },
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const POST = withAuth(
  async (req, _ctx, { organizationId, user }) => {
    const orgId = organizationId!;
    const db = getAdminFirestore();
    const url = new URL(req.url);
    const reset = url.searchParams.get("reset") === "true";

    // Guard: si no viene reset y ya hay datos, rechazar
    if (!reset) {
      const existing = await db.collection(FIN_COLLECTIONS.clientes(orgId)).limit(1).get();
      if (!existing.empty) {
        return NextResponse.json(
          { error: "Ya existen datos. Usá ?reset=true para borrar y re-sembrar." },
          { status: 409 }
        );
      }
    }

    // Si reset=true: borrar colecciones principales
    if (reset) {
      const colsToDelete = [
        FIN_COLLECTIONS.cuotas(orgId),
        FIN_COLLECTIONS.creditos(orgId),
        FIN_COLLECTIONS.clientes(orgId),
        FIN_COLLECTIONS.planesFinanciacion(orgId),
        FIN_COLLECTIONS.politicasCrediticias(orgId),
        FIN_COLLECTIONS.tiposCliente(orgId),
        FIN_COLLECTIONS.sucursales(orgId),
      ];
      for (const col of colsToDelete) {
        const snap = await db.collection(col).get();
        const batch = db.batch();
        for (const doc of snap.docs) batch.delete(doc.ref);
        if (!snap.empty) await batch.commit();
      }
    }

    const createdBy = user?.uid ?? "seed";

    // ── 1. Tipos de cliente ──────────────────────────────────────────────────
    const tipoRefs = await Promise.all(
      TIPOS_CLIENTE.map((t) =>
        db.collection(FIN_COLLECTIONS.tiposCliente(orgId)).add({
          organization_id: orgId,
          codigo: t.codigo,
          nombre: t.nombre,
          descripcion: t.descripcion,
          tipo_base: t.tipo_base,
          activo: true,
          requiere_legajo: false,
          requiere_evaluacion_vigente: false,
          permite_cheques_propios: true,
          permite_cheques_terceros: true,
          created_at: now(),
          updated_at: now(),
        })
      )
    );

    // ── 2. Políticas ─────────────────────────────────────────────────────────
    const politicaRefs = await Promise.all([
      db.collection(FIN_COLLECTIONS.politicasCrediticias(orgId)).add({
        organization_id: orgId,
        codigo: "POL-CONS",
        nombre: "Consumo / Personas",
        tipo_operacion: "consumo",
        activa: true,
        requiere_legajo: false,
        requiere_evaluacion_vigente: false,
        limite_mensual: 500000,
        limite_total: 2000000,
        created_at: now(),
        updated_at: now(),
      }),
      db.collection(FIN_COLLECTIONS.politicasCrediticias(orgId)).add({
        organization_id: orgId,
        codigo: "POL-EMP",
        nombre: "PyME / Empresas",
        tipo_operacion: "empresa",
        activa: true,
        requiere_legajo: false,
        requiere_evaluacion_vigente: false,
        limite_mensual: 2000000,
        limite_total: 10000000,
        created_at: now(),
        updated_at: now(),
      }),
    ]);

    // ── 3. Planes de financiación ────────────────────────────────────────────
    const planData = [
      {
        nombre: "Plan Personal",
        tasa_punitoria_mensual: 6.0,
        tramos_tasa: [
          { cantidad_cuotas: 3,  tasa_mensual: 4.0 },
          { cantidad_cuotas: 6,  tasa_mensual: 4.5 },
          { cantidad_cuotas: 12, tasa_mensual: 4.5 },
          { cantidad_cuotas: 18, tasa_mensual: 4.5 },
          { cantidad_cuotas: 24, tasa_mensual: 5.0 },
        ],
      },
      {
        nombre: "Plan Empresarial",
        tasa_punitoria_mensual: 5.0,
        tramos_tasa: [
          { cantidad_cuotas: 6,  tasa_mensual: 3.5 },
          { cantidad_cuotas: 12, tasa_mensual: 4.0 },
          { cantidad_cuotas: 18, tasa_mensual: 4.0 },
          { cantidad_cuotas: 24, tasa_mensual: 4.5 },
        ],
      },
    ];

    const planRefs = await Promise.all(
      planData.map((p, idx) =>
        db.collection(FIN_COLLECTIONS.planesFinanciacion(orgId)).add({
          organization_id: orgId,
          nombre: p.nombre,
          activo: true,
          sistema: "frances",
          tasa_punitoria_mensual: p.tasa_punitoria_mensual,
          tramos_tasa: p.tramos_tasa,
          politica_id: politicaRefs[idx].id,
          created_at: now(),
          updated_at: now(),
        })
      )
    );

    // ── 4. Sucursales + cajas ────────────────────────────────────────────────
    const sucursalIds: string[] = [];
    for (const s of SUCURSALES) {
      const sRef = await db.collection(FIN_COLLECTIONS.sucursales(orgId)).add({
        organization_id: orgId,
        nombre: s.nombre,
        codigo: s.codigo,
        activa: true,
        created_at: now(),
        updated_at: now(),
      });
      sucursalIds.push(sRef.id);
      await db.collection(FIN_COLLECTIONS.cajas(orgId, sRef.id)).add({
        organization_id: orgId,
        sucursal_id: sRef.id,
        nombre: "Caja 1",
        codigo: "C01",
        activa: true,
        saldo_actual: 0,
        created_at: now(),
        updated_at: now(),
      });
    }

    // ── Snapshots reutilizables ──────────────────────────────────────────────
    const tipoSnaps = TIPOS_CLIENTE.map((t, i) => ({
      id: tipoRefs[i].id,
      codigo: t.codigo,
      nombre: t.nombre,
      tipo_base: t.tipo_base,
    }));

    const politicaSnaps = [
      { id: politicaRefs[0].id, codigo: "POL-CONS", nombre: "Consumo / Personas",  tipo_operacion: "consumo",  requiere_legajo: false, requiere_evaluacion_vigente: false, limite_mensual: 500000,  limite_total: 2000000  },
      { id: politicaRefs[1].id, codigo: "POL-EMP",  nombre: "PyME / Empresas",     tipo_operacion: "empresa",  requiere_legajo: false, requiere_evaluacion_vigente: false, limite_mensual: 2000000, limite_total: 10000000 },
    ];

    const planSnaps = planData.map((p, i) => ({
      id: planRefs[i].id,
      nombre: p.nombre,
      tramos_tasa: p.tramos_tasa,
      tasa_punitoria_mensual: p.tasa_punitoria_mensual,
    }));

    // ── 5. Clientes ──────────────────────────────────────────────────────────
    const clienteIds: string[] = [];
    for (const c of CLIENTES_DEMO) {
      const tipo = TIPOS_CLIENTE[c.tipoIdx];
      const ref = await db.collection(FIN_COLLECTIONS.clientes(orgId)).add({
        organization_id: orgId,
        tipo: c.tipo,
        nombre: c.nombre,
        ...(c.apellido ? { apellido: c.apellido } : {}),
        cuit: c.cuit,
        ...(c.dni ? { dni: c.dni } : {}),
        telefono: c.telefono,
        email: c.email,
        domicilio: c.domicilio,
        localidad: c.localidad,
        provincia: "Tucumán",
        tipo_cliente_id: tipoRefs[c.tipoIdx].id,
        tipo_cliente_nombre: tipo.nombre,
        clasificacion_interna: c.clasificacion,
        creditos_activos_count: 0,
        saldo_total_adeudado: 0,
        created_at: now(),
        created_by: createdBy,
        updated_at: now(),
      });
      clienteIds.push(ref.id);
    }

    // ── 6. Créditos + cuotas ─────────────────────────────────────────────────
    let creditoNum = 1000;
    let totalCuotas = 0;

    for (const demo of CREDITOS_DEMO) {
      const clienteId = clienteIds[demo.clienteIdx];
      const cliente = CLIENTES_DEMO[demo.clienteIdx];
      const tipoIdx = cliente.tipoIdx;
      const sucursalId = sucursalIds[demo.sucursalIdx];
      const politicaIdx = demo.planIdx; // política alineada con plan
      const estadoCredito = demo.estado ?? "activo";

      const fechaOtorg = isoDateFromNow(demo.diasOtorgamiento);
      const fechaPrimerVenc = isoDateFrom(fechaOtorg, 1);

      const i = demo.tasa / 100;
      const cuotaFija = demo.capital * i / (1 - Math.pow(1 + i, -demo.cuotas));
      const totalIntereses = Math.round((cuotaFija * demo.cuotas - demo.capital) * 100) / 100;
      const totalCredito = Math.round(cuotaFija * demo.cuotas * 100) / 100;

      creditoNum++;

      const creditoRef = await db.collection(FIN_COLLECTIONS.creditos(orgId)).add({
        organization_id: orgId,
        sucursal_id: sucursalId,
        cliente_id: clienteId,
        tipo_cliente_id: tipoRefs[tipoIdx].id,
        numero_credito: `CRED-${creditoNum}`,
        articulo_descripcion: demo.articulo,
        tipo_operacion: demo.planIdx === 0 ? "consumo" : "empresa",
        politica_crediticia_id: politicaRefs[politicaIdx].id,
        plan_financiacion_id: planRefs[demo.planIdx].id,
        tipo_cliente_snapshot: tipoSnaps[tipoIdx],
        politica_snapshot: politicaSnaps[politicaIdx],
        plan_snapshot: planSnaps[demo.planIdx],
        capital: demo.capital,
        tasa_mensual: demo.tasa,
        snapshot_tasa_mensual: demo.tasa,
        snapshot_tasa_punitoria_mensual: demo.planIdx === 0 ? 6.0 : 5.0,
        cantidad_cuotas: demo.cuotas,
        sistema: "frances",
        total_intereses: totalIntereses,
        total_credito: totalCredito,
        valor_cuota_promedio: Math.round(cuotaFija * 100) / 100,
        fecha_otorgamiento: fechaOtorg,
        fecha_primer_vencimiento: fechaPrimerVenc,
        estado: estadoCredito,
        cuotas_count: demo.cuotas,
        cuotas_pagas: 0,
        saldo_capital: demo.capital,
        asiento_otorgamiento_id: "",
        created_at: now(),
        created_by: createdBy,
        updated_at: now(),
      });

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

      // Escribir cuotas en batches de 500
      for (let b = 0; b < cuotas.length; b += 499) {
        const batch = db.batch();
        const chunk = cuotas.slice(b, b + 499);
        for (const cuota of chunk) {
          const ref = db.collection(FIN_COLLECTIONS.cuotas(orgId)).doc();
          batch.set(ref, cuota);
        }
        await batch.commit();
        totalCuotas += chunk.length;
      }
    }

    return NextResponse.json({
      ok: true,
      reset,
      tiposCliente: TIPOS_CLIENTE.length,
      politicas: 2,
      planes: 2,
      sucursales: SUCURSALES.length,
      clientes: CLIENTES_DEMO.length,
      creditos: CREDITOS_DEMO.length,
      cuotas: totalCuotas,
    }, { status: 201 });
  },
  { roles: ["admin", "manager"] }
);
