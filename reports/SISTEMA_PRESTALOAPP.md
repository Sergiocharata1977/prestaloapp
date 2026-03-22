# PrestaloApp — Documentación de Sistema para IA
> Última actualización: 2026-03-22 | OLA 9 completada + Bandejas mora/judiciales
> **Este documento es la fuente de verdad para cualquier IA que trabaje en este proyecto.**

---

## Instrucciones para IA que lean este documento

- Antes de proponer cualquier cambio, leer este documento completo.
- No crear módulos, rutas ni colecciones Firestore que no estén aquí definidos o planificados.
- El prefijo `fin_` es OBLIGATORIO en todas las colecciones Firestore de este proyecto.
- No usar React Query, SWR ni Redux. Solo `useState + useEffect + fetch()` o server components.
- No hay asientos contables manuales. Todo se genera automáticamente desde los formularios operativos.
- El sistema es SaaS multi-tenant: siempre filtrar por `organizationId` en Firestore.
- Leer los planes de ola (carpeta `reports/`) antes de implementar nuevas funcionalidades.
- Nunca romper el build de Vercel. Verificar con `npm run build` antes de proponer commits.

---

## ¿Qué es PrestaloApp?

**PrestaloApp** es una plataforma SaaS de **gestión de carteras de crédito al consumo y descuento de cheques**.

Está diseñada para:
- Entidades financieras, financieras de consumo y prestamistas individuales
- Que necesitan originar préstamos, cobrar cuotas, gestionar cheques descontados y llevar contabilidad automatizada

**Comparte el mismo proyecto Firebase** con `9001app-firebase` (prefijo `fin_` en Firestore) pero corre como **aplicación Next.js independiente** en Vercel.

---

## Stack Tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Framework | Next.js 15 (App Router) | NO Pages Router |
| Lenguaje | TypeScript 5 strict | Sin `any` |
| Base de datos | Firebase Firestore (Client + Admin SDK) | Prefijo `fin_` en colecciones |
| UI | Radix UI + Tailwind CSS v4 | `@import 'tailwindcss'` |
| Deploy | Vercel | Env vars en Vercel dashboard |
| Repo | GitHub | Branch `main` = producción |
| Íconos | lucide-react | |
| Fechas | date-fns v4 | `import { es } from 'date-fns/locale'` |
| Validación | Zod | En API routes |

---

## Estructura del Proyecto

```
prestaloapp/
├── src/
│   ├── app/
│   │   ├── (auth)/login/           # Login
│   │   ├── (dashboard)/            # App principal (requiere auth)
│   │   ├── (print)/print/          # Páginas de impresión (sin nav)
│   │   ├── (super-admin)/          # Portal SuperAdmin
│   │   └── page.tsx                # Landing pública
│   ├── components/
│   │   ├── ui/                     # Primitivos Radix/shadcn
│   │   └── fin-*/                  # Componentes del dominio financiero
│   ├── services/                   # Lógica de negocio (ver lista abajo)
│   ├── types/fin-*.ts              # Tipos TypeScript del dominio
│   └── lib/
│       ├── firebase/               # Cliente y Admin SDK
│       └── fin/                    # Utilidades financieras (planUtils, etc.)
├── reports/                        # Documentación y planes de ola
└── test/                           # Tests
```

---

## Reglas de Renderización (OBLIGATORIAS)

| Situación | Directiva |
|-----------|-----------|
| Usa hooks, eventos, Firebase Client SDK | `'use client'` obligatorio |
| Solo lee datos server-side | Server Component (sin directiva) |
| Admin SDK (firebase-admin) | SOLO en API routes (`/api/`) |
| Client SDK | SOLO en `'use client'` components |
| API routes | `export const dynamic = 'force-dynamic'` al tope |

---

## Patrones de Código

### API Routes
```typescript
export const dynamic = 'force-dynamic'
// Validación con Zod
// Sin tipos `any`
// Filtrar siempre por organizationId
```

