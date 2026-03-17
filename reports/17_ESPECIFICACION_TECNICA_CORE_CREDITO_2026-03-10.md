# Especificación Técnica del Core de Crédito

Fecha: 2026-03-10
Propósito: definir una versión técnica implementable del núcleo de crédito, venta financiada, cuotas, cobranzas e integración contable para `9001app-firebase`.

## 1. Alcance técnico

Esta especificación cubre:

- nombres de colecciones Firestore
- tipos TypeScript sugeridos
- estados y enums
- payloads de formularios/servicios
- reglas de persistencia
- pseudocódigo de operaciones núcleo
- integración con `journal_entries`

No cubre:

- UI final
- reglas fiscales locales avanzadas
- conciliación bancaria automática

## 2. Criterios técnicos base

1. Todo documento operativo debe llevar `organization_id`.
2. Todo flujo debe ser idempotente.
3. El saldo del cliente no se calcula desde campos agregados sueltos.
4. El saldo se deriva del subledger `customer_ledger_entries`.
5. Toda operación contable estándar debe crearse desde reglas automáticas.
6. Toda cuota debe persistirse como snapshot.

## 3. Modelo Firestore propuesto

Se recomienda mantener colecciones top-level, igual que la base actual del CRM.

### 3.1 Colecciones principales

- `financial_customers`
- `sales_financed`
- `personal_loans`
- `installment_plans`
- `installments`
- `receipts`
- `receipt_allocations`
- `payment_intents`
- `delinquency_cases`
- `refinancing_operations`
- `customer_ledger_entries`
- `chart_of_accounts`
- `accounting_rules`
- `journal_entries`

### 3.2 Reutilización de colecciones existentes

Pueden seguir existiendo y vincularse:

- `crm_organizaciones`
- `crm_contactos`
- `crm_oportunidades`
- `crm_credit_workflows`
- `crm_evaluaciones_riesgo`

Recomendación:

- en etapa inicial, usar `crm_organizaciones` como maestro de cliente
- más adelante crear `financial_customers` sólo si hace falta desacoplar

## 4. Enums y tipos base

```ts
export type CurrencyCode = 'ARS' | 'USD';

export type OriginType =
  | 'venta_financiada'
  | 'prestamo_personal'
  | 'refinanciacion';

export type InstallmentSystem = 'frances';

export type LoanStatus =
  | 'draft'
  | 'approved'
  | 'disbursed'
  | 'active'
  | 'delinquent'
  | 'refinanced'
  | 'cancelled'
  | 'closed'
  | 'written_off';

export type FinancedSaleStatus =
  | 'draft'
  | 'approved'
  | 'delivered'
  | 'active'
  | 'cancelled'
  | 'closed';

export type InstallmentStatus =
  | 'pending'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'refinanced'
  | 'cancelled';

export type ReceiptStatus =
  | 'pending'
  | 'confirmed'
  | 'partially_allocated'
  | 'allocated'
  | 'failed'
  | 'reversed';

export type PaymentChannel =
  | 'cash'
  | 'transfer'
  | 'card'
  | 'gateway'
  | 'debit';

export type LedgerMovementType = 'debit' | 'credit';

export type LedgerConceptType =
  | 'sale'
  | 'loan_disbursement'
  | 'installment_accrual'
  | 'receipt'
  | 'late_fee'
  | 'refinancing'
  | 'write_off'
  | 'adjustment';

export type AllocationTargetType = 'installment' | 'customer_ledger_entry';

export type AllocationComponent =
  | 'late_fee'
  | 'interest'
  | 'tax'
  | 'capital';

export type PaymentIntentMode =
  | 'overdue_only'
  | 'next_installment'
  | 'full_balance'
  | 'custom_amount';
```

## 5. Tipos TypeScript sugeridos

## 5.1 Shared document base

```ts
export interface AuditableDoc {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}
```

## 5.2 Venta financiada

