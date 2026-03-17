# Plan 51 — prestaloapp: Financiación al Consumo (Desde Cero)

**Reemplaza:** Plan 50 (borrado por problemas de rendering)
**Fecha:** 2026-03-15 (rev. checkpoints 2026-03-15)
**Repo GitHub:** `Sergiocharata1977/prestaloapp`
**Local:** `c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp`

---

## Contexto y Causa Raíz del Plan Anterior

El Plan 50 (`financiacion-app`) falló en **Ola 4 (Frontend)** por conflictos de renderización: múltiples agentes escribiendo frontend en paralelo sin verificación de build intermedia generó:
- Componentes que usan hooks sin `'use client'`
- Firebase Client SDK importado en Server Components
- Providers sin el árbol correcto de contexto
- Hidratación rota

**Solución Plan 51:** Frontend dividido en 3 sub-olas secuenciales + **3 Checkpoints Vercel** distribuidos a lo largo del plan + checks livianos locales entre cada ola.

---

## Lo que YA existe y se migra directamente

Archivos **100% completos** en `9001app-firebase` que se copian al nuevo proyecto:

| Archivo | Estado | Notas |
|---------|--------|-------|
| `src/types/fin-*.ts` (6 archivos) | ✅ Completo | Tipos puros, sin deps |
| `src/services/AmortizationService.ts` | ✅ Completo | Francés + Alemán, fechas robustas |
| `src/services/ClienteService.ts` | ✅ Completo | CRUD + búsqueda fuzzy + Nosis |
| `src/services/CreditoService.ts` | ✅ Completo | Transaccional, cuotas auto, secuencias |
| `src/services/JournalEntryService.ts` | ✅ Completo | Asientos otorgamiento + cobro |
| `src/services/NosisService.ts` | ✅ Completo | Sandbox + Real API + logging |
| `src/firebase/collections.ts` | ✅ Completo | Paths Firestore multi-tenant |

---

## Reglas de Renderización (DEBEN respetarse en TODA la app)

### Regla 1 — `'use client'` obligatorio si el componente usa:
- `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`
- `useRouter`, `usePathname`, `useSearchParams`
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Context hooks (`useAuth`, etc.)
- Firebase Client SDK (`db`, `auth` de `@/firebase/config`)

### Regla 2 — Server Components SOLO pueden:
- Importar `firebase-admin` (Admin SDK, nunca Client SDK)
- Llamar servicios backend (`ClienteService`, `CreditoService`, etc.)
- No tienen hooks, no tienen event handlers

### Regla 3 — Providers en archivo separado `'use client'`:
```typescript
// src/components/Providers.tsx
'use client'
export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider><Toaster />{children}</AuthProvider>
}
```

### Regla 4 — Imports de Firebase:
- **Client SDK** (`@/firebase/config`) → SOLO en archivos `'use client'`
- **Admin SDK** (`@/firebase/admin`) → SOLO en API routes y Server Components

### Regla 5 — Analytics:
```typescript
// firebase/config.ts ya exporta null en server
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null
```

---

## Sistema de Verificación (LEER ANTES DE EJECUTAR CUALQUIER OLA)

### Tres niveles de check

| Nivel | Cuándo | Comando | Tiempo estimado |
|-------|--------|---------|-----------------|
| 🟡 **Check local liviano** | Después de CADA ola | `npx tsc --noEmit` | ~10 seg |
| 🟠 **Check local completo** | Ola 4 (todas las fases) | `npm run build` (local) | ~2-3 min |
| 🔴 **Checkpoint Vercel** | Olas 1, 3 y 4 Fase 1 | Push a GitHub → Vercel redeploya | ~3-5 min |

> **Regla de oro:** Si el check local falla → NO continuar con la siguiente ola.
> Si el Checkpoint Vercel falla → STOP total, diagnosticar antes de avanzar.

---

### Script de Audit de Imports (ejecutar después de copiar archivos de 9001app-firebase)

```bash
# Detecta Client SDK filtrado en archivos server-side
echo "=== Client SDK en services/ ==="
grep -rn "from 'firebase'" src/services/ 2>/dev/null | grep -v "firebase-admin" || echo "OK"

echo "=== Client SDK en API routes ==="
grep -rn "from 'firebase'" src/app/api/ 2>/dev/null | grep -v "firebase-admin" || echo "OK"

echo "=== Admin SDK en componentes 'use client' ==="
grep -rn "firebase-admin" src/components/ 2>/dev/null || echo "OK"

echo "=== Admin SDK en hooks ==="
grep -rn "firebase-admin" src/hooks/ 2>/dev/null || echo "OK"

echo "=== Componentes con hooks sin 'use client' ==="
grep -rn "useState\|useEffect\|useRouter" src/components/ 2>/dev/null | grep -v "use client" | head -20 || echo "OK"
```

> Guardar como `scripts/audit-imports.sh` y ejecutar con `bash scripts/audit-imports.sh`.
> Resultado esperado: todos los grupos deben mostrar `OK`.

---

### Cómo ejecutar un Checkpoint Vercel

```bash
# 1. Asegurarse que el check local pasó
npx tsc --noEmit

# 2. Commit y push
git add -A
git commit -m "checkpoint: ola X completa"
git push origin main

# 3. Vercel redeploya automáticamente (si está conectado a GitHub)
# Verificar en: https://vercel.com/dashboard → prestaloapp → deployment

# 4. Si el build de Vercel falla:
#    a. Revisar los logs de Vercel (Build Logs)
#    b. El error más común: env vars faltantes o import incorrecto
#    c. NO avanzar a la siguiente ola hasta resolver
```

---

### 3 Checkpoints Vercel en el plan

```
OLA 0  →  OLA 1  →  [🔴 CP VERCEL 1]  →  OLA 2  →  OLA 3  →  [🔴 CP VERCEL 2]
    →  OLA 4 Fase 1 (4A)  →  [🔴 CP VERCEL 3]  →  OLA 4 Fase 2 (4B+4C)  →  OLA 4 Fase 3 (4D+4E)  →  OLA 5  →  Deploy final
```

| Checkpoint | Después de | Qué verifica |
|------------|-----------|--------------|
| 🔴 **CP Vercel 1** | Ola 1 | Firebase config + middleware + auth hooks compilan en Vercel |
| 🔴 **CP Vercel 2** | Ola 3 | API routes (20+ endpoints) compilan sin errores en Vercel |
| 🔴 **CP Vercel 3** | Ola 4 Fase 1 (4A) | Frontend shell renderiza correctamente en Vercel (crítico: SSR) |
| Deploy final | Ola 5 | App completa en producción |

---

## Stack completo a instalar

