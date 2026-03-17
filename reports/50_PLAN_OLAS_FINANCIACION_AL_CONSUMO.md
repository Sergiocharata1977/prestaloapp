# Plan Financiación al Consumo — Ejecución multi-agente

**Fecha:** 2026-03-14
**Feature:** App separada de financiación al consumo (casa de electrodomésticos). Motor de créditos con amortización francesa/alemana, cobros por caja, asientos contables automáticos.
**Proyectos afectados:** Nuevo proyecto `financiacion-app` (desde `proyecto-base-copia`), mismo Firebase project que Don Cándido IA.

---

## Contexto arquitectural (leer antes de ejecutar cualquier agente)

- **Stack:** Next.js 14 App Router + TypeScript strict + Firebase 12 + Radix UI + Tailwind + Zod + React Hook Form
- **Template base:** `d:/Proyecto en conjunto/proyecto-base - copia (2) - copia/` — ya tiene Firebase auth/admin, middleware, withAuth, (auth)/ y (dashboard)/ layout
- **Firebase project:** El mismo que Don Cándido IA (mismo `FIREBASE_PROJECT_ID`)
- **Auth:** Compartida — mismos custom claims: `organizationId`, `role`
- **Firestore:** Mismo proyecto, colecciones con prefijo `fin_` para aislamiento de namespace
  - `fin_clientes`, `fin_creditos`, `fin_cuotas`, `fin_cobros`, `fin_asientos`, `fin_plan_cuentas`, `fin_rubros`, `fin_sucursales` (subcolección de org)
- **Multi-tenant:** Todas las colecciones bajo `/organizations/{orgId}/` igual que DC
- **Patrón de seguridad:** `withAuth` wrapper en todas las API routes (copiar de DC)
- **Asientos:** NUNCA manuales. Solo auto-generados por formularios. La colección `fin_asientos` es de solo lectura para el usuario.
- **Nosis:** Reusar patrón exacto de `src/app/api/crm/historico/[clienteId]/nosis/route.ts` de DC

---

## Resumen de olas

| Ola | Agentes | Paralelo entre sí | Dependen de |
|-----|---------|-------------------|-------------|
| 1 | 1A, 1B, 1C | Sí | Nada (arrancan desde template) |
| 2 | 2A, 2B, 2C, 2D | Sí | Ola 1 completa |
| 3 | 3A, 3B, 3C, 3D | Sí | Ola 2 completa |
| 4 | 4A, 4B, 4C, 4D | Sí | Ola 3 completa |
| 5 | 5A, 5B | Sí | Ola 4 completa |

---

## Ola 1 — Tipos, Firebase config y base del proyecto
> Ejecutar 1A + 1B + 1C en PARALELO
> Prerequisito: copiar `proyecto-base-copia` a nueva carpeta `financiacion-app`

---

## Agente 1A — Tipos del dominio

**Puede ejecutarse en paralelo con:** 1B, 1C
**Depende de:** Nada

### Objetivo
Crear todos los tipos TypeScript del dominio de financiación al consumo.

### Archivos a crear
- `src/types/fin-cliente.ts` — tipos de cliente (persona física/jurídica, Nosis)
- `src/types/fin-credito.ts` — tipos de crédito, sistema de amortización, estados
- `src/types/fin-cuota.ts` — tipos de cuota individual, estados de pago
- `src/types/fin-cobro.ts` — tipos de cobro/pago de cuota
- `src/types/fin-asiento.ts` — tipos de asiento contable auto-generado
- `src/types/fin-plan-cuentas.ts` — tipos de rubro y cuenta contable
- `src/types/fin-sucursal.ts` — tipos de sucursal y caja

### Prompt completo para el agente

Sos un agente de TypeScript estricto. Tu tarea es crear los tipos del dominio de un sistema de financiación al consumo (casa de electrodomésticos).

**Stack:** Next.js 14 + TypeScript strict. El proyecto viene de una plantilla limpia.

**Convención de nombres:** Todos los archivos y tipos llevan prefijo `Fin` para evitar colisión con otros módulos.

**Crear `src/types/fin-cliente.ts`:**
```typescript
export type FinClienteTipo = 'fisica' | 'juridica'

export interface FinClienteNosisUltimo {
  fecha: string             // ISO
  score: number | null
  situacion_bcra: number | null  // 1=normal, 2=riesgo bajo, 3=riesgo medio, 4=riesgo alto, 5=irrecuperable, 6=sin info
  cheques_rechazados: number
  juicios_activos: number
  consultado_por: string    // uid del usuario
}

export interface FinCliente {
  id: string
  organization_id: string
  tipo: FinClienteTipo
  // Persona física
  nombre: string
  apellido?: string
  dni?: string
  cuit: string              // siempre presente (CUIT o CUIL)
  // Contacto
  telefono?: string
  email?: string
  domicilio?: string
  localidad?: string
  provincia?: string
  // Estado crediticio
  nosis_ultimo?: FinClienteNosisUltimo
  creditos_activos_count: number
  saldo_total_adeudado: number
  // Auditoría
  created_at: string
  created_by: string
  updated_at: string
}

export type FinClienteCreateInput = Omit<FinCliente, 'id' | 'creditos_activos_count' | 'saldo_total_adeudado' | 'created_at' | 'updated_at'>
```

**Crear `src/types/fin-credito.ts`:**
```typescript
export type FinSistemaAmortizacion = 'frances' | 'aleman'

export type FinCreditoEstado =
  | 'activo'
  | 'cancelado'
  | 'en_mora'
  | 'refinanciado'
  | 'incobrable'

export interface FinCredito {
  id: string
  organization_id: string
  sucursal_id: string
  cliente_id: string
  numero_credito: string    // ej: "2024-000123"
  // Artículo financiado
  articulo_descripcion: string
  articulo_codigo?: string
  // Condiciones financieras
  capital: number           // monto a financiar (sin intereses)
  tasa_mensual: number      // ej: 0.05 = 5% mensual
  cantidad_cuotas: number
  sistema: FinSistemaAmortizacion
  // Totales calculados al crear (inmutables)
  total_intereses: number
  total_credito: number     // capital + intereses
  valor_cuota_promedio: number
  // Fechas
  fecha_otorgamiento: string   // ISO date
  fecha_primer_vencimiento: string  // ISO date
  // Estado
  estado: FinCreditoEstado
  // Seguimiento
  cuotas_count: number
  cuotas_pagas: number
  saldo_capital: number        // capital pendiente
  // Referencias contables
  asiento_otorgamiento_id: string   // auto-generado al crear
  // Auditoría
  created_at: string
  created_by: string
  updated_at: string
}

export type FinCreditoCreateInput = {
  sucursal_id: string
  cliente_id: string
  articulo_descripcion: string
  articulo_codigo?: string
  capital: number
  tasa_mensual: number
  cantidad_cuotas: number
  sistema: FinSistemaAmortizacion
  fecha_otorgamiento: string
  fecha_primer_vencimiento: string
}
```

