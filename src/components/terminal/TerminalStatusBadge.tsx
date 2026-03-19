"use client";

import { Badge } from "@/components/ui/badge";

export type TerminalStatus = "active" | "pending" | "quarantined";
export type SerializedTimestamp =
  | {
      seconds?: number;
      nanoseconds?: number;
      _seconds?: number;
      _nanoseconds?: number;
    }
  | {
      toMillis?: () => number;
    }
  | null
  | undefined;

type TerminalStatusBadgeProps = {
  status: TerminalStatus;
  lastHeartbeat?: SerializedTimestamp;
};

type StatusPresentation = {
  label: string;
  className: string;
};

const ONLINE_THRESHOLD_MS = 90 * 1000;
const INACTIVE_THRESHOLD_MS = 10 * 60 * 1000;

function toMillis(timestamp?: SerializedTimestamp): number | null {
  if (!timestamp) {
    return null;
  }

  const value = timestamp as {
    seconds?: number;
    nanoseconds?: number;
    _seconds?: number;
    _nanoseconds?: number;
    toMillis?: () => number;
  };

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  const seconds =
    typeof value.seconds === "number"
      ? value.seconds
      : typeof value._seconds === "number"
        ? value._seconds
        : null;
  const nanoseconds =
    typeof value.nanoseconds === "number"
      ? value.nanoseconds
      : typeof value._nanoseconds === "number"
        ? value._nanoseconds
        : 0;

  if (seconds === null) {
    return null;
  }

  return seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
}

function getPresentation(
  status: TerminalStatus,
  lastHeartbeat?: SerializedTimestamp
): StatusPresentation {
  if (status === "quarantined") {
    return {
      label: "Cuarentenada",
      className: "border-transparent bg-red-900 text-red-50",
    };
  }

  if (status === "pending") {
    return {
      label: "Pendiente",
      className: "border-transparent bg-slate-100 text-slate-600",
    };
  }

  const heartbeatMs = toMillis(lastHeartbeat);
  const ageMs =
    typeof heartbeatMs === "number" ? Math.max(Date.now() - heartbeatMs, 0) : Number.POSITIVE_INFINITY;

  if (ageMs < ONLINE_THRESHOLD_MS) {
    return {
      label: "Online",
      className: "border-transparent bg-green-100 text-green-800",
    };
  }

  if (ageMs <= INACTIVE_THRESHOLD_MS) {
    return {
      label: "Inactiva",
      className: "border-transparent bg-amber-100 text-amber-900",
    };
  }

  return {
    label: "Sin conexion",
    className: "border-transparent bg-red-100 text-red-800",
  };
}

export function TerminalStatusBadge({
  status,
  lastHeartbeat,
}: TerminalStatusBadgeProps) {
  const presentation = getPresentation(status, lastHeartbeat);

  return <Badge className={presentation.className}>{presentation.label}</Badge>;
}
