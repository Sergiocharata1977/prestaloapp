# PD-CRE-001 — Proceso de Evaluación de Riesgo Crediticio
**Revisión:** 1.0 | **Fecha:** 2026-03-12 | **Estado:** Vigente

---

## Identificación del proceso

| Campo | Valor |
|---|---|
| **Código** | PD-CRE-001 |
| **Nombre** | Proceso de Evaluación de Riesgo Crediticio |
| **Tipo** | Soporte a operativo |
| **Categoría ISO** | Soporte / Gestión de riesgos |
| **Cláusulas ISO 9001:2015** | 6.1, 7.1.6, 8.2.2, 8.4.1, 9.1.3 |
| **Dueño del proceso** | Gerente de Créditos / Gerente General |
| **Sistema** | CRM — Gestión Crediticia `/crm/gestion-crediticia` |
| **Capability requerida** | `crm-risk-scoring` |

---

## 1. Objetivo

Evaluar de manera objetiva, sistemática y documentada el riesgo crediticio de los clientes que solicitan financiamiento o crédito, asignando un score ponderado, un tier crediticio y un límite de crédito que sirvan de base para la decisión comercial, reduciendo la exposición al riesgo de incobrabilidad de la organización.

---

## 2. Alcance

**Inicio:** Derivación desde el Proceso de Ventas (PD-COM-001) al activarse el `CreditWorkflow`, o solicitud directa del área comercial / gerencia.

**Fin:** Emisión de dictamen crediticio (Aprobado / Rechazado / Condicional) con tier y límite asignados, y sincronización del resultado con la oportunidad comercial.

**Incluye:**
- Recopilación de información del cliente
- Consulta a organismos externos (Nosis / Veraz)
- Evaluación de factores cualitativos, de conflicto y cuantitativos
- Scoring ponderado y determinación de tier
- Revisión en comité (cuando corresponde)
- Emisión del dictamen y notificación al proceso de ventas

**Excluye:**
- Proceso de cobranza y recupero de créditos vencidos
- Gestión de garantías reales o prendarias
- Instrumentación legal del contrato de financiamiento

---

## 3. Marco normativo

| Cláusula | Requisito |
|---|---|
| **6.1** | Acciones para abordar riesgos y oportunidades: identificar y planificar |
| **7.1.6** | Conocimientos de la organización: gestión del conocimiento crediticio |
| **8.2.2** | Determinación de requisitos: verificar capacidad antes de comprometerse |
| **8.4.1** | Control de proveedores externos: Nosis como proveedor de datos externos |
| **9.1.3** | Análisis y evaluación: revisión de resultados de scoring y tasa de morosidad |

---

## 4. Modelo de scoring (motor de cálculo)

El sistema aplica un modelo de scoring ponderado en tres categorías:

| Categoría | Peso | Items | Descripción |
|---|---|---|---|
| **Cualitativos** | 43% | 7 items | Gestión de la empresa, relación comercial, historial de pagos |
| **Conflictos** | 31% | 3 items | Situaciones legales, fiscales y financieras adversas |
| **Cuantitativos** | 26% | 4 items | Indicadores económicos y financieros |

### Items por categoría

**Cualitativos (43% del score total)**
| Item | Peso interno |
|---|---|
| Capacidad de la dirección | 14.3% |
| Condiciones del ramo o actividad | 14.3% |
| Organización y controles internos | 14.3% |
| Cheques rechazados en la empresa | 14.3% |
| Términos y condiciones de pago (cumplimiento) | 14.3% |
| Potencialidad y capacidad de crecimiento | 14.3% |
| Nivel de fidelización | 14.2% |

**Conflictos (31% del score total)**
| Item | Peso interno |
|---|---|
| Concursos y quiebras | 33.3% |
| Problemas fiscales | 33.3% |
| Cheques rechazados (historial) | 33.4% |

**Cuantitativos (26% del score total)**
| Item | Peso interno |
|---|---|
| Situación económica | 25% |
| Situación financiera | 25% |
| Volúmenes operados | 25% |
| Situación patrimonial | 25% |

### Fórmula de score total

```
Score Total = (Score Cualitativos × 0.43)
            + (Score Conflictos   × 0.31)
            + (Score Cuantitativos × 0.26)
```