```json
{
  "dependencies": {
    "next": "14.2.18",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.4.5",
    "firebase": "^12.4.0",
    "firebase-admin": "^13.5.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-toast": "^1.2.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-popover": "^1.1.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "lucide-react": "^0.468.0",
    "zod": "^3.23.8",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "openai": "^4.68.0",
    "@anthropic-ai/sdk": "^0.67.0",
    "groq-sdk": "^0.7.0",
    "resend": "^4.0.0",
    "recharts": "^2.13.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "xlsx": "^0.18.5",
    "@sentry/nextjs": "^8.40.0",
    "posthog-js": "^1.194.0",
    "@vercel/analytics": "^1.4.0",
    "@capacitor/core": "^7.0.0",
    "@capacitor/android": "^7.0.0",
    "@capacitor/cli": "^7.0.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/leaflet": "^1.9.14",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.18",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "prettier": "^3.3.3",
    "husky": "^9.1.7",
    "lint-staged": "^15.2.10",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.5.2",
    "@playwright/test": "^1.49.1",
    "ts-jest": "^29.2.5"
  }
}
```

---

## Estructura de carpetas a crear en Ola 0

```
prestaloapp/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          ← sidebar + topbar
│   │   │   ├── page.tsx            ← dashboard home
│   │   │   ├── clientes/
│   │   │   ├── creditos/
│   │   │   ├── cobros/
│   │   │   ├── cajas/
│   │   │   ├── asientos/
│   │   │   └── plan-cuentas/
│   │   ├── api/
│   │   │   └── fin/
│   │   │       ├── clientes/
│   │   │       ├── creditos/
│   │   │       ├── cobros/
│   │   │       ├── sucursales/
│   │   │       ├── asientos/
│   │   │       └── plan-cuentas/
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                     ← shadcn atoms
│   │   ├── fin/                    ← componentes de dominio
│   │   └── Providers.tsx           ← 'use client' providers
│   ├── firebase/
│   │   ├── admin.ts                ← Admin SDK (server only)
│   │   ├── config.ts               ← Client SDK
│   │   └── collections.ts          ← paths Firestore
│   ├── hooks/
│   │   └── useAuth.ts
│   ├── lib/
│   │   ├── api/
│   │   │   └── withAuth.ts
│   │   └── utils.ts               ← cn() helper
│   ├── middleware/
│   │   └── verifyOrganization.ts
│   ├── services/
│   │   ├── AmortizationService.ts  ← copiado de 9001app-firebase
│   │   ├── ClienteService.ts       ← copiado
│   │   ├── CreditoService.ts       ← copiado
│   │   ├── JournalEntryService.ts  ← copiado
│   │   └── NosisService.ts         ← copiado
│   ├── types/
│   │   ├── fin-asiento.ts          ← copiado de 9001app-firebase
│   │   ├── fin-cliente.ts          ← copiado
│   │   ├── fin-cobro.ts            ← copiado
│   │   ├── fin-credito.ts          ← copiado
│   │   ├── fin-cuota.ts            ← copiado
│   │   └── fin-plan-cuentas.ts     ← copiado
│   └── middleware.ts
├── .env.local.example
├── .gitignore
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Resumen de Olas

| Ola | Quién | Agentes | Prerequisito | Check local | Check Vercel |
|-----|-------|---------|--------------|-------------|--------------|
| 0 | Claude Code | — | Nada | `npm run build` ✅ | deploy inicial OK |
| 1 | Agentes (paralelo) | 1A + 1B | Ola 0 OK | 🟡 `tsc --noEmit` | 🔴 **CP Vercel 1** |
| 2 | Agentes (paralelo) | 2A + 2B | CP Vercel 1 OK | 🟡 `tsc --noEmit` + `npm test` | — |
| 3 | Agentes (paralelo) | 3A + 3B + 3C + 3D | Ola 2 OK | 🟡 `tsc --noEmit` | 🔴 **CP Vercel 2** |
| **4** Fase 1 | **1 agente solo** | 4A | CP Vercel 2 OK | 🟠 `npm run build` local | 🔴 **CP Vercel 3** |
| **4** Fase 2 | Agentes (paralelo) | 4B + 4C | CP Vercel 3 OK | 🟠 `npm run build` local | — |
| **4** Fase 3 | Agentes (paralelo) | 4D + 4E | Fase 2 build OK | 🟠 `npm run build` + `npm test` | — |
| 5 | Agentes (paralelo) | 5A + 5B | Ola 4 Fase 3 OK | — | 🚀 Deploy final |

> **Regla:** Las olas con CP Vercel no arrancan hasta que el dashboard de Vercel muestre build verde.

---

## OLA 0 — YO (Claude Code) ejecuto

**Acciones:**
1. `npx create-next-app@latest prestaloapp` con flags: `--typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack`
2. Instalar todas las dependencias del stack completo
3. Configurar Tailwind v4: `@tailwindcss/postcss` + `globals.css`
4. Crear estructura de carpetas completa
5. Copiar `src/types/fin-*.ts` desde `9001app-firebase`
6. Copiar `src/services/{AmortizationService,ClienteService,CreditoService,JournalEntryService,NosisService}.ts` desde `9001app-firebase`
7. Copiar `src/firebase/collections.ts` desde `9001app-firebase`
8. Crear `.env.local.example` con todas las variables necesarias
9. Crear `src/lib/utils.ts` con función `cn()`
10. **Crear `scripts/audit-imports.sh`** (ver sección "Verificaciones de entrega" al final del plan)
11. `gh repo create Sergiocharata1977/prestaloapp --private --source=. --push`
12. `vercel --prod` (deploy inicial con esqueleto)

**Resultado:** Repo GitHub creado, deploy Vercel vacío funcionando con build OK. Script de audit listo para usar en todas las olas siguientes.

---

## OLA 1 — Configuración técnica base

> Ejecutar 1A + 1B en PARALELO
> Prerequisito: Ola 0 completa

---

### Agente 1A — Firebase config, admin, middleware y withAuth

**Archivos a crear:**
- `src/firebase/admin.ts`
- `src/firebase/config.ts`
- `src/middleware.ts`
- `src/middleware/verifyOrganization.ts`
- `src/lib/api/withAuth.ts`

**Prompt:**
```
Sos un agente de configuración de Firebase para Next.js 14 App Router.

El proyecto es `prestaloapp`, una app de financiación al consumo.
Comparte el mismo Firebase project que `9001app-firebase` (mismos custom claims: organizationId, role).

CONTEXTO DE RENDERIZACIÓN — CRÍTICO:
- firebase-admin SOLO en archivos server-side (API routes, Server Components)
- firebase client SDK SOLO en archivos 'use client' o en firebase/config.ts
- NUNCA importar firebase-admin en un componente React

CREAR src/firebase/admin.ts:
- Inicialización singleton con pattern: getApps().length > 0 ? getApp() : initializeApp(credential)
- Intenta leer service-account.json (raíz del proyecto), si no existe usa env vars
- Env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (procesar \n), FIREBASE_STORAGE_BUCKET
- Exportar: adminApp, adminAuth, adminDb, adminStorage
- Exportar helper: getAdminFirestore() que retorna adminDb
- Exportar objeto auth con: getUser(uid), verifyIdToken(token), verifySessionCookie(cookie, checkRevoked?)

