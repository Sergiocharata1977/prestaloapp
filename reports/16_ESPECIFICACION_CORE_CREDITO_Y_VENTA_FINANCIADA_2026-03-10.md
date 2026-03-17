# Especificación Concreta del Core de Crédito y Venta Financiada

Fecha: 2026-03-10
Objetivo: definir una base operativa y técnica clara para que Don Cándido Finanzas evolucione hacia un sistema usable para:

- venta de electrodomésticos o ferretería con crédito propio
- préstamos personales en distintas modalidades
- cobranza web sobre deuda abierta
- contabilidad automática por doble partida

## 1. Decisión de diseño

El sistema debe separar dos operaciones origen:

1. `venta_financiada`
2. `prestamo_personal`

No son el mismo objeto de negocio, pero deben compartir el mismo motor de:

- plan de cuotas
- cobranza
- mora
- imputación
- cuenta corriente del cliente
- contabilidad automática

## 2. Principios del sistema

1. El usuario opera por formularios, no por asientos manuales.
2. Cada formulario representa una operación de negocio.
3. Cada operación genera:
- registro operativo
- impacto financiero
- movimientos de cuenta corriente
- asiento contable automático
4. La contabilidad se resuelve por reglas fijas parametrizadas.
5. La cuota se calcula por sistema francés cuando la modalidad lo requiera.
6. La fuente única del saldo del cliente debe ser el subledger de cliente, no campos sueltos.

## 3. Módulos funcionales

### 3.1 Comercial

- productos
- precios
- stock
- venta
- entrega

### 3.2 Crediticio

- solicitud de crédito
- evaluación / scoring
- otorgamiento
- contrato
- plan de cuotas

### 3.3 Cobranzas

- recibos
- pagos web
- imputación
- promesas de pago
- mora
- refinanciación

### 3.4 Contable

- plan de cuentas
- reglas contables
- journal entries
- mayor auxiliar de clientes

## 4. Entidades principales

## 4.1 Clientes

Colección sugerida:

- `crm_organizaciones` como base comercial actual
- o nueva vista consolidada `financial_customers` si se quiere separar dominio financiero

Campos mínimos:

- `id`
- `organization_id`
- `tipo_persona`: `fisica | juridica`
- `nombre`
- `documento`
- `telefono`
- `email`
- `domicilio`
- `estado_cliente`: `activo | bloqueado | judicial | baja`
- `limite_credito_actual`
- `riesgo_actual`

## 4.2 Venta financiada

Colección sugerida:

- `sales_financed`

Campos mínimos:

- `id`
- `organization_id`
- `customer_id`
- `sale_type`: `venta_financiada`
- `currency`
- `product_lines[]`
- `subtotal`
- `discount_total`
- `down_payment_amount`
- `financed_principal`
- `interest_rate_nominal`
- `installments_count`
- `installment_system`: `frances`
- `first_due_date`
- `status`: `draft | approved | delivered | active | cancelled | closed`
- `stock_impact_posted`
- `accounting_posted`
- `credit_account_id`
- `created_at`
- `updated_at`

## 4.3 Préstamo personal

Colección sugerida:

- `personal_loans`

Campos mínimos:

- `id`
- `organization_id`
- `customer_id`
- `loan_type`: `personal`
- `principal_amount`
- `disbursement_amount`
- `administrative_fees`
- `insurance_amount`
- `interest_rate_nominal`
- `installments_count`
- `installment_system`: `frances`
- `first_due_date`
- `disbursement_date`
- `status`: `draft | approved | disbursed | active | delinquent | refinanced | cancelled | closed | written_off`
- `credit_evaluation_id`
- `created_at`
- `updated_at`

## 4.4 Plan de cuotas

Se recomienda un encabezado y un detalle.

Colecciones sugeridas:

- `installment_plans`
- `installments`

### Encabezado `installment_plans`

- `id`
- `organization_id`
- `origin_type`: `venta_financiada | prestamo_personal | refinanciacion`
- `origin_id`
- `customer_id`
- `principal_amount`
- `annual_rate`
- `installments_count`
- `system`: `frances`
- `start_date`
- `status`: `active | cancelled | completed | refinanced`

### Detalle `installments`

- `id`
- `organization_id`
- `plan_id`
- `origin_type`
- `origin_id`
- `customer_id`
- `installment_number`
- `due_date`
- `opening_balance`
- `capital_amount`
- `interest_amount`
- `tax_amount`
- `late_fee_amount`
- `total_scheduled`
- `total_paid`
- `pending_amount`
- `days_past_due`
- `status`: `pending | partially_paid | paid | overdue | refinanced | cancelled`

## 4.5 Cobranzas

Colección sugerida:

- `receipts`

Campos mínimos:

- `id`
- `organization_id`
- `customer_id`
- `receipt_date`
- `payment_channel`: `cash | transfer | card | gateway | debit`
- `payment_reference`
- `gross_amount`
- `applied_amount`
- `unapplied_amount`
- `status`: `pending | confirmed | partially_allocated | allocated | reversed`
- `source`: `backoffice | web_checkout | webhook`
- `payment_intent_id`

