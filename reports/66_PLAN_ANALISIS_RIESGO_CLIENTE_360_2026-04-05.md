# Plan Analisis de Riesgo Cliente 360 — Ejecucion multi-agente

**Fecha:** 2026-04-05
**Feature:** consolidacion y evolucion del analisis de riesgo de clientes con scoring, Nosis, comportamiento de pago, linea de credito y reglas operativas
**Proyectos afectados:** `prestaloapp`

---

## Resumen de olas

| Ola | Agentes | Paralelos entre si | Dependen de |
|-----|---------|--------------------|-------------|
| 1 | A, B, C | Si | Nada |
| 2 | A, B | Si | Ola 1 completa |
| 3 | A, B | Si | Ola 2 completa |
| 4 | A | No aplica (unico) | Ola 3 completa |

---

## Contexto base del feature

Estado actual del repo:

- Existe scoring crediticio con 14 items y tiers en `A`, `B`, `C` y `reprobado`
- Existe servicio [`src/services/ScoringService.ts`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\services\ScoringService.ts)
- Existe servicio [`src/services/LineaCreditoService.ts`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\services\LineaCreditoService.ts)
- Existe servicio [`src/services/NosisService.ts`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\services\NosisService.ts)
- Existe API [`src/app/api/fin/clientes/[id]/evaluacion/route.ts`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\app\api\fin\clientes\[id]\evaluacion\route.ts)
- Existe API [`src/app/api/fin/clientes/[id]/nosis/route.ts`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\app\api\fin\clientes\[id]\nosis\route.ts)
- Existe ficha Cliente 360 con pestaña de riesgo embebida en [`src/app/(dashboard)/clientes/[id]/page.tsx`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\app\(dashboard)\clientes\[id]\page.tsx)
- Existe formulario de nueva evaluacion en [`src/app/(dashboard)/clientes/[id]/evaluacion/page.tsx`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\app\(dashboard)\clientes\[id]\evaluacion\page.tsx)
- Existe historial en [`src/app/(dashboard)/clientes/[id]/evaluacion/historial/page.tsx`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\app\(dashboard)\clientes\[id]\evaluacion\historial\page.tsx)

Problema actual:

- El riesgo esta distribuido entre scoring, Nosis y resumen crediticio sin una API consolidada
- No existe una lectura unica del riesgo del cliente para UI, originacion y reportes
- Falta score de comportamiento basado en pagos reales y mora historica
- Faltan reglas operativas claras para bloqueo, revision manual y reevaluacion
- La pestaña de riesgo mezcla datos y presentacion dentro de la pagina de cliente

Objetivo de implementacion:

- crear un modulo de riesgo consolidado reutilizable desde backend y frontend
- exponer `/api/fin/clientes/[id]/riesgo` como contrato unico
- incorporar metricas internas de comportamiento de pago
- calcular semaforo y resumen ejecutivo de riesgo
- dejar base lista para politicas automaticas de aprobacion o derivacion

---

## Ola 1 — Fundaciones del dominio de riesgo
> Ejecutar Agente A + Agente B + Agente C en PARALELO

## Agente A — Contrato tipado del riesgo consolidado
**Puede ejecutarse en paralelo con:** Agente B, Agente C
**Depende de:** nada — es la primera ola

### Objetivo
Crear los tipos puros del modulo de riesgo consolidado para que backend y frontend trabajen con un contrato comun.

### Archivos a crear
- `src/types/fin-riesgo.ts` — tipos del resumen de riesgo, metricas de comportamiento, alertas, semaforo, recomendaciones y payload consolidado

### Archivos a modificar
- Ninguno

### Prompt completo para el agente
Trabajas en un proyecto Next.js App Router + TypeScript estricto + Firebase/Firestore. El repo organiza tipos en `src/types`, servicios en `src/services`, APIs en `src/app/api` y UI en `src/app` o `src/components`. En esta tarea debes trabajar solo en tipos puros; no debes tocar servicios, APIs ni componentes.

Lee como referencia:

- `src/types/fin-evaluacion.ts`
- `src/types/fin-linea-credito.ts`
- `src/types/fin-cliente.ts`
- `src/types/fin-credito.ts`
- `reports/62_PLAN_VENTA_FINANCIADA_Y_CLIENTE_360_2026-03-23.md`

Implementa un nuevo archivo `src/types/fin-riesgo.ts` con al menos:

1. Tipos base:
   - `FinRiesgoSemaforo = 'verde' | 'amarillo' | 'rojo'`
   - `FinRiesgoAlertaCodigo`
   - `FinRiesgoRecomendacionCodigo`
