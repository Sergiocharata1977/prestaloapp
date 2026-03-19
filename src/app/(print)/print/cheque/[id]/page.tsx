import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/fin/print/PrintButton";
import { LiquidacionCheque } from "@/components/print/LiquidacionCheque";
import { getAdminFirestore } from "@/firebase/admin";
import { FIN_COLLECTIONS } from "@/firebase/collections";
import { requireServerAuthContext } from "@/lib/api/withAuth";
import { ClienteService } from "@/services/ClienteService";
import { OperacionChequeService } from "@/services/OperacionChequeService";
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

export default async function PrintChequePage({ params }: PageProps) {
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
  const operacion = await OperacionChequeService.getDetalle(auth.organizationId, id);

  if (!operacion) {
    notFound();
  }

  const [organization, cliente, sucursal, caja] = await Promise.all([
    getOrganization(auth.organizationId),
    ClienteService.getById(auth.organizationId, operacion.cliente_id),
    getDocByPath<FinSucursal>(
      FIN_COLLECTIONS.sucursal(auth.organizationId, operacion.sucursal_id)
    ),
    operacion.caja_id
      ? getDocByPath<FinCaja>(
          FIN_COLLECTIONS.caja(auth.organizationId, operacion.sucursal_id, operacion.caja_id)
        )
      : Promise.resolve(null),
  ]);

  if (!cliente) {
    notFound();
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <header className="no-print flex items-center justify-between border-b border-black pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-black">Impresion de cheque</h1>
          <p className="text-sm text-black">Liquidacion lista para impresion.</p>
        </div>
        <PrintButton />
      </header>

      <LiquidacionCheque
        caja={caja}
        cliente={cliente}
        operacion={operacion}
        organization={organization}
        printedAt={new Date().toISOString()}
        sucursal={sucursal}
      />
    </section>
  );
}