## 4.6 Imputación de pagos

Colección sugerida:

- `receipt_allocations`

Campos mínimos:

- `id`
- `organization_id`
- `receipt_id`
- `customer_id`
- `target_type`: `installment | customer_ledger_entry`
- `target_id`
- `installment_id`
- `applied_to`: `late_fee | interest | tax | capital`
- `amount`
- `allocation_order`

## 4.7 Mora y gestión

Colección sugerida:

- `delinquency_cases`

Campos mínimos:

- `id`
- `organization_id`
- `customer_id`
- `origin_type`
- `origin_id`
- `plan_id`
- `overdue_installments_count`
- `overdue_amount`
- `late_fee_accrued`
- `stage`: `preventive | soft_collection | hard_collection | legal`
- `promise_to_pay_date`
- `status`: `open | regularized | escalated | closed`

## 4.8 Refinanciación

Colección sugerida:

- `refinancing_operations`

Campos mínimos:

- `id`
- `organization_id`
- `customer_id`
- `old_plan_id`
- `new_plan_id`
- `refinanced_balance`
- `new_principal`
- `status`: `draft | approved | executed | cancelled`

## 4.9 Cuenta corriente / subledger cliente

Colección sugerida:

- `customer_ledger_entries`

Esta es la pieza más importante para saldo y trazabilidad.

Campos mínimos:

- `id`
- `organization_id`
- `customer_id`
- `entry_date`
- `origin_type`
- `origin_id`
- `document_number`
- `movement_type`: `debit | credit`
- `concept_type`: `sale | loan_disbursement | installment_accrual | receipt | late_fee | refinancing | write_off | adjustment`
- `description`
- `debit_amount`
- `credit_amount`
- `balance_after`
- `journal_entry_id`

## 4.10 Contabilidad

Colecciones sugeridas:

- `chart_of_accounts`
- `accounting_rules`
- `journal_entries`

### `chart_of_accounts`

Campos:

- `id`
- `organization_id`
- `code`
- `name`
- `nature`: `asset | liability | equity | revenue | expense`
- `parent_code`
- `is_postable`
- `status`

### `accounting_rules`

Campos:

- `id`
- `organization_id`
- `operation_type`
- `description`
- `debit_lines[]`
- `credit_lines[]`
- `active`

Ejemplo de línea:

- `account_code`
- `account_name`
- `amount_source`
- `condition`

## 5. Estados clave

## 5.1 Estado de crédito o préstamo

- `draft`
- `approved`
- `disbursed`
- `active`
- `delinquent`
- `refinanced`
- `cancelled`
- `closed`
- `written_off`

## 5.2 Estado de venta financiada

- `draft`
- `approved`
- `delivered`
- `active`
- `cancelled`
- `closed`

## 5.3 Estado de cuota

- `pending`
- `partially_paid`
- `paid`
- `overdue`
- `refinanced`
- `cancelled`

## 5.4 Estado de pago

- `pending`
- `confirmed`
- `partially_allocated`
- `allocated`
- `failed`
- `reversed`

## 6. Operaciones mínimas del sistema

Estas son las operaciones que deben existir como formularios de negocio.

1. alta de venta financiada
2. alta de préstamo personal
3. aprobación / otorgamiento
4. desembolso
5. entrega de mercadería
6. generación de plan de cuotas
7. registro de cobro
8. imputación de cobro
9. generación de mora / punitorio
10. refinanciación
11. cancelación anticipada
12. castigo / incobrable
13. reversión / anulación

## 7. Reglas del sistema francés

Aplica para créditos y ventas financiadas donde haya cuota fija.

Datos de entrada:

- capital financiado
- tasa periódica
- cantidad de cuotas

Resultado por cuota:

- cuota fija
- interés decreciente
- amortización creciente

Campos que deben guardarse por cuota:

- saldo inicial
- interés del período
- amortización de capital
- cuota total
- saldo final

No alcanza con recalcular al vuelo. Debe persistirse el cronograma generado al momento del otorgamiento.

## 8. Reglas de imputación de pagos

Regla estándar recomendada:

1. punitorios
2. intereses
3. impuestos/cargos
4. capital

Política:

- siempre contra deuda más antigua primero
- permitir excepción manual con permiso especial

Esto debe quedar registrado en `receipt_allocations`.

## 9. Catálogo de operaciones contables

## 9.1 Venta financiada

Operación: `sale_financed_confirmed`

Asiento base:

- Debe: créditos por ventas / clientes financiados
- Haber: ventas

Si hay stock:

- Debe: costo de ventas
- Haber: stock mercaderías

Si hay anticipo:

- Debe: caja/banco
- Haber: clientes financiados

## 9.2 Préstamo personal desembolsado

Operación: `personal_loan_disbursed`

Asiento base:

- Debe: cartera de préstamos / créditos otorgados
- Haber: caja/bancos

Si se cobran gastos al origen:

- Debe: cartera o caja según modalidad
- Haber: ingresos por gastos administrativos

## 9.3 Devengamiento de interés

Operación: `interest_accrual`

Asiento base:

- Debe: intereses a cobrar / cartera devengada
- Haber: ingresos financieros por intereses