```ts
export interface FinancedSaleLine {
  product_id: string;
  sku?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
  stock_cost?: number;
}

export interface FinancedSale extends AuditableDoc {
  customer_id: string;
  currency: CurrencyCode;
  status: FinancedSaleStatus;
  product_lines: FinancedSaleLine[];
  subtotal: number;
  discount_total: number;
  total_amount: number;
  down_payment_amount: number;
  financed_principal: number;
  interest_rate_nominal: number;
  installments_count: number;
  installment_system: InstallmentSystem;
  first_due_date: string;
  delivery_date?: string;
  plan_id?: string;
  journal_entry_ids?: string[];
  stock_impact_posted: boolean;
  accounting_posted: boolean;
}
```

## 5.3 Préstamo personal

```ts
export interface PersonalLoan extends AuditableDoc {
  customer_id: string;
  currency: CurrencyCode;
  status: LoanStatus;
  principal_amount: number;
  disbursement_amount: number;
  administrative_fees: number;
  insurance_amount: number;
  interest_rate_nominal: number;
  installments_count: number;
  installment_system: InstallmentSystem;
  first_due_date: string;
  disbursement_date?: string;
  credit_evaluation_id?: string;
  plan_id?: string;
  journal_entry_ids?: string[];
  accounting_posted: boolean;
}
```

## 5.4 Plan de cuotas

```ts
export interface InstallmentPlan extends AuditableDoc {
  origin_type: OriginType;
  origin_id: string;
  customer_id: string;
  principal_amount: number;
  annual_rate: number;
  installments_count: number;
  system: InstallmentSystem;
  start_date: string;
  first_due_date: string;
  status: 'active' | 'cancelled' | 'completed' | 'refinanced';
}

export interface Installment extends AuditableDoc {
  plan_id: string;
  origin_type: OriginType;
  origin_id: string;
  customer_id: string;
  installment_number: number;
  due_date: string;
  opening_balance: number;
  capital_amount: number;
  interest_amount: number;
  tax_amount: number;
  late_fee_amount: number;
  total_scheduled: number;
  total_paid: number;
  pending_amount: number;
  days_past_due: number;
  status: InstallmentStatus;
  paid_at?: string;
}
```

## 5.5 Cobranza

```ts
export interface Receipt extends AuditableDoc {
  customer_id: string;
  receipt_date: string;
  payment_channel: PaymentChannel;
  payment_reference?: string;
  gross_amount: number;
  applied_amount: number;
  unapplied_amount: number;
  status: ReceiptStatus;
  source: 'backoffice' | 'web_checkout' | 'webhook';
  payment_intent_id?: string;
  provider?: string;
  provider_reference?: string;
}

export interface ReceiptAllocation extends AuditableDoc {
  receipt_id: string;
  customer_id: string;
  target_type: AllocationTargetType;
  target_id: string;
  installment_id?: string;
  applied_to: AllocationComponent;
  amount: number;
  allocation_order: number;
}
```

## 5.6 Pago web

```ts
export interface PaymentIntent extends AuditableDoc {
  customer_id: string;
  target_mode: PaymentIntentMode;
  requested_amount: number;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  provider: string;
  provider_reference?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}
```

## 5.7 Subledger cliente

```ts
export interface CustomerLedgerEntry extends AuditableDoc {
  customer_id: string;
  entry_date: string;
  origin_type: OriginType | 'receipt' | 'late_fee' | 'write_off' | 'adjustment';
  origin_id: string;
  document_number?: string;
  movement_type: LedgerMovementType;
  concept_type: LedgerConceptType;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance_after: number;
  journal_entry_id?: string;
}
```

## 5.8 Plan de cuentas y reglas

