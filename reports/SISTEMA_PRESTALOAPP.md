# PrestaloApp — Sistema de Financiación al Consumo
> Fecha: 2026-03-16 | Proyecto: prestaloapp | Estado: Olas 0-5 completadas, Vercel desplegado

## ¿Qué es?

PrestaloApp es una plataforma SaaS de **gestión de carteras de crédito al consumo**. Está diseñada para entidades financieras, financieras de consumo y prestamistas que necesitan originar préstamos, hacer el seguimiento de cobranzas y llevar la contabilidad automatizada de su cartera.

Es un proyecto independiente que comparte el mismo proyecto Firebase con 9001app-firebase (prefijo `fin_` en Firestore) pero corre como aplicación Next.js separada.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | **Next.js 16.1.6 + React 19.2.3** |
| Lenguaje | **TypeScript 5 strict** |
| Backend/DB | **Firebase 12.10 (Firestore) + Admin SDK 13.7** |
| UI | **Radix UI + Tailwind CSS v4** |
| Animaciones | **Framer Motion** |
| Formularios | **React Hook Form + Zod v4** |
| Notificaciones | **Sonner (toasts)** |
| Analytics | **PostHog** |
| Error tracking | **Sentry** |
| Emails | **Resend** |
| Tours | **Driver.js** |
| Tests unitarios | **Jest + React Testing Library** |
| Tests E2E | **Playwright** |
| Deploy | **Vercel** |
| CI | **GitHub Actions** |

---

## Módulos del Sistema

### 1. Dashboard Principal
**Ruta:** `/`

Métricas operativas en tiempo real:
- Total clientes activos
- Créditos activos
- Cartera total (capital pendiente)
- Cobranzas del día (cantidad + monto)

**API:** `GET /api/fin/dashboard`

---

### 2. Gestión de Clientes
**Rutas:** `/clientes` / `/clientes/nuevo` / `/clientes/[id]`

- Alta de personas físicas y jurídicas (CUIT obligatorio)
- Búsqueda fuzzy por nombre/CUIT con debounce
- Detección automática de duplicados
- Vista de cliente: créditos activos, historial de pagos, **cuenta corriente**
- Consulta al **buró Nosis** desde el perfil del cliente

**Colección Firestore:** `fin_clientes`

---

### 3. Originación de Créditos
**Rutas:** `/creditos` / `/creditos/nuevo` / `/creditos/[id]`

Dos sistemas de amortización:
- **Sistema Francés** — cuota fija, interés decreciente (annuité)
- **Sistema Alemán** — capital fijo, cuota decreciente

Flujo de creación (2 pasos):
1. Selección de sucursal + cliente
2. Ingreso de capital / tasa / plazo + **preview de tabla de amortización antes de confirmar**

Al confirmar:
- Se generan automáticamente todas las **cuotas** (fin_cuotas)
- Se genera el **asiento contable de otorgamiento** (fin_asientos)
- Se asigna número de crédito único

**API key:** `GET /api/fin/creditos/preview` — previsualiza tabla sin guardar

**Colección Firestore:** `fin_creditos`

---

### 4. Gestión de Cuotas (Installments)
Generadas automáticamente al crear el crédito.

Cada cuota contiene:
- Número de cuota y fecha de vencimiento
- Desglose capital + interés
- Saldo de capital (capital restante)
- Estado: `pendiente` / `pagada` / `vencida` (calculado por fecha)

**Colección Firestore:** `fin_cuotas`

---

### 5. Registro de Cobranzas
**Rutas:** `/cobros` / `/cobros/nuevo`

- Registra el pago de una cuota específica
- Medio de pago: `efectivo` (extensible a cheque, transferencia)
- Al registrar:
  - Marca la cuota como pagada
  - Actualiza el estado del crédito si corresponde
  - Genera el **asiento contable de cobro** automáticamente
- Anulación de pagos con trazabilidad

