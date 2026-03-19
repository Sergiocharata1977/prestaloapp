import "server-only";

import { getAdminFirestore } from "@/lib/firebase/admin";
import type { EffectivePolicy, ToolName } from "@/types/agent-terminal";

type PolicySource = {
  allowed_tools?: unknown;
  require_approval_for?: unknown;
  policy?: unknown;
  activo?: unknown;
  prioridad?: unknown;
  terminal_id?: unknown;
  puesto_id?: unknown;
  departamento_id?: unknown;
};

type ResolvedTerminalContext = {
  terminal_id: string;
  puesto_id: string | null;
  departamento_id: string | null;
};

function normalizeTools(value: unknown): ToolName[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractPolicy(source: PolicySource | undefined): Partial<EffectivePolicy> {
  if (!source || typeof source !== "object") {
    return {};
  }

  const embeddedPolicy =
    source.policy && typeof source.policy === "object"
      ? (source.policy as Record<string, unknown>)
      : null;

  return {
    allowed_tools:
      normalizeTools(source.allowed_tools) ??
      normalizeTools(embeddedPolicy?.allowed_tools) ??
      undefined,
    require_approval_for:
      normalizeTools(source.require_approval_for) ??
      normalizeTools(embeddedPolicy?.require_approval_for) ??
      undefined,
  };
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toPriority(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isActivePolicy(source: PolicySource | undefined): boolean {
  return source?.activo !== false;
}

function matchesPolicy(
  source: PolicySource | undefined,
  terminalContext: ResolvedTerminalContext
): boolean {
  if (!source) {
    return false;
  }

  const terminalId = toOptionalString(source.terminal_id);
  const puestoId = toOptionalString(source.puesto_id);
  const departamentoId = toOptionalString(source.departamento_id);

  if (!terminalId && !puestoId && !departamentoId) {
    return false;
  }

  if (terminalId && terminalId !== terminalContext.terminal_id) {
    return false;
  }

  if (puestoId && puestoId !== terminalContext.puesto_id) {
    return false;
  }

  if (departamentoId && departamentoId !== terminalContext.departamento_id) {
    return false;
  }

  return true;
}

export class TerminalPolicyService {
  static async resolvePolicy(
    organizationId: string,
    terminalId: string
  ): Promise<EffectivePolicy> {
    const db = getAdminFirestore();
    const [defaultPolicySnap, terminalSnap, policiesSnap] = await Promise.all([
      db.doc(`organizations/${organizationId}/terminal_policy/default`).get(),
      db.doc(`organizations/${organizationId}/terminals/${terminalId}`).get(),
      db
        .collection(`organizations/${organizationId}/terminal_policy`)
        .orderBy("prioridad", "desc")
        .get(),
    ]);

    const defaultPolicy = extractPolicy(
      defaultPolicySnap.exists ? (defaultPolicySnap.data() as PolicySource) : undefined
    );
    const terminalSource = terminalSnap.exists
      ? (terminalSnap.data() as PolicySource)
      : undefined;
    const terminalPolicy = extractPolicy(terminalSource);
    const terminalContext: ResolvedTerminalContext = {
      terminal_id: terminalId,
      puesto_id: toOptionalString(terminalSource?.puesto_id),
      departamento_id: toOptionalString(terminalSource?.departamento_id),
    };

    const matchedPolicies = policiesSnap.docs
      .filter((doc) => doc.id !== "default")
      .map((doc) => doc.data() as PolicySource)
      .filter((policy) => isActivePolicy(policy) && matchesPolicy(policy, terminalContext))
      .sort((a, b) => toPriority(b.prioridad) - toPriority(a.prioridad))
      .map((policy) => extractPolicy(policy));

    const mergedPolicy = matchedPolicies.reduce<Partial<EffectivePolicy>>(
      (acc, policy) => ({
        allowed_tools: policy.allowed_tools ?? acc.allowed_tools,
        require_approval_for:
          policy.require_approval_for ?? acc.require_approval_for,
      }),
      {}
    );

    return {
      allowed_tools:
        mergedPolicy.allowed_tools ??
        terminalPolicy.allowed_tools ??
        defaultPolicy.allowed_tools ??
        [],
      require_approval_for:
        mergedPolicy.require_approval_for ??
        terminalPolicy.require_approval_for ??
        defaultPolicy.require_approval_for ??
        [],
    };
  }
}