2. Metricas de comportamiento:
   - `max_dias_atraso`
   - `cuotas_vencidas_impagas`
   - `creditos_en_mora`
   - `creditos_incobrables`
   - `capital_vencido`
   - `capital_a_vencer_30d`
   - `monto_total_adeudado`
   - `porcentaje_linea_utilizada`
   - `promedio_dias_atraso`
   - `cantidad_refinanciaciones`
3. Resumen de riesgo consolidado:
   - datos de evaluacion vigente
   - datos resumidos de Nosis vigente
   - linea de credito actual
   - metricas de comportamiento
   - semaforo
   - alertas
   - recomendaciones operativas
4. Payload API:
   - `FinClienteRiesgoResponse`
   - `FinClienteRiesgoResumen`
   - `FinClienteRiesgoAlerta`
   - `FinClienteRiesgoRecomendacion`
5. Mantener nombres alineados al dominio actual (`tier_sugerido`, `tier_asignado`, `limite_credito_asignado`, etc.) para minimizar adaptaciones posteriores.

No debes:

- modificar tipos existentes
- crear servicios
- crear endpoints
- inventar colecciones Firestore nuevas

Criterio de exito:

- el archivo compila en forma aislada
- los nombres de campos son consistentes con el dominio existente
- el contrato queda listo para ser consumido por API y UI sin redefinir tipos locales

## Agente B — Servicio puro de metricas de comportamiento
**Puede ejecutarse en paralelo con:** Agente A, Agente C
**Depende de:** nada — es la primera ola

### Objetivo
Crear un servicio puro que calcule metricas de riesgo comportamental a partir de creditos y cobros existentes.

### Archivos a crear
- `src/services/RiesgoMetricsService.ts` — calculos puros de mora, vencimientos, utilizacion y comportamiento de pago

### Archivos a modificar
- Ninguno

### Prompt completo para el agente
Trabajas en un proyecto TypeScript con servicios de dominio en `src/services`. En esta tarea debes crear un servicio puro, sin acceso a Firestore y sin tocar UI o APIs. Debes priorizar funciones deterministicas y faciles de testear.

Lee como referencia:

- `src/services/LineaCreditoService.ts`
- `src/services/CreditoService.ts`
- `src/types/fin-credito.ts`
- `src/types/fin-cobro.ts`
- `src/types/fin-linea-credito.ts`

Implementa `src/services/RiesgoMetricsService.ts` con funciones puras para:

1. Calcular exposicion:
   - `calcularMontoTotalAdeudado`
   - `calcularCapitalVencido`
   - `calcularCapitalAVencer30d`
2. Calcular comportamiento:
   - `calcularMaxDiasAtraso`
   - `calcularPromedioDiasAtraso`
   - `calcularCuotasVencidasImpagas`
   - `calcularCreditosEnMora`
   - `calcularCreditosIncobrables`
   - `calcularCantidadRefinanciaciones`
3. Calcular uso de linea:
   - `calcularPorcentajeLineaUtilizada(linea?: { limite_total: number | null; consumo_actual: number })`
4. Exponer una fachada:
   - `buildMetrics(params: { creditos: FinCredito[]; cobros?: FinCobro[]; linea?: { limite_total: number | null; consumo_actual: number } | null; now?: Date })`

Asume estructuras actuales del dominio y trabaja con ellas; si algun dato no existe de forma confiable, documenta la aproximacion en comentarios muy breves y devuelve el mejor calculo posible sin inventar persistencia.

No debes:

- leer o escribir Firestore
- modificar `CreditoService`
- modificar `LineaCreditoService`
- crear componentes React

Criterio de exito:

- el servicio es puro y reutilizable
- no introduce dependencias circulares
- deja funciones aptas para test unitario directo

## Agente C — Reglas y catalogos de decision de riesgo
**Puede ejecutarse en paralelo con:** Agente A, Agente B
**Depende de:** nada — es la primera ola

### Objetivo
Definir reglas y catalogos puros para semaforo, alertas y recomendaciones operativas sin tocar servicios existentes.

### Archivos a crear
- `src/lib/riesgo/riskRules.ts` — reglas puras para derivar semaforo, alertas y recomendaciones desde score, Nosis y comportamiento

### Archivos a modificar
- Ninguno

### Prompt completo para el agente
Trabajas en un proyecto Next.js + TypeScript. Debes crear utilidades puras en `src/lib` para reglas de negocio que luego van a reutilizar servicios y UI. No debes tocar APIs, servicios con Firestore ni componentes.

