import { cookies, headers } from "next/headers";

import { TerminalListPageClient } from "@/components/terminal/TerminalListPageClient";
import type { Terminal } from "@/components/terminal/TerminalTable";

export const dynamic = "force-dynamic";

async function fetchTerminals(): Promise<{ terminals: Terminal[]; error: string | null }> {
  try {
    const headerStore = await headers();
    const cookieStore = await cookies();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

    if (!host) {
      return { terminals: [], error: "No se pudo resolver el host para cargar terminales." };
    }

    const protocol = headerStore.get("x-forwarded-proto") ?? "http";
    const response = await fetch(`${protocol}://${host}/api/admin/terminals`, {
      headers: {
        cookie: cookieStore.toString(),
      },
      cache: "no-store",
    });

    const data = (await response.json()) as Terminal[] | { error?: string };
    if (!response.ok) {
      return {
        terminals: [],
        error:
          !Array.isArray(data) && typeof data.error === "string"
            ? data.error
            : "No se pudieron cargar las terminales.",
      };
    }

    return { terminals: Array.isArray(data) ? data : [], error: null };
  } catch (error) {
    return {
      terminals: [],
      error: error instanceof Error ? error.message : "No se pudieron cargar las terminales.",
    };
  }
}

export default async function TerminalesPage() {
  const { terminals, error } = await fetchTerminals();

  return <TerminalListPageClient initialTerminals={terminals} initialError={error} />;
}
