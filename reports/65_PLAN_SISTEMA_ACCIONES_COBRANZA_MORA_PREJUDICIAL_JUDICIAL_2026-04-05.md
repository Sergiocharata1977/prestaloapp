# Plan Sistema de Acciones de Cobranza Mora / Pre Judicial / Judicial — Ejecucion multi-agente

**Fecha:** 2026-04-05
**Feature:** profesionalizacion del sistema de acciones de cobranza para mora temprana, pre judicial y judicial, reutilizando `fin_mora_acciones`
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

- Existe coleccion `organizations/{orgId}/fin_mora_acciones`
- Existen rutas `GET/POST /api/fin/control-mora/acciones`
- Existe `PATCH /api/fin/control-mora/clientes/[id]`
- Existe el servicio [`src/services/MoraService.ts`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\services\MoraService.ts)
- Existe el tipo [`src/types/fin-mora.ts`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\types\fin-mora.ts)
- Existe la UI [`src/components/fin/mora/MoraCRMBoard.tsx`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\components\fin\mora\MoraCRMBoard.tsx)
- Existen pantallas [`src/app/(dashboard)/acciones/mora-temprana/page.tsx`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\app\(dashboard)\acciones\mora-temprana\page.tsx) y [`src/app/(dashboard)/acciones/judiciales/page.tsx`](c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp\src\app\(dashboard)\acciones\judiciales\page.tsx)

Problema actual:

- El modelo de accion es demasiado simple
- Falta agenda operativa
- Falta responsable
- Falta estado de la accion
- Falta trazabilidad por caso y por instrumento
- Falta soporte real para promesas, derivacion legal y seguimiento judicial

Objetivo de implementacion:

- evolucionar `fin_mora_acciones` sin romper el circuito existente
- agregar etapa `mora_temprana`
- soportar acciones pendientes, realizadas, canceladas y vencidas
- agregar agenda, responsable, prioridad, compromisos de pago y timeline

---

## Ola 1 — Base de dominio y contratos backend
> Ejecutar Agente A + Agente B + Agente C en PARALELO

## Agente A — Modelo de dominio de cobranzas
**Puede ejecutarse en paralelo con:** Agente B, Agente C
**Depende de:** nada — es la primera ola

### Objetivo
Expandir los tipos de mora/cobranzas para soportar acciones operativas formales, agenda, prioridad, responsable y vinculos por entidad.

### Archivos a crear
- `src/lib/fin/moraCatalogs.ts` — catalogos tipados y helpers puros para etapas, estados, prioridades, categorias y resultados

### Archivos a modificar
- `src/types/fin-mora.ts` — ampliar tipos de etapa, accion, filtros, agenda y timeline
- `src/types/fin-cliente.ts` — adaptar `gestion_mora_etapa` a la nueva etapa `mora_temprana`

### Prompt completo para el agente
Trabajas en un proyecto Next.js App Router + TypeScript + Firebase Admin/Firestore. El repo usa tipos en `src/types`, servicios en `src/services`, APIs en `src/app/api`, y componentes client/server en `src/components` y `src/app`. Debes trabajar solo en el dominio tipado y catalogos puros; no tocar rutas API ni UI.

Lee como referencia:

- `src/types/fin-mora.ts`
- `src/types/fin-cliente.ts`
- `src/services/MoraService.ts`
- `src/__tests__/services/MoraService.test.ts`

Implementa:

1. Agrega etapa `mora_temprana` al dominio.
2. Redefine `FinMoraAccion` para soportar al menos:
   - `etapa`
   - `categoria`
   - `tipo`
   - `estado`
   - `prioridad`
   - `resultado_codigo`
   - `resultado_texto`
   - `entidad_tipo`
   - `entidad_id`
   - `credito_id`
   - `cuota_id`
   - `cheque_id`
   - `saldo_exigible_snapshot`
   - `dias_mora_snapshot`
   - `compromiso_pago_fecha`
   - `compromiso_pago_monto`
   - `compromiso_pago_cumplido`
   - `proxima_accion_tipo`
   - `proxima_accion_at`
   - `fecha_vencimiento_accion`
   - `responsable_user_id`
   - `responsable_nombre`
   - `sector_responsable`
   - `estudio_juridico_nombre`
   - `expediente_numero`
   - `documento_tipo`
   - `documento_url`
   - `executed_at`
   - `updated_at`
