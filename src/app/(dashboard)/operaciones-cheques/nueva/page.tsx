"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChequeOperationForm } from "@/components/fin/cheques/ChequeOperationForm";
import { Button } from "@/components/ui/button";

export default function NuevaOperacionChequePage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/operaciones-cheques")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Nueva operacion de cheque</h1>
          <p className="text-sm text-slate-500">
            Carga varios cheques, ajusta condiciones y confirma la oferta preliminar.
          </p>
        </div>
      </div>

      <ChequeOperationForm />
    </div>
  );
}