Donde cada score de categoría = Σ (puntaje_item × peso_item), con puntajes de 1 a 10.

### Tabla de Tier

| Score Total | Tier | Significado |
|---|---|---|
| 8.00 – 10.00 | **A** | Riesgo bajo — elegible para crédito pleno |
| 6.00 – 7.99 | **B** | Riesgo moderado — elegible con condiciones |
| 4.00 – 5.99 | **C** | Riesgo elevado — evaluar con garantías |
| < 4.00 | **REPROBADO** | No elegible para crédito |

### Límite de crédito sugerido

```
Capital Garantía = Patrimonio Neto Computable × 50%
Límite máx. Tier A = Capital Garantía × 50%
Límite máx. Tier B = Capital Garantía × 40%
Límite máx. Tier C = Capital Garantía × 30%
```

---

## 5. SIPOC

### Proveedores → Entradas

| Proveedor | Entrada |
|---|---|
| Proceso de Ventas (PD-COM-001) | Oportunidad con `CreditWorkflow` en estado "pendiente" |
| Cliente externo | Documentación: balances, estados de cuenta, constancias AFIP |
| Nosis / Veraz (externo) | Informe de riesgo crediticio externo (score Nosis) |
| AFIP / Registros públicos | Situación fiscal y legal del cliente |
| Analista crediticio | Evaluación cualitativa y criterio profesional |

### Proceso — Actividades principales

```
CreditWorkflow en estado "pendiente"
           │
           ▼
[1] Asignación a analista crediticio
           │
           ▼
[2] Recopilación de información del cliente
           │
           ├──► [2a] Consulta Nosis (CUIT del cliente)
           │
           ▼
[3] Evaluación de scoring (14 items, 3 categorías)
           │
           ▼
[4] Cálculo automático de score y tier sugerido
           │
           ▼
[5] ¿Requiere comité?
           │
     Sí ──┼──► [5a] Revisión en comité
           │                │
     No ──┤◄────────────────┘
           │
           ▼
[6] Asignación de tier y límite (analista / comité)
           │
           ▼
[7] Emisión del dictamen (Aprobado / Rechazado / Condicional)
           │
           ▼
[8] Sincronización con oportunidad CRM
```

### Salidas → Clientes

| Salida | Cliente interno/externo |
|---|---|
| Dictamen crediticio (tier + límite) | Vendedor / Proceso de Ventas (PD-COM-001) |
| Evaluación vigente registrada en ficha del cliente | Analistas, Gerencia |
| Badge de estado crediticio en Kanban de Oportunidades | Equipo comercial |
| Indicadores de riesgo del portfolio | Dirección / Dashboard ejecutivo |
| Historial de evaluaciones del cliente | Auditoría interna |

---

## 6. Actividades detalladas

### Actividad 1 — Asignación a analista
**Responsable:** Jefe de Créditos / Supervisor
**Duración estimada:** 1 día hábil desde la derivación
**Descripción:** Al recibir el `CreditWorkflow` en estado "pendiente", asignar el analista responsable y fijar la fecha de SLA (plazo máximo de resolución). Mover el workflow a estado "En análisis".
**Registro:** Campo `assigned_to_user_id` + `sla_due_at` en `crm_credit_workflows`
**Control:** SLA máximo: 5 días hábiles para créditos estándar / 10 días para créditos especiales.

---

### Actividad 2 — Recopilación de información
**Responsable:** Analista crediticio
**Duración estimada:** 1–3 días hábiles
**Descripción:** Solicitar al cliente la documentación necesaria: último balance o declaración jurada de ingresos, extractos bancarios, constancia de inscripción AFIP. Registrar documentos en la ficha del cliente CRM (tab "Documentos"). Mover workflow a "Documentación pendiente" si falta información y notificar al cliente.
**Registro:** Documentos subidos en `organizations/{orgId}/clientes/{clienteId}/documentos/`
**Control:** Checklist mínimo de documentación completado antes de avanzar al scoring.

---