3. Conserva compatibilidad hacia atras:
   - mantener `clase` como alias temporal si hace falta
   - no eliminar campos actuales sin reemplazo claro
4. Define tipos auxiliares:
   - `FinMoraEtapa`
   - `FinMoraAccionEstado`
   - `FinMoraAccionPrioridad`
   - `FinMoraAccionCategoria`
   - `FinMoraResultadoCodigo`
   - `FinMoraEntidadTipo`
   - `FinMoraAgendaItem`
   - `FinMoraTimelineItem`
5. Crea `src/lib/fin/moraCatalogs.ts` con arrays `as const` y helpers para labels.

No debes:

- tocar `MoraService`
- tocar endpoints API
- tocar componentes UI
- cambiar archivos fuera de los indicados

Criterio de exito:

- el dominio queda listo para ser consumido por backend y frontend
- los tipos no rompen el build por imports faltantes
- la compatibilidad con el modelo actual queda razonablemente preservada

## Agente B — Endpoints de acciones y agenda
**Puede ejecutarse en paralelo con:** Agente A, Agente C
**Depende de:** nada — es la primera ola

### Objetivo
Crear el contrato API de acciones y agenda de cobranzas sin depender de cambios de UI.

### Archivos a crear
- `src/app/api/fin/control-mora/acciones/[id]/route.ts` — PATCH para actualizar estado, resultado, agenda y campos operativos de una accion
- `src/app/api/fin/control-mora/agenda/route.ts` — GET para listar agenda operativa de acciones pendientes o vencidas
- `src/app/api/fin/control-mora/clientes/[id]/timeline/route.ts` — GET para exponer historial operativo por cliente

### Archivos a modificar
- `src/app/api/fin/control-mora/acciones/route.ts` — ampliar GET y POST para nuevos filtros y payload v2

### Prompt completo para el agente
Trabajas en un proyecto Next.js App Router con route handlers en `src/app/api`, autenticacion con `withAuth`, validacion con `zod`, Firestore por medio de servicios, y respuestas JSON simples. Debes implementar solo contratos API y validaciones. No modifiques UI ni servicios base fuera de lo imprescindible para compilar firmas.

Lee como referencia:

- `src/app/api/fin/control-mora/acciones/route.ts`
- `src/app/api/fin/control-mora/clientes/route.ts`
- `src/app/api/fin/control-mora/clientes/[id]/route.ts`
- `src/app/api/fin/cobros/route.ts`
- `src/lib/api/withAuth.ts`

Implementa:

1. `GET /api/fin/control-mora/acciones`
   - soportar filtros por `clienteId`, `etapa`, `estado`, `responsableUserId`, `soloVencidas`
2. `POST /api/fin/control-mora/acciones`
   - aceptar payload v2 con campos de agenda, prioridad, responsable, promesa y vinculacion por entidad
3. `PATCH /api/fin/control-mora/acciones/[id]`
   - permitir actualizar `estado`, `resultado_codigo`, `resultado_texto`, `notas`, `proxima_accion_at`, `responsable_user_id`, `responsable_nombre`, `executed_at`
4. `GET /api/fin/control-mora/agenda`
   - devolver lista apta para bandeja de agenda
5. `GET /api/fin/control-mora/clientes/[id]/timeline`
   - devolver historial de acciones del cliente ordenado desc

Asume que los metodos de servicio necesarios existiran o los podes dejar invocados contra firmas claras si el compilado lo permite una vez integrada Ola 2. Mantene el estilo de validacion y errores existente.

No debes:

- construir componentes React
- tocar `MoraCRMBoard.tsx`
- modificar test files
- cambiar logica contable o de cobros

Criterio de exito:

- las rutas quedan creadas y validadas con `zod`
- siguen el patron del repo
- exponen el contrato correcto para que frontend pueda trabajar en la siguiente ola

## Agente C — Servicio operativo de mora
**Puede ejecutarse en paralelo con:** Agente A, Agente B
**Depende de:** nada — es la primera ola

### Objetivo
Refactorizar `MoraService` para soportar acciones v2, agenda, timeline y resolucion de etapa con `mora_temprana`.

### Archivos a crear
- `src/services/MoraAgendaService.ts` — helpers o fachada para construir agenda operativa desde acciones

### Archivos a modificar
- `src/services/MoraService.ts` — ampliar logica de resumen, acciones, agenda, timeline y actualizacion de etapa