**Colección Firestore:** `fin_cobros`

---

### 6. Contabilidad — Libro Diario y Mayor
**Rutas:** `/asientos` / `/asientos/[id]` / `/asientos/mayor`

**Asientos automáticos generados por el sistema:**

*Al otorgar crédito (4 líneas):*
- Débito: Créditos por Financiaciones (activo ↑)
- Débito: Intereses no Devengados (pasivo ↑)
- Crédito: Ventas Financiadas (ingreso ↑)
- Crédito: Intereses no Devengados (pasivo diferido ↑)

*Al registrar cobro (4 líneas):*
- Débito: Caja (activo ↑)
- Débito: Intereses no Devengados (amortización)
- Crédito: Créditos (activo ↓)
- Crédito: Intereses Ganados (ingreso devengado)

**Libro Mayor:** resumen por cuenta con saldo progresivo.

**Colección Firestore:** `fin_asientos`

---

### 7. Plan de Cuentas
**Rutas:** `/plan-cuentas` / `/plan-cuentas/configurar`

- Estructura jerárquica: Rubros → Cuentas
- Naturaleza: Activo / Pasivo / Patrimonio / Resultados
- Configuración del plugin: qué cuenta contable usar para cada tipo de movimiento
- Permite adaptar el plan de cuentas a cada organización

**Colecciones Firestore:** `fin_rubros`, `fin_cuentas`, `fin_config_cuentas`

---

### 8. Sucursales y Cajas
**Ruta:** `/cajas`

- Multi-sucursal: cada organización puede tener múltiples sucursales
- Cada sucursal tiene una o más cajas registradoras
- Las cajas tienen cuenta contable asociada y tracking de saldo
- Los cobros se asignan a una caja específica

**Colecciones Firestore:** `fin_sucursales`, `fin_sucursales/{id}/fin_cajas`

---

### 9. Integración Nosis (Buró Crediticio)
**Servicio:** `NosisService`

- Consulta el buró Nosis/BCRA por CUIT
- Retorna: score crediticio (300-850), situación BCRA, cheques rechazados, juicios activos
- Modo sandbox para desarrollo (`NOSIS_SANDBOX=true`)
- Resultado cacheado en el perfil del cliente
- Timeout: 15 segundos

---

## Estructura de Tipos (TypeScript)
`src/types/fin-*.ts`

| Archivo | Entidad |
|---------|---------|
| `fin-cliente.ts` | Cliente (física/jurídica), resultado Nosis |
| `fin-credito.ts` | Crédito, estado, sistema de amortización |
| `fin-cuota.ts` | Cuota individual, estado de pago |
| `fin-cobro.ts` | Registro de pago, medio de pago |
| `fin-asiento.ts` | Asiento contable, líneas debe/haber, origen |
| `fin-plan-cuentas.ts` | Rubro, cuenta, naturaleza, config plugin |
| `fin-sucursal.ts` | Sucursal, caja, estado de caja |

---

## Servicios
`src/services/`

| Servicio | Responsabilidad |
|----------|----------------|
| `AmortizationService` | Cálculo tabla amortización (Francés/Alemán) |
| `ClienteService` | CRUD clientes + búsqueda fuzzy |
| `CreditoService` | Originación + ciclo de vida del crédito |
| `CobroService` | Registro de pagos + anulación |
| `JournalEntryService` | Generación automática de asientos contables |
| `PlanCuentasService` | Gestión del plan de cuentas + configuración |
| `NosisService` | Consulta al buró crediticio |

---

## API Routes (19 endpoints)
`src/app/api/fin/`

Todos los endpoints están protegidos con `withAuth()` y el scoping de organización.

