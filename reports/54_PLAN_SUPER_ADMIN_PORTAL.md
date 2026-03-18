# Plan Super Admin Portal — Préstalo

**Fecha:** 2026-03-18
**Proyecto:** prestaloapp
**Estado:** PLANIFICACIÓN
**Referencia:** 9001app-firebase/super-admin (estructura base reutilizable)

---

## Visión

Préstalo es un **SaaS multi-tenant** para financieras y prestamistas. El Super Admin
es el panel desde donde el dueño del sistema (Sergio) gestiona todas las organizaciones
(clientes de Préstalo) sin tocar Firebase Console ni la base de datos directamente.

```
prestaloapp.vercel.app/
├── /                    → Landing B2B pública
├── /login               → Login tenant
├── /(dashboard)/        → App por organización (ya existe)
└── /super-admin/        → Panel SaaS ← LO QUE CONSTRUIMOS
```

---

## Arquitectura multi-tenant actual

```
Firebase Auth
  └── Usuario → custom claims: { organizationId, role, admin }

Firestore
  └── organizations/
        ├── org_prestalo/          ← la org demo (ya existe)
        │     ├── fin_clientes/
        │     ├── fin_creditos/
        │     └── ...
        └── org_financiera_norte/  ← futuros clientes
              └── ...
```

**El Super Admin se distingue por:** `admin: true` en custom claims (sin `organizationId` fijo).
Puede operar sobre cualquier `orgId` enviando el header `x-org-id`.

---

## Módulos del Super Admin

### Vista Dashboard
- Total de organizaciones activas
- Total de usuarios globales
- Últimas organizaciones creadas
- Estado del sistema (Firestore, Auth)

### Organizaciones
- Listar todas con: nombre, plan, fecha creación, nro clientes, nro créditos
- Crear nueva organización + usuario admin de esa org
- Ver detalle de una org (stats de uso)
- Activar / desactivar org

### Usuarios Globales
- Listar usuarios con su org, rol, último login
- Crear usuario en una org con rol específico
- Resetear contraseña
- Cambiar rol / revocar acceso

### Demo Requests *(fase 2)*
- Gestionar solicitudes de demo desde la landing
- Convertir demo request en organización activa

---

## Olas de desarrollo

Cada ola es **independiente** y puede ejecutarse con un agente en paralelo.

---

### OLA 1 — Infraestructura y protección de rutas
**Archivos a crear:**

```
src/lib/api/superAdminAuth.ts         ← withAuth options para role: 'super_admin'
src/app/(super-admin)/layout.tsx      ← Shell del super admin (sidebar propio)
src/app/(super-admin)/super-admin/page.tsx  ← Dashboard con stats globales
src/app/api/super-admin/stats/route.ts      ← GET stats globales
```

**Detalle:**
- Nuevo route group `(super-admin)` separado del `(dashboard)` de tenants
- `superAdminAuth.ts`: `{ roles: ['super_admin'], admin: true }`
- Middleware: rutas `/super-admin/*` requieren `admin: true` en token
- Sidebar con: Dashboard, Organizaciones, Usuarios
- Stats card: total orgs, total users, orgs activas

**Dependencias:** ninguna
**Referencia:** `9001app-firebase/src/lib/api/superAdminAuth.ts`

---

### OLA 2 — CRUD Organizaciones
**Archivos a crear:**

```
src/app/api/super-admin/organizations/route.ts          ← GET lista, POST nueva
src/app/api/super-admin/organizations/[orgId]/route.ts  ← GET detalle, PATCH, DELETE
src/app/(super-admin)/super-admin/organizaciones/page.tsx
src/app/(super-admin)/super-admin/organizaciones/nueva/page.tsx
src/app/(super-admin)/super-admin/organizaciones/[orgId]/page.tsx
src/types/super-admin.ts                                 ← tipos Organization, SuperAdminUser
```

**Detalle:**
- `GET /api/super-admin/organizations` → lista `organizations/*` de Firestore
- `POST /api/super-admin/organizations` → crea doc Firestore + usuario Firebase Auth + custom claims
- `PATCH /api/super-admin/organizations/[orgId]` → activa/desactiva, cambia plan
- Tabla con columnas: nombre, plan, createdAt, clientes, créditos, acciones
- Formulario nueva org: nombre, plan (free/pro/enterprise), email admin, contraseña temporal