### Páginas Dashboard
```typescript
'use client'
// useState + useEffect + fetch() directo
// No React Query / SWR
```

### Importación de fechas
```typescript
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
```

---

## Colecciones Firestore (prefijo `fin_` SIEMPRE)

| Colección | Descripción |
|-----------|-------------|
| `fin_clientes` | Clientes (física y jurídica) |
| `fin_creditos` | Créditos otorgados |
| `fin_cuotas` | Cuotas de cada crédito |
| `fin_cobros` | Registros de pago de cuotas |
| `fin_asientos` | Asientos contables (solo lectura/auditoría) |
| `fin_operaciones_cheques` | Operaciones de descuento de cheques |
| `fin_cheques` | Cheques individuales por operación |
| `fin_evaluaciones` | Evaluaciones crediticias y scoring |
| `fin_lineas_credito` | Líneas de crédito por cliente |
| `fin_planes_financiacion` | Planes con tasas y tramos |
| `fin_politicas_crediticias` | Políticas por segmento |
| `fin_tipos_cliente` | Clasificación interna de clientes |
| `fin_rubros` | Rubros del plan de cuentas |
| `fin_cuentas` | Cuentas del plan de cuentas |
| `fin_config_cuentas` | Mapeo contable por tipo de movimiento |
| `fin_sucursales` | Sucursales de la organización |
| `fin_cajas` | Cajas por sucursal |

---

## Módulos del Sistema

### 1. Dashboard
**Ruta:** `/dashboard`
KPIs del día: cobros pendientes, créditos vencidos, cartera activa, cajas.
**API:** `/api/fin/dashboard`

---

### 2. Gestión de Clientes
**Rutas:** `/clientes` · `/clientes/nuevo` · `/clientes/[id]`

- Alta de personas físicas y jurídicas (CUIT obligatorio)
- Búsqueda fuzzy por nombre/CUIT con debounce
- Filtro por tipo de cliente con totalizador de cartera
- **Detalle 360°**: créditos, operaciones de cheques, cuenta corriente, evaluación crediticia, Nosis, legajo
- Seed de datos ficticios accesible desde `/clientes`

**Sub-rutas del detalle:**
- `/clientes/[id]/evaluacion` — scoring + línea de crédito
- `/clientes/[id]/evaluacion/historial` — historial de evaluaciones
- `/clientes/[id]/cuenta-corriente` — movimientos del cliente

**Colección Firestore:** `fin_clientes`

---

### 3. Evaluación Crediticia y Scoring
**Rutas:** `/clientes/[id]/evaluacion` · `/clientes/[id]/evaluacion/historial`

- Modelo de scoring: **14 ítems en 3 categorías**
  - Cualitativo: 43%
  - Conflictos: 31%
  - Cuantitativo: 26%
- Score final 0-10 → Tiers: A (≥8), B (≥6), C (≥4), Reprobado (<4)
- Score Nosis opcional (integración externa)
- Línea de crédito automática: límite mensual y total según tier + política
- Historial con decisiones (aprobar/rechazar) por analista

**Servicio:** `ScoringService`, `LineaCreditoService`, `NosisService`
**Colección Firestore:** `fin_evaluaciones`, `fin_lineas_credito`

---

### 4. Originación de Créditos
**Rutas:** `/creditos` · `/creditos/nuevo` · `/creditos/[id]`

- Dos sistemas de amortización: **Francés** (cuota fija) y **Alemán** (capital fijo)
- Tasas por tramos según plan de financiación (ej.: 3 cuotas → 4.5%, 6 → 5.0%)
- Preview de tabla de amortización antes de confirmar
- **Snapshot** de condiciones al momento del otorgamiento (inmutabilidad garantizada)
- **Asiento contable automático** al otorgar (4 líneas balanceadas)
- Numeración secuencial por año: `2026-000001`
- Validación de línea de crédito disponible

**Impresión:** `/print/credito/[id]` — contrato de crédito
**Servicio:** `CreditoService`, `AmortizationService`
**Colecciones Firestore:** `fin_creditos`, `fin_cuotas`