### Prompt completo para el agente
Trabajas en un proyecto TypeScript con servicios de dominio en `src/services` que leen/escriben Firestore via `getAdminFirestore` y `FIN_COLLECTIONS`. Debes concentrarte en logica de negocio backend. No tocar rutas UI.

Lee como referencia:

- `src/services/MoraService.ts`
- `src/services/ChequeService.ts`
- `src/services/CreditoService.ts`
- `src/firebase/collections.ts`
- `src/__tests__/services/MoraService.test.ts`

Implementa:

1. Resolver etapa base con esta prioridad:
   - `judicial`
   - `pre_judicial`
   - `mora_temprana`
   - `sin_gestion`
2. Considerar `mora_temprana` para clientes con mora incipiente aunque aun no hayan escalado a pre judicial.
3. Ampliar `crearAccion` para construir acciones v2 con defaults compatibles.
4. Crear metodos:
   - `getAccionById`
   - `updateAccion`
   - `listAgenda`
   - `listTimelineByCliente`
5. En `actualizarEtapaCliente`, registrar opcionalmente accion automatica de cambio de etapa si corresponde.
6. Mantener `listClientes` y `buildClienteMoraResumen` compatibles con la UI actual y preparar campos nuevos para agenda.
7. Si creas `MoraAgendaService`, dejalo como helper puro o servicio chico, sin duplicar toda la logica.

No debes:

- modificar componentes React
- modificar route handlers
- tocar otros dominios ajenos
- inventar persistencias paralelas fuera de `fin_mora_acciones`

Criterio de exito:

- el servicio soporta los endpoints nuevos
- no rompe la bandeja actual
- el dominio queda listo para agenda y timeline

---

## Ola 2 — Interfaz operativa de cobranzas
> Ejecutar SOLO despues de que Ola 1 este completa
> Ejecutar Agente A + Agente B en PARALELO

## Agente A — Evolucion de la bandeja CRM de mora
**Puede ejecutarse en paralelo con:** Agente B
**Depende de:** Ola 1 completa

### Objetivo
Actualizar la bandeja actual de mora para usar acciones v2, etapa `mora_temprana`, prioridad, responsable y formulario estructurado.

### Archivos a crear
- `src/components/fin/mora/MoraActionForm.tsx` — formulario estructurado de alta/edicion de accion
- `src/components/fin/mora/MoraTimeline.tsx` — timeline de acciones por cliente

### Archivos a modificar
- `src/components/fin/mora/MoraCRMBoard.tsx` — integrar nueva ficha, formulario, timeline y campos operativos
- `src/app/(dashboard)/acciones/mora-temprana/page.tsx` — ajustar copy y stage `mora_temprana`
- `src/app/(dashboard)/acciones/judiciales/page.tsx` — ajustar copy y estados v2

### Prompt completo para el agente
Trabajas en un proyecto Next.js + React client components con Tailwind y componentes UI propios (`Card`, `Button`, `Input`, `Select`, `Textarea`, `DataTable`, `Badge`). Debes tocar solo la experiencia principal de gestion por cliente/caso.

Lee como referencia:

- `src/components/fin/mora/MoraCRMBoard.tsx`
- `src/components/ui/data-table.tsx`
- `src/app/(dashboard)/cobros/page.tsx`
- `src/app/(dashboard)/clientes/[id]/page.tsx`

Implementa:

1. Adaptar la bandeja para:
   - soportar etapa `mora_temprana`
   - mostrar prioridad
   - mostrar responsable
   - mostrar proxima accion y estado de accion
2. Extraer formulario de accion a `MoraActionForm.tsx`.
3. Crear `MoraTimeline.tsx` para listar historial por cliente con mejor jerarquia visual.
4. El formulario debe capturar:
   - tipo
   - categoria
   - prioridad
   - resultado
   - notas
   - responsable
   - proxima accion
   - promesa de pago si aplica
5. Mantener el estilo visual actual del repo; no rediseñar todo el dashboard.

No debes:

- crear nuevas APIs
- tocar servicios backend
- tocar pruebas
- cambiar otros modulos del sistema

Criterio de exito:

- la bandeja actual queda mas rica pero sigue siendo entendible
- usa los nuevos endpoints definidos en Ola 1
- no rompe las vistas de `mora-temprana` y `judiciales`

## Agente B — Bandeja de agenda operativa
**Puede ejecutarse en paralelo con:** Agente A
**Depende de:** Ola 1 completa

### Objetivo
Construir una nueva pantalla de agenda operativa para seguimiento diario de acciones pendientes, vencidas y promesas por controlar.

