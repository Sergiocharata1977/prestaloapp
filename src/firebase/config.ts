import { getAnalytics } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

let appInstance: ReturnType<typeof initializeApp> | undefined;
let authInstance: ReturnType<typeof getAuth> | undefined;
let dbInstance: ReturnType<typeof getFirestore> | undefined;
let storageInstance: ReturnType<typeof getStorage> | undefined;

function getFirebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missingEnvVars = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingEnvVars.length > 0) {
    console.error(`[Firebase] Missing env vars: ${missingEnvVars.join(", ")}`);
    // Fallback to empty config to prevent crashing at build time
    // Actual Firebase calls will fail at runtime if these are missing and it's not build time
  }

  return config;
}

export function getFirebaseApp() {
  if (appInstance) return appInstance;
  appInstance = getApps().length > 0 
    ? getApp() 
    : initializeApp(getFirebaseConfig());
  return appInstance;
}

// Para retrocompatibilidad y exportaciones directas, inicializamos de forma controlada o mockeada si falta config
const isConfigComplete = process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export const app = getApps().length > 0 ? getApp() : initializeApp(isConfigComplete ? getFirebaseConfig() : {});
export const auth = typeof window !== "undefined" || isConfigComplete ? getAuth(app) : {} as ReturnType<typeof getAuth>;
export const db = typeof window !== "undefined" || isConfigComplete ? getFirestore(app) : {} as ReturnType<typeof getFirestore>;
export const storage = typeof window !== "undefined" || isConfigComplete ? getStorage(app) : {} as ReturnType<typeof getStorage>;
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
