import type { FinCliente } from "@/types/fin-cliente";
import type { FinCredito } from "@/types/fin-credito";
import type { FinCuota } from "@/types/fin-cuota";

type PrintOrganization = {
  name: string;
  cuit?: string | null;
  domicilio?: string | null;
  logoUrl?: string | null;
};

type ContratoCreditoProps = {
  organization: PrintOrganization;
  cliente: FinCliente;
  credito: FinCredito;
  cuotas: FinCuota[];
  printedAt: string;
};

function formatCurrency(value: number) {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("es-AR");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("es-AR");
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number") {
    return "No disponible";
  }

  return `${value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function getClienteNombre(cliente: FinCliente) {
  if (cliente.tipo === "juridica") {
    return cliente.nombre;
  }

  return [cliente.nombre, cliente.apellido].filter(Boolean).join(" ");
}

export function ContratoCredito({
  organization,
  cliente,
  credito,
  cuotas,
  printedAt,
}: ContratoCreditoProps) {
  return (
    <article className="mx-auto w-full max-w-5xl border border-black bg-white p-8 text-black print:max-w-none print:border-0 print:p-10">
      <header className="border-b border-black pb-4">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em]">Contrato de credito</p>
            <h1 className="text-2xl font-semibold uppercase">{organization.name}</h1>
            <p className="text-sm">CUIT: {organization.cuit ?? "No disponible"}</p>
            <p className="text-sm">
              Domicilio: {organization.domicilio ?? "No disponible"}
            </p>
          </div>
          {organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={organization.name}
              className="max-h-20 max-w-40 object-contain"
              src={organization.logoUrl}
            />
          ) : null}
        </div>
      </header>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-3 border border-black p-4">
          <h2 className="text-sm font-semibold uppercase">Datos del acreedor</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-semibold">Razon social</dt>
              <dd>{organization.name}</dd>
            </div>
            <div>
              <dt className="font-semibold">CUIT</dt>
              <dd>{organization.cuit ?? "No disponible"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Domicilio</dt>
              <dd>{organization.domicilio ?? "No disponible"}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3 border border-black p-4">
          <h2 className="text-sm font-semibold uppercase">Datos del cliente</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-semibold">Nombre o razon social</dt>
              <dd>{getClienteNombre(cliente)}</dd>
            </div>
            <div>
              <dt className="font-semibold">CUIT</dt>
              <dd>{cliente.cuit}</dd>
            </div>
            <div>
              <dt className="font-semibold">Domicilio</dt>
              <dd>{cliente.domicilio ?? "No informado"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-6 space-y-4 border border-black p-4">
        <h2 className="text-sm font-semibold uppercase">Condiciones del credito</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-semibold">Numero de credito</dt>
            <dd>{credito.numero_credito}</dd>
          </div>
          <div>
            <dt className="font-semibold">Capital otorgado</dt>
            <dd>{formatCurrency(credito.capital)}</dd>
          </div>
          <div>
            <dt className="font-semibold">Sistema</dt>
            <dd>{credito.sistema === "frances" ? "Frances" : "Aleman"}</dd>
          </div>
          <div>
            <dt className="font-semibold">Cantidad de cuotas</dt>
            <dd>{credito.cantidad_cuotas}</dd>
          </div>
          <div>
            <dt className="font-semibold">Tasa mensual aplicada</dt>
            <dd>{formatPercent(credito.snapshot_tasa_mensual)}</dd>
          </div>
          <div>
            <dt className="font-semibold">Tasa punitoria mensual</dt>
            <dd>{formatPercent(credito.snapshot_tasa_punitoria_mensual)}</dd>
          </div>
          <div>
            <dt className="font-semibold">Fecha de otorgamiento</dt>
            <dd>{formatDate(credito.fecha_otorgamiento)}</dd>
          </div>
          <div>
            <dt className="font-semibold">Primer vencimiento</dt>
            <dd>{formatDate(credito.fecha_primer_vencimiento)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase">Tabla de amortizacion</h2>
          <p className="text-xs">Total financiado: {formatCurrency(credito.total_credito)}</p>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-black px-2 py-2 text-left">Cuota</th>
              <th className="border border-black px-2 py-2 text-left">Vencimiento</th>
              <th className="border border-black px-2 py-2 text-right">Capital</th>
              <th className="border border-black px-2 py-2 text-right">Interes</th>
              <th className="border border-black px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((cuota) => (
              <tr key={cuota.id}>
                <td className="border border-black px-2 py-2">{cuota.numero_cuota}</td>
                <td className="border border-black px-2 py-2">
                  {formatDate(cuota.fecha_vencimiento)}
                </td>
                <td className="border border-black px-2 py-2 text-right">
                  {formatCurrency(cuota.capital)}
                </td>
                <td className="border border-black px-2 py-2 text-right">
                  {formatCurrency(cuota.interes)}
                </td>
                <td className="border border-black px-2 py-2 text-right font-semibold">
                  {formatCurrency(cuota.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 space-y-3 border border-black p-4 text-sm leading-6">
        <p>
          El cliente reconoce haber recibido el capital indicado y se obliga a cancelar
          el presente credito conforme al cronograma precedente.
        </p>
        <p>
          En caso de mora, se aplicara una tasa punitoria mensual de{" "}
          <span className="font-semibold">
            {formatPercent(credito.snapshot_tasa_punitoria_mensual)}
          </span>{" "}
          sobre las sumas vencidas e impagas.
        </p>
      </section>

      <section className="mt-10 grid gap-10 md:grid-cols-2">
        <div className="pt-10 text-center">
          <div className="border-t border-black pt-2 text-sm font-semibold">
            Firma del cliente
          </div>
        </div>
        <div className="pt-10 text-center">
          <div className="border-t border-black pt-2 text-sm font-semibold">
            Firma representante de la empresa
          </div>
        </div>
      </section>

      <footer className="mt-10 border-t border-black pt-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Credito N. {credito.numero_credito}</span>
          <span>Fecha de impresion: {formatDateTime(printedAt)}</span>
        </div>
      </footer>
    </article>
  );
}