```ts
export interface ChartOfAccount extends AuditableDoc {
  code: string;
  name: string;
  nature: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_code?: string;
  is_postable: boolean;
  status: 'active' | 'inactive';
}

export interface AccountingRuleLine {
  account_code: string;
  account_name: string;
  amount_source: string;
  condition?: string;
}

export interface AccountingRule extends AuditableDoc {
  operation_type: string;
  description: string;
  debit_lines: AccountingRuleLine[];
  credit_lines: AccountingRuleLine[];
  active: boolean;
}
```

## 6. Payloads de servicios y formularios

## 6.1 Crear venta financiada

```ts
export interface CreateFinancedSaleInput {
  organization_id: string;
  customer_id: string;
  currency: CurrencyCode;
  lines: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
  }>;
  down_payment_amount?: number;
  interest_rate_nominal: number;
  installments_count: number;
  first_due_date: string;
  created_by: string;
  idempotency_key?: string;
}
```

## 6.2 Crear préstamo personal

```ts
export interface CreatePersonalLoanInput {
  organization_id: string;
  customer_id: string;
  principal_amount: number;
  administrative_fees?: number;
  insurance_amount?: number;
  interest_rate_nominal: number;
  installments_count: number;
  first_due_date: string;
  disbursement_date: string;
  credit_evaluation_id?: string;
  created_by: string;
  idempotency_key?: string;
}
```

## 6.3 Registrar cobro

```ts
export interface RegisterReceiptInput {
  organization_id: string;
  customer_id: string;
  receipt_date: string;
  payment_channel: PaymentChannel;
  gross_amount: number;
  payment_reference?: string;
  source: 'backoffice' | 'web_checkout' | 'webhook';
  payment_intent_id?: string;
  provider?: string;
  provider_reference?: string;
  created_by: string;
  idempotency_key?: string;
}
```

## 6.4 Refinanciar deuda

```ts
export interface RefinanceDebtInput {
  organization_id: string;
  customer_id: string;
  old_plan_id: string;
  refinanced_balance: number;
  new_interest_rate_nominal: number;
  new_installments_count: number;
  new_first_due_date: string;
  created_by: string;
  idempotency_key?: string;
}
```

## 7. Reglas de persistencia

## 7.1 Índices sugeridos

Mínimos:

- `installments`: `organization_id + customer_id + status + due_date`
- `installments`: `organization_id + plan_id + installment_number`
- `receipts`: `organization_id + customer_id + receipt_date`
- `customer_ledger_entries`: `organization_id + customer_id + entry_date`
- `personal_loans`: `organization_id + customer_id + status`
- `sales_financed`: `organization_id + customer_id + status`

## 7.2 Convenciones

- montos como `number` en centavos o moneda decimal fija definida una sola vez
- fechas guardadas en ISO string o Timestamp, pero no mezclar arbitrariamente
- `idempotency_key` obligatoria en operaciones externas o de webhook

Recomendación:

- si el repo actual ya usa ISO string en CRM, mantener ISO string en estos módulos para consistencia inicial

## 8. Motor francés: función técnica

Firma sugerida:

```ts
export interface FrenchInstallmentItem {
  installment_number: number;
  due_date: string;
  opening_balance: number;
  installment_amount: number;
  capital_amount: number;
  interest_amount: number;
  closing_balance: number;
}

export interface BuildFrenchScheduleInput {
  principal: number;
  annual_rate: number;
  installments_count: number;
  first_due_date: string;
}

export function buildFrenchSchedule(
  input: BuildFrenchScheduleInput
): FrenchInstallmentItem[] {}
```

Reglas:

- tasa periódica mensual = `annual_rate / 12`
- cuota fija
- persistir resultado exacto
- ajustar última cuota para absorber redondeo

## 9. Orden estándar de imputación

Firma sugerida:

```ts
export interface AllocationResult {
  installment_id: string;
  allocations: Array<{
    component: AllocationComponent;
    amount: number;
  }>;
}

export function allocateReceiptAcrossInstallments(params: {
  amount: number;
  installments: Installment[];
}): AllocationResult[] {}
```

