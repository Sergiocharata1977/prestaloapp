"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { NuevoCreditoDialog } from "@/components/fin/dialogs/NuevoCreditoDialog";
import { Button } from "@/components/ui/button";

export default function NuevoCreditoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClienteId = searchParams.get("clienteId") ?? undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/creditos")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Otorgamiento bajo politica
          </h1>
          <p className="text-sm text-slate-500">
            Personas y empresas con validacion de cupo, scoring y legajo.
          </p>
        </div>
      </div>

      <NuevoCreditoDialog
        open
        preselectedClienteId={preselectedClienteId}
        onOpenChange={(open) => {
          if (!open) {
            router.push("/creditos");
          }
        }}
      />
    </div>
  );
}
