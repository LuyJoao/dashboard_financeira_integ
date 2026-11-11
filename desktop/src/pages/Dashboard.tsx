import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { buscarDashboard } from "../api/dashboard";
import { Cartao } from "../components/Cartao";
import { GraficoCategorias } from "../components/dashboard/GraficoCategorias";
import { GraficoMeses } from "../components/dashboard/GraficoMeses";
import { GraficoSaldo } from "../components/dashboard/GraficoSaldo";
import { Painel } from "../components/dashboard/Painel";
import { ResumoContas } from "../components/dashboard/ResumoContas";
import { Carregando, ErroMsg } from "../components/estados";
import { BarraFiltros, FiltroSelect } from "../components/Filtros";
import { useFiltros } from "../hooks/useFiltros";
import { calcular } from "../lib/dashboard";
import { formatBRL, formatDataHora } from "../lib/format";

export default function Dashboard() {
  const consulta = useQuery({ queryKey: ["dashboard"], queryFn: buscarDashboard });
  const f = useFiltros(); // mês, conta e categoria ficam na URL
  const mes = f.get("mes");
  const conta = f.get("conta");
  const categoria = f.get("categoria");

  const d = consulta.data;
  const v = useMemo(() => (d ? calcular(d, { mes, conta, categoria }) : null), [d, mes, conta, categoria]);

  if (consulta.isLoading) return <Carregando texto="Carregando o dashboard..." />;
  if (consulta.error || !d || !v) return <ErroMsg erro={consulta.error} onRetry={() => consulta.refetch()} />;

  const brl = (x: number | null) => (x === null ? "—" : formatBRL(x));
  const tituloResultado = v.resultadoDeCategoria
    ? "Resultado da categoria"
    : v.mostrarAplicado
      ? "Resultado do mês (variação do total)"
      : "Resultado do mês (variação do saldo)";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Dashboard Financeiro — {v.mes}</h1>
        <p className="text-sm text-slate-500">
          {d.instituicao} · Contas: {d.contas.join(" · ")}
        </p>
        <p className="text-xs text-slate-400">Dados atualizados em {formatDataHora(d.atualizado_em)}</p>
      </header>

      <BarraFiltros mostrarLimpar={f.temFiltro} onLimpar={f.limpar}>
        <FiltroSelect label="Mês" valor={mes} onChange={(x) => f.set("mes", x)} opcoes={d.meses} todas="Último mês" />
        <FiltroSelect label="Conta" valor={conta} onChange={(x) => f.set("conta", x)} opcoes={d.contas} />
        <FiltroSelect label="Categoria" valor={categoria} onChange={(x) => f.set("categoria", x)} opcoes={d.categorias} />
      </BarraFiltros>

      {v.divergencias > 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          ⚠ {v.divergencias} conta(s) com divergência de conciliação em {v.mes}. Confira o resumo por conta abaixo.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Cartao titulo={`Saldo nas contas (fim de ${v.mes})`} valor={brl(v.saldoContas)} />
        <Cartao titulo="Saldo aplicado" valor={brl(v.saldoAplicado)} />
        <Cartao titulo="Total (contas + aplicado)" valor={brl(v.total)} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cartao titulo="Receitas do mês" valor={formatBRL(v.receitas)} />
        <Cartao titulo="Rendimentos" valor={formatBRL(v.rendimentos)} />
        <Cartao titulo="Despesas do mês" valor={formatBRL(v.despesas)} />
        <Cartao titulo={tituloResultado} valor={formatBRL(v.resultado)} destaque={v.resultado >= 0 ? "ok" : "erro"} />
      </div>
      <p className="-mt-3 text-xs text-slate-500">
        Aplicações no mês: {formatBRL(v.aplicacoes)} · Resgates: {formatBRL(v.resgates)} · Total movimentado (ABS):{" "}
        {formatBRL(v.totalMovimentado)}
        {!v.mostrarAplicado && " · O saldo aplicado e o total não existem por conta."}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Evolução do saldo">
          <GraficoSaldo dados={v.serieSaldo} mostrarAplicado={v.mostrarAplicado} />
        </Painel>
        <Painel titulo="Receitas x Despesas por mês">
          <GraficoMeses dados={v.serieMeses} />
        </Painel>
        <Painel titulo={`Receitas x Despesas por categoria — ${v.mes}`}>
          <GraficoCategorias dados={v.categorias} />
        </Painel>
        <Painel titulo={`Resumo por conta — ${v.mes}`}>
          <ResumoContas linhas={v.saldosDoMes} />
        </Painel>
      </div>
    </div>
  );
}
