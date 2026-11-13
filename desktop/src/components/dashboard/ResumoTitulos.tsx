import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { listarTitulos } from "../../api/titulos";
import { formatBRL } from "../../lib/format";
import { resumoTitulos } from "../../lib/titulos";
import { Cartao } from "../Cartao";
import { Carregando, ErroMsg } from "../estados";

// Situação de hoje das contas a pagar e a receber (não depende do mês escolhido no dashboard).
export function ResumoTitulos() {
  const consulta = useQuery({ queryKey: ["titulos", ""], queryFn: () => listarTitulos(""), retry: false });
  const r = useMemo(() => (consulta.data ? resumoTitulos(consulta.data) : null), [consulta.data]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Contas a pagar e a receber (situação de hoje)</h2>
        <Link to="/contas" className="text-sm text-slate-500 hover:text-slate-900">
          Ver todas
        </Link>
      </div>
      {consulta.isLoading && <Carregando texto="Carregando as contas..." />}
      {consulta.isError && <ErroMsg erro={consulta.error} onRetry={() => consulta.refetch()} />}
      {r && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Cartao titulo="A pagar em aberto" valor={formatBRL(r.aPagar)} />
          <Cartao titulo="A receber em aberto" valor={formatBRL(r.aReceber)} />
          <Cartao
            titulo={`Em atraso (${r.vencidosPagar.qtd} a pagar, ${r.vencidosReceber.qtd} a receber)`}
            valor={formatBRL(r.vencidosPagar.valor + r.vencidosReceber.valor)}
            destaque={r.vencidosPagar.qtd + r.vencidosReceber.qtd > 0 ? "erro" : undefined}
          />
          <Cartao titulo={`Vencem em 7 dias (${r.vencemEm7Dias.qtd})`} valor={formatBRL(r.vencemEm7Dias.valor)} />
        </div>
      )}
    </section>
  );
}
