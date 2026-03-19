import type { FinCliente } from "@/types/fin-cliente";
import type { FinCobro } from "@/types/fin-cobro";
import type { FinCredito } from "@/types/fin-credito";
import type { FinCuota } from "@/types/fin-cuota";
import type { FinCaja, FinSucursal } from "@/types/fin-sucursal";

type PrintOrganization = {
  name: string;
  cuit?: string | null;
  domicilio?: string | null;
  logoUrl?: string | null;
};

type ReciboCobroProps = {
  organization: PrintOrganization;
  cliente: FinCliente;
  credito: FinCredito;
  cuota: FinCuota;
  cobro: FinCobro;
  sucursal: FinSucursal | null;
  caja: FinCaja | null;
  printedAt: string;
};

function formatCurrency(value: number) {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("es-AR");
}

function getClienteNombre(cliente: FinCliente) {
  if (cliente.tipo === "juridica") {
    return cliente.nombre;
  }

  return [cliente.nombre, cliente.apellido].filter(Boolean).join(" ");
}

export function ReciboCobro({
  organization,
  cliente,
  credito,
  cuota,
  cobro,
  sucursal,
  caja,
  printedAt,
}: ReciboCobroProps) {
  const numeroRecibo = cobro.id.slice(0, 8).toUpperCase();

  return (
    <article className="mx-auto w-full max-w-4xl border border-black bg-white p-8 text-black print:max-w-none print:border-0 print:p-10">
      <header className="border-b border-black pb-4">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em]">Recibo de cobro</p>
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

      <section className="mt-6 flex items-start justify-between gap-6 border border-black p-4">
        <div>
          <h2 className="text-lg font-semibold">Recibo N. {numeroRecibo}</h2>
          <p className="mt-1 text-sm">Comprobante de cancelacion de cuota</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">Fecha y hora de cobro</p>
          <p>{formatDateTime(cobro.fecha_cobro)}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
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

        <div className="space-y-3 border border-black p-4">
          <h2 className="text-sm font-semibold uppercase">Lugar de cobro</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-semibold">Sucursal</dt>
              <dd>{sucursal?.nombre ?? cobro.sucursal_id}</dd>
            </div>
            <div>
              <dt className="font-semibold">Caja</dt>
              <dd>{caja?.nombre ?? cobro.caja_id}</dd>
            </div>
            <div>
              <dt className="font-semibold">Cobrador</dt>
              <dd>{cobro.usuario_nombre}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase">Detalle de la cuota pagada</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-black px-3 py-2 text-left">Credito</th>
              <th className="border border-black px-3 py-2 text-left">Cuota</th>
              <th className="border border-black px-3 py-2 text-right">Capital</th>
              <th className="border border-black px-3 py-2 text-right">Interes</th>
              <th className="border border-black px-3 py-2 text-right">Total cobrado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-3 py-2">{credito.numero_credito}</td>
              <td className="border border-black px-3 py-2">
                {cuota.numero_cuota} de {credito.cantidad_cuotas}
              </td>
              <td className="border border-black px-3 py-2 text-right">
                {formatCurrency(cobro.capital_cobrado)}
              </td>
              <td className="border border-black px-3 py-2 text-right">
                {formatCurrency(cobro.interes_cobrado)}
              </td>
              <td className="border border-black px-3 py-2 text-right font-semibold">
                {formatCurrency(cobro.total_cobrado)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-6 grid gap-4 border border-black p-4 text-sm md:grid-cols-2">
        <div>
          <p className="font-semibold">Concepto</p>
          <p>
            Cobro correspondiente a la cuota {cobro.numero_cuota} del credito{" "}
            {credito.numero_credito}.
          </p>
        </div>
        <div>
          <p className="font-semibold">Vencimiento original</p>
          <p>{cuota.fecha_vencimiento}</p>
        </div>
      </section>

      <section className="mt-10 grid gap-10 md:grid-cols-2">
        <div className="pt-10 text-center">
          <div className="border-t border-black pt-2 text-sm font-semibold">
            Firma del cobrador
          </div>
        </div>
        <div className="pt-10 text-center">
          <div className="border-t border-black pt-2 text-sm font-semibold">
            Firma del cliente
          </div>
        </div>
      </section>

      <footer className="mt-10 border-t border-black pt-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Este recibo es valido como constancia de pago una vez emitido por la
            organizacion.
          </span>
          <span>Impreso: {formatDateTime(printedAt)}</span>
        </div>
      </footer>
    </article>
  );
}