**Crear `src/types/fin-cuota.ts`:**
```typescript
export type FinCuotaEstado = 'pendiente' | 'pagada' | 'vencida'

export interface FinCuota {
  id: string
  organization_id: string
  credito_id: string
  cliente_id: string
  numero_cuota: number      // 1-based
  fecha_vencimiento: string // ISO date
  // Importes (inmutables — calculados al crear el crédito)
  capital: number
  interes: number
  total: number
  // Saldos del capital en esta cuota
  saldo_capital_inicio: number
  saldo_capital_fin: number
  // Estado
  estado: FinCuotaEstado
  // Si fue pagada
  cobro_id?: string
  fecha_pago?: string
}
```

**Crear `src/types/fin-cobro.ts`:**
```typescript
export type FinMedioPago = 'efectivo'  // plugins agregan más métodos

export interface FinCobro {
  id: string
  organization_id: string
  sucursal_id: string
  caja_id: string
  credito_id: string
  cuota_id: string
  cliente_id: string
  numero_cuota: number
  // Importes
  capital_cobrado: number
  interes_cobrado: number
  total_cobrado: number
  medio_pago: FinMedioPago
  // Auditoría
  fecha_cobro: string       // ISO
  usuario_id: string
  usuario_nombre: string
  // Referencia contable
  asiento_id: string        // auto-generado
  created_at: string
}

export type FinCobroCreateInput = {
  sucursal_id: string
  caja_id: string
  credito_id: string
  cuota_id: string
  medio_pago: FinMedioPago
}
```

**Crear `src/types/fin-asiento.ts`:**
```typescript
export type FinAsientoOrigen =
  | 'credito_otorgado'
  | 'cobro_cuota'

export interface FinAsientoLinea {
  cuenta_id: string
  cuenta_codigo: string
  cuenta_nombre: string
  debe: number
  haber: number
  descripcion: string
}

export interface FinAsiento {
  id: string
  organization_id: string
  sucursal_id: string
  origen: FinAsientoOrigen
  documento_id: string      // credito_id o cobro_id
  documento_tipo: string
  fecha: string             // ISO date
  periodo: string           // "YYYY-MM"
  estado: 'contabilizado'   // siempre — no hay borradores automáticos
  lineas: FinAsientoLinea[]
  total_debe: number
  total_haber: number
  creado_por: {
    usuario_id: string
    nombre: string
    timestamp: string
  }
}
```

**Crear `src/types/fin-plan-cuentas.ts`:**
```typescript
export type FinNaturalezaCuenta = 'activo' | 'pasivo' | 'patrimonio_neto' | 'resultado_positivo' | 'resultado_negativo'

export interface FinRubro {
  id: string
  organization_id: string
  codigo: string
  nombre: string
  naturaleza: FinNaturalezaCuenta
  orden: number
}

export interface FinCuenta {
  id: string
  organization_id: string
  rubro_id: string
  codigo: string            // ej: "1.1.01"
  nombre: string
  naturaleza: FinNaturalezaCuenta
  imputable: boolean        // false = solo agrupadora
  activa: boolean
  // Configuración analítica
  requiere_sucursal: boolean
  requiere_caja: boolean
  requiere_tercero: boolean
}

// Cuentas usadas por el motor de asientos (configuradas por plugin)
export interface FinConfigCuentas {
  organization_id: string
  plugin: string            // ej: 'financiacion_consumo'
  cuentas: {
    creditos_por_financiaciones: string   // cuenta_id
    intereses_no_devengados: string
    ventas_financiadas: string
    intereses_ganados: string
    // caja es dinámica por sucursal/caja — se resuelve en runtime
  }
}
```

**Crear `src/types/fin-sucursal.ts`:**
```typescript
export interface FinSucursal {
  id: string
  organization_id: string
  nombre: string
  direccion?: string
  activa: boolean
  created_at: string
}

export type FinCajaEstado = 'abierta' | 'cerrada'

export interface FinCaja {
  id: string
  organization_id: string
  sucursal_id: string
  nombre: string
  cuenta_contable_id: string  // cuenta en plan de cuentas que representa esta caja
  estado: FinCajaEstado
  saldo_actual: number
  updated_at: string
}
```

**Criterio de éxito:** Los 7 archivos de tipos compilan sin errores con `tsc --noEmit`. No hay imports entre ellos (son tipos puros, sin dependencias).

---

## Agente 1B — Firebase config y colecciones

**Puede ejecutarse en paralelo con:** 1A, 1C
**Depende de:** Nada

### Objetivo
Configurar el acceso a Firebase del nuevo proyecto apuntando al mismo proyecto de Don Cándido, y definir las constantes de colecciones con prefijo `fin_`.

### Archivos a crear
- `src/firebase/collections.ts` — constantes de nombres de colecciones
- `src/firebase/config.ts` — Firebase client config (mismo projectId que DC)
- `src/firebase/admin.ts` — Firebase Admin SDK (mismo projectId que DC)

### Archivos a modificar
- `.env.local.example` — agregar variables de entorno necesarias

### Prompt completo para el agente

Sos un agente de configuración Firebase. Tu tarea es configurar Firebase para el nuevo proyecto `financiacion-app` que comparte el mismo Firebase project que otra app llamada Don Cándido IA.

**Regla fundamental:** Las colecciones de esta app llevan prefijo `fin_` para no colisionar con las colecciones de Don Cándido en el mismo Firestore.

**Estructura Firestore esperada:**
```
/organizations/{orgId}/
  fin_clientes/{clienteId}
  fin_creditos/{creditoId}
  fin_cuotas/{cuotaId}
  fin_cobros/{cobroId}
  fin_asientos/{asientoId}
  fin_rubros/{rubroId}
  fin_cuentas/{cuentaId}
  fin_config_cuentas/{pluginId}
  fin_sucursales/{sucursalId}
    fin_cajas/{cajaId}   ← subcolección de sucursal
```