---

### 5. Cobranzas
**Ruta:** `/cobros` · `/cobros/nuevo`

- Registra cobro de cuota con caja y medio de pago
- Calcula mora automática (tasa punitoria del snapshot del crédito)
- **Asiento contable automático** al cobrar
- Impresión de recibo desde el cobro

**Impresión:** `/print/cobro/[id]`
**Servicio:** `CobroService`
**Colección Firestore:** `fin_cobros`

---

### 6. Bandejas de Mora y Judiciales
**Rutas:** `/acciones/mora-temprana` · `/acciones/judiciales`

- **Mora temprana**: créditos con cuotas vencidas recientes (gestión preventiva)
- **Judiciales**: operaciones (cheques y créditos) en estado judicial
- Acciones directas desde la bandeja: registro de gestión, avance de estado

---

### 7. Descuento de Cheques
**Rutas:** `/operaciones-cheques` · `/operaciones-cheques/nueva` · `/operaciones-cheques/[id]`
**Kanban:** `/cheques/kanban` · **Detalle cheque:** `/cheques/[id]`

- Carga de uno o más cheques por operación (banco, CUIT librador, fecha vto., valor)
- Cálculo automático de descuento por días corridos con tasa del plan
- Preview: nominal, días, descuento, gastos fijos/variables, neto a acreditar
- **Asiento contable automático** al liquidar
- Seguimiento Kanban: `recibido → en_cartera → depositado → acreditado`
- Estados de problema: `rechazado`, `pre_judicial`, `judicial`

**Impresión:** `/print/cheque/[id]`
**Servicio:** `OperacionChequeService`
**Colecciones Firestore:** `fin_operaciones_cheques`, `fin_cheques`

---

### 8. Plan de Cuentas
**Rutas:** `/plan-cuentas` · `/plan-cuentas/configurar`

- Árbol jerárquico: Rubros → Cuentas
- Naturaleza: Activo / Pasivo / Patrimonio / Resultados
- **Configuración del plugin contable**: mapeo de cuentas para cada tipo de movimiento
- El plan de cuentas es inicializable con cuentas predeterminadas

**Servicio:** `PlanCuentasService`
**Colecciones Firestore:** `fin_rubros`, `fin_cuentas`, `fin_config_cuentas`

---

### 9. Cajas y Sucursales
**Rutas:** `/cajas` · `/cajas/nuevo` · `/cajas/[id]`

- Multi-sucursal con múltiples cajas por sucursal
- Apertura con monto inicial, cierre con resumen del día

**Colecciones Firestore:** `fin_sucursales`, `fin_cajas`

---

### 10. Configuración
**Menú desplegable lateral → Configuracion**

| Sub-módulo | Ruta | Descripción |
|------------|------|-------------|
| Tipos de cliente | `/tipos-cliente` | Clasificación interna (Persona A, Empresa B, etc.) |
| Políticas crediticias | `/politicas-crediticias` | Condiciones por segmento (requiere legajo, evaluación, etc.) |
| Planes de financiación | `/planes-financiacion` | Tasas por tramos + tasa punitoria + cargos |
| Usuarios | `/usuarios` | Usuarios de la organización actual |

---

### 11. Contabilidad (automática, sin UI editable)

> **Decisión de diseño firme:** No hay asientos manuales ni páginas de libro diario/mayor. Los registros existen en Firestore para auditoría pero no se exponen en la UI.

| Operación | Asiento generado | Servicio |
|-----------|-----------------|----------|
| Otorgar crédito | 4 líneas: Créditos / Intereses no devengados / Ventas financiadas | `CreditoService.buildAsientoOtorgamiento()` |
| Cobrar cuota | 4 líneas: Caja / Créditos / Intereses ganados / devengamiento | `CobroService → JournalEntryService` |
| Liquidar operación de cheque | Cheques en cartera / Caja / Ingresos por descuento | `OperacionChequeService → JournalEntryService` |

