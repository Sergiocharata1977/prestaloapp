"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

type FormState = {
  contactName: string;
  organizationName: string;
  email: string;
  phone: string;
  requestedPlan: "free" | "pro" | "enterprise";
  notes: string;
};

const INITIAL_STATE: FormState = {
  contactName: "",
  organizationName: "",
  email: "",
  phone: "",
  requestedPlan: "pro",
  notes: "",
};

export function DemoRequestForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/public/demo-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "No se pudo enviar la solicitud");
        return;
      }

      setForm(INITIAL_STATE);
      setSuccess("Solicitud enviada. Te vamos a contactar para coordinar la demo.");
    } catch (submitError) {
      console.error(submitError);
      setError("No se pudo enviar la solicitud");
    } finally {
      setSubmitting(false);
    }
  }

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form id="demo-request-form" className="space-y-5 text-left" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-brand-text">Nombre</span>
          <input
            className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-brand-text outline-none transition focus:border-brand-accent focus:ring-4 focus:ring-amber-100"
            value={form.contactName}
            onChange={(event) => updateField("contactName", event.target.value)}
            placeholder="Tu nombre"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-brand-text">Empresa</span>
          <input
            className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-brand-text outline-none transition focus:border-brand-accent focus:ring-4 focus:ring-amber-100"
            value={form.organizationName}
            onChange={(event) => updateField("organizationName", event.target.value)}
            placeholder="Financiera del Centro"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-brand-text">Email</span>
          <input
            type="email"
            className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-brand-text outline-none transition focus:border-brand-accent focus:ring-4 focus:ring-amber-100"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="nombre@empresa.com"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-brand-text">Teléfono</span>
          <input
            className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-brand-text outline-none transition focus:border-brand-accent focus:ring-4 focus:ring-amber-100"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="+54 9 11 5555 5555"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-brand-text">Plan estimado</span>
        <select
          className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-brand-text outline-none transition focus:border-brand-accent focus:ring-4 focus:ring-amber-100"
          value={form.requestedPlan}
          onChange={(event) =>
            updateField("requestedPlan", event.target.value as FormState["requestedPlan"])
          }
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-brand-text">Contexto</span>
        <textarea
          className="min-h-28 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-brand-text outline-none transition focus:border-brand-accent focus:ring-4 focus:ring-amber-100"
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          placeholder="Contanos volumen mensual, equipo y cómo operan hoy."
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-full bg-brand-accent px-8 py-4 text-lg font-medium text-white transition-all duration-200 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Enviando..." : "Solicitar demo"}
        <ArrowRight className="ml-2 h-5 w-5" />
      </button>
    </form>
  );
}
