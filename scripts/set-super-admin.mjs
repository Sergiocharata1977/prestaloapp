/**
 * Script de un solo uso: asigna role=super_admin al usuario indicado.
 * Uso: node scripts/set-super-admin.mjs
 *
 * Requiere .env.local con FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Leer .env.local ---
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  process.env[key] = val;
}

// --- Init Firebase Admin ---
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Faltan variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const auth = getAuth();

// --- Email a convertir en super_admin ---
const TARGET_EMAIL = "sergiojdf@gmail.com";

async function main() {
  console.log(`Buscando usuario: ${TARGET_EMAIL} ...`);
  const user = await auth.getUserByEmail(TARGET_EMAIL);
  console.log(`UID encontrado: ${user.uid}`);
  console.log(`Claims actuales:`, user.customClaims);

  // Conservar claims existentes y agregar/actualizar role
  const currentClaims = user.customClaims ?? {};
  const newClaims = {
    ...currentClaims,
    role: "super_admin",
    admin: true,
    organizationId: null,
  };

  await auth.setCustomUserClaims(user.uid, newClaims);
  console.log(`\n✓ Claims actualizados:`, newClaims);
  console.log(`\nListo. Cerrá sesión y volvé a entrar en la app para que el token se renueve.`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
