import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatDataHora } from "../lib/format";
import { usarModoImpressao } from "../lib/impressao";

const ROTULOS: Record<string, string> = {
  mes: "Mês", conta: "Conta", banco: "Conta", categoria: "Categoria", tipo: "Tipo", status: "Status",
  empresa: "Empresa", de: "De", ate: "Até", busca: "Busca", atraso: "Só com atraso", inconsistentes: "Só inconsistentes",
};

// Só aparece no papel: quem imprimiu, quando e com quais filtros.
export function CabecalhoImpressao() {
  usarModoImpressao(); // redesenha ao imprimir, para a hora ficar certa
  const [params] = useSearchParams();
  const { user } = useAuth();
  const filtros = Array.from(params.entries())
    .filter(([k, v]) => v && k !== "simular")
    .map(([k, v]) => `${ROTULOS[k] ?? k}: ${k === "atraso" || k === "inconsistentes" ? "sim" : v}`);

  return (
    <div className="mb-4 hidden border-b pb-2 text-xs text-slate-600 print:block">
      <p className="text-sm font-semibold text-slate-900">INTEG — Sistema financeiro</p>
      <p>
        PDF gerado em {formatDataHora(new Date().toISOString())}
        {user && ` por ${user.nome}`}
      </p>
      {filtros.length > 0 && <p>Filtros: {filtros.join(" · ")}</p>}
    </div>
  );
}