| Endpoint | Métodos |
|----------|---------|
| `/api/fin/dashboard` | GET |
| `/api/fin/clientes` | GET, POST |
| `/api/fin/clientes/[id]` | GET, PUT |
| `/api/fin/clientes/[id]/nosis` | GET |
| `/api/fin/clientes/[id]/cuenta-corriente` | GET |
| `/api/fin/creditos` | GET, POST |
| `/api/fin/creditos/preview` | GET |
| `/api/fin/creditos/[id]` | GET, PUT |
| `/api/fin/creditos/[id]/cuotas` | GET |
| `/api/fin/cobros` | GET, POST |
| `/api/fin/cobros/[id]` | GET, DELETE |
| `/api/fin/asientos` | GET, POST |
| `/api/fin/asientos/[id]` | GET |
| `/api/fin/asientos/mayor` | GET |
| `/api/fin/plan-cuentas/rubros` | GET |
| `/api/fin/plan-cuentas/cuentas` | GET |
| `/api/fin/plan-cuentas/config` | GET, POST |
| `/api/fin/sucursales` | GET, POST |
| `/api/fin/sucursales/[id]/cajas` | GET, POST |

---

## Modelo de Multi-Tenancy

Mismo proyecto Firebase que 9001app-firebase:
- Firebase Auth compartida — mismo login para todas las apps del ecosistema
- Todas las colecciones con prefijo `fin_` para namespace
- Cada documento tiene `organization_id` para aislamiento
- `withAuth()` extrae el org del token Firebase y scope todas las queries

---

## Decisiones de Arquitectura Clave

1. **`getAdminFirestore()`** — exportada desde `src/firebase/admin.ts` para acceso server-side
2. **Zod v4** — `z.number()` + `valueAsNumber: true` en `register()` (no usar `z.coerce.number()`)
3. **`apiFetch`** — client-side fetch con Bearer token automático (`src/lib/apiFetch.ts`)
4. **Cuotas generadas al crear el crédito** — no on-demand, están precomputadas
5. **Asientos contables automáticos** — no requieren intervención manual del contador
6. **Plan de cuentas configurable** — cada org mapea sus propias cuentas contables

---

## Variables de Entorno

```bash
FIREBASE_PROJECT_ID            # Compartido con 9001app-firebase
FIREBASE_CLIENT_EMAIL          # Admin SDK
FIREBASE_PRIVATE_KEY           # Admin SDK
NEXT_PUBLIC_FIREBASE_*         # Client SDK
NOSIS_API_KEY                  # Buró crediticio
NOSIS_SANDBOX                  # true = modo sandbox desarrollo
```

---

## Estado del Proyecto (2026-03-16)

| Ola | Contenido | Estado |
|-----|-----------|--------|
| Ola 0 | Setup, Firebase, Auth, shell | ✅ Completada |
| Ola 1 | Tipos + Servicios base | ✅ Completada |
| Ola 2 | Clientes CRUD + API | ✅ Completada |
| Ola 3 | Créditos + Amortización + Cuotas | ✅ Completada |
| Ola 4 | Cobranzas + Contabilidad | ✅ Completada |
| Ola 5 | Plan de Cuentas + Sucursales/Cajas + Nosis | ✅ Completada |
| Build | `tsc 0 errores`, `audit 4/4 OK` | ✅ Verde |
| Deploy | Vercel | ✅ Desplegado |

**Commit de referencia:** `df7f2b5`
**Reporte maestro:** `reports/51_PLAN_OLAS_PRESTALOAPP_FINANCIACION_CONSUMO.md`

---

## Deuda Técnica y Próximos Pasos

| Pendiente | Descripción |
|-----------|-------------|
| Medios de pago | Solo efectivo — agregar cheque, transferencia |
| Nosis producción | Rotar API key real, mejorar manejo de errores |
| Asientos manuales | UI para crear ajuste manual (solo API por ahora) |
| Reporting avanzado | P&L, aging de cartera, mora por segmento |
| Refinanciación | Estado "refinanciado" en modelo pero sin UI/lógica |
| Audit trail completo | Log de anulaciones y correcciones |
