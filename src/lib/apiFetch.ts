"use client";

import { auth } from "@/firebase/config";

export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
}
