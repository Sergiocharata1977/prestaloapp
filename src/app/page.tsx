import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Layers,
  Percent,
  Scale,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { DemoRequestForm } from "@/components/public/DemoRequestForm";

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-bg font-sans text-brand-text">
      <section className="relative w-full overflow-hidden bg-gradient-to-b from-brand-bg to-brand-mint px-6 pb-20 pt-32 lg:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
              <ShieldCheck className="h-4 w-4" />
              Sistema multi-tenant · Contabilidad 100% automática
            </div>
            <h1 className="font-heading text-5xl font-bold leading-[1.1] tracking-tight text-brand-text lg:text-7xl">
              Gestioná créditos, cheques y cartera desde un{" "}
              <span className="text-brand-primary">único tablero.</span>
            </h1>
            <p className="max-w-xl text-xl text-gray-600">
              El sistema operativo para financieras y prestamistas. Scoring crediticio,
              descuento de cheques, contabilidad automática y control multi-organización.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/clientes"
                className="inline-flex items-center justify-center rounded-full bg-brand-accent px-8 py-4 font-medium text-white shadow-[0_8px_30px_rgb(217,119,6,0.3)] transition-all duration-200 hover:scale-105 hover:bg-amber-600"
              >
                Empezar gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <a
                href="#demo-request-form"
                className="inline-flex items-center justify-center rounded-full border-2 border-brand-primary bg-transparent px-8 py-4 font-medium text-brand-primary transition-all duration-200 hover:bg-brand-primary/5"
              >
                Solicitar demo
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-tr from-brand-primary to-brand-accent opacity-20 blur-xl" />
            <div className="relative space-y-5 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Financiera del Norte</p>
                    <p className="text-xs text-gray-400">Panel de Control · org_norte</p>
                  </div>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Activa
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-brand-mint bg-brand-mint/50 p-4">
                  <p className="mb-1 text-xs font-medium text-gray-500">Cartera activa</p>
                  <p className="font-heading text-2xl font-bold text-brand-primary">$ 4.200.000</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-xs font-medium text-gray-500">Cobros del día</p>
                  <p className="font-heading text-2xl font-bold text-brand-text">47</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: "Clientes", val: "312", color: "bg-blue-50 text-blue-700" },
                  { label: "Créditos activos", val: "198", color: "bg-green-50 text-green-700" },
                  { label: "Cheques en cartera", val: "24", color: "bg-amber-50 text-amber-700" },
                ].map((stat) => (
                  <div key={stat.label} className={`${stat.color} rounded-xl p-3`}>
                    <p className="opacity-70">{stat.label}</p>
                    <p className="mt-1 text-lg font-bold">{stat.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-accent">
              Módulos incluidos
            </p>
            <h2 className="mb-4 font-heading text-4xl font-bold text-brand-text">
              Todo lo que necesitás, integrado.
            </h2>
            <p className="text-xl text-gray-600">
              Cada módulo trabaja en conjunto. Sin hojas de cálculo, sin doble carga.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <ModuleCard
              icon={<Users className="h-6 w-6" />}
              color="bg-green-100 text-green-600"
              title="Gestión de clientes 360°"
              items={[
                "Ficha completa: CUIT, DNI, domicilio, contacto",
                "Historial de créditos y cheques vinculados",
                "Scoring crediticio con evaluación por items",
                "Consulta Nosis: score, BCRA, juicios",
                "Legajo documental por tipo de cliente",
                "Línea de crédito: tier A/B/C, límite asignado",
              ]}
            />
            <ModuleCard
              icon={<CreditCard className="h-6 w-6" />}
              color="bg-blue-100 text-blue-600"
              title="Créditos y amortización"
              items={[
                "Sistema Francés o Alemán, con vista previa en tiempo real",
                "Cuotas generadas automáticamente al otorgar",
                "Tabla de amortización completa con capital e intereses",
                "Mora automática por tasa punitoria del snapshot",
                "Contrato imprimible con tabla de cuotas",
                "Snapshot de condiciones: política, plan, tasa",
              ]}
            />
            <ModuleCard
              icon={<ClipboardList className="h-6 w-6" />}
              color="bg-amber-100 text-amber-600"
              title="Descuento de cheques"
              items={[
                "Carga de uno o varios cheques por operación",
                "Cálculo automático: días, descuento, gastos y neto",
                "Seguimiento Kanban: recibido -> acreditado",
                "Estados de problema: rechazado, pre_judicial, judicial",
                "Liquidación imprimible por operación",
                "Asiento contable automático al liquidar",
              ]}
            />
            <ModuleCard
              icon={<Wallet className="h-6 w-6" />}
              color="bg-teal-100 text-teal-600"
              title="Cobros y cajas"
              items={[
                "Cobro de cuotas desde el detalle del crédito",
                "Selección de caja, sucursal y medio de pago",
                "Mora calculada automáticamente si la cuota vence",
                "Recibo de cobro imprimible",
                "Cajas organizadas por sucursal",
                "Asiento contable automático al cobrar",
              ]}
            />
            <ModuleCard
              icon={<ShieldCheck className="h-6 w-6" />}
              color="bg-purple-100 text-purple-600"
              title="Scoring crediticio"
              items={[
                "14 ítems en 3 categorías: Cualitativos, Conflictos, Cuantitativos",
                "Pesos configurables por categoría",
                "Score 0-10 -> tier: A (>=8), B (>=6), C (>=4)",
                "Analista puede aprobar o rechazar con override de tier",
                "Límite mensual y total por tier asignado",
                "Validación automática al otorgar un crédito",
              ]}
            />
            <ModuleCard
              icon={<Scale className="h-6 w-6" />}
              color="bg-slate-100 text-slate-600"
              title="Contabilidad automática"
              items={[
                "Asientos generados al otorgar crédito, cobrar o liquidar cheque",
                "Sin ingreso manual de asientos contables",
                "Plan de cuentas configurable (5 rubros, 26+ cuentas)",
                "Árbol Rubros -> Cuentas: Activo, Pasivo, PN, Ingresos, Egresos",
                "Mapeo de cuentas por tipo de movimiento",
                "Registros disponibles para auditoría externa",
              ]}
            />
          </div>
        </div>
      </section>

      <section className="relative bg-brand-mint py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-16 text-center font-heading text-4xl font-bold text-brand-text">
            Tan simple como 1, 2, 3
          </h2>
          <div className="relative flex flex-col items-center justify-between gap-12 md:flex-row">
            <div className="absolute left-0 right-0 top-1/2 -z-10 hidden h-0.5 -translate-y-1/2 border-t-2 border-dashed border-gray-300 md:block" />
            <StepCard
              number="1"
              icon={<Users className="h-8 w-8" />}
              title="Cargás el cliente"
              subtitle="Con evaluación crediticia y legajo"
            />
            <StepCard
              number="2"
              icon={<CreditCard className="h-8 w-8" />}
              title="Otorgás el crédito"
              subtitle="Cuotas y asiento generados solos"
            />
            <StepCard
              number="3"
              icon={<CheckCircle2 className="h-8 w-8" />}
              title="Cobrás y controlás"
              subtitle="Recibo, caja y contabilidad automática"
              isGreen
            />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-white py-24">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="mb-4 font-heading text-4xl font-bold text-brand-text">
            Control total de tu operación
          </h2>
          <p className="mb-12 text-lg text-gray-500">
            Sidebar ordenado por función. Todo a un clic de distancia.
          </p>
          <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-gray-100 bg-[#f8f9fa] shadow-2xl">
            <div className="flex h-12 items-center gap-2 border-b border-gray-100 bg-white px-4">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="mx-4 h-6 flex-1 rounded-md bg-gray-100" />
            </div>
            <div className="flex gap-6 p-6 select-none">
              <div className="hidden w-56 shrink-0 space-y-1 rounded-2xl bg-slate-950 p-4 text-white md:block">
                <div className="mb-3 px-2 py-2 text-base font-bold">Préstalo.</div>
                {[
                  { icon: LayoutDashboard, label: "Dashboard", active: true },
                  { icon: Users, label: "Clientes" },
                  { icon: Wallet, label: "Cobros" },
                ].map(({ icon: Icon, label, active }) => (
                  <div
                    key={label}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
                      active ? "bg-white/10 text-white" : "text-slate-400"
                    }`}
                  >
                    <Icon size={15} /> {label}
                  </div>
                ))}
                <div className="pt-2">
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400">
                    <Layers size={15} /> Operaciones &gt;
                  </div>
                  <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500">
                      <CreditCard size={13} /> Prestamos
                    </div>
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500">
                      <ClipboardList size={13} /> Cheques
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400">
                  <FileText size={15} /> Reportes
                </div>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400">
                  <BookOpen size={15} /> Manual
                </div>
                <div className="pt-2">
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400">
                    <Settings size={15} /> Configuración &gt;
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-44 rounded-md bg-gray-200" />
                  <div className="flex h-9 w-32 items-center justify-center rounded-full bg-brand-accent text-sm font-medium text-white">
                    + Nuevo crédito
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {["Clientes", "Créditos activos", "Cobros hoy", "Cartera"].map((label) => (
                    <div
                      key={label}
                      className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                    >
                      <p className="text-xs text-gray-400">{label}</p>
                      <div className="mt-2 h-6 w-16 rounded bg-gray-100" />
                    </div>
                  ))}
                </div>
                <div className="h-48 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 h-4 w-32 rounded bg-gray-100" />
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 border-b border-gray-50 py-2"
                    >
                      <div className="h-3 w-28 rounded bg-gray-100" />
                      <div className="h-3 w-20 rounded bg-gray-100" />
                      <div className="ml-auto h-3 w-16 rounded bg-green-100" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-brand-bg py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-heading text-4xl font-bold text-brand-text">
              Diseñado para la realidad del prestamista.
            </h2>
            <p className="text-xl text-gray-600">Sin fricciones, sin contadores, sin planillas.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<Percent className="h-6 w-6 text-brand-accent" />}
              title="Originación en 3 minutos"
              description="Formulario de crédito con previsualización de amortización en tiempo real. Cuotas, intereses y asiento contable se crean automáticamente al confirmar."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-6 w-6 text-brand-accent" />}
              title="Scoring integrado"
              description="14 ítems ponderados en 3 categorías. El sistema asigna tier A/B/C y límites de crédito. El analista aprueba o rechaza con un clic."
            />
            <FeatureCard
              icon={<Scale className="h-6 w-6 text-brand-accent" />}
              title="Contabilidad sin contadores"
              description="Cada operación genera su asiento automáticamente. Cero ingreso manual. Plan de cuentas propio configurable desde el panel."
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-heading text-4xl font-bold text-brand-text">
              Planes para cada etapa
            </h2>
            <p className="text-xl text-gray-600">
              Escalá tus operaciones sin preocuparte por la tecnología.
            </p>
          </div>
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
              <h3 className="mb-2 font-heading text-2xl font-bold">Starter</h3>
              <p className="mb-6 text-gray-500">Para financiadoras en crecimiento.</p>
              <ul className="mb-8 space-y-4">
                {[
                  "Hasta 500 créditos activos",
                  "2 usuarios administradores",
                  "Módulos core: créditos y cobros",
                  "Soporte por email",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-gray-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href="#demo-request-form"
                className="inline-flex w-full items-center justify-center rounded-full border-2 border-gray-200 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-300"
              >
                Consultar
              </a>
            </div>
            <div className="relative rounded-[2rem] border-2 border-brand-primary bg-brand-primary p-8 text-white shadow-xl md:scale-105">
              <div className="absolute right-8 top-0 -translate-y-1/2 rounded-full bg-brand-accent px-4 py-1 text-sm font-bold uppercase tracking-wide text-white">
                Más popular
              </div>
              <h3 className="mb-2 font-heading text-2xl font-bold">Pro</h3>
              <p className="mb-6 text-gray-300">Para operaciones consolidadas.</p>
              <ul className="mb-8 space-y-4">
                {[
                  "Créditos y clientes ilimitados",
                  "Usuarios ilimitados con roles",
                  "Scoring crediticio + Nosis",
                  "Descuento de cheques (Kanban)",
                  "Contabilidad automática completa",
                  "Multi-sucursal y multi-caja",
                  "Soporte prioritario 24/7",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-mint" />
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href="#demo-request-form"
                className="inline-flex w-full items-center justify-center rounded-full bg-brand-accent py-3 font-semibold text-white transition-colors hover:bg-amber-600"
              >
                Consultar
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center bg-brand-primary py-24 text-white">
        <div className="absolute left-12 top-8 select-none font-serif text-9xl text-white/5">
          &quot;
        </div>
        <div className="absolute bottom-8 right-12 rotate-180 select-none font-serif text-9xl text-white/5">
          &quot;
        </div>
        <div className="z-10 mx-auto max-w-4xl px-6 text-center">
          <p className="mb-8 font-heading text-3xl font-medium leading-tight md:text-5xl">
            &quot;Antes manejábamos todo en Excel. Con Préstalo cerramos el mes en 20
            minutos.&quot;
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-400">
              <Image
                src="https://i.pravatar.cc/100?img=11"
                alt="Gerente"
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-brand-mint">Roberto Sánchez</p>
              <p className="text-brand-mint/70">
                Gerente de operaciones, Financiera del Norte
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-32 text-center bg-brand-bg">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-6 font-heading text-5xl font-bold text-brand-text">
            Tu financiera, digitalizada.
          </h2>
          <p className="mb-10 text-2xl text-gray-600">
            Setup en 15 minutos. Sin tarjeta de crédito.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/clientes"
              className="rounded-full bg-brand-accent px-8 py-4 text-lg font-medium text-white transition-all duration-200 hover:bg-amber-600"
            >
              Empezar gratis
            </Link>
            <a
              href="#demo-request-form"
              className="rounded-full border-2 border-brand-primary bg-transparent px-8 py-4 text-lg font-medium text-brand-primary transition-all duration-200 hover:bg-brand-primary/5"
            >
              Ver demo
            </a>
          </div>
        </div>
      </section>

      <section id="demo-request-form" className="bg-white py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6 text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-accent">
              Solicitar Demo
            </p>
            <h2 className="font-heading text-4xl font-bold text-brand-text">
              Contanos cómo operás y te armamos una demo sobre tu caso real.
            </h2>
            <p className="text-lg text-gray-600">
              El pedido entra directo al portal super admin y se puede convertir en una
              organización activa con un click.
            </p>
            <div className="space-y-2 rounded-[2rem] border border-brand-mint bg-brand-mint/40 p-6 text-sm text-gray-700">
              <p className="font-semibold text-brand-primary">¿Qué incluye el setup?</p>
              <ul className="space-y-1.5">
                {[
                  "Usuario administrador con acceso completo",
                  "Configuración inicial de tipos, políticas y planes",
                  "Plan de cuentas contable cargado automáticamente",
                  "Datos demo opcionales para explorar el sistema",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-[2rem] border border-gray-100 bg-[#fffdf9] p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <DemoRequestForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-brand-primary pb-8 pt-16 text-brand-mint/80">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 grid gap-12 md:grid-cols-4">
            <div className="col-span-1">
              <h4 className="mb-4 font-heading text-2xl font-bold text-white">Préstalo.</h4>
              <p className="mb-4 text-sm opacity-80">
                El sistema operativo para financieras y prestamistas de América Latina.
              </p>
              <p className="text-xs opacity-50">
                Multi-tenant · Contabilidad automática · Scoring crediticio
              </p>
            </div>
            <div>
              <h5 className="mb-4 font-semibold text-white">Módulos</h5>
              <ul className="space-y-3 text-sm">
                {[
                  "Créditos y amortización",
                  "Descuento de cheques",
                  "Scoring crediticio",
                  "Contabilidad automática",
                ].map((item) => (
                  <li key={item}>
                    <a href="#" className="transition-colors hover:text-amber-400">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="mb-4 font-semibold text-white">Empresa</h5>
              <ul className="space-y-3 text-sm">
                {["Sobre nosotros", "Blog", "Contacto"].map((item) => (
                  <li key={item}>
                    <a href="#" className="transition-colors hover:text-amber-400">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="mb-4 font-semibold text-white">Legal</h5>
              <ul className="space-y-3 text-sm">
                {["Términos del servicio", "Política de privacidad"].map((item) => (
                  <li key={item}>
                    <a href="#" className="transition-colors hover:text-amber-400">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-sm">
            © 2026 Préstalo · Hecho en Argentina
          </div>
        </div>
      </footer>
    </div>
  );
}

function ModuleCard({
  icon,
  color,
  title,
  items,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
        {icon}
      </div>
      <h3 className="mb-4 font-heading text-lg font-bold text-brand-text">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-gray-500">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="transform rounded-3xl bg-white p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-mint">
        {icon}
      </div>
      <h3 className="mb-3 font-heading text-xl font-bold">{title}</h3>
      <p className="leading-relaxed text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  icon,
  title,
  subtitle,
  isGreen = false,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  isGreen?: boolean;
}) {
  return (
    <div className="relative z-10 flex w-full flex-1 flex-col items-center rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-lg">
      <div
        className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl ${
          isGreen ? "bg-brand-primary" : "bg-brand-accent"
        }`}
      >
        {icon}
      </div>
      <h3 className="font-heading text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      <div className="absolute -left-4 -top-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-brand-bg font-bold text-brand-text">
        {number}
      </div>
    </div>
  );
}