CREAR src/firebase/config.ts:
- Client SDK (firebase, NO firebase-admin)
- Config desde NEXT_PUBLIC_FIREBASE_* env vars
- Validación early: si falta alguna env var, throw Error con lista de faltantes
- Exportar: app, auth, db, storage
- analytics: typeof window !== 'undefined' ? getAnalytics(app) : null (SSR-safe)

CREAR src/middleware.ts:
- Ruta: /api/fin/* requiere auth
- Verifica Bearer token o session cookie
- Si no hay token válido: 401
- Si el token es válido: pasa a la route
- Rutas públicas: /api/health, / (home)
- Usar firebase-admin para verificar tokens (server-only)

CREAR src/middleware/verifyOrganization.ts:
- Exportar función: resolveAuthorizedOrganizationId(request, decodedToken)
- Lógica: si decodedToken.organizationId existe → retorna ese ID
- Si el token tiene claim 'admin' → puede operar sobre cualquier org (leer header x-org-id)
- Exportar: toOrganizationApiError(code, message) → NextResponse.json({error}, {status})

CREAR src/lib/api/withAuth.ts:
- HOF: withAuth(handler, options?) → RouteHandler
- options: { roles?: string[] } — si se especifica, verifica que el usuario tenga ese rol
- Decodifica token, llama resolveAuthorizedOrganizationId, pasa { user, organizationId } al handler
- Si el token es inválido → 401
- Si el rol no coincide → 403
- El handler recibe: (request: NextRequest, context: { params }, authContext: { user, organizationId })

REGLAS DE TYPESCRIPT:
- TypeScript strict, sin 'any' implícito
- Tipos exportados para AuthContext y DecodedToken
```

---

### Agente 1B — Hooks de auth y providers

**Archivos a crear:**
- `src/hooks/useAuth.ts`
- `src/components/Providers.tsx`
- `src/components/AuthGuard.tsx`

**Prompt:**
```
Sos un agente de React para Next.js 14 App Router.

CRÍTICO — REGLAS DE RENDERIZACIÓN:
- Providers.tsx DEBE tener 'use client' al inicio
- useAuth.ts DEBE tener 'use client' al inicio
- AuthGuard.tsx DEBE tener 'use client' al inicio
- NUNCA usar firebase-admin en estos archivos (solo firebase client SDK)
- Importar auth SOLO de '@/firebase/config'

CREAR src/components/Providers.tsx:
```tsx
'use client'
import { ReactNode } from 'react'
import { AuthProvider } from '@/hooks/useAuth'
// Toaster de Radix Toast
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      {/* Toaster aquí */}
    </AuthProvider>
  )
}
```

CREAR src/hooks/useAuth.ts:
- 'use client' al inicio
- Context: AuthContext con { user: FirebaseUser | null, loading: boolean, organizationId: string | null, role: string | null, signOut: () => Promise<void> }
- AuthProvider: escucha onAuthStateChanged, extrae custom claims (organizationId, role) de getIdTokenResult
- Hook useAuth(): retorna el context, throw si se usa fuera del Provider
- Exportar: AuthProvider, useAuth, AuthContext

CREAR src/components/AuthGuard.tsx:
- 'use client' al inicio
- Componente que verifica si hay usuario autenticado
- Si loading: mostrar spinner (div centrado con animate-spin)
- Si no hay user: router.push('/login')
- Si hay user: render children
- Props: { children: ReactNode, requiredRole?: string }
```

---

## 🔴 CHECKPOINT VERCEL 1 — Después de Ola 1

> **NO iniciar Ola 2 hasta que este checkpoint sea verde.**

### Qué se verifica
Firebase config (`admin.ts`, `config.ts`), middleware y auth hooks compilan correctamente en el entorno de Vercel (variables de entorno reales, sin service-account.json local).

### Pasos

```bash
# 1. Check local liviano (antes del push)
cd /c/Users/Usuario/Documents/Proyectos/ISO\ -conjunto/prestaloapp
npx tsc --noEmit

# 2. Audit de imports (crítico después de copiar archivos)
bash scripts/audit-imports.sh

# 3. Si ambos OK → commit y push
git add -A
git commit -m "ola-1: firebase config + auth hooks + middleware"
git push origin main
```

