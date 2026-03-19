import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/fin/print/PrintButton";
import { ContratoCredito } from "@/components/print/ContratoCredito";
import { getAdminFirestore } from "@/firebase/admin";
import { requireServerAuthContext } from "@/lib/api/withAuth";
import { ClienteService } from "@/services/ClienteService";
import { CreditoService } from "@/services/CreditoService";

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

export default async function PrintCreditoPage({ params }: PageProps) {
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
  const [organization, credito, cuotas] = await Promise.all([
    getOrganization(auth.organizationId),
    CreditoService.getById(auth.organizationId, id),
    CreditoService.getCuotas(auth.organizationId, id),
  ]);

  if (!credito) {
    notFound();
  }

  const cliente = await ClienteService.getById(auth.organizationId, credito.cliente_id);
  if (!cliente) {
    notFound();
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <header className="no-print flex items-center justify-between border-b border-black pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-black">Impresion de credito</h1>
          <p className="text-sm text-black">Contrato listo para impresion.</p>
        </div>
        <PrintButton />
      </header>

      <ContratoCredito
        cliente={cliente}
        credito={credito}
        cuotas={cuotas}
        organization={organization}
        printedAt={new Date().toISOString()}
      />
    </section>
  );
}
