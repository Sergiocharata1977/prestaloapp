import { redirect } from "next/navigation";
import type { ReactNode, CSSProperties } from "react";
import { requireServerAuthContext } from "@/lib/api/withAuth";
import { PrintButton } from "@/components/fin/print/PrintButton";

const PRINT_ROLES = ["admin", "gerente", "operador"];

export default async function PrintOrdenServicioPage() {
  try {
    await requireServerAuthContext({ roles: PRINT_ROLES });
  } catch {
    redirect("/login");
  }

  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-8 print:max-w-none print:px-0 print:py-0">
      {/* Toolbar — oculto al imprimir */}
      <header className="no-print flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Orden de Prestación de Servicios</h1>
          <p className="text-sm text-slate-500">Documento legal · Agrobiciuffa SRL</p>
        </div>
        <PrintButton label="Imprimir" />
      </header>

      {/* Documento imprimible */}
      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* Encabezado del documento */}
        <div className="bg-[#1a1a1a] px-10 py-8 text-center text-white">
          <p className="text-[10px] tracking-[0.3em] uppercase text-slate-400">
            Agrobiciuffa SRL · Servicios de Tecnología
          </p>
          <h1 className="mt-3 text-2xl font-bold uppercase tracking-widest">
            Orden de Prestación de Servicios
          </h1>
          <p className="mt-1 text-[10px] tracking-[0.25em] uppercase text-slate-400">
            Desarrollo de Software
          </p>
        </div>

        {/* Cuerpo del documento */}
        <div className="px-10 py-8 text-[13px] leading-relaxed text-[#1a1a1a]">
          {/* Número y fecha */}
          <div className="mb-8 flex flex-wrap gap-x-12 gap-y-2 border-b border-[#e5e7eb] pb-5">
            <Row label="Orden N°">
              <Field width="100px" />
            </Row>
            <Row label="Lugar y Fecha">
              <Field width="220px" />
            </Row>
          </div>

          {/* Cláusula 1 */}
          <Clause number="1" title="Las Partes">
            <p>
              <strong>Prestador:</strong> Agrobiciuffa SRL.{"  "}CUIT:{" "}
              <Field width="130px" />.{"  "}Domicilio:{" "}
              <Field width="280px" />
            </p>
            <p className="mt-4">
              <strong>Cliente:</strong> <Field width="180px" />.{"  "}CUIT/DNI:{" "}
              <Field width="130px" />.{"  "}Domicilio:{" "}
              <Field width="240px" />
            </p>
            <Lines count={1} />
          </Clause>

          {/* Cláusula 2 */}
          <Clause number="2" title="Objeto del Servicio">
            <p>
              <strong>Nombre del Proyecto:</strong> <Field width="300px" />
            </p>
            <p className="mt-3 font-semibold">Descripción General del Desarrollo:</p>
            <Lines count={4} />
            <p className="mt-4 font-semibold">Plataforma y Tecnologías a utilizar:</p>
            <Lines count={2} />
          </Clause>

          {/* Cláusula 3 */}
          <Clause number="3" title="Entregables y Plazos">
            <div className="space-y-3">
              <HitoRow label="Hito 1" />
              <HitoRow label="Hito 2" />
              <HitoRow label="Entrega Final" />
            </div>
          </Clause>

          {/* Cláusula 4 */}
          <Clause number="4" title="Precio y Forma de Pago">
            <p>
              <strong>Costo Total del Desarrollo:</strong> <Field width="180px" />
            </p>
            <p className="mt-3 font-semibold">
              Condiciones de facturación y pagos (anticipo / contra entrega):
            </p>
            <Lines count={3} />
            <p className="mt-4 font-semibold">
              Datos para el Pago (CBU / Alias / Pasarela):
            </p>
            <Lines count={2} />
          </Clause>

          {/* Cláusula 5 */}
          <Clause number="5" title="Propiedad Intelectual y Confidencialidad">
            <p className="leading-7 text-[#374151]">
              El código fuente, documentación técnica y demás activos digitales desarrollados
              en el marco del presente contrato serán propiedad exclusiva del Cliente,
              transferidos en su totalidad una vez efectuado el pago íntegro del precio
              pactado. Hasta dicho momento, la titularidad permanecerá en cabeza del
              Prestador. Ambas partes se obligan a mantener estricta confidencialidad
              respecto de la información técnica, comercial y estratégica intercambiada
              durante la vigencia del presente acuerdo y por el plazo de dos (2) años
              posteriores a su extinción, bajo pena de responder por daños y perjuicios.
            </p>
          </Clause>

          {/* Cláusula 6 */}
          <Clause number="6" title="Mantenimiento y Garantía">
            <p className="leading-7 text-[#374151]">
              El Prestador garantiza el correcto funcionamiento del software entregado durante
              un período de <Field width="60px" /> días corridos contados desde la fecha de
              entrega final. Durante dicho período, el Prestador se compromete a corregir, sin
              cargo adicional, cualquier falla o error imputable al desarrollo. Quedan
              excluidos del alcance de la garantía los desperfectos originados por
              modificaciones realizadas por el Cliente o por terceros ajenos al Prestador.
            </p>
          </Clause>

          {/* Cláusula 7 — Firmas */}
          <Clause number="7" title="Aceptación y Firmas">
            <div className="mt-6 grid grid-cols-2 gap-16">
              <SignatureBlock party="Por el Prestador" />
              <SignatureBlock party="Por el Cliente" />
            </div>
          </Clause>

          {/* Pie */}
          <footer className="mt-10 border-t border-[#e5e7eb] pt-4 text-center text-[11px] text-[#9ca3af]">
            Agrobiciuffa SRL · Documento generado el {today}
          </footer>
        </div>
      </article>
    </section>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Field({ width = "120px" }: { width?: string }) {
  const style: CSSProperties = {
    display: "inline-block",
    minWidth: width,
    borderBottom: "1px solid #1a1a1a",
    verticalAlign: "bottom",
  };
  return <span style={style} />;
}

function Lines({ count = 2 }: { count?: number }) {
  return (
    <div style={{ marginTop: "6px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: "100%",
            height: "26px",
            borderBottom: "1px solid #9ca3af",
            marginBottom: "2px",
          }}
        />
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
        {label}:
      </span>
      {children}
    </div>
  );
}

function HitoRow({ label }: { label: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="w-28 shrink-0 font-semibold">{label}:</span>
      <Field width="200px" />
      <span className="shrink-0 text-[#6b7280]">— Fecha de entrega:</span>
      <Field width="100px" />
    </div>
  );
}

function Clause({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginTop: "28px" }}>
      <h2
        style={{
          fontSize: "11px",
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#1a1a1a",
          borderBottom: "2px solid #1a1a1a",
          paddingBottom: "4px",
          marginBottom: "12px",
        }}
      >
        Cláusula {number}. {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function SignatureBlock({ party }: { party: string }) {
  return (
    <div className="space-y-6">
      <p className="border-b border-[#e5e7eb] pb-2 text-center text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
        {party}
      </p>
      <div>
        <div className="h-14 w-full border-b border-[#1a1a1a]" />
        <p className="mt-1 text-center text-[11px] text-[#9ca3af]">Firma</p>
      </div>
      <div>
        <div className="h-5 w-full border-b border-[#1a1a1a]" />
        <p className="mt-1 text-center text-[11px] text-[#9ca3af]">Aclaración</p>
      </div>
      <div>
        <div className="h-5 w-full border-b border-[#1a1a1a]" />
        <p className="mt-1 text-center text-[11px] text-[#9ca3af]">Cargo / Representación</p>
      </div>
    </div>
  );
}