**Dependencias:** OLA 1
**Referencia:** `9001app-firebase/src/app/(dashboard)/super-admin/organizaciones/`

---

### OLA 3 — CRUD Usuarios Globales
**Archivos a crear:**

```
src/app/api/super-admin/users/route.ts          ← GET lista global, POST nuevo
src/app/api/super-admin/users/[uid]/route.ts    ← GET, PATCH claims, DELETE
src/app/(super-admin)/super-admin/usuarios/page.tsx
src/app/(super-admin)/super-admin/usuarios/nuevo/page.tsx
```

**Detalle:**
- Listar usuarios via Firebase Admin `auth.listUsers()`
- Mostrar: email, displayName, organizationId, role, último acceso
- Crear usuario: asigna `organizationId` + `role` via `setCustomUserClaims`
- Resetear contraseña: `auth.generatePasswordResetLink(email)`
- Revocar acceso: `auth.updateUser(uid, { disabled: true })`

**Dependencias:** OLA 1
**Referencia:** `9001app-firebase/src/app/(dashboard)/super-admin/usuarios/`

---

### OLA 4 — Demo Requests + Conversión a Org *(fase 2)*
**Archivos a crear:**

```
src/app/api/super-admin/demo-requests/route.ts
src/app/(super-admin)/super-admin/demo-requests/page.tsx
src/app/api/public/demo-request/route.ts   ← endpoint público desde landing
```

**Detalle:**
- La landing tiene formulario "Solicitar demo" → POST `/api/public/demo-request`
- Guarda en `demo_requests/` en Firestore con status: `pending`
- Super Admin ve la lista, puede convertir un request en org activa (1 click)
- Integración: al aprobar → ejecuta lógica de OLA 2 (crear org + user)

**Dependencias:** OLA 2, OLA 3

---

## Convenciones técnicas

```ts
// superAdminAuth.ts
export const SUPER_ADMIN_OPTIONS: WithAuthOptions = {
  roles: ['super_admin'],
};

// En route handlers:
export const GET = withAuth(async (req, ctx, auth) => {
  // auth.user.admin === true
  // auth.organizationId viene de header x-org-id
}, SUPER_ADMIN_OPTIONS);
```

```ts
// Custom claims para super admin
await auth.setCustomUserClaims(uid, {
  role: 'super_admin',
  admin: true,
  // sin organizationId — puede operar en cualquier org
});
```

```
// Estructura Firestore organización
organizations/{orgId}: {
  id: string,
  nombre: string,
  plan: 'free' | 'pro' | 'enterprise',
  status: 'active' | 'inactive' | 'trial',
  createdAt: string,
  owner_email: string,
  trial_ends_at?: string,
}
```

---

## Instrucciones para agentes paralelos

Cada ola puede ejecutarse con un agente independiente. El contexto necesario:

```
Proyecto: c:/Users/Usuario/Documents/Proyectos/ISO -conjunto/prestaloapp
Stack: Next.js 16 (App Router), TypeScript, Firebase Admin, Tailwind
Autenticación: withAuth() en src/lib/api/withAuth.ts
Colecciones: src/firebase/collections.ts
Componentes UI: src/components/ui/ (button, card, input, dialog, data-table, badge)
Referencia super-admin: c:/Users/Usuario/Documents/Proyectos/ISO -conjunto/9001app-firebase/src/app/(dashboard)/super-admin/
Convención params: const { id } = await context.params (Next.js 16 async params)
```

**Orden recomendado:**
1. OLA 1 primero (bloquea al resto)
2. OLA 2 y OLA 3 en paralelo (ambas dependen solo de OLA 1)
3. OLA 4 al final

---

## Checklist antes de cada ola

- [ ] `npx tsc --noEmit` pasa sin errores antes de empezar
- [ ] Todos los route handlers con `[id]` usan `await context.params`
- [ ] Ningún código Firebase Admin en top-level de módulo
- [ ] Pushear al final de cada ola y verificar build en Vercel