**Crear `src/firebase/collections.ts`:**
```typescript
export const FIN_COLLECTIONS = {
  // Raíz de org
  orgBase: (orgId: string) => `organizations/${orgId}`,

  // Clientes
  clientes: (orgId: string) => `organizations/${orgId}/fin_clientes`,
  cliente: (orgId: string, id: string) => `organizations/${orgId}/fin_clientes/${id}`,

  // Créditos
  creditos: (orgId: string) => `organizations/${orgId}/fin_creditos`,
  credito: (orgId: string, id: string) => `organizations/${orgId}/fin_creditos/${id}`,

  // Cuotas
  cuotas: (orgId: string) => `organizations/${orgId}/fin_cuotas`,
  cuota: (orgId: string, id: string) => `organizations/${orgId}/fin_cuotas/${id}`,

  // Cobros
  cobros: (orgId: string) => `organizations/${orgId}/fin_cobros`,
  cobro: (orgId: string, id: string) => `organizations/${orgId}/fin_cobros/${id}`,

  // Asientos (solo lectura para el usuario)
  asientos: (orgId: string) => `organizations/${orgId}/fin_asientos`,
  asiento: (orgId: string, id: string) => `organizations/${orgId}/fin_asientos/${id}`,

  // Plan de cuentas
  rubros: (orgId: string) => `organizations/${orgId}/fin_rubros`,
  cuentas: (orgId: string) => `organizations/${orgId}/fin_cuentas`,
  configCuentas: (orgId: string, plugin: string) => `organizations/${orgId}/fin_config_cuentas/${plugin}`,

  // Sucursales y cajas
  sucursales: (orgId: string) => `organizations/${orgId}/fin_sucursales`,
  sucursal: (orgId: string, id: string) => `organizations/${orgId}/fin_sucursales/${id}`,
  cajas: (orgId: string, sucursalId: string) => `organizations/${orgId}/fin_sucursales/${sucursalId}/fin_cajas`,
  caja: (orgId: string, sucursalId: string, cajaId: string) => `organizations/${orgId}/fin_sucursales/${sucursalId}/fin_cajas/${cajaId}`,
} as const
```

**Crear `src/firebase/config.ts`** — Firebase client SDK, leer variables de entorno NEXT_PUBLIC_FIREBASE_*. El `projectId` debe ser el mismo que usa Don Cándido IA.

**Crear `src/firebase/admin.ts`** — Firebase Admin SDK con `getApps()` guard para evitar inicialización múltiple. Usar `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` del entorno.

**Crear `.env.local.example`** con:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=     # mismo que Don Cándido
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=                  # mismo que Don Cándido
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

**Criterio de éxito:** Los tres archivos compilan. `collections.ts` exporta todas las rutas. El Admin SDK usa `getApps().length === 0` como guard de inicialización.

---

## Agente 1C — withAuth middleware y lib base

**Puede ejecutarse en paralelo con:** 1A, 1B
**Depende de:** Nada

### Objetivo
Adaptar el middleware de autenticación del template y crear los helpers base que todas las API routes van a usar.

### Archivos a crear
- `src/lib/api/withAuth.ts` — wrapper de autenticación para API routes (mismo patrón que DC)
- `src/lib/api/errors.ts` — helpers de error HTTP estandarizados
- `src/middleware.ts` — middleware global Next.js (proteger rutas del dashboard)

### Archivos a modificar
- `src/types/auth.ts` — agregar tipo `FinAuthContext` con `organizationId` y `role`

### Prompt completo para el agente

Sos un agente de seguridad. Tu tarea es implementar el middleware de autenticación para el proyecto `financiacion-app` basándote en el patrón de Don Cándido IA.

**Referencia:** El patrón de `withAuth` de DC está en `src/lib/api/withAuth.ts` de otro proyecto. El wrapper:
1. Verifica el Bearer token del header `Authorization` o la cookie `session`
2. Valida contra Firebase Auth Admin SDK
3. Extrae `uid`, `organizationId`, `role` del token JWT (custom claims)
4. Llama al handler con el contexto de auth si todo está bien
5. Retorna 401 si no autenticado, 403 si sin permiso para el rol requerido

**Implementar `src/lib/api/withAuth.ts`:**
```typescript
import { adminAuth } from '@/firebase/admin'
import { NextRequest, NextResponse } from 'next/server'

export interface AuthContext {
  uid: string
  email: string | null
  organizationId: string
  role: string
}

type RouteHandler<P = Record<string, string>> = (
  req: NextRequest,
  context: { params: Promise<P> },
  auth: AuthContext
) => Promise<NextResponse>

interface WithAuthOptions {
  roles?: string[]
}

export function withAuth<P = Record<string, string>>(
  handler: RouteHandler<P>,
  options: WithAuthOptions = {}
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    // extraer token de Authorization header o cookie
    // verificar con adminAuth.verifyIdToken()
    // extraer organizationId y role de customClaims
    // validar roles si options.roles está definido
    // llamar handler(req, context, authContext)
    // manejar errores con responses JSON estandarizados
  }
}
```

**Implementar `src/lib/api/errors.ts`:**
```typescript
export function unauthorizedError(msg = 'No autenticado') { ... }
export function forbiddenError(msg = 'Sin permiso') { ... }
export function notFoundError(msg = 'No encontrado') { ... }
export function validationError(msg: string) { ... }
export function serverError(msg = 'Error interno') { ... }
```

**Implementar `src/middleware.ts`:** Proteger todas las rutas bajo `/(dashboard)` y `/api/fin/` excluyendo `/api/fin/public/`. Redirigir a `/login` si no hay sesión.

**Criterio de éxito:** El middleware compila. `withAuth` exporta el tipo `AuthContext`. Los helpers de error devuelven `NextResponse` con status correcto.

---

## Ola 2 — Motor de negocio y servicios
> Ejecutar solo después de que OLA 1 esté completa
> Ejecutar 2A + 2B + 2C + 2D en PARALELO

---

## Agente 2A — Motor de amortización

**Puede ejecutarse en paralelo con:** 2B, 2C, 2D
**Depende de:** 1A (tipos fin-credito.ts, fin-cuota.ts)

### Objetivo
Implementar el motor de cálculo de tablas de amortización francesa y alemana.

### Archivos a crear
- `src/services/AmortizationService.ts` — motor de cálculo French + German

### Prompt completo para el agente

Sos un agente de lógica financiera. Implementá el motor de amortización para un sistema de financiación al consumo.

**Tipos disponibles (ya creados en ola 1):**
- `src/types/fin-credito.ts` → `FinSistemaAmortizacion`, `FinCreditoCreateInput`
- `src/types/fin-cuota.ts` → `FinCuota`

**Implementar `src/services/AmortizationService.ts`:**

```typescript
export interface CuotaCalculada {
  numero_cuota: number
  fecha_vencimiento: string   // ISO date
  capital: number
  interes: number
  total: number
  saldo_capital_inicio: number
  saldo_capital_fin: number
}

export interface TablaAmortizacion {
  sistema: 'frances' | 'aleman'
  capital: number
  tasa_mensual: number
  cantidad_cuotas: number
  total_intereses: number
  total_credito: number
  valor_cuota_promedio: number
  cuotas: CuotaCalculada[]
}

export class AmortizationService {
  static calcular(
    capital: number,
    tasaMensual: number,         // ej: 0.05 para 5% mensual
    cantidadCuotas: number,
    sistema: 'frances' | 'aleman',
    fechaPrimerVencimiento: string  // ISO date
  ): TablaAmortizacion

  private static calcularFrances(...): CuotaCalculada[]
  // Sistema francés: cuota fija = C × i / (1 - (1+i)^-n)
  // Cada período: interés = saldo × tasa, capital = cuota - interés
  // Redondear a 2 decimales. Ajustar última cuota para cerrar exactamente.

  private static calcularAleman(...): CuotaCalculada[]
  // Sistema alemán: capital fijo = total / n
  // Cada período: interés = saldo × tasa, total = capitalFijo + interés
  // Redondear a 2 decimales. Ajustar última cuota para cerrar exactamente.

  static calcularFechasVencimiento(
    fechaPrimera: string,
    cantidad: number
  ): string[]
  // Genera fechas mensuales desde fechaPrimera. Maneja fin de mes correctamente.
}
```

