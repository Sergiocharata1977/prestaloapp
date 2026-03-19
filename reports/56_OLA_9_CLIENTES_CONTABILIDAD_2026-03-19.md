# OLA 9 — Clientes mejorado + Contabilidad automática
**Fecha:** 2026-03-19
**Estado:** En ejecución

---

## Decisiones de diseño

- **Contabilidad = solo lectura, no editable.** Los asientos se generan automáticamente desde los formularios operativos (crédito, cobro, liquidación de cheque). No hay ingreso manual de asientos.
- **Libro Diario y Mayor** se eliminan como páginas navegables del sistema. Los registros quedan en Firestore para auditoría pero la UI no los expone como módulo.
- **Registros estructurados**: toda transacción financiera dispara un asiento balanceado via `JournalEntryService` / `CreditoService`.

---

## Auditoría de cobertura contable (estado actual)

| Formulario / Operación | Genera asiento | Servicio |
|---|---|---|
| Otorgar crédito | ✅ | `CreditoService.crear()` → `buildAsientoOtorgamiento()` |
| Cobrar cuota | ✅ | `CobroService` → `JournalEntryService` |
| Liquidar operación de cheque | ✅ | `OperacionChequeService` → `JournalEntryService` |
| Alta cliente | — | No aplica (no mueve dinero) |
| Alta caja | — | No aplica (apertura/cierre es gestión) |

**Conclusión:** Todos los formularios que mueven dinero ya generan asiento automático.

---

## Tareas OLA 9

### Tarea 1 — Eliminar Libro Diario + Mayor del sidebar y sus páginas

**Archivos a eliminar:**
- `src/app/(dashboard)/asientos/page.tsx`
- `src/app/(dashboard)/asientos/[id]/page.tsx`
- `src/app/(dashboard)/asientos/mayor/page.tsx`
- `src/app/(dashboard)/asientos/nuevo/page.tsx`

**Sidebar:** Quitar `{ href: "/asientos", label: "Libro Diario" }` y `{ href: "/asientos/mayor", label: "Mayor" }` de `bottomItems`.

**Nota:** Las API routes `/api/fin/asientos/*` y `/api/fin/asientos/mayor` se **mantienen** — son usadas por los servicios para guardar asientos.

---

### Tarea 2 — Filtro por tipo de cliente en lista de clientes

La lista ya muestra `saldo_total_adeudado`. Agregar:

1. **Frontend** `src/app/(dashboard)/clientes/page.tsx`:
   - Dropdown "Tipo de cliente" con opciones cargadas de `/api/fin/tipos-cliente`
   - Pasa `tipoClienteId` como query param a `/api/fin/clientes`
   - Columna "Tipo" en la tabla (física/jurídica + nombre del tipo_cliente si existe)

2. **API Route** `src/app/api/fin/clientes/route.ts`:
   - Leer `?tipoClienteId=xxx` del searchParams
   - Llamar `ClienteService.list(orgId, limit, { tipoClienteId })`

3. **ClienteService** `src/services/ClienteService.ts`:
   - Agregar filtro `tipo_cliente_id` al query Firestore en `list()`

---

### Tarea 3 — Detalle de cliente: pestaña Operaciones

El detalle ya tiene pestañas "Resumen" y "Legajo". Agregar pestaña **"Operaciones"** con:

- **Créditos activos** (tabla): Nro, Capital, Cuotas pagas/total, Estado, Fecha
- **Cheques en curso** (tabla): Operación, Cheques count, Neto, Estado, Fecha
- **Últimos cobros** (tabla): Fecha, Capital, Interés, Mora, Total, Caja

Fuentes:
- Créditos: `/api/fin/creditos?clienteId={id}` (ya existe)
- Cheques: `/api/fin/operaciones-cheques?clienteId={id}` (verificar si existe o agregar)
- Cobros: `/api/fin/clientes/{id}/cuenta-corriente` (ya existe)

---

## Resultado esperado

- Sidebar más limpio: sin Libro Diario ni Mayor
- Lista de clientes con filtro rápido por tipo → permite ver "¿cuántos clientes Empresa A tenemos?"
- Detalle de cliente = visión 360° de todas sus operaciones desde una sola pantalla
