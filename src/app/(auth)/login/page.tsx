"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ArrowRight, Landmark } from "lucide-react";
import { auth } from "@/firebase/config";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormValues = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!loading && user) {
      router.replace("/clientes");
    }
  }, [loading, router, user]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      router.replace("/clientes");
    } catch {
      setSubmitError("No se pudo iniciar sesión. Verificá tus credenciales.");
    }
  });

  return (
    <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <section className="space-y-6">
        <div className="inline-flex items-center gap-3 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
          <Landmark className="h-4 w-4 text-amber-700" />
          Plataforma operativa para financiación al consumo
        </div>
        <div className="space-y-4">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Operá créditos, cobros y cartera desde un único tablero.
          </h1>
          <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Ingresá con tu cuenta para administrar clientes, originación,
            cobranzas y caja diaria en Préstalo.
          </p>
        </div>
      </section>

      <Card className="border-white/70 bg-white/88 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-slate-900">Iniciar sesión</CardTitle>
          <p className="text-sm text-slate-500">
            Accedé con el usuario habilitado para tu organización.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="equipo@prestalo.app"
                {...register("email", {
                  required: "Ingresá tu email.",
                })}
              />
              {errors.email ? (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password", {
                  required: "Ingresá tu contraseña.",
                })}
              />
              {errors.password ? (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              ) : null}
            </div>

            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}

            <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ingresando..." : "Entrar al panel"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