### Actividad 2a — Consulta Nosis *(integración externa)*
**Responsable:** Analista crediticio (sistema asistido)
**Descripción:** Desde la ficha del cliente (tab "Crédito y Scoring"), usar el botón "Consultar Nosis" ingresando el CUIT del cliente. El resultado queda disponible como `score_nosis` para incorporar a la evaluación.
**Proveedor externo:** Nosis S.A. (proveedor evaluado conforme cláusula 8.4.1)
**Registro:** Resultado de consulta Nosis registrado en la evaluación
**Control:** Si el CUIT no está cargado en el cliente CRM, la consulta no puede realizarse — completar datos del cliente primero.

---

### Actividad 3 — Evaluación de scoring
**Responsable:** Analista crediticio
**Duración estimada:** 2–4 horas
**Descripción:** Completar el formulario de evaluación crediticia en `/crm/evaluaciones/nueva?cliente_id={id}`. Para cada uno de los 14 items asignar un puntaje de 1 a 10 con fundamentación en las observaciones. Registrar el patrimonio neto computable del cliente.
**Registro:** Colección `crm_evaluaciones` — nueva `EvaluacionRiesgo`
**Control:** Todos los items deben tener puntaje (no puede quedar en blanco). Puntajes extremos (1 o 10) requieren observación escrita.

---

### Actividad 4 — Cálculo automático
**Responsable:** Sistema (automático)
**Descripción:** El sistema calcula en tiempo real durante la carga: score por categoría, score total ponderado, tier sugerido y límite de crédito sugerido. El analista visualiza el resultado antes de guardar.
**Registro:** Campos calculados en `EvaluacionRiesgo`: `score_cualitativos`, `score_conflictos`, `score_cuantitativos`, `score_ponderado_total`, `tier_sugerido`, `capital_garantia`

---

### Actividad 5 — Decisión de comité *(condicional)*
**Condición:** Crédito solicitado > umbral definido por la organización, o tier C, o caso especial.
**Responsable:** Comité de créditos (Gerente + Analista + área solicitante)
**Descripción:** Presentar la evaluación ante el comité. Registrar la decisión, condiciones adicionales y fundamentos. Mover el workflow a estado "Comité". Resolución documentada en notas del workflow.
**Registro:** Campo `notes` del `CreditWorkflow` + cambio de estado a "comite"
**Control:** El comité debe reunirse dentro del SLA. Toda decisión de comité requiere firma del Gerente.

---

### Actividad 6 — Asignación de tier y límite definitivo
**Responsable:** Analista / Comité
**Descripción:** Basado en el tier sugerido por el sistema y el criterio profesional (o resolución del comité), asignar el `tier_asignado` y el `limite_credito_asignado` definitivos. Estos pueden diferir del tier sugerido si hay fundamentos documentados.
**Registro:** Campos `tier_asignado` + `limite_credito_asignado` en `EvaluacionRiesgo`
**Control:** Toda desviación entre tier sugerido y asignado debe tener justificación escrita.

---

### Actividad 7 — Emisión del dictamen
**Responsable:** Analista / Jefe de Créditos
**Descripción:** Actualizar el estado del workflow a "Aprobado", "Rechazado" o condicional. Registrar la resolución. El sistema sincroniza automáticamente el resultado en la oportunidad CRM vinculada.
**Registro:** Campo `resolution` en `CreditWorkflow` + `estado = 'aprobada'/'rechazada'` en `EvaluacionRiesgo`
**Control:** No puede emitirse dictamen sin evaluación de scoring guardada y tier asignado.

---

### Actividad 8 — Sincronización con oportunidad CRM
**Responsable:** Sistema (automático)
**Descripción:** Al cerrar el workflow, el sistema actualiza `oportunidad.subprocesos.crediticio` con: estado, tier, límite de crédito y fecha de resolución. El badge de la oportunidad en el Kanban comercial refleja el resultado. El vendedor es notificado para retomar la negociación.
**Registro:** Campo `subprocesos.crediticio` en `crm_oportunidades`

---

## 7. Roles y responsabilidades (RACI)

| Actividad | Analista Crediticio | Jefe de Créditos | Gerente | Vendedor |
|---|---|---|---|---|
| Asignación a analista | Informado | **Responsable** | Aprueba | Informado |
| Recopilación de información | **Responsable** | Consultado | — | Consultado |
| Consulta Nosis | **Responsable** | — | — | — |
| Evaluación de scoring | **Responsable** | Revisado | — | — |
| Decisión de comité | Consultado | **Responsable** | **Aprueba** | Informado |
| Asignación tier/límite | **Responsable** | Aprueba | Aprueba (si comité) | — |
| Emisión del dictamen | **Responsable** | Aprueba | — | Informado |
| Sincronización CRM | Sistema | — | — | Informado |