Regla obligatoria:

1. cuotas vencidas primero
2. dentro de cada cuota:
- `late_fee`
- `interest`
- `tax`
- `capital`
3. luego cuotas pendientes por fecha

## 10. Pseudocódigo: `crearVentaConCredito`

```ts
async function crearVentaConCredito(input: CreateFinancedSaleInput) {
  assertIdempotency(input.organization_id, input.idempotency_key);

  const customer = await getCustomer(input.customer_id);
  validateCustomer(customer);

  const products = await loadProducts(input.lines);
  validateStock(products, input.lines);

  const normalizedLines = buildFinancedSaleLines(products, input.lines);
  const subtotal = sum(normalizedLines.line_total);
  const discountTotal = sum(normalizedLines.discount_amount);
  const totalAmount = subtotal - discountTotal;
  const downPayment = input.down_payment_amount || 0;
  const financedPrincipal = totalAmount - downPayment;

  assert(financedPrincipal > 0);

  const sale = await createSalesFinanced({
    ...input,
    product_lines: normalizedLines,
    subtotal,
    discount_total: discountTotal,
    total_amount: totalAmount,
    financed_principal: financedPrincipal,
    status: 'approved',
  });

  const schedule = buildFrenchSchedule({
    principal: financedPrincipal,
    annual_rate: input.interest_rate_nominal,
    installments_count: input.installments_count,
    first_due_date: input.first_due_date,
  });

  const plan = await createInstallmentPlanFromSale(sale, schedule);
  await createInstallments(plan, sale, schedule);

  await postStockImpactForSale(sale);

  await postCustomerLedgerEntry({
    customer_id: sale.customer_id,
    concept_type: 'sale',
    movement_type: 'debit',
    debit_amount: financedPrincipal,
    credit_amount: 0,
    origin_type: 'venta_financiada',
    origin_id: sale.id,
  });

  if (downPayment > 0) {
    await postCustomerLedgerEntry({
      customer_id: sale.customer_id,
      concept_type: 'receipt',
      movement_type: 'credit',
      debit_amount: 0,
      credit_amount: downPayment,
      origin_type: 'venta_financiada',
      origin_id: sale.id,
    });
  }

  const journalEntryIds = await postAccountingForFinancedSale({
    sale,
    plan,
    downPayment,
  });

  await markSaleAccountingPosted(sale.id, journalEntryIds, plan.id);

  return { sale_id: sale.id, plan_id: plan.id };
}
```

## 11. Pseudocódigo: `crearPrestamoPersonal`

```ts
async function crearPrestamoPersonal(input: CreatePersonalLoanInput) {
  assertIdempotency(input.organization_id, input.idempotency_key);

  const customer = await getCustomer(input.customer_id);
  validateCustomer(customer);

  if (input.credit_evaluation_id) {
    const evaluation = await getCreditEvaluation(input.credit_evaluation_id);
    validateEvaluationForLoan(evaluation, input.principal_amount);
  }

  const fees = input.administrative_fees || 0;
  const insurance = input.insurance_amount || 0;
  const disbursementAmount = input.principal_amount;

  const loan = await createPersonalLoan({
    ...input,
    disbursement_amount: disbursementAmount,
    administrative_fees: fees,
    insurance_amount: insurance,
    status: 'disbursed',
  });

  const schedule = buildFrenchSchedule({
    principal: input.principal_amount,
    annual_rate: input.interest_rate_nominal,
    installments_count: input.installments_count,
    first_due_date: input.first_due_date,
  });

  const plan = await createInstallmentPlanFromLoan(loan, schedule);
  await createInstallments(plan, loan, schedule);

  await postCustomerLedgerEntry({
    customer_id: loan.customer_id,
    concept_type: 'loan_disbursement',
    movement_type: 'debit',
    debit_amount: input.principal_amount,
    credit_amount: 0,
    origin_type: 'prestamo_personal',
    origin_id: loan.id,
  });

  const journalEntryIds = await postAccountingForPersonalLoan({
    loan,
    plan,
  });

  await markLoanAccountingPosted(loan.id, journalEntryIds, plan.id);

  return { loan_id: loan.id, plan_id: plan.id };
}
```

