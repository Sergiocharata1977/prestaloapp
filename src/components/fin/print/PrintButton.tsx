"use client";

type PrintButtonProps = {
  label?: string;
};

export function PrintButton({ label = "Imprimir" }: PrintButtonProps) {
  return (
    <button
      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
      onClick={() => window.print()}
      type="button"
    >
      {label}
    </button>
  );
}