**Reglas de redondeo:**
- Todo en pesos argentinos: redondear a 2 decimales con `Math.round(x * 100) / 100`
- La última cuota absorbe el centavo de diferencia por redondeo
- Los totales `total_intereses` y `total_credito` se suman de las cuotas calculadas (no se recalculan)

**Criterio de éxito:**
- `AmortizationService.calcular(100000, 0.05, 12, 'frances', '2026-04-01')` devuelve 12 cuotas donde `sum(capital) === 100000` y `sum(total) === total_credito`
- Mismo test con `'aleman'` — cada cuota tiene el mismo `capital`
- Escribir 3-4 tests unitarios simples al final del archivo (como comentarios o con Jest si el proyecto lo tiene)

---

## Agente 2B — Motor de asientos contables

**Puede ejecutarse en paralelo con:** 2A, 2C, 2D
**Depende de:** 1A (tipos fin-asiento.ts, fin-credito.ts, fin-cobro.ts)

### Objetivo
Implementar el servicio que genera asientos contables automáticos a partir de eventos de negocio. Nunca recibe input del usuario directamente — solo es llamado desde otros servicios.

### Archivos a crear
- `src/services/JournalEntryService.ts` — generador automático de asientos

### Prompt completo para el agente

Sos un agente de lógica contable. Implementá el motor de asientos contables automáticos de doble partida.

**Regla fundamental:** Este servicio NUNCA es llamado desde rutas de API directamente por el usuario. Solo lo llaman `CreditoService` (al otorgar crédito) y `CobroService` (al registrar un pago). El usuario no puede crear asientos manuales.

**Tipos disponibles (ya creados en ola 1):**
- `src/types/fin-asiento.ts` → `FinAsiento`, `FinAsientoLinea`, `FinAsientoOrigen`
- `src/types/fin-credito.ts` → `FinCredito`
- `src/types/fin-cobro.ts` → `FinCobro`
- `src/types/fin-plan-cuentas.ts` → `FinConfigCuentas`

**Implementar `src/services/JournalEntryService.ts`:**

```typescript
import { adminDb } from '@/firebase/admin'
import { FIN_COLLECTIONS } from '@/firebase/collections'
import type { FinCredito } from '@/types/fin-credito'
import type { FinCobro } from '@/types/fin-cobro'
import type { FinAsiento } from '@/types/fin-asiento'
import type { FinConfigCuentas } from '@/types/fin-plan-cuentas'

export class JournalEntryService {
  // Genera asiento de otorgamiento de crédito
  // Debe === Haber obligatoriamente
  // Dr: Créditos por Financiaciones [capital]
  // Dr: Intereses No Devengados [total_intereses]  (como activo diferido)
  // Cr: Ventas Financiadas [capital]
  // Cr: Intereses No Devengados Cr [total_intereses]
  static async generarAsientoOtorgamiento(
    credito: FinCredito,
    config: FinConfigCuentas,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<string>  // retorna asiento_id

  // Genera asiento de cobro de cuota
  // Dr: Caja [cuota.total]
  // Cr: Créditos por Financiaciones [cuota.capital]
  // Dr: Intereses No Devengados [cuota.interes]  (reversa el diferido)
  // Cr: Intereses Ganados [cuota.interes]
  static async generarAsientoCobro(
    cobro: FinCobro,
    cuotaCapital: number,
    cuotaInteres: number,
    cajaAccountId: string,    // cuenta contable de la caja donde se cobró
    config: FinConfigCuentas,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<string>  // retorna asiento_id

  // Valida que un asiento esté balanceado (debe === haber)
  // Lanza error si no lo está — nunca guardar asientos desbalanceados
  private static validarBalance(lineas: FinAsientoLinea[]): void

  // Helper: obtiene config de cuentas del plugin
  static async getConfigCuentas(
    orgId: string,
    plugin: string
  ): Promise<FinConfigCuentas>
}
```

**Regla de balance:** `sum(debe) === sum(haber)`. Si no se cumple, lanzar `Error('Asiento desbalanceado: debe=${X} haber=${Y}')`. Nunca persistir un asiento desbalanceado.

**Criterio de éxito:** El servicio compila. La validación de balance lanza error si debe ≠ haber. Los dos métodos `generarAsiento*` persisten el asiento en Firestore y retornan el ID.

---

## Agente 2C — ClienteService y NosisService

**Puede ejecutarse en paralelo con:** 2A, 2B, 2D
**Depende de:** 1A (tipos fin-cliente.ts), 1B (collections.ts)

### Objetivo
Implementar el servicio de gestión de clientes y el adaptador de consulta Nosis, reutilizando el patrón existente en Don Cándido IA.

### Archivos a crear
- `src/services/ClienteService.ts` — CRUD de clientes en Firestore
- `src/services/NosisService.ts` — consulta Nosis (patrón idéntico al de DC)

### Prompt completo para el agente

Sos un agente de servicios de datos. Tu tarea es implementar el servicio de clientes y la integración con Nosis.

**Referencia Nosis de Don Cándido:** El patrón de DC guarda: `cuit`, `fechaConsulta`, `tipoConsulta`, `scoreObtenido`, `situacionBcra`, `chequesRechazados`, `juiciosActivos`, `estado`, `tiempoRespuestaMs`, `solicitadoPor`. Replicar exactamente.

**Tipos disponibles:**
- `src/types/fin-cliente.ts` → `FinCliente`, `FinClienteCreateInput`, `FinClienteNosisUltimo`
- `src/firebase/collections.ts` → `FIN_COLLECTIONS`

**Implementar `src/services/ClienteService.ts`:**
```typescript
export class ClienteService {
  static async crear(orgId: string, input: FinClienteCreateInput, usuarioId: string): Promise<string>
  static async getById(orgId: string, clienteId: string): Promise<FinCliente | null>
  static async getByCuit(orgId: string, cuit: string): Promise<FinCliente | null>
  static async buscar(orgId: string, query: string): Promise<FinCliente[]>
    // busca por nombre, apellido o CUIT/DNI — query >= 3 chars
  static async actualizarNosisUltimo(orgId: string, clienteId: string, nosis: FinClienteNosisUltimo): Promise<void>
  static async incrementarCreditosActivos(orgId: string, clienteId: string, deltaCapital: number): Promise<void>
    // usa Firestore FieldValue.increment() — no sobreescribir
  static async decrementarCreditosActivos(orgId: string, clienteId: string, deltaCapital: number): Promise<void>
}
```