## 12. Pseudocódigo: `registrarCobro`

```ts
async function registrarCobro(input: RegisterReceiptInput) {
  assertIdempotency(input.organization_id, input.idempotency_key);

  const receipt = await createReceipt({
    ...input,
    applied_amount: 0,
    unapplied_amount: input.gross_amount,
    status: 'confirmed',
  });

  const installments = await getOpenInstallmentsForCustomer(
    input.organization_id,
    input.customer_id
  );

  const allocationPlan = allocateReceiptAcrossInstallments({
    amount: input.gross_amount,
    installments,
  });

  let appliedTotal = 0;
  const allocationDocs = [];

  for (const item of allocationPlan) {
    for (const alloc of item.allocations) {
      const doc = await createReceiptAllocation({
        receipt_id: receipt.id,
        customer_id: input.customer_id,
        target_type: 'installment',
        target_id: item.installment_id,
        installment_id: item.installment_id,
        applied_to: alloc.component,
        amount: alloc.amount,
      });
      allocationDocs.push(doc);
      appliedTotal += alloc.amount;
    }

    await applyAllocationsToInstallment(item.installment_id, item.allocations);
  }

  await updateReceiptAmounts(receipt.id, {
    applied_amount: appliedTotal,
    unapplied_amount: input.gross_amount - appliedTotal,
    status:
      appliedTotal === input.gross_amount ? 'allocated' : 'partially_allocated',
  });

  await postCustomerLedgerEntry({
    customer_id: input.customer_id,
    concept_type: 'receipt',
    movement_type: 'credit',
    debit_amount: 0,
    credit_amount: appliedTotal,
    origin_type: 'receipt',
    origin_id: receipt.id,
  });

  const journalEntryId = await postAccountingForReceipt({
    receipt_id: receipt.id,
    allocations: allocationDocs,
  });

  await linkReceiptJournalEntry(receipt.id, journalEntryId);

  return { receipt_id: receipt.id, journal_entry_id: journalEntryId };
}
```

## 13. Pseudocódigo: `refinanciarDeuda`

```ts
async function refinanciarDeuda(input: RefinanceDebtInput) {
  assertIdempotency(input.organization_id, input.idempotency_key);

  const oldPlan = await getInstallmentPlan(input.old_plan_id);
  const openInstallments = await getOpenInstallmentsByPlan(oldPlan.id);
  const outstandingBalance = calculateOutstandingBalance(openInstallments);

  assertAmountsMatch(outstandingBalance, input.refinanced_balance);

  const refinancing = await createRefinancingOperation({
    old_plan_id: oldPlan.id,
    refinanced_balance: outstandingBalance,
    status: 'approved',
  });

  const schedule = buildFrenchSchedule({
    principal: outstandingBalance,
    annual_rate: input.new_interest_rate_nominal,
    installments_count: input.new_installments_count,
    first_due_date: input.new_first_due_date,
  });

  const newPlan = await createInstallmentPlanFromRefinancing(
    refinancing,
    schedule
  );

  await markInstallmentsAsRefinanced(openInstallments);
  await createInstallments(newPlan, refinancing, schedule);
  await markOldPlanRefinanced(oldPlan.id);

  await postCustomerLedgerAdjustmentForRefinancing({
    customer_id: input.customer_id,
    old_plan_id: oldPlan.id,
    new_plan_id: newPlan.id,
  });

  const journalEntryId = await postAccountingForRefinancing({
    refinancing_id: refinancing.id,
    old_plan_id: oldPlan.id,
    new_plan_id: newPlan.id,
    amount: outstandingBalance,
  });

  await markRefinancingExecuted(refinancing.id, newPlan.id, journalEntryId);

  return { refinancing_id: refinancing.id, new_plan_id: newPlan.id };
}
```

