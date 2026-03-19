import type { FinCliente } from "@/types/fin-cliente";
import type { FinCheque } from "@/types/fin-cheque";
import type { FinOperacionChequeDetalle } from "@/types/fin-operacion-cheque";
import type { FinCaja, FinSucursal } from "@/types/fin-sucursal";

type PrintOrganization = {
  name: string;
  cuit?: string | null;
  domicilio?: string | null;
  logoUrl?: string | null;
};

type LiquidacionChequeProps = {
  organization: PrintOrganization;
  cliente: FinCliente;
  operacion: FinOperacionChequeDetalle;
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

function resolveChequeNumero(cheque: FinCheque) {
  return cheque.numero ?? cheque.numero_cheque ?? cheque.id;
}

function resolveChequeBanco(cheque: FinCheque) {
  return cheque.banco ?? cheque.banco_nombre ?? "No informado";
}

function resolveChequeLibrador(cheque: FinCheque) {
  return cheque.cuit_librador ?? cheque.titular ?? cheque.librador_nombre ?? "No informado";
}

function calcularDiasPromedioPonderados(
  cheques: FinCheque[],
  fechaLiquidacion: string
) {
  const base = new Date(fechaLiquidacion);
  if (Number.isNaN(base.getTime()) || cheques.length === 0) {
    return 0;
  }

  const nominal = cheques.reduce((acc, cheque) => acc + Number(cheque.importe || 0), 0);
  if (nominal <= 0) {
    return 0;
  }

  const weightedDays = cheques.reduce((acc, cheque) => {
    const fechaPago = new Date(cheque.fecha_pago);
    if (Number.isNaN(fechaPago.getTime())) {
      return acc;
    }

    const days = Math.floor(
      (Date.UTC(
        fechaPago.getUTCFullYear(),
        fechaPago.getUTCMonth(),
        fechaPago.getUTCDate()
      ) -
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())) /
        86400000
    );

    return acc + Math.max(0, days) * Number(cheque.importe || 0);
  }, 0);

  return weightedDays / nominal;
}

export function LiquidacionCheque({
  organization,
  cliente,
  operacion,
  sucursal,
  caja,
  printedAt,
}: LiquidacionChequeProps) {
  const resumen = operacion.resumen;
  const tasaMensual = operacion.tasa_mensual_aplicada ?? 0;
  const tasaDiaria = tasaMensual / 30;
  const sumaNominal = resumen?.importe_bruto ?? operacion.importe_bruto ?? 0;
  const descuento = resumen?.descuento ?? operacion.descuento ?? 0;
  const gastosFijos = resumen?.gastos_fijos_total ?? operacion.gastos_fijos_total ?? 0;
  const gastosVariables =
    resumen?.gastos_variables_total ?? operacion.gastos_variables_total ?? 0;
  const totalGastos = resumen?.gastos ?? operacion.total_gastos ?? 0;
  const neto = resumen?.importe_neto ?? operacion.importe_neto_liquidado ?? 0;
  const diasPromedioPonderados = calcularDiasPromedioPonderados(
    operacion.cheques,
    operacion.fecha_liquidacion
  );

  return (
    <article className="mx-auto w-full max-w-5xl border border-black bg-white p-8 text-black print:max-w-none print:border-0 print:p-10">
      <header className="border-b border-black pb-4">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em]">
              Liquidacion de cheques
            </p>
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
          <h2 className="text-sm font-semibold uppercase">Datos del presentante</h2>
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
          <h2 className="text-sm font-semibold uppercase">Datos de liquidacion</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-semibold">Operacion</dt>
              <dd>{operacion.numero_operacion ?? operacion.id}</dd>
            </div>
            <div>
              <dt className="font-semibold">Fecha de liquidacion</dt>
              <dd>{formatDate(operacion.fecha_liquidacion)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Sucursal</dt>
              <dd>{sucursal?.nombre ?? operacion.sucursal_id}</dd>
            </div>
            <div>
              <dt className="font-semibold">Caja</dt>
              <dd>{caja?.nombre ?? operacion.caja_id ?? "No asignada"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase">Cheques incluidos</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-black px-2 py-2 text-left">Banco</th>
              <th className="border border-black px-2 py-2 text-left">Numero</th>
              <th className="border border-black px-2 py-2 text-left">CUIT librador</th>
              <th className="border border-black px-2 py-2 text-left">Fecha vto</th>
              <th className="border border-black px-2 py-2 text-right">Valor nominal</th>
            </tr>
          </thead>
          <tbody>
            {operacion.cheques.map((cheque) => (
              <tr key={cheque.id}>
                <td className="border border-black px-2 py-2">
                  {resolveChequeBanco(cheque)}
                </td>
                <td className="border border-black px-2 py-2">
                  {resolveChequeNumero(cheque)}
                </td>
                <td className="border border-black px-2 py-2">
                  {resolveChequeLibrador(cheque)}
                </td>
                <td className="border border-black px-2 py-2">
                  {formatDate(cheque.fecha_pago)}
                </td>
                <td className="border border-black px-2 py-2 text-right font-semibold">
                  {formatCurrency(cheque.importe)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="border border-black p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase">Calculo de liquidacion</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Suma nominal</dt>
              <dd>{formatCurrency(sumaNominal)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Dias promedio ponderados</dt>
              <dd>
                {diasPromedioPonderados.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Descuento</dt>
              <dd>{formatCurrency(descuento)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Gastos fijos</dt>
              <dd>{formatCurrency(gastosFijos)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Gastos variables</dt>
              <dd>{formatCurrency(gastosVariables)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Total gastos</dt>
              <dd>{formatCurrency(totalGastos)}</dd>
            </div>
            <div className="sm:col-span-2 border-t border-black pt-2">
              <dt className="font-semibold">Neto a acreditar</dt>
              <dd className="text-base font-semibold">{formatCurrency(neto)}</dd>
            </div>
          </dl>
        </div>

        <div className="border border-black p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase">Condiciones aplicadas</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-semibold">Tasa mensual aplicada</dt>
              <dd>{formatPercent(tasaMensual)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Tasa diaria usada</dt>
              <dd>{formatPercent(tasaDiaria)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Gastos fijos</dt>
              <dd>
                {operacion.gastos_fijos?.length
                  ? operacion.gastos_fijos
                      .map((gasto) => `${gasto.concepto}: ${formatCurrency(gasto.importe)}`)
                      .join(" | ")
                  : "Sin gastos fijos informados"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Gastos variables</dt>
              <dd>
                {operacion.gastos_variables?.length
                  ? operacion.gastos_variables
                      .map((gasto) => `${gasto.concepto}: ${formatPercent(gasto.porcentaje)}`)
                      .join(" | ")
                  : "Sin gastos variables informados"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-10 grid gap-10 md:grid-cols-2">
        <div className="pt-10 text-center">
          <div className="border-t border-black pt-2 text-sm font-semibold">
            Firma del presentante
          </div>
        </div>
        <div className="pt-10 text-center">
          <div className="border-t border-black pt-2 text-sm font-semibold">
            Fecha de liquidacion: {formatDateTime(operacion.fecha_liquidacion)}
          </div>
        </div>
      </section>

      <footer className="mt-10 border-t border-black pt-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Operacion N. {operacion.numero_operacion ?? operacion.id}</span>
          <span>Impreso: {formatDateTime(printedAt)}</span>
        </div>
      </footer>
    </article>
  );
}