**Implementar `src/services/NosisService.ts`:**
```typescript
export interface NosisConsultaResult {
  score: number | null
  situacion_bcra: number | null
  cheques_rechazados: number
  juicios_activos: number
  raw_response?: unknown
  error?: string
}

export class NosisService {
  // Realiza la consulta HTTP a la API de Nosis
  // En sandbox/desarrollo: retorna datos mock si NOSIS_SANDBOX=true
  static async consultar(cuit: string, apiKey: string): Promise<NosisConsultaResult>
  // Guarda el log de la consulta en Firestore para trazabilidad
  // (similar a HistoricoService.logConsultaNosis en DC)
  static async logConsulta(
    orgId: string,
    clienteId: string,
    cuit: string,
    resultado: NosisConsultaResult,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<void>
}
```

**Variable de entorno a agregar a `.env.local.example`:** `NOSIS_API_KEY=` y `NOSIS_SANDBOX=true`

**Criterio de éxito:** `ClienteService.getByCuit` retorna null si no existe y el cliente si existe. `NosisService.consultar` con `NOSIS_SANDBOX=true` retorna datos mock sin llamar a la API real.

---

## Agente 2D — CreditoService y CobroService

**Puede ejecutarse en paralelo con:** 2A, 2B, 2C
**Depende de:** 1A (tipos fin-credito.ts, fin-cuota.ts, fin-cobro.ts), 1B (collections.ts)

### Objetivo
Implementar los servicios de creación de créditos (con tabla de amortización) y registro de cobros. Estos servicios orquestan el flujo completo: persistir datos + llamar al motor de asientos.

### Archivos a crear
- `src/services/CreditoService.ts` — creación de crédito con tabla de amortización
- `src/services/CobroService.ts` — registro de pago de cuota

### Prompt completo para el agente

Sos un agente de servicios de negocio. Implementás los servicios de créditos y cobros, que orquestan la persistencia en Firestore y la generación automática de asientos contables.

**Importante:** Estos servicios usan Firestore batched writes para garantizar atomicidad. Si falla cualquier paso (guardar crédito, cuotas o asiento), nada se persiste.

**Tipos disponibles (ola 1):** `FinCredito`, `FinCreditoCreateInput`, `FinCuota`, `FinCobro`, `FinCobroCreateInput`
**Servicios disponibles (ola 2, mismo agente puede referenciar):** `AmortizationService` (2A), `JournalEntryService` (2B)

**Implementar `src/services/CreditoService.ts`:**
```typescript
export class CreditoService {
  static async crear(
    orgId: string,
    input: FinCreditoCreateInput,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ creditoId: string; asientoId: string }>
  // 1. Calcular tabla de amortización (AmortizationService.calcular)
  // 2. Generar numero_credito único: "YYYY-NNNNNN" (año + contador secuencial por org)
  // 3. Batch write: crear FinCredito + todas las FinCuota + actualizar cliente (creditos_activos_count++)
  // 4. Cargar config de cuentas del plugin 'financiacion_consumo'
  // 5. Generar asiento de otorgamiento (JournalEntryService.generarAsientoOtorgamiento)
  // 6. Actualizar credito con asiento_otorgamiento_id
  // 7. Retornar IDs

  static async getById(orgId: string, creditoId: string): Promise<FinCredito | null>
  static async getByCliente(orgId: string, clienteId: string): Promise<FinCredito[]>
  static async getCuotas(orgId: string, creditoId: string): Promise<FinCuota[]>
  static async getCuotasPendientes(orgId: string, creditoId: string): Promise<FinCuota[]>
  static async actualizarEstado(orgId: string, creditoId: string, estado: FinCreditoEstado): Promise<void>
}
```

**Implementar `src/services/CobroService.ts`:**
```typescript
export class CobroService {
  static async registrar(
    orgId: string,
    input: FinCobroCreateInput,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ cobroId: string; asientoId: string }>
  // 1. Leer la cuota (verificar estado === 'pendiente' o 'vencida')
  // 2. Leer la caja (verificar estado === 'abierta')
  // 3. Batch write:
  //    - Crear FinCobro
  //    - Actualizar FinCuota: estado='pagada', cobro_id, fecha_pago
  //    - Actualizar FinCredito: cuotas_pagas++, saldo_capital -= cuota.capital
  //    - Actualizar FinCaja: saldo_actual += total_cobrado (FieldValue.increment)
  // 4. Obtener cuenta contable de la caja (para el asiento)
  // 5. Generar asiento de cobro (JournalEntryService.generarAsientoCobro)
  // 6. Actualizar cobro con asiento_id
  // 7. Si cuotas_pagas === cuotas_count: actualizar crédito a estado='cancelado'
  // 8. Retornar IDs

  static async getByCredito(orgId: string, creditoId: string): Promise<FinCobro[]>
  static async getByFecha(orgId: string, fecha: string): Promise<FinCobro[]>
  static async getByCaja(orgId: string, cajaId: string, fecha: string): Promise<FinCobro[]>
}
```

**Criterio de éxito:** Los servicios compilan. `CreditoService.crear` es una transacción atómica — si falla el asiento, tampoco se guarda el crédito. `CobroService.registrar` no permite cobrar una cuota ya pagada (lanza error).

---

## Ola 3 — API Routes
> Ejecutar solo después de que OLA 2 esté completa
> Ejecutar 3A + 3B + 3C + 3D en PARALELO

---

## Agente 3A — API clientes y Nosis

**Puede ejecutarse en paralelo con:** 3B, 3C, 3D
**Depende de:** 2C (ClienteService, NosisService)

### Objetivo
Crear las API routes de gestión de clientes y consulta Nosis.

### Archivos a crear
- `src/app/api/fin/clientes/route.ts` — GET (lista/búsqueda) + POST (crear)
- `src/app/api/fin/clientes/[id]/route.ts` — GET por ID
- `src/app/api/fin/clientes/[id]/nosis/route.ts` — POST (consultar Nosis)

### Prompt completo para el agente

Sos un agente de API routes. Creás las rutas de clientes y Nosis siguiendo el patrón de Don Cándido IA.

**Patrón de API routes (obligatorio):**
```typescript
import { withAuth } from '@/lib/api/withAuth'
import { NextResponse } from 'next/server'

export const GET = withAuth(async (request, { params }, auth) => {
  // auth.organizationId — siempre usar este, nunca confiar en query params
  // auth.uid, auth.role disponibles
  const { organizationId } = auth
  // ... lógica
  return NextResponse.json({ success: true, data: result })
}, { roles: ['admin', 'gerente', 'operador'] })
```

**`GET /api/fin/clientes`** — buscar clientes (query param `q` para búsqueda por nombre/CUIT). Retorna `{ success: true, data: FinCliente[] }`.

**`POST /api/fin/clientes`** — crear cliente. Body: `FinClienteCreateInput`. Validar con Zod. Verificar que no exista otro con el mismo CUIT.

**`GET /api/fin/clientes/[id]`** — obtener cliente por ID. Include: todos sus créditos activos (llama a `CreditoService.getByCliente` filtrando activos).