### Archivos a crear
- `src/app/(dashboard)/acciones/agenda/page.tsx` — pagina principal de agenda de cobranzas
- `src/components/fin/mora/MoraAgendaBoard.tsx` — tablero de agenda operativa

### Archivos a modificar
- `src/components/layout/Sidebar.tsx` — agregar acceso a la nueva bandeja de agenda dentro de Gestion / Control de mora

### Prompt completo para el agente
Trabajas en un proyecto Next.js App Router con paginas dashboard en `src/app/(dashboard)` y componentes reutilizables. Debes crear una pantalla nueva independiente de la bandeja CRM existente.

Lee como referencia:

- `src/components/fin/mora/MoraCRMBoard.tsx`
- `src/app/(dashboard)/reportes/proyeccion-cobranzas/page.tsx`
- `src/app/(dashboard)/cobros/page.tsx`
- `src/components/layout/Sidebar.tsx`

Implementa:

1. Crear una vista de agenda basada en `GET /api/fin/control-mora/agenda`.
2. La bandeja debe mostrar por fila:
   - cliente
   - etapa
   - tipo de accion
   - estado
   - prioridad
   - responsable
   - proxima accion
   - dias de atraso o vencimiento
3. Agregar filtros por:
   - etapa
   - estado
   - responsable
   - solo vencidas
4. Agregar accesos rapidos visuales para:
   - acciones vencidas
   - acciones de hoy
   - promesas de pago a controlar
5. Agregar acceso en sidebar sin romper items existentes.

No debes:

- modificar `MoraService`
- tocar route handlers
- tocar formulario principal de `MoraCRMBoard`
- cambiar otros grupos del sidebar fuera de lo necesario

Criterio de exito:

- existe una nueva pantalla util para seguimiento diario
- navega bien desde el sidebar
- no depende de archivos escritos por el otro agente de esta misma ola

---

## Ola 3 — Integracion de calidad y migracion operativa
> Ejecutar SOLO despues de que Ola 2 este completa
> Ejecutar Agente A + Agente B en PARALELO

## Agente A — Tests y regresion de mora
**Puede ejecutarse en paralelo con:** Agente B
**Depende de:** Ola 2 completa

### Objetivo
Agregar cobertura automatizada para el nuevo dominio de acciones, agenda, timeline y resolucion de etapas.

### Archivos a crear
- `src/__tests__/services/MoraAgendaService.test.ts` — pruebas de agenda si el servicio existe

### Archivos a modificar
- `src/__tests__/services/MoraService.test.ts` — ampliar cobertura del dominio de mora

### Prompt completo para el agente
Trabajas en un proyecto con Jest y tests de servicios en `src/__tests__/services`. Debes crear pruebas unitarias puras o casi puras, evitando dependencias innecesarias de UI.

Lee como referencia:

- `src/__tests__/services/MoraService.test.ts`
- `src/__tests__/services/ChequeService.test.ts`
- `src/services/MoraService.ts`

Implementa pruebas para:

1. resolucion de etapa a `mora_temprana`
2. escalamiento a `pre_judicial`
3. escalamiento a `judicial`
4. seleccion de `proxima_accion_at`
5. agenda de acciones vencidas y pendientes
6. compatibilidad con acciones legacy

No debes:

- tocar componentes React
- tocar route handlers
- modificar logica de produccion salvo ajustes minimos si el test detecta fallas claras

Criterio de exito:

- los tests cubren la logica nueva mas sensible
- dejan claro que no se rompio el comportamiento previo

## Agente B — Documento de migracion e indices
**Puede ejecutarse en paralelo con:** Agente A
**Depende de:** Ola 2 completa

### Objetivo
Dejar documentada la migracion operativa del modelo de acciones y los indices necesarios en Firestore.

### Archivos a crear
- `reports/66_MIGRACION_ACCIONES_COBRANZA_V2_2026-04-05.md` — guia de migracion funcional y tecnica

### Archivos a modificar
- `firestore.indexes.json` — agregar indices requeridos por agenda y filtros de acciones
- `reports/SISTEMA_PRESTALOAPP.md` — actualizar descripcion del modulo de mora si corresponde

### Prompt completo para el agente
Trabajas en un repo con documentacion tecnica en `reports/` y configuracion Firestore en `firestore.indexes.json`. Debes dejar listo el soporte de despliegue y operacion. No tocar UI ni servicios.

