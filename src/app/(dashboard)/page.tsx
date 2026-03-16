import {
  BadgeDollarSign,
  BriefcaseBusiness,
  ReceiptText,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stats = [
  {
    title: "Total Clientes",
    value: "0",
    detail: "Base de clientes activos",
    icon: Users,
  },
  {
    title: "Créditos Activos",
    value: "0",
    detail: "Operaciones vigentes",
    icon: BriefcaseBusiness,
  },
  {
    title: "Cobros del Día",
    value: "0",
    detail: "Pagos registrados hoy",
    icon: ReceiptText,
  },
  {
    title: "Monto en Cartera",
    value: "$0",
    detail: "Capital administrado",
    icon: BadgeDollarSign,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
        <Badge className="w-fit">Dashboard operativo</Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Resumen general
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            El tablero inicial queda listo para conectar métricas reales de
            clientes, créditos, cobranzas y cartera.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ detail, icon: Icon, title, value }) => (
          <Card
            key={title}
            className="border-white/70 bg-white/88 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardDescription>{title}</CardDescription>
                <CardTitle className="text-3xl font-semibold tracking-tight">
                  {value}
                </CardTitle>
              </div>
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