## 14. Integración con `journal_entries`

Se puede reutilizar el servicio actual:

- `src/lib/accounting/CoreLedgerService.ts`

Convención sugerida de `source_module`:

- `finance`

Convención sugerida de `source_type`:

- `financed_sale`
- `personal_loan`
- `receipt`
- `refinancing`
- `late_fee`
- `write_off`

Ejemplo:

```ts
await CoreLedgerService.postEntry({
  organization_id,
  source_module: 'finance',
  source_type: 'personal_loan',
  source_id: loan.id,
  entry_date: new Date(),
  description: 'Desembolso de prestamo personal',
  currency: 'ARS',
  lines: [
    {
      account_code: '113101',
      account_name: 'Prestamos a cobrar',
      debit: 100000,
      credit: 0,
    },
    {
      account_code: '111201',
      account_name: 'Banco cuenta corriente',
      debit: 0,
      credit: 100000,
    },
  ],
  created_by: userId,
  idempotency_key,
});
```

## 15. Reglas contables iniciales mínimas

Operaciones a crear primero en `accounting_rules`:

1. `sale_financed_confirmed`
2. `sale_financed_down_payment`
3. `personal_loan_disbursed`
4. `installment_collection`
5. `late_fee_accrual`
6. `refinancing_executed`
7. `write_off`

## 16. Servicios sugeridos

Archivos sugeridos:

- `src/services/finance/FinancedSaleService.ts`
- `src/services/finance/PersonalLoanService.ts`
- `src/services/finance/InstallmentPlanService.ts`
- `src/services/finance/ReceiptService.ts`
- `src/services/finance/AllocationService.ts`
- `src/services/finance/CustomerLedgerService.ts`
- `src/services/finance/AccountingRuleResolver.ts`
- `src/services/finance/FrenchAmortizationService.ts`
- `src/services/finance/RefinancingService.ts`

## 17. Endpoints sugeridos

```txt
POST   /api/finance/financed-sales
GET    /api/finance/financed-sales/:id
POST   /api/finance/personal-loans
GET    /api/finance/personal-loans/:id
POST   /api/finance/receipts
POST   /api/finance/refinancing
GET    /api/finance/customers/:id/ledger
GET    /api/finance/customers/:id/installments
POST   /api/finance/payment-intents
POST   /api/finance/payment-webhooks/:provider
```

## 18. Validaciones críticas

1. no permitir cuota con `pending_amount < 0`
2. no permitir cobro mayor al saldo si la política no lo acepta
3. no permitir crear plan sin capital positivo
4. no permitir préstamo desembolsado sin evaluación válida, si la política lo exige
5. no duplicar asiento ante retry
6. no duplicar receipt ante webhook repetido
7. no permitir refinanciación con cuotas ya pagadas mal recalculadas

## 19. Estrategia de implementación sobre el repo actual

Paso 1:

- agregar tipos en `src/types/finance.ts`

Paso 2:

- crear `src/services/finance/*`

Paso 3:

- reutilizar `CoreLedgerService`

Paso 4:

- exponer APIs nuevas bajo `/api/finance/*`

Paso 5:

- después integrar portal cliente y CRM

## 20. Veredicto técnico

El diseño correcto para este proyecto no es “hacer un módulo contable y después ver”. El diseño correcto es:

1. crear operaciones origen
2. generar plan de cuotas
3. generar subledger cliente
4. imputar cobranzas
5. automatizar asientos contables

La secuencia técnica correcta es:

- `origin operation -> installment plan -> customer ledger -> receipt allocation -> journal entry`

Si se respeta ese orden, el sistema queda preparado tanto para:

- venta financiada de electrodomésticos
- crédito propio de comercio
- préstamos personales en distintas modalidades