Lee como referencia:

- `firestore.indexes.json`
- `reports/SISTEMA_PRESTALOAPP.md`
- `reports/63_PLAN_OLAS_11-14_CTACTE_FINANCIADA_2026-04-04.md`

Implementa:

1. indices para consultas de:
   - `cliente_id + created_at`
   - `etapa + estado + proxima_accion_at`
   - `responsable_user_id + estado + proxima_accion_at`
   - `etapa + prioridad + proxima_accion_at`
2. documento de migracion que explique:
   - campos nuevos
   - defaults para datos existentes
   - pasos de despliegue
   - riesgos y rollback
3. actualizacion breve del reporte maestro del sistema si el modulo cambia de alcance funcional.

No debes:

- modificar tests
- modificar React components
- tocar rutas API o servicios

Criterio de exito:

- el despliegue queda preparado
- la migracion esta documentada con claridad
- los indices cubren las consultas introducidas en el feature

---

## Ola 4 — Cierre de integracion
> Ejecutar SOLO despues de que Ola 3 este completa

## Agente A — Ajustes finales y smoke integration
**Puede ejecutarse en paralelo con:** es el unico de esta ola
**Depende de:** Ola 3 completa

### Objetivo
Resolver desajustes de integracion entre backend, frontend, tests e indices, y dejar el feature listo para validacion funcional.

### Archivos a crear
- Ninguno obligatorio

### Archivos a modificar
- `src/types/fin-mora.ts` — ajustes finales de tipos si quedaron incompatibilidades
- `src/services/MoraService.ts` — correcciones finales de integracion si hicieran falta
- `src/app/api/fin/control-mora/acciones/route.ts` — correcciones finales de contrato si hicieran falta
- `src/components/fin/mora/MoraCRMBoard.tsx` — correcciones finales de integracion si hicieran falta
- `src/components/fin/mora/MoraAgendaBoard.tsx` — correcciones finales de integracion si hicieran falta

### Prompt completo para el agente
Trabajas como integrador final. Debes revisar el trabajo de las olas anteriores, compilar mentalmente el flujo entero y corregir solo lo necesario para que todo encaje sin reabrir el alcance.

Lee como referencia minima:

- `src/types/fin-mora.ts`
- `src/services/MoraService.ts`
- `src/app/api/fin/control-mora/acciones/route.ts`
- `src/app/api/fin/control-mora/acciones/[id]/route.ts`
- `src/app/api/fin/control-mora/agenda/route.ts`
- `src/app/api/fin/control-mora/clientes/[id]/timeline/route.ts`
- `src/components/fin/mora/MoraCRMBoard.tsx`
- `src/components/fin/mora/MoraAgendaBoard.tsx`
- `src/__tests__/services/MoraService.test.ts`

Tu trabajo:

1. corregir incompatibilidades de tipos
2. asegurar consistencia entre payloads backend y frontend
3. revisar si la etapa `mora_temprana` se refleja bien en UI y servicio
4. revisar si la agenda usa correctamente los campos nuevos
5. hacer ajustes pequenos de texto o labels solo si son necesarios para coherencia

No debes:

- redisenar componentes
- cambiar la arquitectura definida
- agregar features nuevos fuera del plan

Criterio de exito:

- el feature queda coherente de punta a punta
- no quedan referencias obvias rotas
- el sistema esta listo para QA manual

---

## Verificacion final

- [ ] Un cliente con mora inicial puede verse en etapa `mora_temprana`
- [ ] Un cliente puede registrar una accion con prioridad, responsable y proxima accion
- [ ] Una accion puede quedar `pendiente`, `realizada`, `cancelada` o `vencida`
- [ ] La bandeja principal muestra responsable, prioridad y seguimiento
- [ ] Existe una bandeja separada de agenda operativa
- [ ] El timeline por cliente lista acciones en orden correcto
- [ ] El backend soporta GET, POST y PATCH de acciones
- [ ] Existen indices Firestore para filtros de agenda
- [ ] Los tests de `MoraService` cubren etapa y agenda
- [ ] No se rompe la bandeja actual de pre judicial y judicial

## Orden recomendado de ejecucion real

1. Lanzar Ola 1 completa en paralelo
2. Integrar y revisar firmas antes de iniciar Ola 2
3. Lanzar Ola 2 en paralelo
4. Lanzar Ola 3 en paralelo
5. Ejecutar Ola 4 como cierre tecnico

