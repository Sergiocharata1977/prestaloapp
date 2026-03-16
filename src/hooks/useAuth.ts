'use client'

import {
  createContext,
  createElement,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/firebase/config";

type AuthContextValue = {
  user: FirebaseUser | null;
  loading: boolean;
  organizationId: string | null;
  role: string | null;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setLoading(true);

      if (!nextUser) {
        setUser(null);
        setOrganizationId(null);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const tokenResult = await nextUser.getIdTokenResult();
        const nextOrganizationId =
          typeof tokenResult.claims.organizationId === "string"
            ? tokenResult.claims.organizationId
            : null;
        const nextRole =
          typeof tokenResult.claims.role === "string"
            ? tokenResult.claims.role
            : null;

        setUser(nextUser);
        setOrganizationId(nextOrganizationId);
        setRole(nextRole);
      } catch {
        setUser(nextUser);
        setOrganizationId(null);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      organizationId,
      role,
      signOut: () => firebaseSignOut(auth),
    }),
    [loading, organizationId, role, user]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
