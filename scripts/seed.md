# Seed — Datos demo prestaloapp

## Requisitos
Variables de entorno en `.env.local`:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

O bien, un archivo `service-account.json` en la raíz del proyecto.

## Ejecutar
```bash
npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed.ts
```

## Qué inserta
- Organización demo: `org-demo-prestalo`
- 6 cuentas del plan de cuentas (`fin_cuentas`)
- 3 clientes (Rosario x2 + Córdoba)
- 2 créditos activos (sistema francés)
- 18 cuotas auto-generadas (12 + 6)
- 5 cobros de los últimos días
- 2 asientos de otorgamiento
- 1 sucursal central + 1 caja abierta hoy

## Estructura en Firestore
Todas las colecciones viven bajo `organizations/org-demo-prestalo/`:
```
organizations/org-demo-prestalo/
  fin_cuentas/          (6 docs)
  fin_clientes/         (3 docs)
  fin_creditos/         (2 docs)
  fin_cuotas/           (18 docs)
  fin_cobros/           (5 docs)
  fin_asientos/         (2 docs)
  fin_sucursales/
    suc-central/
      fin_cajas/        (1 doc)
```

## Es idempotente
Se puede ejecutar múltiples veces — borra y recrea los datos demo cada vez.

## Solo para desarrollo
Nunca ejecutar en un proyecto con datos reales de producción.