**Colección Firestore:** `fin_asientos`

---

### 12. Reportes
**Ruta:** `/reportes`

- Cartera activa (créditos vigentes, capital pendiente, próximos vencimientos) — **con totales**
- Líneas consumidas (% de uso del cupo mensual/total por cliente)
- Cartera de cheques (estado, banco, fecha vto.)
- Cheques rechazados (gastos, estado judicial)
- Cobros del período (capital, interés, mora)

---

### 13. Manual de Sistemas
**Ruta:** `/manual`

Guía funcional y operativa integrada al sistema. Layout 3 columnas. Expandible por módulo.

---

### 14. Super Admin Portal
**Rutas:** `/super-admin` · `/super-admin/organizaciones` · `/super-admin/usuarios` · `/super-admin/demo-requests`

Portal separado para administración de la plataforma (multi-tenant):
- CRUD de organizaciones
- CRUD de usuarios globales
- Gestión de solicitudes de demo

**Layout:** `(super-admin)/layout.tsx` — completamente separado del dashboard

---

### 15. Control de Terminales
**Rutas:** `/terminales` · `/terminales/[id]` · `/terminales/politicas`

Sistema de control de dispositivos (terminales POS). Ver `reports/` para documentación detallada.

---

## Arquitectura de Tipos

**Ubicación:** `src/types/fin-*.ts`

| Archivo | Entidad |
|---------|---------|
| `fin-cliente.ts` | Cliente (física/jurídica), Nosis, legajo |
| `fin-credito.ts` | Crédito, snapshots (política, plan, tipo_cliente) |
| `fin-cuota.ts` | Cuota, estado calculado |
| `fin-cobro.ts` | Cobro, medio de pago |
| `fin-asiento.ts` | Asiento contable, líneas debe/haber |
| `fin-operacion-cheque.ts` | Operación, resumen, base contable |
| `fin-cheque.ts` | Cheque individual, eventos de estado |
| `fin-evaluacion.ts` | Evaluación crediticia, scoring, tiers |
| `fin-linea-credito.ts` | Línea de crédito, disponible, vigencia |
| `fin-plan-financiacion.ts` | Plan, tramos de tasa |
| `fin-politica-crediticia.ts` | Política, tiers por política |
| `fin-tipo-cliente.ts` | Clasificación interna |
| `fin-plan-cuentas.ts` | Rubro, cuenta, naturaleza, config plugin |
| `fin-sucursal.ts` | Sucursal, caja |

---

## Servicios

**Ubicación:** `src/services/`

| Servicio | Responsabilidad |
|----------|----------------|
| `AmortizationService` | Tabla amortización Francés/Alemán |
| `ClienteService` | CRUD + búsqueda fuzzy + filtro por tipo |
| `CreditoService` | Originación + ciclo de vida + mora + asiento otorgamiento |
| `CobroService` | Registro de pagos + asiento contable |
| `JournalEntryService` | Generación de asientos (cobro, cheque) |
| `OperacionChequeService` | Flujo completo de descuento de cheques |
| `LineaCreditoService` | Cálculo de cupo disponible |
| `ScoringService` | Score ponderado 14 ítems + tiers |
| `NosisService` | Consulta buró externo (sandbox / producción) |
| `PlanCuentasService` | Plan de cuentas + config plugin |
| `LegajoService` | Documentos y checklist por cliente |
| `PlanFinanciacionService` | Tasas, tramos, cargos |
| `PoliticaCrediticiaService` | Reglas de otorgamiento por segmento |
| `TipoClienteService` | Clasificación interna de clientes |

---

## Variables de Entorno

```bash
FIREBASE_PROJECT_ID            # Compartido con 9001app-firebase
FIREBASE_CLIENT_EMAIL          # Admin SDK
FIREBASE_PRIVATE_KEY           # Admin SDK
NEXT_PUBLIC_FIREBASE_*         # Client SDK (apiKey, authDomain, etc.)
NOSIS_API_KEY                  # Buró crediticio
NOSIS_SANDBOX                  # "true" = sandbox desarrollo
```

