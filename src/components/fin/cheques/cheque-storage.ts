"use client";

import type { ChequeOperation } from "@/components/fin/cheques/types";
import {
  buildOperationNumber,
  calculateOfferPreview,
  getSeedOperations,
} from "@/components/fin/cheques/cheque-utils";

const STORAGE_KEY = "prestalo.cheque-operations.v1";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getStoredChequeOperations(): ChequeOperation[] {
  if (!canUseStorage()) {
    return getSeedOperations();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const userOperations = raw ? ((JSON.parse(raw) as ChequeOperation[]) ?? []) : [];
  return [...userOperations, ...getSeedOperations()];
}

function saveUserOperations(operations: ChequeOperation[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(operations));
}

export function createChequeOperation(
  draft: Omit<ChequeOperation, "id" | "numeroOperacion" | "preview" | "createdAt">
) {
  if (!canUseStorage()) {
    throw new Error("LocalStorage no disponible");
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const existing = raw ? ((JSON.parse(raw) as ChequeOperation[]) ?? []) : [];
  const totalCount = existing.length + getSeedOperations().length + 1;
  const createdAt = new Date().toISOString();

  const operation: ChequeOperation = {
    ...draft,
    id: `user-op-${crypto.randomUUID()}`,
    numeroOperacion: buildOperationNumber(totalCount),
    createdAt,
    preview: calculateOfferPreview(draft.cheques, draft.terms),
  };

  saveUserOperations([operation, ...existing]);
  return operation;
}

export function getChequeOperationById(id: string) {
  return getStoredChequeOperations().find((operation) => operation.id === id) ?? null;
}
