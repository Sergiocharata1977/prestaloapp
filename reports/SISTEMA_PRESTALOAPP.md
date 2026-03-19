# PrestaloApp — Sistema de Financiación al Consumo
> Última actualización: 2026-03-19 | OLA 9 completada | Vercel desplegado

---

## ¿Qué es?

PrestaloApp es una plataforma SaaS de **gestión de carteras de crédito al consumo y descuento de cheques**. Está diseñada para entidades financieras, financieras de consumo y prestamistas que necesitan originar préstamos, hacer el seguimiento de cobranzas, gestionar operaciones de cheques y llevar la contabilidad automatizada.

Comparte el mismo proyecto Firebase con 9001app-firebase (prefijo `fin_` en Firestore) pero corre como aplicación Next.js separada.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | **Next.js 16.1.6 + React 19.2.3** |
| Lenguaje | **TypeScript 5 strict** |
| Backend/DB | **Firebase 12.10 (Firestore) + Admin SDK 13.7** |
| UI | **Radix UI + Tailwind CSS v4** |
| Deploy | **Vercel** |
| Repo | **GitHub** |

---

## Módulos del Sistema

### 1. Dashboard
**Ruta:** `/dashboard`

Métricas del día: cobros pendientes, créditos vencidos, cartera activa, cajas.

---

### 2. Gestión de Clientes
**Rutas:** `/clientes` / `/clientes/[id]`

- Alta de personas físicas y jurídicas (CUIT obligatorio)
- Búsqueda fuzzy por nombre/CUIT con debounce
- **Filtro por tipo de cliente** (clasificación interna) con totalizador de cartera
- **Detalle 360°**: créditos, operaciones de cheques, cuenta corriente, evaluación crediticia, Nosis, legajo

**Colección Firestore:** `fin_clientes`

---

### 3. Evaluación Crediticia y Scoring
**Rutas:** `/clientes/[id]/evaluacion` / `/clientes/[id]/evaluacion/historial`

- Modelo de scoring: 14 ítems en 3 categorías (cualitativo 43%, conflictos 31%, cuantitativo 26%)
- Score final 0-10 → Tiers: A (≥8), B (≥6), C (≥4), Reprobado (<4)
- Score Nosis opcional (integración externa)
- Línea de crédito automática: límite mensual y total según tier + política
- Historial con decisiones (aprobar/rechazar) por analista

**Colección Firestore:** `fin_evaluaciones`

---

### 4. Originación de Créditos
**Rutas:** `/creditos` / `/creditos/[id]`

Dos sistemas de amortización: **Francés** (cuota fija) y **Alemán** (capital fijo).

- Tasas por tramos según plan de financiación (ej.: 3 cuotas → 4.5%, 6 → 5.0%)
- Preview de tabla de amortización antes de confirmar
- Snapshot de condiciones al momento del otorgamiento (inmutabilidad)
- **Asiento contable automático** al otorgar (4 líneas balanceadas)
- Numeración secuencial por año (`2026-000001`)
- Validación de línea de crédito disponible

**Colección Firestore:** `fin_creditos`, `fin_cuotas`

---

### 5. Cobranzas
**Ruta:** `/cobros`

- Registra cobro de cuota con caja y medio de pago
- Calcula mora automática (tasa punitoria del snapshot del crédito)
- **Asiento contable automático** al cobrar
- Impresión de recibo desde el cobro

**Colección Firestore:** `fin_cobros`

---

### 6. Descuento de Cheques
**Rutas:** `/operaciones-cheques` / `/operaciones-cheques/[id]`

- Carga de uno o más cheques por operación (banco, CUIT librador, fecha vto., valor)
- Cálculo automático de descuento por días corridos con tasa del plan
- Preview: nominal, días, descuento, gastos fijos/variables, neto a acreditar
- **Asiento contable automático** al liquidar
- Seguimiento Kanban: recibido → en_cartera → depositado → acreditado
- Estados de problema: rechazado, pre_judicial, judicial

**Colección Firestore:** `fin_operaciones_cheques`, `fin_cheques`