---

## Estado del Proyecto — Olas Completadas

| Ola | Contenido | Estado |
|-----|-----------|--------|
| 0 | Setup, Firebase, Auth, Shell | ✅ main |
| 1 | Tipos cliente, políticas, planes con tramos de tasa | ✅ main |
| 2 | Clientes CRUD + scoring configurable + Nosis ampliado | ✅ main |
| 3 | Créditos + amortización + cuotas + snapshots | ✅ main |
| 4 | Cobranzas + asientos automáticos | ✅ main |
| 5 | Plan de cuentas + sucursales/cajas + Nosis | ✅ main |
| 6 | Legajo + líneas de crédito | ✅ main |
| 7 | Cheques: operaciones, Kanban, descuento | ✅ main |
| 8 | Impresión: contratos, recibos, liquidaciones cheques | ✅ main |
| 9 | Sidebar limpio + filtro tipo-cliente + detalle 360° + contabilidad automática | ✅ main |
| Post-9 | Bandejas mora temprana y judiciales + totales cartera en reportes + landing actualizada | ✅ main |

**Último commit relevante:** `2e5d82c — feat(cobranzas): agregar bandejas de mora y judiciales`

---

## Próximos módulos planificados (no implementados)

Ver archivos individuales en `reports/` para detalles de diseño:

| # | Report | Descripción |
|---|--------|-------------|
| 57 | `57_ANALISIS_MODELO_COMERCIOS_5_ANOS_*` | Módulo de planeamiento financiero y rentabilidad por comercio/canal |
| 58 | `58_ANALISIS_VERIFICACION_IDENTIDAD_WHATSAPP_*` | Verificación de identidad vía WhatsApp |
| 59 | `59_DISENO_TECNICO_AUTORIZACION_WHATSAPP_*` | Autorización de operaciones vía WhatsApp |
| 60 | `60_SISTEMA_PLUGINS_EXTENSIONES_*` | Sistema de plugins/extensiones (inspirado en capabilities de 9001app) |

---

## Relación con 9001app-firebase

| Aspecto | prestaloapp | 9001app-firebase |
|---------|-------------|-----------------|
| Firebase project | **compartido** | **compartido** |
| Prefijo Firestore | `fin_` | sin prefijo o `org_` |
| Propósito | Financiación al consumo / créditos | Gestión ISO 9001 / procesos |
| URL producción | Vercel (dominio propio) | Vercel (dominio propio) |
| Multi-tenant | Sí (`organizationId`) | Sí (`organizationId`) |

---

## Reports pendientes de implementación

> Los reports de olas ya completadas (0–9) fueron eliminados. Solo se conservan los módulos aún no implementados.

| # | Archivo | Contenido | Estado |
|---|---------|-----------|--------|
| 57 | `57_ANALISIS_MODELO_COMERCIOS_5_ANOS_PARA_PRESTALOAPP_2026-03-19.md` | Módulo de planeamiento financiero y rentabilidad por comercio/canal | Pendiente |
| 58 | `58_ANALISIS_VERIFICACION_IDENTIDAD_WHATSAPP_PRESTALOAPP_2026-03-19.md` | Verificación de identidad vía WhatsApp | Pendiente |
| 59 | `59_DISENO_TECNICO_AUTORIZACION_WHATSAPP_PRESTALOAPP_2026-03-19.md` | Diseño técnico: autorización de operaciones vía WhatsApp | Pendiente |
| 60 | `60_SISTEMA_PLUGINS_EXTENSIONES_PRESTALOAPP_2026-03-19.md` | Sistema de plugins/extensiones multi-tenant | Pendiente |
| 61 | `61_PLAN_PROYECCION_COBRANZAS_2026-03-22.md` | OLA 10 — Proyección de cobranzas / flujo de fondos esperado (tabla matriz mensual) | Pendiente |
