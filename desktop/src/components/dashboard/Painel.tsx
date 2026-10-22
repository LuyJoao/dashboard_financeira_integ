import { ReactNode } from "react";

export function Painel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{titulo}</h2>
      {children}
    </section>
  );
}