---

### 7. Plan de Cuentas
**Ruta:** `/plan-cuentas`

- Árbol jerárquico: Rubros → Cuentas
- Naturaleza: Activo / Pasivo / Patrimonio / Resultados
- Configuración del plugin: mapeo de cuentas para cada tipo de movimiento

**Colecciones Firestore:** `fin_rubros`, `fin_cuentas`, `fin_config_cuentas`

---

### 8. Cajas y Sucursales
**Ruta:** `/cajas`

- Multi-sucursal con múltiples cajas por sucursal
- Apertura con monto inicial, cierre con resumen del día

**Colecciones Firestore:** `fin_sucursales`, `fin_cajas`

---

### 9. Configuración
**Menú desplegable lateral → Configuracion**

| Sub-módulo | Ruta | Descripción |
|------------|------|-------------|
| Tipos de cliente | `/tipos-cliente` | Clasificación interna (Persona A, Empresa B, etc.) |
| Políticas crediticias | `/politicas-crediticias` | Condiciones por segmento (requiere legajo, evaluación, etc.) |
| Planes de financiación | `/planes-financiacion` | Tasas por tramos + tasa punitoria + cargos |

---

### 10. Contabilidad (solo lectura / automática)

> **Decisión de diseño:** No hay asientos manuales ni páginas de libro diario/mayor en el sistema. Todos los asientos son generados automáticamente por los formularios operativos.

| Operación | Asiento generado |
|-----------|-----------------|
| Otorgar crédito | 4 líneas: Créditos / Intereses no devengados / Ventas financiadas |
| Cobrar cuota | 4 líneas: Caja / Créditos / Intereses ganados / devengamiento |
| Liquidar operación de cheque | Cheques en cartera / Caja / Ingresos por descuento |

Los asientos están disponibles en Firestore (`fin_asientos`) para auditoría externa.

---

### 11. Reportes
**Ruta:** `/reportes`

- Cartera activa (créditos vigentes, capital pendiente, próximos vencimientos)
- Líneas consumidas (% de uso del cupo mensual/total por cliente)
- Cartera de cheques (estado, banco, fecha vto.)
- Cheques rechazados (gastos, estado judicial)
- Cobros del período (capital, interés, mora)

---

### 12. Manual de Sistemas
**Ruta:** `/manual`

Guía funcional y operativa integrada en el sistema. Expandible por módulo.

---

## Arquitectura de Tipos

`src/types/fin-*.ts`

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

`src/services/`

| Servicio | Responsabilidad |
|----------|----------------|
| `AmortizationService` | Tabla amortización Francés/Alemán |
| `ClienteService` | CRUD + búsqueda fuzzy + filtro por tipo |
| `CreditoService` | Originación + ciclo de vida + mora |
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
NEXT_PUBLIC_FIREBASE_*         # Client SDK
NOSIS_API_KEY                  # Buró crediticio
NOSIS_SANDBOX                  # true = sandbox desarrollo
```

---

## Estado del Proyecto

| Ola | Contenido | Estado |
|-----|-----------|--------|
| 0 | Setup, Firebase, Auth | ✅ |
| 1 | Tipos cliente, políticas, planes con tramos de tasa | ✅ |
| 2 | Clientes CRUD + scoring configurable + Nosis ampliado | ✅ |
| 3 | Créditos + amortización + cuotas + snapshots | ✅ |
| 4 | Cobranzas + asientos automáticos | ✅ |
| 5 | Plan de cuentas + sucursales/cajas + Nosis | ✅ |
| 6 | Legajo + líneas de crédito | ✅ |
| 7 | Cheques: operaciones, Kanban, descuento | ✅ |
| 8 | Impresión: contratos, recibos, liquidaciones cheques | ✅ |
| 9 | Sidebar limpio + filtro tipo-cliente + detalle 360° | ✅ |

**Último commit:** `1bb8e0a`
**Reporte de OLAs:** `reports/55_PLAN_GESTION_CREDITOS_PERSONAS_EMPRESAS_CHEQUES_2026-03-18.md`