**`POST /api/fin/clientes/[id]/nosis`** — consultar Nosis. Body: `{ cuit: string }`. Llama a `NosisService.consultar` + `NosisService.logConsulta` + `ClienteService.actualizarNosisUltimo`. Roles: solo admin y gerente pueden consultar Nosis.

**Criterio de éxito:** 4 archivos de routes. Cada route usa `withAuth`. Validación Zod en los POSTs. Errores retornan `{ success: false, error: string }`.

---

## Agente 3B — API créditos y cuotas

**Puede ejecutarse en paralelo con:** 3A, 3C, 3D
**Depende de:** 2A (AmortizationService), 2D (CreditoService)

### Objetivo
Crear las API routes de créditos, cuotas y preview de tabla de amortización.

### Archivos a crear
- `src/app/api/fin/creditos/route.ts` — GET (lista) + POST (crear crédito)
- `src/app/api/fin/creditos/[id]/route.ts` — GET por ID con cuotas
- `src/app/api/fin/creditos/[id]/cuotas/route.ts` — GET cuotas del crédito
- `src/app/api/fin/creditos/preview/route.ts` — POST preview tabla amortización (sin persistir)

### Prompt completo para el agente

Sos un agente de API routes. Creás las rutas de créditos.

**Patrón:** Igual a Agente 3A — `withAuth` en todas. `auth.organizationId` siempre.

**`POST /api/fin/creditos/preview`** — calcula la tabla de amortización SIN persistir nada. Body: `{ capital, tasa_mensual, cantidad_cuotas, sistema, fecha_primer_vencimiento }`. Llama solo a `AmortizationService.calcular()`. Retorna la `TablaAmortizacion` completa. Útil para mostrar preview antes de confirmar.

**`POST /api/fin/creditos`** — crear crédito. Body: `FinCreditoCreateInput`. Llama a `CreditoService.crear()`. Retorna `{ success: true, data: { creditoId, asientoId, tabla_amortizacion } }`.

**`GET /api/fin/creditos`** — listar créditos de la org. Query params opcionales: `cliente_id`, `estado`, `sucursal_id`.

**`GET /api/fin/creditos/[id]`** — obtener crédito completo con sus cuotas (`CreditoService.getById` + `CreditoService.getCuotas`).

**`GET /api/fin/creditos/[id]/cuotas`** — solo las cuotas. Query param `estado` opcional (pendiente|pagada|vencida).

**Criterio de éxito:** El preview endpoint no escribe nada en Firestore. El POST de creación es transaccional.

---

## Agente 3C — API cobros, cajas y sucursales

**Puede ejecutarse en paralelo con:** 3A, 3B, 3D
**Depende de:** 2D (CobroService)

### Objetivo
Crear las API routes de cobros, cajas y sucursales.

### Archivos a crear
- `src/app/api/fin/cobros/route.ts` — POST (registrar cobro)
- `src/app/api/fin/cobros/[id]/route.ts` — GET por ID
- `src/app/api/fin/sucursales/route.ts` — GET + POST
- `src/app/api/fin/sucursales/[id]/cajas/route.ts` — GET cajas + POST nueva caja
- `src/app/api/fin/cajas/[id]/saldo/route.ts` — GET saldo del día

### Prompt completo para el agente

Sos un agente de API routes. Creás las rutas de cobros y estructura operativa.

**`POST /api/fin/cobros`** — registrar cobro de cuota. Body: `FinCobroCreateInput`. Llama a `CobroService.registrar()`. Retorna `{ success: true, data: { cobroId, asientoId } }`. Solo roles: admin, gerente, operador.

**`GET /api/fin/cobros`** — listar cobros. Query params: `fecha` (YYYY-MM-DD), `caja_id`, `credito_id`.

**`GET /api/fin/sucursales`** — listar sucursales activas de la org.

**`POST /api/fin/sucursales`** — crear sucursal. Solo admin.

**`GET /api/fin/sucursales/[id]/cajas`** — listar cajas de una sucursal.

**`POST /api/fin/sucursales/[id]/cajas`** — crear caja. Body: `{ nombre, cuenta_contable_id }`.

**`GET /api/fin/cajas/[id]/saldo`** — saldo actual de la caja + total cobrado en la fecha (query param `fecha`).

**Criterio de éxito:** El POST de cobro valida que la cuota esté pendiente o vencida (no pagada). Todas las routes usan `withAuth`.

---

## Agente 3D — API plan de cuentas y asientos

**Puede ejecutarse en paralelo con:** 3A, 3B, 3C
**Depende de:** 1A (tipos fin-plan-cuentas.ts, fin-asiento.ts), 1B (collections.ts)

### Objetivo
Crear las API routes del plan de cuentas (lectura/admin) y el libro diario (solo lectura).

### Archivos a crear
- `src/app/api/fin/plan-cuentas/rubros/route.ts` — GET + POST
- `src/app/api/fin/plan-cuentas/cuentas/route.ts` — GET + POST
- `src/app/api/fin/plan-cuentas/config/[plugin]/route.ts` — GET + PUT (config de cuentas por plugin)
- `src/app/api/fin/asientos/route.ts` — GET (libro diario, solo lectura)
- `src/app/api/fin/asientos/[id]/route.ts` — GET asiento individual

### Prompt completo para el agente

Sos un agente de API routes. Creás las rutas del plan de cuentas y libro diario.

**Regla fundamental para asientos:** NO existe POST en `/api/fin/asientos`. Los asientos solo los crea el sistema internamente. Si alguien intenta POST a esa ruta, retornar 405 Method Not Allowed.

**`GET /api/fin/plan-cuentas/rubros`** — lista rubros de la org.
**`POST /api/fin/plan-cuentas/rubros`** — crear rubro. Solo rol admin.
**`GET /api/fin/plan-cuentas/cuentas`** — lista cuentas. Query param `rubro_id`, `imputable`, `activa`.
**`POST /api/fin/plan-cuentas/cuentas`** — crear cuenta. Solo rol admin.
**`GET /api/fin/plan-cuentas/config/[plugin]`** — obtener config de cuentas para un plugin (ej: `financiacion_consumo`).
**`PUT /api/fin/plan-cuentas/config/[plugin]`** — actualizar config de cuentas. Solo admin.
**`GET /api/fin/asientos`** — libro diario. Query params: `periodo` (YYYY-MM), `origen`, `sucursal_id`. Paginación: `limit` (default 50) + `cursor`.
**`GET /api/fin/asientos/[id]`** — asiento completo con líneas.

**Criterio de éxito:** El endpoint de asientos no tiene método POST. Las routes de plan de cuentas tienen validación de rol admin para escritura.

---

## Ola 4 — Frontend: páginas y componentes
> Ejecutar solo después de que OLA 3 esté completa
> Ejecutar 4A + 4B + 4C + 4D en PARALELO

---

## Agente 4A — Layout, navegación y dashboard

**Puede ejecutarse en paralelo con:** 4B, 4C, 4D
**Depende de:** 1C (middleware y auth), 3A-3D (API routes disponibles)