---

## 8. Controles e indicadores

| Indicador | Fórmula | Meta | Frecuencia |
|---|---|---|---|
| Tiempo promedio de resolución crediticia | Días desde apertura hasta dictamen | ≤ 5 días hábiles | Mensual |
| Tasa de aprobación | Créditos aprobados / Evaluados | KPI de referencia | Mensual |
| Tasa de incobrabilidad (12 meses) | Créditos con mora > 90 días / Cartera total | ≤ 3% | Trimestral |
| Evaluaciones con SLA vencido | Conteo workflows vencidos | = 0 | Semanal |
| Cobertura de scoring | Clientes con crédito activo y evaluación vigente | 100% | Mensual |
| Score promedio del portfolio | Media de scores de clientes activos | ≥ 6.5 | Trimestral |

---

## 9. Riesgos del proceso

| Riesgo | Causa | Efecto | Severidad | Probabilidad | Control actual |
|---|---|---|---|---|---|
| Evaluación subjetiva sin sustento documental | Presión comercial, falta de disciplina | Riesgo crediticio no detectado | Crítica | Media | Observaciones obligatorias en puntajes extremos |
| Score Nosis no consultado | Error humano, dato CUIT faltante | Información incompleta → decisión errónea | Alta | Media | Checklist de completitud antes del dictamen |
| Decisión de comité sin quórum | Ausencias, urgencia | Dictamen sin respaldo institucional | Alta | Baja | SLA de comité + firma del Gerente obligatoria |
| Evaluación vigente expirada (> 12 meses) | Falta de seguimiento | Decisiones sobre datos desactualizados | Alta | Media | Alerta automática de evaluaciones a vencer |
| Datos del cliente incompletos | Carga incompleta en CRM | Imposibilidad de completar scoring | Media | Alta | Validación de CUIT obligatorio antes de evaluación |
| Límite asignado sin fundamento de desviación | Falta de control | Riesgo crediticio subestimado | Alta | Baja | Campo de justificación obligatorio al desviar tier |

---

## 10. Registros del proceso

| Registro | Sistema | Retención |
|---|---|---|
| Evaluación de riesgo crediticio | `crm_evaluaciones` en Firestore | 7 años |
| Items de evaluación detallados | Sub-colección de evaluación | 7 años |
| Informe Nosis | Documentos del cliente | 7 años |
| Workflow crediticio (historial de estados) | `crm_credit_workflows` | 7 años |
| Actas de comité | Notas del workflow + documentos | 7 años |
| Documentos del cliente (balances, etc.) | Firebase Storage — `/clientes/{id}/documentos/` | 7 años |

---

## 11. Vigencia de las evaluaciones

La evaluación crediticia tiene vigencia de **12 meses** desde su fecha de emisión. Pasado ese plazo, se considera vencida y el cliente debe ser re-evaluado antes de otorgar nuevas condiciones de financiamiento. El sistema alerta automáticamente cuando una evaluación está próxima a vencer.

---

## 12. Interacciones con otros procesos

```
PD-COM-001 (Ventas)
      │
      │  Derivación cuando requiere crédito
      ▼
PD-CRE-001 PROCESO DE EVALUACIÓN DE RIESGO CREDITICIO
      │
      ├──► Proceso de Auditoría Interna
      │     (las evaluaciones son auditadas periódicamente)
      │
      ├──► Proceso de Mejora Continua
      │     (tasa de incobrabilidad → hallazgos → acciones)
      │
      ├──► Proveedor externo: Nosis / Veraz
      │     (controlado según cláusula 8.4.1)
      │
      └──► PD-COM-001 (Ventas) — devolución del dictamen
```

---

## 13. Historial de revisiones

| Versión | Fecha | Descripción | Aprobado por |
|---|---|---|---|
| 1.0 | 2026-03-12 | Versión inicial | Gerencia |

---

*Documento generado en conformidad con ISO 9001:2015 — Secciones 6.1, 8.2 y 8.4*
