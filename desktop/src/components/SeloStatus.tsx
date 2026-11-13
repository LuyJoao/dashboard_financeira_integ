import type { Titulo } from "../api/titulos";
import { diasDeAtraso, ROTULO_STATUS, statusDoTitulo } from "../lib/titulos";

export function SeloStatus({ titulo }: { titulo: Pick<Titulo, "vencimento" | "pago_em"> }) {
  const s = statusDoTitulo(titulo);
  const cores = {
    pago: "bg-green-100 text-green-800",
    vencido: "bg-red-100 text-red-800",
    vence_hoje: "bg-amber-100 text-amber-800",
    a_vencer: "bg-slate-100 text-slate-700",
  }[s];
  const dias = diasDeAtraso(titulo);
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${cores}`}>
      {ROTULO_STATUS[s]}
      {s === "vencido" && ` há ${dias} dia${dias > 1 ? "s" : ""}`}
    </span>
  );
}