### Objetivo
Crear el layout principal de la app, navegación lateral y dashboard de inicio.

### Archivos a crear
- `src/app/(dashboard)/layout.tsx` — layout con sidebar
- `src/app/(dashboard)/_components/Sidebar.tsx` — navegación lateral
- `src/app/(dashboard)/page.tsx` — dashboard: métricas del día (cobros, cajas, créditos activos)

### Prompt completo para el agente

Sos un agente de UI. Creás el layout y dashboard de la app de financiación al consumo.

**Stack UI:** Next.js 14 App Router + Tailwind + Radix UI. Colores: emerald para acciones primarias, slate para fondo. Sin emojis en UI.

**Sidebar debe tener estos links:**
- Dashboard (/)
- Clientes (/clientes)
- Nuevo crédito (/creditos/nuevo)
- Créditos (/creditos)
- Cobros (/cobros)
- Cajas (/cajas)
- Plan de cuentas (/plan-cuentas) — solo visible para admin
- Libro diario (/asientos) — solo visible para admin/contador
- Configuración (/configuracion)

**Dashboard `/`:** Cards con métricas del día: total cobrado hoy, cantidad de cobros, créditos otorgados hoy, créditos activos totales. Tabla de últimos 5 cobros del día.

**Criterio de éxito:** Layout renderiza con sidebar. El dashboard hace fetch a las APIs disponibles. El sidebar muestra links condicionados por rol.

---

## Agente 4B — Páginas de clientes

**Puede ejecutarse en paralelo con:** 4A, 4C, 4D
**Depende de:** 3A (API clientes y Nosis)

### Objetivo
Crear las páginas de lista de clientes, alta de cliente y detalle de cliente con resumen de créditos (tipo estado de cuenta).

### Archivos a crear
- `src/app/(dashboard)/clientes/page.tsx` — lista + buscador por nombre/CUIT
- `src/app/(dashboard)/clientes/nuevo/page.tsx` — formulario alta de cliente
- `src/app/(dashboard)/clientes/[id]/page.tsx` — detalle + resumen de créditos + botón consultar Nosis

### Prompt completo para el agente

Sos un agente de UI. Creás las páginas de gestión de clientes.

**Página de lista `/clientes`:**
- Buscador en tiempo real (debounce 300ms) por nombre, apellido, DNI o CUIT
- Tabla: nombre, CUIT, créditos activos, saldo adeudado, última consulta Nosis
- Link a detalle por fila

**Página de alta `/clientes/nuevo`:**
- Formulario con React Hook Form + Zod
- Campos: tipo (física/jurídica), nombre, apellido, CUIT, DNI opcional, teléfono, email, domicilio, localidad, provincia
- Submit: POST a `/api/fin/clientes`, redirect a detalle del cliente creado

**Página de detalle `/clientes/[id]`:**
- Header: datos del cliente, badge de estado Nosis (situación BCRA semáforo)
- Botón "Consultar Nosis" (llama a `/api/fin/clientes/[id]/nosis`)
- Sección "Resumen de créditos" (como extracto de tarjeta de crédito):
  - Por cada crédito activo: número, artículo, cuotas pagas/total, próxima cuota con fecha y monto, saldo de capital
  - Total saldo adeudado consolidado al pie
- Botón "Nuevo crédito" → link a `/creditos/nuevo?cliente_id=[id]`

**Criterio de éxito:** La búsqueda funciona con debounce. El resumen de créditos muestra todos los créditos activos del cliente (múltiples simultáneos). El semáforo de Nosis es verde (1), amarillo (2-3), rojo (4-5).

---

## Agente 4C — Páginas de créditos con preview de amortización

**Puede ejecutarse en paralelo con:** 4A, 4B, 4D
**Depende de:** 3B (API créditos)

### Objetivo
Crear formulario de nuevo crédito con preview en tiempo real de la tabla de amortización, y página de detalle del crédito.

### Archivos a crear
- `src/app/(dashboard)/creditos/page.tsx` — lista de créditos
- `src/app/(dashboard)/creditos/nuevo/page.tsx` — formulario con preview tabla
- `src/app/(dashboard)/creditos/[id]/page.tsx` — detalle: cuotas, cobros, asiento de otorgamiento

### Prompt completo para el agente

Sos un agente de UI. Creás las páginas de créditos, especialmente el formulario con preview de amortización en tiempo real.

**Formulario `/creditos/nuevo`:**
- Si viene query param `cliente_id`, pre-cargar el cliente
- Campos: cliente (buscador inline), artículo descripción, capital, tasa mensual (%), cantidad de cuotas, sistema (frances/aleman), fecha primer vencimiento
- **Preview automático:** cuando capital + tasa + cuotas + sistema están completos, llamar a `/api/fin/creditos/preview` con debounce 500ms y mostrar:
  - Tabla de amortización completa (numero, fecha, capital, interés, total, saldo)
  - Resumen: total intereses, total crédito, cuota promedio
  - Botón "Confirmar y otorgar" (solo activo si preview cargó OK)
- Submit: POST a `/api/fin/creditos`

**Página de detalle `/creditos/[id]`:**
- Header: número de crédito, cliente, estado (badge), sistema, tasa
- Tabla de cuotas: número, fecha vencimiento, capital, interés, total, estado (pendiente/pagada/vencida), botón "Registrar cobro" en las pendientes/vencidas
- Sección de cobros registrados
- Link al asiento de otorgamiento

**Criterio de éxito:** El preview se actualiza mientras el usuario escribe (debounce). La tabla de cuotas distingue visualmente las pagadas (verde), vencidas (rojo) y pendientes (gris).

---

## Agente 4D — Páginas de cobros y cajas

**Puede ejecutarse en paralelo con:** 4A, 4B, 4C
**Depende de:** 3C (API cobros, cajas)

### Objetivo
Crear las páginas de registro de cobro de cuota y vista de caja del día.

### Archivos a crear
- `src/app/(dashboard)/cobros/page.tsx` — historial de cobros del día por caja
- `src/app/(dashboard)/cobros/nuevo/page.tsx` — registrar cobro de cuota
- `src/app/(dashboard)/cajas/page.tsx` — vista de cajas: saldo, cobros del día, total

### Prompt completo para el agente

Sos un agente de UI. Creás las páginas de cobros y cajas.

**Página `/cobros` (historial del día):**
- Selector de fecha (default: hoy)
- Selector de caja/sucursal
- Tabla: hora, cliente, crédito, cuota nro, capital, interés, total, medio de pago
- Total del día al pie

**Página `/cobros/nuevo`:**
- Puede llegar con query params `credito_id` y `cuota_id` (desde el detalle del crédito)
- O búsqueda manual de cliente → seleccionar crédito activo → seleccionar cuota
- Muestra detalle de la cuota: monto, fecha vencimiento, capital, interés
- Selector de caja (de la sucursal del usuario)
- Selector de medio de pago (por ahora solo "Efectivo")
- Confirmación: monto a cobrar (no editable — igual al total de la cuota)
- Submit: POST a `/api/fin/cobros`

