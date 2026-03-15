export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 sm:px-10">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-6">
          <p className="inline-flex rounded-full border border-accent/20 bg-card px-4 py-1 text-sm font-medium text-accent">
            Ola 0 completada
          </p>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
              PrestaloApp arranca con la base tecnica lista para financiar consumo.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted">
              Proyecto Next.js con Tailwind v4, tipos financieros, servicios
              core, Firebase collections y utilidades iniciales preparados para
              las siguientes olas.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-8 shadow-[0_20px_80px_rgba(31,41,55,0.08)]">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Checklist de base</h2>
            <ul className="space-y-3 text-sm text-muted">
              <li>Next App creada con `src/` + alias `@/*`.</li>
              <li>Stack del proyecto instalado para olas siguientes.</li>
              <li>Servicios y tipos financieros copiados desde `9001app-firebase`.</li>
              <li>Script `scripts/audit-imports.sh` listo para control de capas.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
