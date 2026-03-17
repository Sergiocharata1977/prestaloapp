import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, LayoutDashboard, Search, Settings, Wallet, BarChart3, Calendar, Users, Percent } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans overflow-x-hidden">
      
      {/* 1. HERO SECTION */}
      <section className="relative w-full pt-32 pb-20 px-6 lg:px-8 bg-gradient-to-b from-brand-bg to-brand-mint overflow-hidden">
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <h1 className="text-5xl lg:text-7xl font-bold font-heading leading-[1.1] text-brand-text tracking-tight">
              Gestioná créditos, cobros y cartera desde un <span className="text-brand-primary">único tablero.</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-xl">
              El sistema operativo para financieras y prestamistas. Diseñado para simplificar tus operaciones diarias sin la complejidad de un banco.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/clientes" className="inline-flex items-center justify-center bg-brand-accent hover:bg-amber-600 text-white font-medium px-8 py-4 rounded-full transition-all duration-200 transform hover:scale-105 shadow-[0_8px_30px_rgb(217,119,6,0.3)]">
                Empezar gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
          
          {/* Hero Dashboard Mockup */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-tr from-brand-primary to-brand-accent rounded-[2rem] blur-xl opacity-20"></div>
            <div className="relative bg-white border border-gray-100 p-6 rounded-[2rem] shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center">
                    <Wallet className="text-white h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Financiera del Norte</p>
                    <p className="text-xs text-gray-400">Panel de Control</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-brand-mint/50 p-4 rounded-2xl border border-brand-mint">
                  <p className="text-gray-600 text-sm font-medium mb-1">Cartera activa</p>
                  <p className="text-2xl font-bold font-heading text-brand-primary">$ 4.200.000</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-gray-600 text-sm font-medium mb-1">Cobros del día</p>
                  <p className="text-2xl font-bold font-heading text-brand-text">47</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 col-span-2">
                  <p className="text-gray-600 text-sm font-medium mb-1">Créditos vigentes</p>
                  <div className="flex items-end gap-3 mt-2">
                    <p className="text-3xl font-bold font-heading text-brand-text">312</p>
                    <div className="flex items-center text-sm text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md mb-1">
                      +12 este mes
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SOCIAL PROOF */}
      <section className="py-12 border-y border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-gray-500 tracking-wider uppercase mb-8">
            Más de 80 financieras ya operan con Préstalo
          </p>
          <div className="flex flex-wrap justify-center gap-12 opacity-60 grayscale">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FEATURES */}
      <section className="py-24 bg-brand-mint text-brand-primary relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold font-heading mb-4 text-brand-text">Todo lo que necesitás, sin fricciones.</h2>
            <p className="text-xl text-gray-600">Herramientas pensadas para la realidad del prestamista.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Percent className="h-6 w-6 text-brand-accent" />}
              title="Originación en 3 minutos"
              description="Formularios de crédito simples, previsualización de amortización y generación automática de cronogramas."
            />
            <FeatureCard 
              icon={<Calendar className="h-6 w-6 text-brand-accent" />}
              title="Cobranza automatizada"
              description="Seguimiento de cuotas, alertas de atrasos y conciliación diaria de caja en tiempo real."
            />
            <FeatureCard 
              icon={<BarChart3 className="h-6 w-6 text-brand-accent" />}
              title="Contabilidad integrada"
              description="Asientos automáticos, libro diario y estado de cuenta por cliente, siempre actualizados."
            />
          </div>
        </div>
      </section>

      {/* 4. MOCKUP SECTION */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold font-heading mb-12 text-brand-text">Control total de tu negocio</h2>
          <div className="relative mx-auto w-full max-w-5xl rounded-xl shadow-2xl border border-gray-100 bg-[#f8f9fa] overflow-hidden">
            {/* Fake Browser header */}
            <div className="h-12 bg-white border-b border-gray-100 flex items-center px-4 gap-2">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="mx-4 flex-1 bg-gray-100 h-6 rounded-md"></div>
            </div>
            {/* Mockup content */}
            <div className="p-8 flex gap-8 select-none">
              {/* Sidebar */}
              <div className="w-64 bg-brand-primary rounded-2xl p-4 text-white space-y-6 hidden md:block">
                <div className="font-bold text-xl py-2">Préstalo.</div>
                <div className="space-y-2">
                  <div className="bg-white/10 p-3 rounded-xl flex items-center gap-3"><LayoutDashboard size={18} /> Tablero</div>
                  <div className="p-3 rounded-xl flex items-center gap-3 opacity-60"><Users size={18} /> Clientes</div>
                  <div className="p-3 rounded-xl flex items-center gap-3 opacity-60"><Wallet size={18} /> Créditos</div>
                  <div className="p-3 rounded-xl flex items-center gap-3 opacity-60"><Calendar size={18} /> Cobranzas</div>
                </div>
              </div>
              {/* Main Content */}
              <div className="flex-1 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="h-8 w-48 bg-gray-200 rounded-md"></div>
                  <div className="h-10 w-32 bg-brand-accent rounded-full text-white flex items-center justify-center font-medium text-sm">Nuevo Crédito</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-32 bg-white rounded-xl shadow-sm border border-gray-100"></div>
                  <div className="h-32 bg-white rounded-xl shadow-sm border border-gray-100"></div>
                  <div className="h-32 bg-white rounded-xl shadow-sm border border-gray-100"></div>
                </div>
                <div className="h-64 bg-white rounded-xl shadow-sm border border-gray-100"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section className="py-24 bg-brand-bg relative">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-4xl font-bold font-heading text-center mb-16 text-brand-text">Tan simple como 1, 2, 3</h2>
          
          <div className="relative flex flex-col md:flex-row justify-between items-center gap-12">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 border-t-2 border-dashed border-gray-300 -z-10 -translate-y-1/2"></div>
            
            <StepCard number="1" icon={<Users className="w-8 h-8" />} title="Cargás el cliente" />
            <StepCard number="2" icon={<Settings className="w-8 h-8" />} title="Configurás el crédito" />
            <StepCard number="3" icon={<CheckCircle2 className="w-8 h-8" />} title="Cobrás y controlás" isGreen />
          </div>
        </div>
      </section>

      {/* 6. PRICING PROXY */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold font-heading mb-4 text-brand-text">Planes diseñados para crecer</h2>
            <p className="text-xl text-gray-600">Escalá tus operaciones sin preocuparte por la tecnología.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Starter */}
            <div className="bg-white rounded-[2rem] p-8 border border-gray-200 shadow-sm">
              <h3 className="text-2xl font-bold font-heading mb-2">Starter</h3>
              <p className="text-gray-500 mb-6">Para financiadoras en crecimiento.</p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-gray-400" /> Hasta 500 créditos activos</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-gray-400" /> 2 usuarios administradores</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-gray-400" /> Soporte por email</li>
              </ul>
              <button className="w-full py-3 rounded-full border-2 border-gray-200 text-gray-700 font-semibold hover:border-gray-300 transition-colors">Consultar</button>
            </div>
            
            {/* Pro */}
            <div className="bg-brand-primary rounded-[2rem] p-8 border-2 border-brand-primary shadow-xl relative text-white transform md:-scale-y-100 md:scale-y-100 md:scale-105">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-brand-accent text-white px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wide">
                Más popular
              </div>
              <h3 className="text-2xl font-bold font-heading mb-2">Pro</h3>
              <p className="text-gray-300 mb-6">Para operaciones consolidadas y de volumen.</p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-brand-mint" /> Créditos ilimitados</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-brand-mint" /> Usuarios ilimitados</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-brand-mint" /> Contabilidad avanzada</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-brand-mint" /> Soporte prioritario 24/7</li>
              </ul>
              <button className="w-full py-3 rounded-full bg-brand-accent hover:bg-amber-600 text-white font-semibold transition-colors">Consultar</button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. TESTIMONIAL */}
      <section className="py-24 bg-brand-primary text-white relative flex justify-center items-center">
        <div className="absolute top-8 left-12 text-9xl text-white/5 font-serif select-none">&quot;</div>
        <div className="absolute bottom-8 right-12 text-9xl text-white/5 font-serif select-none rotate-180">&quot;</div>
        <div className="max-w-4xl mx-auto px-6 text-center z-10">
          <p className="text-3xl md:text-5xl font-heading font-medium leading-tight mb-8">
            &quot;Antes manejábamos todo en Excel. Con Préstalo cerramos el mes en 20 minutos.&quot;
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 bg-gray-400 rounded-full overflow-hidden flex items-center justify-center">
               <img src="https://i.pravatar.cc/100?img=11" alt="Gerente" className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <p className="font-bold text-lg text-brand-mint">Roberto Sánchez</p>
              <p className="text-brand-mint/70">Gerente de operaciones, Financiera del Norte</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FINAL CTA */}
      <section className="py-32 bg-brand-bg text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-5xl font-bold font-heading mb-6 text-brand-text">Tu financiera, digitalizada.</h2>
          <p className="text-2xl text-gray-600 mb-10">Probalo sin tarjeta. Setup en 15 minutos.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/clientes" className="bg-brand-accent hover:bg-amber-600 text-white font-medium px-8 py-4 rounded-full transition-all duration-200 text-lg">
              Empezar gratis
            </Link>
            <button className="bg-transparent border-2 border-brand-primary text-brand-primary hover:bg-brand-primary/5 font-medium px-8 py-4 rounded-full transition-all duration-200 text-lg">
              Ver demo
            </button>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="bg-brand-primary pt-16 pb-8 border-t border-white/10 text-brand-mint/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1">
              <h4 className="text-2xl font-bold font-heading text-white mb-4">Préstalo.</h4>
              <p className="text-sm opacity-80 mb-6">El sistema operativo para financieras y prestamistas de América Latina.</p>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Producto</h5>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-amber-400 transition-colors">Características</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Precios</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Seguridad</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Empresa</h5>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-amber-400 transition-colors">Sobre nosotros</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Contacto</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Legal</h5>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-amber-400 transition-colors">Términos del servicio</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Política de privacidad</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 text-center text-sm">
            © 2026 Préstalo · Hecho en Argentina con ♥
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 transform hover:-translate-y-1">
      <div className="w-14 h-14 bg-brand-mint rounded-2xl flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold font-heading mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ number, icon, title, isGreen = false }: { number: string, icon: React.ReactNode, title: string, isGreen?: boolean }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 flex-1 w-full relative z-10 flex flex-col items-center text-center">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-white shadow-xl ${isGreen ? 'bg-brand-primary' : 'bg-brand-accent'}`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold font-heading">{title}</h3>
      <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-brand-bg text-brand-text font-bold flex items-center justify-center border-2 border-dashed border-gray-300">
        {number}
      </div>
    </div>
  );
}