**Página `/cajas`:**
- Cards por caja/sucursal: nombre, estado (abierta/cerrada), saldo actual, total cobrado hoy
- Lista de cobros del día por caja seleccionada

**Criterio de éxito:** Desde el detalle de un crédito, hacer click en "Registrar cobro" en una cuota lleva a `/cobros/nuevo?credito_id=X&cuota_id=Y` con los datos pre-cargados.

---

## Ola 5 — Vistas de auditoría e integración final
> Ejecutar solo después de que OLA 4 esté completa
> Ejecutar 5A + 5B en PARALELO

---

## Agente 5A — Libro diario y asientos

**Puede ejecutarse en paralelo con:** 5B
**Depende de:** 3D (API asientos), 4A (layout)

### Objetivo
Crear la vista de libro diario (solo lectura) y el detalle de asiento contable.

### Archivos a crear
- `src/app/(dashboard)/asientos/page.tsx` — libro diario con filtros
- `src/app/(dashboard)/asientos/[id]/page.tsx` — detalle del asiento con líneas

### Prompt completo para el agente

Sos un agente de UI. Creás el libro diario, que es una vista de solo lectura de los asientos auto-generados.

**Página `/asientos` (libro diario):**
- Filtros: período (mes/año), origen (credito_otorgado|cobro_cuota), sucursal
- Tabla: fecha, número, origen, documento origen (link al crédito o cobro), total debe/haber, estado
- Badge de balance (debe === haber → verde, sino → rojo alarma)
- Paginación

**Página `/asientos/[id]` (detalle):**
- Header: origen, fecha, documento de origen con link
- Tabla de líneas: cuenta (código + nombre), debe, haber
- Totales: suma debe y suma haber (deben ser iguales)
- Badge "Balanceado" en verde
- Link de vuelta al documento origen (crédito o cobro)

**Criterio de éxito:** No hay botón de crear/editar asiento en ninguna parte de estas páginas. El sistema solo muestra asientos existentes.

---

## Agente 5B — Plan de cuentas admin y seed inicial

**Puede ejecutarse en paralelo con:** 5A
**Depende de:** 3D (API plan de cuentas), 4A (layout)

### Objetivo
Crear la página de administración del plan de cuentas y el script de seed con las cuentas mínimas para financiación al consumo.

### Archivos a crear
- `src/app/(dashboard)/plan-cuentas/page.tsx` — vista de rubros y cuentas (solo admin)
- `src/app/(dashboard)/plan-cuentas/config/page.tsx` — configurar cuentas del plugin financiacion_consumo
- `scripts/seed-plan-cuentas.ts` — script de seed inicial

### Prompt completo para el agente

Sos un agente de UI y scripts. Creás la administración del plan de cuentas y el seed inicial.

**Seed inicial `scripts/seed-plan-cuentas.ts`:**
Crear los rubros y cuentas mínimas para que el motor de asientos funcione:

```
RUBROS:
1. Activo (naturaleza: activo)
2. Pasivo (naturaleza: pasivo)
3. Patrimonio Neto (naturaleza: patrimonio_neto)
4. Resultados Positivos (naturaleza: resultado_positivo)
5. Resultados Negativos (naturaleza: resultado_negativo)

CUENTAS (imputable: true):
1.1.01 — Caja General (activo, requiere_caja: true, requiere_sucursal: true)
1.1.02 — Créditos por Financiaciones (activo)
1.1.03 — Intereses No Devengados (activo, cuenta reguladora/contra)
4.1.01 — Ventas Financiadas (resultado_positivo)
4.1.02 — Intereses Ganados (resultado_positivo)
```

**Configuración del plugin en Firestore:**
```
fin_config_cuentas/financiacion_consumo:
  creditos_por_financiaciones: "cuenta_id_de_1.1.02"
  intereses_no_devengados: "cuenta_id_de_1.1.03"
  ventas_financiadas: "cuenta_id_de_4.1.01"
  intereses_ganados: "cuenta_id_de_4.1.02"
  # caja: dinámica — se resuelve por caja_id en runtime
```

**Página `/plan-cuentas`:**
- Lista de rubros con sus cuentas anidadas
- Badge de naturaleza por rubro
- Por cada cuenta: código, nombre, si es imputable, estado activa/inactiva

**Página `/plan-cuentas/config`:**
- Muestra la configuración actual del plugin `financiacion_consumo`
- Selector para cada cuenta (dropdown con todas las cuentas imputables)
- Submit: PUT a `/api/fin/plan-cuentas/config/financiacion_consumo`

**Criterio de éxito:** El script seed es ejecutable con `npx ts-node scripts/seed-plan-cuentas.ts`. La página de config permite mapear las cuentas del motor de asientos.

---

## Verificación final

Checklist para confirmar que el sistema funciona de punta a punta:

- [ ] Login con usuario de Don Cándido IA funciona en la nueva app (mismo Firebase Auth)
- [ ] Al crear un cliente con CUIT, no aparece en Don Cándido (colecciones separadas)
- [ ] Consulta Nosis retorna datos (mock en dev con `NOSIS_SANDBOX=true`)
- [ ] Crear crédito con sistema francés: la tabla de amortización tiene `sum(capital) === capital_original`
- [ ] Crear crédito con sistema alemán: todas las cuotas tienen el mismo capital
- [ ] Al confirmar el crédito: se crea en Firestore + todas las cuotas + asiento de otorgamiento balanceado
- [ ] Asiento de otorgamiento: `sum(debe) === sum(haber)` (capital + intereses)
- [ ] Registrar cobro de cuota: se marca como pagada + se actualiza saldo de caja + se genera asiento de cobro
- [ ] Asiento de cobro: `sum(debe) === sum(haber)`
- [ ] Cliente con 2 créditos activos: el resumen muestra ambos con su saldo
- [ ] No existe ningún botón/form para crear asientos manualmente en toda la app
- [ ] Libro diario: muestra asientos del mes filtrados, no editables
- [ ] Al pagar la última cuota: crédito pasa a estado `cancelado` automáticamente

---

## Notas para implementación

1. **Copiar template primero:** Antes de ejecutar cualquier agente, copiar `proyecto-base-copia` al directorio destino con el nombre del proyecto.
2. **Mismo Firebase project:** Copiar las variables de entorno del proyecto Don Cándido (mismo `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
3. **Seed de plan de cuentas:** Ejecutar el script de seed (Agente 5B) antes de probar cobros, ya que el motor de asientos necesita los IDs de cuentas configurados.
4. **Nosis sandbox:** Dejar `NOSIS_SANDBOX=true` en dev para no consumir créditos reales de la API.
5. **Independencia de Don Cándido:** Este proyecto no importa ni depende de ningún archivo de Don Cándido. Solo comparte el Firebase project (mismas credenciales).