Lee como referencia:

- `src/lib/scoring/utils.ts`
- `src/types/fin-evaluacion.ts`
- `src/types/fin-linea-credito.ts`
- `reports/SISTEMA_PRESTALOAPP.md`

Implementa `src/lib/riesgo/riskRules.ts` con:

1. Catalogos de alerta y recomendacion como arrays `as const`
2. Helpers:
   - `resolverSemaforoRiesgo`
   - `resolverAlertasRiesgo`
   - `resolverRecomendacionesRiesgo`
3. Reglas minimas:
   - rojo si tier `reprobado`
   - rojo si hay `judicial` o `incobrable`
   - rojo si BCRA es grave o hay multiples cheques rechazados
   - amarillo si hay mora o evaluacion vencida
   - amarillo si la linea esta casi consumida
   - verde si no hay alertas relevantes
4. Las funciones deben aceptar inputs simples y serializables para facilitar test y reutilizacion.

No debes:

- importar servicios con acceso a Firestore
- crear endpoints
- tocar paginas o componentes
- modificar tipos existentes

Criterio de exito:

- las reglas quedan encapsuladas en un unico modulo puro
- backend y frontend pueden reutilizar las mismas reglas
- no hay acoplamiento con UI

---

## Ola 2 — Backend consolidado de riesgo
> Ejecutar SOLO despues de que Ola 1 este completa
> Ejecutar Agente A + Agente B en PARALELO

## Agente A — Servicio agregador de riesgo del cliente
**Puede ejecutarse en paralelo con:** Agente B
**Depende de:** Ola 1 completa

### Objetivo
Construir el servicio principal que consolida evaluacion, Nosis, linea y metricas comportamentales en un resumen unico por cliente.

### Archivos a crear
- `src/services/ClienteRiesgoService.ts` — agregador principal del riesgo del cliente

### Archivos a modificar
- Ninguno

### Prompt completo para el agente
Trabajas en un proyecto TypeScript con servicios de dominio backend que leen Firestore por medio de `getAdminFirestore`, `FIN_COLLECTIONS` y servicios ya existentes. Debes crear un servicio nuevo sin tocar rutas API ni UI.

Lee como referencia:

- `src/services/ScoringService.ts`
- `src/services/LineaCreditoService.ts`
- `src/services/NosisService.ts`
- `src/services/ClienteService.ts`
- `src/services/CreditoService.ts`
- `src/services/RiesgoMetricsService.ts`
- `src/lib/riesgo/riskRules.ts`
- `src/types/fin-riesgo.ts`

Implementa `ClienteRiesgoService` con al menos:

1. `getResumenRiesgo(orgId: string, clienteId: string): Promise<FinClienteRiesgoResponse | null>`
2. Debe obtener:
   - cliente
   - evaluaciones
   - ultima evaluacion vigente
   - linea de credito actual
   - creditos del cliente
   - datos Nosis del cliente
3. Debe calcular:
   - metricas comportamentales usando `RiesgoMetricsService`
   - semaforo, alertas y recomendaciones usando `riskRules`
4. Debe devolver payload listo para API y UI.
5. Si faltan algunos datos, debe responder igual con degradacion razonable y sin tirar excepcion salvo errores reales de infraestructura.

No debes:

- crear route handlers
- modificar paginas React
- escribir en Firestore
- cambiar otros servicios existentes salvo imports si fuera imprescindible

Criterio de exito:

- el servicio consolida todo en un contrato unico
- no depende de UI
- puede ser consumido por API, reportes y originacion

## Agente B — Endpoint consolidado y contrato HTTP
**Puede ejecutarse en paralelo con:** Agente A
**Depende de:** Ola 1 completa

### Objetivo
Crear la API `/api/fin/clientes/[id]/riesgo` y preparar el contrato HTTP para consumo frontend.

### Archivos a crear
- `src/app/api/fin/clientes/[id]/riesgo/route.ts` — GET del riesgo consolidado del cliente

### Archivos a modificar
- `reports/SISTEMA_PRESTALOAPP.md` — documentar la nueva API y aclarar el alcance del modulo de riesgo

### Prompt completo para el agente
Trabajas en un proyecto Next.js App Router con route handlers, autenticacion via `withAuth`, respuestas JSON simples y validacion de acceso por `organizationId`. Debes crear solo el endpoint consolidado y la documentacion minima asociada. No debes tocar paginas UI.

Lee como referencia:

- `src/app/api/fin/clientes/[id]/evaluacion/route.ts`
- `src/app/api/fin/clientes/[id]/nosis/route.ts`
- `src/lib/api/withAuth.ts`
- `src/services/ClienteRiesgoService.ts`
- `reports/SISTEMA_PRESTALOAPP.md`

Implementa:

1. `GET /api/fin/clientes/[id]/riesgo`
   - autenticar con `withAuth`
   - validar `organizationId`
   - devolver `404` si el cliente no existe
   - devolver payload consolidado si existe
2. Mantener estilo del repo:
   - `export const dynamic = 'force-dynamic'` si aplica al patron usado
   - errores JSON simples
3. Actualizar `reports/SISTEMA_PRESTALOAPP.md` en la parte de clientes o riesgo para mencionar esta nueva API consolidada.

No debes:

- crear componentes React
- modificar la pagina del cliente
- tocar servicios de scoring o linea existentes
- agregar nuevos endpoints

Criterio de exito:

- existe una API unica de riesgo por cliente
- el contrato queda claro y estable
- la documentacion maestra refleja el cambio

---

## Ola 3 — Frontend Cliente 360 y pruebas
> Ejecutar SOLO despues de que Ola 2 este completa
> Ejecutar Agente A + Agente B en PARALELO

## Agente A — Tab dedicada de analisis de riesgo
**Puede ejecutarse en paralelo con:** Agente B
**Depende de:** Ola 2 completa

### Objetivo
Extraer y mejorar la experiencia de riesgo del Cliente 360 usando la nueva API consolidada.

### Archivos a crear
- `src/components/fin/cliente/TabAnalisisRiesgo.tsx` — componente dedicado para semaforo, score, alertas, recomendaciones, linea y comportamiento

### Archivos a modificar
- `src/app/(dashboard)/clientes/[id]/page.tsx` — reemplazar la logica embebida de riesgo por el nuevo componente y consumir `/api/fin/clientes/[id]/riesgo`

### Prompt completo para el agente
Trabajas en un proyecto Next.js App Router con client components, `useState + useEffect + fetch()`, Tailwind y componentes UI propios. Debes mejorar la UI de riesgo sin redisenar todo el dashboard y respetando el estilo visual actual.

Lee como referencia:

- `src/app/(dashboard)/clientes/[id]/page.tsx`
- `src/components/fin/cliente/ClienteResumenCrediticio.tsx`
- `src/app/(dashboard)/clientes/[id]/evaluacion/historial/page.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/types/fin-riesgo.ts`

Implementa:

1. Crear `TabAnalisisRiesgo.tsx` que reciba el payload consolidado de riesgo.
2. Mostrar como minimo:
   - semaforo visual
   - score final
   - score Nosis
   - tier sugerido y asignado
   - limite asignado y porcentaje usado
   - maximo atraso
   - cuotas vencidas impagas
   - alertas
   - recomendaciones
   - resumen breve del historial de evaluaciones
3. En `clientes/[id]/page.tsx`:
   - dejar de construir la pestaña de riesgo con llamadas separadas para esos datos
   - llamar al nuevo endpoint consolidado
   - mantener navegacion a nueva evaluacion, historial y consulta Nosis
4. Mantener el resto de tabs del cliente sin cambios funcionales.

No debes:

- tocar el endpoint `/riesgo`
- cambiar formularios de evaluacion
- redisenar el layout global
- agregar dependencias externas

Criterio de exito:

- la pestaña de riesgo queda desacoplada de la pagina principal
- el cliente 360 usa una sola API de riesgo para esa vista
- la UI comunica mejor el riesgo operativo del cliente

## Agente B — Tests del dominio de riesgo consolidado
**Puede ejecutarse en paralelo con:** Agente A
**Depende de:** Ola 2 completa

### Objetivo
Agregar pruebas unitarias para metricas y reglas puras del nuevo modulo de riesgo.

### Archivos a crear
- `src/__tests__/services/RiesgoMetricsService.test.ts` — pruebas unitarias de metricas de comportamiento
- `src/__tests__/lib/riskRules.test.ts` — pruebas unitarias de semaforo, alertas y recomendaciones

### Archivos a modificar
- Ninguno

### Prompt completo para el agente
Trabajas en un proyecto con Jest y pruebas de servicios/utilidades en `src/__tests__`. Debes crear tests puros y estables, evitando dependencias de UI o Firestore.

Lee como referencia:

- `src/__tests__/services/LineaCreditoService.test.ts`
- `src/__tests__/services/ScoringService.test.ts`
- `src/services/RiesgoMetricsService.ts`
- `src/lib/riesgo/riskRules.ts`

Implementa pruebas para cubrir al menos:

1. cliente sin mora y con tier alto => semaforo verde
2. cliente con mora moderada => semaforo amarillo
3. cliente judicial o reprobado => semaforo rojo
4. linea casi consumida => alerta de exposicion
5. calculo de cuotas vencidas e impagas
6. calculo de maximo atraso y promedio atraso
7. calculo de porcentaje de linea utilizada

No debes:

- tocar componentes React
- tocar route handlers
- modificar servicios existentes salvo ajustes minimos estrictamente necesarios si el test detecta fallo real

Criterio de exito:

- las reglas puras quedan cubiertas
- los tests documentan el comportamiento esperado del riesgo consolidado
- no dependen de red ni Firestore

---

## Ola 4 — Reglas operativas de originacion e integracion final
> Ejecutar SOLO despues de que Ola 3 este completa

## Agente A — Integracion de riesgo con originacion de credito
**Puede ejecutarse en paralelo con:** es el unico de esta ola
**Depende de:** Ola 3 completa

### Objetivo
Usar el resumen consolidado de riesgo en la originacion para bloquear, advertir o derivar casos a revision manual sin reabrir todo el circuito.

### Archivos a crear
- Ninguno obligatorio

### Archivos a modificar
- `src/app/api/fin/creditos/route.ts` — incorporar validaciones operativas de riesgo previas al otorgamiento
- `src/components/fin/dialogs/NuevoCreditoDialog.tsx` — mostrar advertencias o bloqueos legibles al usuario
- `src/services/ClienteRiesgoService.ts` — exponer helpers adicionales solo si hicieran falta para validacion previa

### Prompt completo para el agente
Trabajas como integrador final sobre el circuito de originacion de credito. Debes aprovechar la nueva consolidacion de riesgo para mejorar controles operativos sin redisenar el flujo ni cambiar el modelo contable.

Lee como referencia:

- `src/app/api/fin/creditos/route.ts`
- `src/components/fin/dialogs/NuevoCreditoDialog.tsx`
- `src/services/ClienteRiesgoService.ts`
- `src/services/ScoringService.ts`
- `src/services/LineaCreditoService.ts`
- `src/types/fin-riesgo.ts`

Implementa:

1. Reglas minimas previas al otorgamiento:
   - bloquear si no hay evaluacion vigente cuando la politica lo requiera
   - bloquear si la linea disponible no alcanza
   - advertir o derivar a revision manual si el semaforo es rojo
   - advertir si Nosis tiene alertas relevantes
2. En la UI de nuevo credito:
   - mostrar mensajes claros de bloqueo o advertencia
   - no romper el flujo existente cuando el riesgo sea aceptable
3. Mantener compatibilidad con el circuito actual de `CreditoService`.

No debes:

- redisenar el dialogo completo
- cambiar `CreditoService` salvo que sea estrictamente necesario
- tocar otros modulos del dashboard
- crear nuevas colecciones Firestore

Criterio de exito:

- el resumen de riesgo pasa a influir en originacion
- el usuario entiende por que un credito se bloquea o requiere revision
- el feature queda integrado de punta a punta

---

## Verificacion final

- [ ] Existe `GET /api/fin/clientes/[id]/riesgo`
- [ ] La respuesta incluye evaluacion vigente, Nosis, linea, metricas, semaforo, alertas y recomendaciones
- [ ] La pestaña de riesgo del Cliente 360 usa una unica API consolidada
- [ ] El riesgo ya no esta embebido en exceso dentro de `clientes/[id]/page.tsx`
- [ ] Se muestran metricas de comportamiento reales del cliente
- [ ] Existen reglas de semaforo reutilizables y cubiertas por tests
- [ ] El modulo de riesgo sigue sin introducir colecciones Firestore nuevas innecesarias
- [ ] Originacion de credito puede bloquear o advertir segun riesgo consolidado
- [ ] No se rompe la carga manual de evaluaciones ni el historial existente
- [ ] La documentacion maestra del sistema refleja la nueva capacidad

## Orden recomendado de ejecucion real

1. Lanzar Ola 1 completa en paralelo
2. Validar contratos y nombres de campos antes de iniciar Ola 2
3. Lanzar Ola 2 en paralelo
4. Lanzar Ola 3 en paralelo
5. Ejecutar Ola 4 como cierre de integracion con originacion
