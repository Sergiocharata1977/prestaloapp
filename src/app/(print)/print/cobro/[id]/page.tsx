import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/fin/print/PrintButton";
import { ReciboCobro } from "@/components/print/ReciboCobro";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import { requireServerAuthContext } from "@/lib/api/withAuth";
import { ClienteService } from "@/services/ClienteService";
import { CobroService } from "@/services/CobroService";
import type { FinCredito } from "@/types/fin-credito";
import type { FinCuota } from "@/types/fin-cuota";
import type { FinCaja, FinSucursal } from "@/types/fin-sucursal";

const PRINT_ROLES = ["admin", "gerente", "operador"];

type PageProps = {
  params: Promise<{ id: string }>;
};

type PrintOrganization = {
  name: string;
  cuit?: string | null;
  domicilio?: string | null;
  logoUrl?: string | null;
};

function pickString(
  record: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function getOrganization(orgId: string): Promise<PrintOrganization> {
  const db = getAdminFirestore();
  const doc = await db.collection("organizations").doc(orgId).get();
  const data = (doc.data() ?? {}) as Record<string, unknown>;

  return {
    name: pickString(data, ["name", "nombre"]) ?? "Organizacion",
    cuit: pickString(data, ["cuit", "taxId", "tax_id"]),
    domicilio: pickString(data, ["domicilio", "direccion", "address"]),
    logoUrl: pickString(data, ["logoUrl", "logo_url"]),
  };
}

async function getDocByPath<T>(path: string): Promise<T | null> {
  const db = getAdminFirestore();
  const doc = await db.doc(path).get();
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as T;
}

export default async function PrintCobroPage({ params }: PageProps) {
  let auth;

  try {
    auth = await requireServerAuthContext({ roles: PRINT_ROLES });
  } catch {
    redirect("/login");
  }

  if (!auth.organizationId) {
    notFound();
  }

  const { id } = await params;
  const cobro = await CobroService.getById(auth.organizationId, id);

  if (!cobro) {
    notFound();
  }

  const [organization, cliente, credito, cuota, sucursal, caja] = await Promise.all([
    getOrganization(auth.organizationId),
    ClienteService.getById(auth.organizationId, cobro.cliente_id),
    getDocByPath<FinCredito>(FIN_COLLECTIONS.credito(auth.organizationId, cobro.credito_id)),
    getDocByPath<FinCuota>(FIN_COLLECTIONS.cuota(auth.organizationId, cobro.cuota_id)),
    getDocByPath<FinSucursal>(
      FIN_COLLECTIONS.sucursal(auth.organizationId, cobro.sucursal_id)
    ),
    getDocByPath<FinCaja>(
      FIN_COLLECTIONS.caja(auth.organizationId, cobro.sucursal_id, cobro.caja_id)
    ),
  ]);

  if (!cliente || !credito || !cuota) {
    notFound();
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <header className="no-print flex items-center justify-between border-b border-black pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-black">Impresion de cobro</h1>
          <p className="text-sm text-black">Recibo listo para impresion.</p>
        </div>
        <PrintButton />
      </header>

      <ReciboCobro
        caja={caja}
        cliente={cliente}
        cobro={cobro}
        credito={credito}
        cuota={cuota}
        organization={organization}
        printedAt={new Date().toISOString()}
        sucursal={sucursal}
      />
    </section>
  );
}
