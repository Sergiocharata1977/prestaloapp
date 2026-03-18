import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin env vars are required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export const auth = {
  verifyIdToken: (token: string) => getAuth(getAdminApp()).verifyIdToken(token),
  verifySessionCookie: (cookie: string, checkRevoked?: boolean) =>
    getAuth(getAdminApp()).verifySessionCookie(cookie, checkRevoked),
  getUser: (uid: string) => getAuth(getAdminApp()).getUser(uid),
  listUsers: (maxResults?: number) => getAuth(getAdminApp()).listUsers(maxResults),
  createUser: (properties: Parameters<ReturnType<typeof getAuth>["createUser"]>[0]) =>
    getAuth(getAdminApp()).createUser(properties),
  setCustomUserClaims: (uid: string, claims: object | null) =>
    getAuth(getAdminApp()).setCustomUserClaims(uid, claims),
  updateUser: (uid: string, properties: Parameters<ReturnType<typeof getAuth>["updateUser"]>[1]) =>
    getAuth(getAdminApp()).updateUser(uid, properties),
  generatePasswordResetLink: (email: string) =>
    getAuth(getAdminApp()).generatePasswordResetLink(email),
};