### Qué verificar en Vercel
1. Abrir [https://vercel.com/dashboard](https://vercel.com/dashboard) → proyecto `prestaloapp`
2. Esperar a que el deploy termine (3-5 min)
3. Estado esperado: **Build succeeded** (aunque la app muestre pantalla vacía, el build debe ser verde)
4. Revisar el tab **Build Logs** buscando errores TypeScript o imports rotos

### Errores comunes y solución

| Error en Vercel | Causa | Solución |
|----------------|-------|----------|
| `Cannot find module 'firebase-admin'` | Falta en `package.json` o no instalado | `npm install firebase-admin` → commit |
| `FIREBASE_PROJECT_ID is not defined` | Env var no configurada en Vercel | Agregar en Vercel → Settings → Environment Variables |
| `Module not found: '@/firebase/config'` | Path alias no resuelto | Verificar `tsconfig.json` paths |
| Error de tipo en `middleware.ts` | Import de firebase-admin mal tipado | Corregir en local + re-check |

### Criterio de paso: ✅
Build de Vercel verde. Si falla → diagnosticar ANTES de avanzar.

---

## OLA 2 — Servicios (validación y ajuste de imports)

> Ejecutar 2A + 2B en PARALELO
> Prerequisito: **CP Vercel 1 OK**

> ⚠️ **DIRECTORIO DE TRABAJO OBLIGATORIO:**
> ```
> c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
> ```
> Verificar SIEMPRE con `pwd` antes de escribir archivos. NO usar ningún otro directorio.

Los servicios ya fueron copiados desde 9001app-firebase en Ola 0.
Esta ola ajusta imports y corrige inconsistencias detectadas.

---

### Agente 2A — AmortizationService + tests

**Archivos:**
- `src/services/AmortizationService.ts` (ajustar si hay imports externos)
- `src/__tests__/services/AmortizationService.test.ts` (crear/actualizar)

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

El archivo src/services/AmortizationService.ts ya existe (copiado de otro proyecto).

TAREA 1 — Verificar que no tiene imports externos (es puro TypeScript). Si los tiene, eliminarlos o reemplazarlos con lógica inline.

TAREA 2 — Crear src/__tests__/services/AmortizationService.test.ts con tests para:
- Sistema francés: capital=10000, tasa=5%, 12 cuotas → verificar total_credito, 12 cuotas generadas, suma capital = 10000
- Sistema alemán: capital=6000, tasa=3%, 6 cuotas → capital fijo=1000, interés decreciente
- Tasa 0%: cuotas iguales, sin intereses
- Fechas: preservar fin de mes (31 enero + 1 mes → 28/29 feb)
- Validaciones: capital negativo → throw, cuotas=0 → throw, fecha inválida → throw

Usar Jest + describe/it/expect. Sin mocks (puro cálculo).
```

---

### Agente 2B — Servicios de datos (ajuste de imports)

**Archivos:**
- `src/services/ClienteService.ts`
- `src/services/NosisService.ts`
- `src/services/CreditoService.ts`
- `src/services/JournalEntryService.ts`

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

Los servicios en src/services/ ya existen (copiados de otro proyecto).

TAREA — Verificar y corregir todos los imports en los 4 archivos:

1. Todos los imports de Firebase Admin deben ser:
   import { getAdminFirestore } from '@/firebase/admin'
   (NO import adminDb desde admin.ts directamente — JournalEntryService tenía esta inconsistencia)

2. Todos los imports de types deben ser '@/types/fin-*'

3. Todos los imports de collections deben ser '@/firebase/collections'

4. NO deben importar nada de 'firebase' (client SDK) — solo 'firebase-admin'

5. Verificar que los paths @/... resuelven correctamente con el tsconfig.json del proyecto.

Corregir cualquier discrepancia encontrada. No cambiar la lógica de negocio.
```

---

## OLA 3 — API Routes

> Ejecutar 3A + 3B + 3C + 3D en PARALELO
> Prerequisito: Ola 2 completa

> ⚠️ **DIRECTORIO DE TRABAJO OBLIGATORIO para todos los agentes de esta ola:**
> ```
> c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
> ```
> Verificar con `pwd` antes de escribir archivos. NO trabajar en ningún otro directorio.

**REGLA CRÍTICA para TODAS las API routes:**
- Importar solo desde 'firebase-admin/*' (NUNCA 'firebase/*')
- Siempre usar `withAuth` wrapper
- Siempre usar `resolveAuthorizedOrganizationId`
- Todas las rutas devuelven `NextResponse.json()`
- Manejo de errores con try/catch y status codes correctos

---

### Agente 3A — API Clientes y Nosis

**Archivos a crear:**
- `src/app/api/fin/clientes/route.ts` — GET (list/search) + POST (create)
- `src/app/api/fin/clientes/[id]/route.ts` — GET + PATCH + DELETE
- `src/app/api/fin/clientes/[id]/nosis/route.ts` — POST (consultar Nosis)

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

Crear API routes para clientes del módulo de financiación al consumo.

STACK: Next.js App Router, TypeScript strict, Firebase Admin SDK.

IMPORTS OBLIGATORIOS:
import { withAuth } from '@/lib/api/withAuth'
import { ClienteService } from '@/services/ClienteService'
import { NosisService } from '@/services/NosisService'
import { NextRequest, NextResponse } from 'next/server'

NOTA CRÍTICA DE RENDERIZACIÓN:
- Estos archivos son Server-only (API routes)
- NUNCA importar 'firebase' (client SDK) aquí
- SIEMPRE importar 'firebase-admin' (server SDK)
- No usar 'use client'

CREAR src/app/api/fin/clientes/route.ts:
- GET: recibe ?q=búsqueda → ClienteService.buscar(orgId, q). Si no hay q → ClienteService.list(orgId, limit=50)
- POST: body FinClienteCreateInput → ClienteService.crear(orgId, body, user.uid). Devuelve {id, cliente}
- Ambos wrapped con withAuth

CREAR src/app/api/fin/clientes/[id]/route.ts:
- GET: ClienteService.getById(orgId, params.id)
- PATCH: body parcial → ClienteService.actualizar(orgId, params.id, body) [si no existe el método, agregar en ClienteService]
- Wrapped con withAuth

CREAR src/app/api/fin/clientes/[id]/nosis/route.ts:
- POST: consulta Nosis para el cliente
- Lee NOSIS_API_KEY de env vars
- NosisService.consultar(cliente.cuit, apiKey)
- ClienteService.actualizarNosisUltimo(orgId, clienteId, resultado)
- Devuelve el resultado Nosis
- Wrapped con withAuth, requiredRole: ['admin', 'manager', 'operator']

ERROR HANDLING:
- 404 si cliente no existe
- 400 si falta body requerido
- 500 con mensaje genérico (no exponer detalles internos)
```

---

### Agente 3B — API Créditos y Cuotas

**Archivos a crear:**
- `src/app/api/fin/creditos/route.ts` — GET (list) + POST (crear crédito + cuotas)
- `src/app/api/fin/creditos/[id]/route.ts` — GET
- `src/app/api/fin/creditos/[id]/cuotas/route.ts` — GET (cuotas del crédito)
- `src/app/api/fin/creditos/preview/route.ts` — POST (preview tabla sin guardar)

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

Crear API routes para créditos y cuotas del módulo de financiación.

IMPORTS:
import { withAuth } from '@/lib/api/withAuth'
import { CreditoService } from '@/services/CreditoService'
import { AmortizationService } from '@/services/AmortizationService'
import { NextRequest, NextResponse } from 'next/server'

CREAR src/app/api/fin/creditos/route.ts:
- GET: ?clienteId=X&estado=activo&sucursalId=Y → CreditoService.list(orgId, filters)
- POST: body FinCreditoCreateInput → CreditoService.crear(orgId, body, user.uid, user.name)
  - Devuelve { creditoId, asientoId, tabla_amortizacion }
  - El body DEBE incluir: sucursal_id, cliente_id, capital, tasa_mensual, cantidad_cuotas, sistema, fechas
  - Validación Zod del body antes de llamar al servicio

CREAR src/app/api/fin/creditos/[id]/route.ts:
- GET: CreditoService.getById(orgId, id) con cuotas incluidas
- PATCH: solo permite cambiar estado (estado_nuevo: FinCreditoEstado)
  - No permite modificar capital, tasa ni cuotas

CREAR src/app/api/fin/creditos/[id]/cuotas/route.ts:
- GET: ?estado=pendiente|pagada|vencida → CreditoService.getCuotas(orgId, id, estado)

CREAR src/app/api/fin/creditos/preview/route.ts:
- POST: body { capital, tasa_mensual, cantidad_cuotas, sistema, fecha_primer_vencimiento }
- Devuelve tabla de amortización calculada SIN guardar nada en Firestore
- Usar AmortizationService.calcular() directamente
- No requiere withAuth (puede ser público para formularios de simulación)
  - Alternativa: sí requiere auth, a criterio del agente pero documentar la decisión

SCHEMAS ZOD obligatorios para validación de body.
```

---

### Agente 3C — API Cobros, Cajas y Sucursales

**Archivos a crear:**
- `src/app/api/fin/cobros/route.ts` — GET + POST
- `src/app/api/fin/cobros/[id]/route.ts` — GET
- `src/app/api/fin/sucursales/route.ts` — GET + POST
- `src/app/api/fin/sucursales/[id]/cajas/route.ts` — GET + POST

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

Crear API routes para cobros, cajas y sucursales.

COBROS — src/app/api/fin/cobros/route.ts:
- POST: registra cobro de una cuota
  - Body: { sucursal_id, caja_id, credito_id, cuota_id, medio_pago }
  - Llamar CobroService.registrar() — ESTE SERVICIO AÚN NO EXISTE, CREARLO
  - CobroService.registrar() debe:
    1. Verificar que la cuota existe y está en estado 'pendiente' o 'vencida'
    2. Calcular capital e interés de la cuota
    3. Crear documento en fin_cobros
    4. Llamar JournalEntryService.generarAsientoCobro()
    5. Marcar cuota como 'pagada' (cobro_id, fecha_pago)
    6. Actualizar saldo_capital del crédito
    7. Si todas las cuotas están pagas → cambiar estado crédito a 'cancelado'
    8. Todo en transacción Firestore
    9. Retornar { cobroId, asientoId }
- GET: ?creditoId=X&sucursalId=Y&desde=YYYY-MM-DD → lista cobros

CAJAS — src/app/api/fin/sucursales/[id]/cajas/route.ts:
- GET: lista cajas de la sucursal con saldo_actual
- POST: crear nueva caja

SUCURSALES — src/app/api/fin/sucursales/route.ts:
- GET: lista sucursales de la org
- POST: crear sucursal

CREAR src/services/CobroService.ts (nuevo servicio).

NOTA: CobroService debe seguir el mismo patrón que CreditoService:
- Usar getAdminFirestore() de '@/firebase/admin'
- Usar FIN_COLLECTIONS de '@/firebase/collections'
- Todas las operaciones en transacción cuando hay múltiples escrituras
```

---

### Agente 3D — API Plan de Cuentas y Asientos

**Archivos a crear:**
- `src/app/api/fin/plan-cuentas/rubros/route.ts` — GET + POST
- `src/app/api/fin/plan-cuentas/cuentas/route.ts` — GET + POST
- `src/app/api/fin/plan-cuentas/config/route.ts` — GET + PUT
- `src/app/api/fin/asientos/route.ts` — GET (solo lectura)
- `src/app/api/fin/asientos/[id]/route.ts` — GET

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

Crear API routes para plan de cuentas y asientos contables.

REGLA CRÍTICA: fin_asientos es de SOLO LECTURA para el usuario.
Los asientos son generados automáticamente por CreditoService y CobroService.
Las rutas de asientos son GET únicamente. NO hay POST, PATCH ni DELETE en asientos.

PLAN DE CUENTAS:
- src/app/api/fin/plan-cuentas/rubros/route.ts:
  - GET: lista rubros de la org (ordenados por campo `orden`)
  - POST: crear rubro (requiere role: admin o manager)

- src/app/api/fin/plan-cuentas/cuentas/route.ts:
  - GET: ?rubroId=X → cuentas del rubro (o todas si no hay filtro)
  - POST: crear cuenta

- src/app/api/fin/plan-cuentas/config/route.ts:
  - GET: leer FinConfigCuentas para plugin 'financiacion_consumo'
  - PUT: actualizar mapeo de cuentas (4 campos: creditos_por_financiaciones, intereses_no_devengados, ventas_financiadas, intereses_ganados)

ASIENTOS:
- src/app/api/fin/asientos/route.ts:
  - GET: ?desde=YYYY-MM&hasta=YYYY-MM&origen=credito_otorgado|cobro_cuota → lista asientos
  - Ordenados por fecha descendente
  - Paginación: limit=50, cursor-based

- src/app/api/fin/asientos/[id]/route.ts:
  - GET: asiento con todas sus líneas

CREAR también src/services/PlanCuentasService.ts:
- getRubros(orgId): Promise<FinRubro[]>
- getCuentas(orgId, rubroId?): Promise<FinCuenta[]>
- getConfigCuentas(orgId, plugin): Promise<FinConfigCuentas | null>
- upsertConfigCuentas(orgId, plugin, config): Promise<void>
- crearRubro(orgId, input): Promise<string>
- crearCuenta(orgId, input): Promise<string>
```

---

## 🔴 CHECKPOINT VERCEL 2 — Después de Ola 3

> **NO iniciar Ola 4A hasta que este checkpoint sea verde.**
> Este es el checkpoint más importante del backend: 20+ API routes creadas de una vez.

### Qué se verifica
Todas las API routes de `src/app/api/fin/` compilan en Vercel. Firebase Admin SDK correctamente inicializado en server-side. No hay Client SDK filtrado en ninguna route.

### Pasos

```bash
# 1. Check local liviano
npx tsc --noEmit

# 2. Audit de imports (crítico — muchos archivos nuevos en esta ola)
bash scripts/audit-imports.sh

# 3. Verificar que todas las routes tienen withAuth
grep -rn "withAuth" src/app/api/fin/ | wc -l
# Resultado esperado: número > 15 (una por cada route)

# 4. Si todo OK → commit y push
git add -A
git commit -m "ola-3: API routes fin/ completas (clientes, creditos, cobros, asientos, plan-cuentas)"
git push origin main
```

### Qué verificar en Vercel
1. Build succeeded
2. En Build Logs: buscar `Compiled successfully` — debe listar todas las rutas `/api/fin/*`
3. Smoke test manual (si hay `.env.local` en Vercel): `curl https://[tu-app].vercel.app/api/fin/clientes` debe devolver `401` (no 500 ni error de build)

### Errores comunes y solución

| Error en Vercel | Causa | Solución |
|----------------|-------|----------|
| `getAdminFirestore is not a function` | Export incorrecto en `admin.ts` | Verificar export en `src/firebase/admin.ts` |
| `Cannot find module '@/services/CobroService'` | Agente 3C creó el servicio con otro nombre | Ajustar import en la route |
| Error de tipos en `withAuth` | AuthContext mal tipado | Revisar tipos en `src/lib/api/withAuth.ts` |
| `Dynamic server usage` en route estática | Falta `export const dynamic = 'force-dynamic'` | Agregar en la route afectada |

### Criterio de paso: ✅
Build verde + al menos una route `/api/fin/*` devuelve 401 (no 500).

---

## OLA 4 — Frontend

> Prerequisito: **CP Vercel 2 OK**
> Esta ola se ejecuta en **3 fases secuenciales** — no pasar a la siguiente sin build OK.

> ⚠️ **DIRECTORIO DE TRABAJO OBLIGATORIO para todos los agentes de esta ola:**
> ```
> c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
> ```
> Verificar con `pwd` antes de escribir archivos. NO trabajar en ningún otro directorio.

---

### Fase 1 — Solo Agente 4A (shell)
> Ejecutar **solo 4A**. Esperar build OK + CP Vercel 3 antes de pasar a Fase 2.

### Agente 4A — Layout, providers, auth pages, dashboard

**Archivos a crear:**
- `src/app/layout.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/login/layout.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/page.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/separator.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Topbar.tsx`

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

Sos un agente de Frontend para Next.js App Router. Tu tarea es crear el SHELL de la app.

STACK: Next.js (versión del package.json), TypeScript strict, Tailwind CSS 4, Radix UI, shadcn/ui pattern, lucide-react.

=== REGLAS DE RENDERIZACIÓN — MUY IMPORTANTE ===

1. app/layout.tsx → Server Component (NO 'use client')
   - Solo importa Providers (que sí es 'use client')
   - No usa hooks ni event handlers

2. Providers.tsx → 'use client' (ya existe en src/components/Providers.tsx)

3. (auth)/login/page.tsx → 'use client'
   - Usa useAuth, useRouter, react-hook-form

4. (dashboard)/layout.tsx → puede ser Server Component
   - Wrappea con AuthGuard (que es 'use client')
   - No necesita ser 'use client' si solo hace layout HTML

5. (dashboard)/page.tsx → Server Component por defecto
   - Si necesita datos en tiempo real → 'use client'
   - Por ahora: datos estáticos/skeleton OK como Server Component

6. Sidebar.tsx y Topbar.tsx → 'use client'
   - Usan usePathname() para active state
   - Usan useAuth() para mostrar nombre de usuario

=== CREAR src/app/layout.tsx ===
```tsx
import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Préstalo — Financiación al Consumo',
  description: 'Sistema de gestión de créditos al consumo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

=== CREAR src/app/(dashboard)/layout.tsx ===
- Wrappea children con AuthGuard
- Estructura: flex, sidebar fijo izquierda, main content derecha
- No 'use client' en el layout (AuthGuard se encarga del 'use client')

=== CREAR src/components/layout/Sidebar.tsx ===
'use client'
- Navegación con links: Dashboard, Clientes, Créditos, Cobros, Cajas, Plan de Cuentas, Libro Diario
- usePathname() para marcar active
- Logo "Préstalo" arriba
- Radix icons o lucide-react para íconos (DollarSign, Users, CreditCard, etc.)

=== CREAR src/components/layout/Topbar.tsx ===
'use client'
- Nombre de usuario (useAuth().user?.displayName)
- Botón de logout
- Sin otros estados complejos

=== CREAR src/components/ui/ ===
Copiar patrón shadcn/ui para: button.tsx, input.tsx, card.tsx, badge.tsx, label.tsx, separator.tsx
- Usar class-variance-authority (cva) para variantes de botón
- Usar cn() de @/lib/utils

=== CREAR src/app/(dashboard)/page.tsx ===
- 4 cards con stats vacías: Total Clientes, Créditos Activos, Cobros del Día, Monto en Cartera
- Puede ser Server Component con datos dummy (0, 0, 0, $0)
- UI limpia con Card de shadcn

=== VERIFICACIÓN FINAL DEL AGENTE ===
Antes de declarar terminada la Ola 4A, el agente DEBE verificar:
1. Que no hay imports de 'firebase' (client SDK) en archivos sin 'use client'
2. Que no hay imports de 'firebase-admin' en archivos con 'use client'
3. Que todos los archivos con hooks tienen 'use client' al inicio
4. Ejecutar: npm run build (reportar resultado)
5. Ejecutar: npm run lint (reportar resultado)
NO pasar a Ola 4B si el build falla.
```

---

## 🔴 CHECKPOINT VERCEL 3 — Después de Ola 4A

> **NO iniciar Ola 4B hasta que este checkpoint sea verde.**
> Este es el checkpoint más crítico del frontend. Aquí murieron los planes anteriores.

### Qué se verifica
El shell de la app (layout, login, dashboard, sidebar) renderiza correctamente en Vercel sin errores de hidratación ni de SSR/Client boundary.

### Pasos

```bash
# 1. Build local PRIMERO (obligatorio antes del push)
npm run build
# Si falla → NO hacer push, diagnosticar aquí en local

# 2. Si el build local pasó → audit de imports (hay nuevos componentes)
bash scripts/audit-imports.sh

# 3. Verificación específica de 'use client' en componentes interactivos
echo "=== Componentes sin 'use client' que usan hooks ==="
for f in src/components/layout/Sidebar.tsx src/components/layout/Topbar.tsx src/app/\(auth\)/login/page.tsx; do
  if ! head -1 "$f" | grep -q "use client"; then
    echo "FALTA 'use client': $f"
  else
    echo "OK: $f"
  fi
done

# 4. Verificar que app/layout.tsx NO tiene 'use client'
head -1 src/app/layout.tsx | grep -c "use client" && echo "ERROR: layout.tsx NO debe tener 'use client'" || echo "OK: layout.tsx es Server Component"

# 5. Si todo OK → commit y push
git add -A
git commit -m "ola-4A: frontend shell (layout, auth, dashboard, sidebar)"
git push origin main
```

### Qué verificar en Vercel
1. Build succeeded (el más crítico de los 3 checkpoints)
2. Abrir la URL del deploy → debe mostrar la pantalla de login (no blank page ni error)
3. Login con un usuario real de Firebase → debe redirigir al dashboard
4. Verificar en consola del browser: **no debe haber hydration errors**

### Errores comunes y solución

| Error en Vercel | Causa | Solución |
|----------------|-------|----------|
| `You're importing a component that needs useState` | Componente sin `'use client'` | Agregar `'use client'` al archivo |
| `ReferenceError: window is not defined` | Firebase analytics en SSR | Usar guard `typeof window !== 'undefined'` |
| Hydration mismatch | Provider renderiza distinto en server vs client | Verificar árbol de `Providers.tsx` |
| Blank page (sin error) | `AuthGuard` redirige antes de hidratar | Revisar el loading state del AuthGuard |
| `Cannot read properties of undefined` en sidebar | `useAuth()` llamado fuera del Provider | Verificar que Sidebar está dentro de `<Providers>` |

### Criterio de paso: ✅
Build verde en Vercel + pantalla de login visible + sin hydration errors en consola.

---

### Fase 2 — Agentes 4B + 4C en paralelo
> Prerequisito: **CP Vercel 3 OK**
> **🔴 VERIFICACIÓN: `npm run build` local antes de pasar a Fase 3**

---

### Agente 4B — Componentes Shared

**Archivos a crear:**
- `src/components/ui/data-table.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/fin/AmortizationPreviewTable.tsx`
- `src/components/fin/StatusBadge.tsx`

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

Sos un agente de componentes React para Next.js App Router.

TODOS estos archivos son 'use client' (componentes interactivos con hooks o eventos).

CREAR src/components/ui/data-table.tsx:
'use client'
- Props: { columns: Column[], data: T[], loading?: boolean, emptyMessage?: string }
- Column: { key: string, header: string, render?: (row: T) => ReactNode, width?: string }
- Renderiza tabla HTML semántica (<table>, <thead>, <tbody>)
- Loading state: skeleton rows (animate-pulse)
- Empty state: mensaje centrado
- Responsive: overflow-x-auto

CREAR src/components/fin/AmortizationPreviewTable.tsx:
'use client'
- Props: { tabla: TablaAmortizacion | null, loading: boolean }
- Muestra: Nro, Vencimiento, Capital, Interés, Total, Saldo
- Footer con totales: total capital, total intereses, total crédito
- Si loading: skeleton
- Si null: mensaje "Completá el formulario para ver la tabla"
- Números en formato: toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

CREAR src/components/fin/StatusBadge.tsx:
- Props: { estado: FinCreditoEstado | FinCuotaEstado }
- Colores: activo=verde, cancelado=gris, en_mora=naranja, incobrable=rojo, pagada=verde, vencida=rojo, pendiente=azul
- Usar Badge de @/components/ui/badge

CREAR src/components/ui/select.tsx, dialog.tsx, textarea.tsx:
- Patrón shadcn/ui wrapeando Radix UI
- Misma estructura que button.tsx y card.tsx ya existentes
```

---

### Agente 4C — Páginas de Clientes

**Archivos a crear:**
- `src/app/(dashboard)/clientes/page.tsx`
- `src/app/(dashboard)/clientes/nuevo/page.tsx`
- `src/app/(dashboard)/clientes/[id]/page.tsx`

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

Sos un agente de páginas React para Next.js App Router.

CONTEXTO: El módulo de clientes permite gestionar clientes del sistema de financiación al consumo.

=== REGLAS DE RENDERIZACIÓN ===
- Páginas con formularios, estado o fetch client-side → 'use client'
- Páginas solo de listado pueden ser Server Components SOLO si hacen fetch en el servidor
- Para este módulo: usar 'use client' en todas las páginas (más simple, evita problemas)

CREAR src/app/(dashboard)/clientes/page.tsx:
'use client'
- Hook useClientes() local (fetch a /api/fin/clientes con useEffect + useState)
- Barra de búsqueda: input con debounce 300ms, fetch ?q=término
- Tabla con DataTable component: columnas Nombre, CUIT, Tipo, Créditos activos, Saldo, Acciones
- Botón "Nuevo cliente" → link a /clientes/nuevo
- Click en fila → link a /clientes/[id]
- Loading state mientras carga
- Error state si falla el fetch

CREAR src/app/(dashboard)/clientes/nuevo/page.tsx:
'use client'
- Formulario con react-hook-form + Zod validation
- Campos: tipo (persona física/jurídica), nombre, apellido, DNI, CUIT, teléfono, email, domicilio, localidad, provincia
- Submit → POST /api/fin/clientes
- Éxito → redirect a /clientes/[id]
- Error → toast con mensaje

CREAR src/app/(dashboard)/clientes/[id]/page.tsx:
'use client'
- Fetch cliente + créditos activos
- Sección 1: datos del cliente (tarjeta)
- Sección 2: historial Nosis (último score + botón "Consultar Nosis")
- Sección 3: créditos del cliente (tabla compacta con DataTable)
- Botón "Nuevo crédito" → link a /creditos/nuevo?clienteId=[id]

=== IMPORTS CORRECTOS ===
- Fetch a APIs: window.fetch a '/api/fin/...' (client-side)
- NO importar ningún Service directamente en estas páginas ('use client' no puede usar firebase-admin)
- NO importar firebase-admin aquí
- SÍ puede importar tipos: import type { FinCliente } from '@/types/fin-cliente'
```

---

### Fase 3 — Agentes 4D + 4E en paralelo
> Prerequisito: **Fase 2 con build OK**
> **🔴 VERIFICACIÓN FINAL: `npm run build && npm run type-check && npm test`**

---

### Agente 4D — Páginas de Créditos

**Archivos a crear:**
- `src/app/(dashboard)/creditos/page.tsx`
- `src/app/(dashboard)/creditos/nuevo/page.tsx`
- `src/app/(dashboard)/creditos/[id]/page.tsx`

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

Crear páginas de créditos. Todas son 'use client'.

CREAR creditos/page.tsx:
- Tabla de créditos: Nro, Cliente, Capital, Sistema (Francés/Alemán), Cuotas, Estado, Fecha
- Filtros: estado (select), cliente (búsqueda)
- Botón "Nuevo crédito"
- Fetch a GET /api/fin/creditos

CREAR creditos/nuevo/page.tsx:
'use client'
Esta es la página más compleja — formulario en 2 pasos:

PASO 1 — Datos del crédito:
- Buscar/seleccionar cliente (input de búsqueda + dropdown con resultados de /api/fin/clientes?q=)
- Descripción del artículo
- Capital ($)
- Sistema de amortización: radio buttons (Francés / Alemán) con descripción de cada sistema
- Tasa mensual (%)
- Cantidad de cuotas
- Fecha de otorgamiento (date picker simple)
- Fecha primer vencimiento (date picker)

PREVIEW EN TIEMPO REAL (mientras el usuario completa):
- Cuando los 5 campos numéricos están completos → fetch POST /api/fin/creditos/preview
- Mostrar AmortizationPreviewTable con el resultado
- Loading state en la tabla mientras se calcula
- Usar debounce o useEffect con los campos como dependencias

PASO 2 — Confirmación:
- Resumen del crédito a otorgar
- "Confirmar y otorgar" → POST /api/fin/creditos
- Éxito → redirect a /creditos/[id]

CREAR creditos/[id]/page.tsx:
- Datos del crédito (card superior)
- Tabla de cuotas (DataTable con estado, vencimiento, capital, interés, total)
- Estado de cada cuota con StatusBadge
- Botón "Registrar cobro" en cuotas pendientes → link a /cobros/nuevo?cuotaId=[id]&creditoId=[creditoId]

REGLAS RENDERIZACIÓN:
- 'use client' en todas las páginas
- Fetch a APIs (no importar Services)
- Tipos solo desde '@/types/fin-*'
```

---

### Agente 4E — Páginas de Cobros y Cajas

**Archivos a crear:**
- `src/app/(dashboard)/cobros/page.tsx`
- `src/app/(dashboard)/cobros/nuevo/page.tsx`
- `src/app/(dashboard)/cajas/page.tsx`

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

Crear páginas de cobros y cajas. Todas son 'use client'.

CREAR cobros/page.tsx:
- Lista de cobros del día (filtro por fecha, sucursal)
- Columnas: Hora, Cliente, Nro Cuota, Capital, Interés, Total, Medio de Pago
- Total del día al pie de la tabla

CREAR cobros/nuevo/page.tsx:
'use client'
- Recibe query params: ?cuotaId=X&creditoId=Y (pre-rellena el formulario)
- Si no hay params: formulario libre con búsqueda de crédito/cuota
- Muestra: datos del cliente, crédito, cuota seleccionada (capital, interés, total)
- Selector de caja (fetch /api/fin/sucursales/[id]/cajas)
- Medio de pago: por ahora solo 'efectivo'
- Confirmación → POST /api/fin/cobros
- Éxito → toast + redirect a /cobros

CREAR cajas/page.tsx:
- Lista de sucursales con sus cajas
- Fetch GET /api/fin/sucursales → sucursales, luego cajas de cada una
- Por ahora: vista simple de lista

REGLAS:
- 'use client' en todo
- Fetch a API routes, no a services directamente
```

---

## OLA 5 — Auditoría y Configuración

> Ejecutar 5A + 5B en PARALELO
> Prerequisito: Ola 4C con build + test OK

> ⚠️ **DIRECTORIO DE TRABAJO OBLIGATORIO para todos los agentes de esta ola:**
> ```
> c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
> ```
> Verificar con `pwd` antes de escribir archivos. NO trabajar en ningún otro directorio.

---

### Agente 5A — Libro Diario y Asientos

**Archivos a crear:**
- `src/app/(dashboard)/asientos/page.tsx`
- `src/app/(dashboard)/asientos/[id]/page.tsx`

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

'use client' en todas las páginas.

CREAR asientos/page.tsx:
- Tabla de asientos: Fecha, Período, Origen (badge), Documento, Debe, Haber
- Filtros: período (mes/año), origen
- Verificación visual: debe == haber en cada fila

CREAR asientos/[id]/page.tsx:
- Detalle completo del asiento
- Tabla de líneas: Cuenta, Código, Debe, Haber, Descripción
- Total Debe / Total Haber en footer
- Badge de estado BALANCEADO (verde) o DESBALANCEADO (rojo)

REGLAS: Estos son de solo lectura. NO hay botones de editar/eliminar.
```

---

### Agente 5B — Plan de Cuentas Admin + Seed

**Archivos a crear:**
- `src/app/(dashboard)/plan-cuentas/page.tsx`
- `src/app/(dashboard)/plan-cuentas/configurar/page.tsx`
- `scripts/seed-plan-cuentas.ts`

**Prompt:**
```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de crear o modificar cualquier archivo.
NO escribir en ninguna subcarpeta de otro proyecto.

CREAR plan-cuentas/page.tsx:
'use client'
- Árbol de rubros con cuentas anidadas
- Fetch GET /api/fin/plan-cuentas/cuentas
- Cada cuenta muestra: código, nombre, naturaleza, si es imputable

CREAR plan-cuentas/configurar/page.tsx:
'use client'
- Formulario para mapear las 4 cuentas requeridas:
  - Créditos por Financiaciones
  - Intereses No Devengados
  - Ventas Financiadas
  - Intereses Ganados
- Cada campo es un select con las cuentas disponibles (GET /api/fin/plan-cuentas/cuentas)
- Submit → PUT /api/fin/plan-cuentas/config

CREAR scripts/seed-plan-cuentas.ts:
Script Node.js para crear el plan de cuentas inicial:
- Rubros: Activo (100), Pasivo (200), Patrimonio Neto (300), Resultados Positivos (400), Resultados Negativos (500)
- Cuentas mínimas:
  - 1.1.01 — Créditos por Financiaciones (activo, imputable)
  - 1.1.02 — Intereses No Devengados (activo, imputable, ajuste)
  - 4.1.01 — Ventas Financiadas (resultado positivo, imputable)
  - 4.1.02 — Intereses Ganados (resultado positivo, imputable)
  - 1.1.03 — Caja Principal (activo, imputable, requiere_caja: true)
- FinConfigCuentas para plugin 'financiacion_consumo' con las 4 cuentas
```

---

## Variables de entorno requeridas

```env
# .env.local.example

# Firebase Admin (server-side)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Firebase Client (browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Nosis (opcional en dev)
NOSIS_API_KEY=
NOSIS_SANDBOX=true

# Observabilidad (opcional en dev)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=
```

---

## Verificaciones de entrega — Tabla Final

| Ola | Check local | Audit imports | Vercel |
|-----|-------------|---------------|--------|
| 0 | `npm run build` OK | — | ✅ deploy inicial OK |
| **1** | `npx tsc --noEmit` | ✅ `audit-imports.sh` | 🔴 **CP Vercel 1** — NO avanzar si falla |
| 2 | `npx tsc --noEmit` + `npm test` | ✅ (servicios copiados) | — |
| **3** | `npx tsc --noEmit` | ✅ `audit-imports.sh` | 🔴 **CP Vercel 2** — NO avanzar si falla |
| **4 Fase 1 (4A)** | `npm run build` local | ✅ (componentes nuevos) | 🔴 **CP Vercel 3** — NO avanzar si falla |
| **4 Fase 2 (4B+4C)** | `npm run build` local | ✅ | — |
| **4 Fase 3 (4D+4E)** | `npm run build` + `npm test` | — | — |
| **5** | — | — | 🚀 **Deploy final** + smoke test |

---

### Cuándo usar `tsc --noEmit` vs `npm run build`

| Situación | Comando | Razón |
|-----------|---------|-------|
| Después de Olas 1, 2, 3 | `npx tsc --noEmit` | Solo verifica tipos, no compila. Rápido. Detecta el 90% de los errores antes de subir. |
| Antes de un CP Vercel | `npx tsc --noEmit` + `audit-imports.sh` | Mínimo antes de hacer push. |
| Ola 4 (todas las fases) | `npm run build` local | Frontend necesita compilación real para detectar errores de SSR/CSR. |
| CP Vercel 3 en adelante | Build en Vercel (automático con push) | Verifica el entorno de producción real (env vars, Node version). |

---

### Crear `scripts/audit-imports.sh` en Ola 0

Este archivo debe crearse en Ola 0 junto con la estructura del proyecto:

```bash
#!/bin/bash
echo "=== [1] Client SDK en services/ (debe estar vacío) ==="
grep -rn "from 'firebase'" src/services/ 2>/dev/null | grep -v "firebase-admin" && echo "⚠️  PROBLEMA ENCONTRADO" || echo "✅ OK"

echo "=== [2] Client SDK en API routes (debe estar vacío) ==="
grep -rn "from 'firebase'" src/app/api/ 2>/dev/null | grep -v "firebase-admin" && echo "⚠️  PROBLEMA ENCONTRADO" || echo "✅ OK"

echo "=== [3] Admin SDK en componentes (debe estar vacío) ==="
grep -rn "firebase-admin" src/components/ 2>/dev/null && echo "⚠️  PROBLEMA ENCONTRADO" || echo "✅ OK"

echo "=== [4] Admin SDK en hooks (debe estar vacío) ==="
grep -rn "firebase-admin" src/hooks/ 2>/dev/null && echo "⚠️  PROBLEMA ENCONTRADO" || echo "✅ OK"

echo ""
echo "Si todos los grupos dicen OK → seguro hacer push."
```