## 9.4 Cobro de cuota

Operación: `installment_collection`

Asiento base:

- Debe: caja/bancos
- Haber: intereses a cobrar
- Haber: cartera de préstamos o créditos por ventas
- Haber: punitorios a cobrar, si aplica

## 9.5 Punitorio por mora

Operación: `late_fee_accrual`

Asiento base:

- Debe: punitorios a cobrar
- Haber: ingresos por mora

## 9.6 Refinanciación

Operación: `refinancing_executed`

Asiento base:

- cierre de saldo anterior
- apertura de nueva cartera refinanciada

La implementación exacta depende de política contable, pero debe existir como operación diferenciada.

## 9.7 Incobrable / castigo

Operación: `write_off`

Asiento base:

- Debe: previsión / pérdida por incobrables
- Haber: cartera de préstamos o créditos por ventas

## 10. Reglas de negocio por formulario

## 10.1 Formulario `crearVentaConCredito`

Debe hacer:

1. validar cliente
2. validar productos y stock
3. calcular total
4. registrar anticipo si existe
5. calcular saldo financiado
6. generar venta financiada
7. generar plan de cuotas
8. impactar stock
9. crear movimientos de cuenta corriente
10. crear asientos contables

## 10.2 Formulario `crearPrestamoPersonal`

Debe hacer:

1. validar cliente
2. validar aprobación crediticia
3. definir monto, tasa y plazo
4. generar préstamo
5. generar plan de cuotas
6. registrar desembolso
7. crear movimientos de cuenta corriente
8. crear asientos contables

## 10.3 Formulario `registrarCobro`

Debe hacer:

1. crear recibo
2. confirmar pago
3. imputar por regla
4. actualizar cuotas
5. actualizar saldo de cliente
6. generar asiento

## 10.4 Formulario `refinanciarDeuda`

Debe hacer:

1. congelar saldo exigible anterior
2. cerrar o marcar cuotas refinanciadas
3. generar nuevo plan
4. mover saldo a nueva operación
5. registrar asientos

## 11. Integración con eCommerce

El eCommerce no debe resolver lógica financiera compleja.

Debe hacer solo esto:

1. crear orden
2. elegir medio de pago
3. si es crédito propio:
- invocar `crearVentaConCredito`
4. recibir respuesta con:
- venta
- crédito
- plan de cuotas

El core financiero debe ser el dueño de:

- cuotas
- cuenta corriente
- pagos
- mora
- contabilidad

## 12. Pagos web

## 12.1 Entidades

- `payment_intents`
- `receipts`
- `receipt_allocations`

### `payment_intents`

- `id`
- `organization_id`
- `customer_id`
- `target_mode`: `overdue_only | next_installment | full_balance | custom_amount`
- `requested_amount`
- `status`: `pending | paid | failed | expired`
- `provider`
- `provider_reference`

## 12.2 Flujo web

1. cliente entra a “mi deuda”
2. elige monto a pagar
3. backend crea `payment_intent`
4. se redirige al PSP
5. webhook confirma pago
6. backend crea `receipt`
7. backend genera `receipt_allocations`
8. backend actualiza cuotas
9. backend genera asiento

Regla obligatoria:

- nunca marcar pago como confirmado solo por respuesta del front

## 13. Reportes mínimos

1. cartera activa
2. cuotas vencidas
3. mora por antigüedad
4. cobranzas del día
5. cuenta corriente por cliente
6. préstamos vigentes
7. ventas financiadas vigentes
8. intereses devengados
9. refinanciaciones
10. incobrables

## 14. Relación con el sistema actual

Se puede reutilizar del repo actual:

- `crm_organizaciones`
- `crm_contactos`
- `crm_oportunidades`
- `crm_credit_workflows`
- `crm_evaluaciones_riesgo`
- `journal_entries`
- portal cliente

No conviene reutilizar como fuente principal de finanzas:

- resúmenes UI de “deudas” en CRM
- “cuenta corriente” actual basada en datos resumidos
- campos aislados como `limite_credito_actual` como si fueran cartera

## 15. Orden recomendado de implementación

### Fase 1

- plan de cuentas
- reglas contables
- customer ledger
- installment plans
- installments

### Fase 2

- formulario `crearPrestamoPersonal`
- formulario `crearVentaConCredito`

### Fase 3

- formulario `registrarCobro`
- imputación
- pagos web

### Fase 4

- mora
- punitorios
- refinanciación
- incobrables

## 16. Veredicto final

La conversación previa estaba bien orientada, pero le faltaba bajar a estructura concreta. Esta especificación fija esa estructura:

- separa origen comercial de origen crediticio
- unifica el motor de cuotas y cobranzas
- define cuenta corriente real
- define el catálogo mínimo de operaciones
- deja clara la contabilidad automática basada en formularios

La pieza más crítica no es el cálculo francés ni el asiento contable aislado. La pieza crítica es:

- `customer_ledger_entries`
- `installments`
- `receipt_allocations`

Si esas tres capas quedan bien diseñadas, el sistema puede crecer hacia retail financiado y préstamos personales sin romperse.
