import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { buscarDashboard } from "../api/dashboard";
import { Cartao } from "../components/Cartao";
import { Conciliacao } from "../components/dashboard/Conciliacao";
import { GraficoCategorias } from "../components/dashboard/GraficoCategorias";
import { GraficoMeses } from "../components/dashboard/GraficoMeses";
import { GraficoSaldo } from "../components/dashboard/GraficoSaldo";
import { Painel } from "../components/dashboard/Painel";
import { ResumoContas } from "../components/dashboard/ResumoContas";
import { Carregando, ErroMsg } from "../components/estados";
import { calcular } from "../lib/dashboard";
import { formatBRL, formatDataHora } from "../lib/format";

export default function Dashboard() {
  const consulta = useQuery({ queryKey: ["dashboard"], queryFn: buscarDashboard });
  // Regra a confirmar com a supervisora: aplicações/resgates entram em receitas e despesas?
  const [incluirAplicacoes, setIncluirAplicacoes] = useState(false);

  const d = consulta.data;
  const v = useMemo(() => (d ? calcular(d, incluirAplicacoes) : null), [d, incluirAplicacoes]);

  if (consulta.isLoading) return <Carregando texto="Carregando o dashboard..." />;
  if (consulta.error || !d || !v) return <ErroMsg erro={consulta.error} onRetry={() => consulta.refetch()} />;

  const primeiro = d.meses[0]?.mes;
  const botao = (ativo: boolean) =>
    `px-3 py-1.5 text-sm ${ativo ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Dashboard Financeiro — Conciliação Bancária</h1>
        <p className="text-sm text-slate-500">
          {d.instituicao} · Consolidado {primeiro} a {v.ultimoMes} · Contas: {d.contas.join(" · ")}
        </p>
        <p className="text-xs text-slate-400">Dados atualizados em {formatDataHora(d.atualizado_em)}</p>
      </header>

      {v.divergencias === 0 ? (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          ✓ Conciliação bancária validada — nenhuma divergência nas {v.combinacoes} combinações conta/mês.
        </p>
      ) : (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          ⚠ {v.divergencias} divergência(s) de conciliação em {v.combinacoes} combinações conta/mês. Veja o quadro de conciliação.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-500">Aplicações financeiras:</span>
        <div className="flex overflow-hidden rounded-md border">
          <button className={botao(!incluirAplicacoes)} onClick={() => setIncluirAplicacoes(false)}>
            Separar de receitas e despesas
          </button>
          <button className={botao(incluirAplicacoes)} onClick={() => setIncluirAplicacoes(true)}>
            Incluir (como na planilha)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cartao titulo="Saldo atual nas contas" valor={formatBRL(v.saldoAtual)} />
        <Cartao titulo="Receitas no semestre" valor={formatBRL(v.receitas)} />
        <Cartao titulo="Despesas no semestre" valor={formatBRL(v.despesas)} />
        <Cartao titulo="Resultado do semestre" valor={formatBRL(v.resultado)} destaque={v.resultado >= 0 ? "ok" : "erro"} />
      </div>
      <p className="-mt-3 text-xs text-slate-500">
        Total movimentado (ABS): {formatBRL(v.totalMovimentado)} · Valor aplicado (líquido): {formatBRL(v.aplicadoLiquido)}, que não está
        no saldo das contas.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Evolução do saldo em caixa (soma das contas)">
          <GraficoSaldo dados={v.saldoPorMes} />
        </Painel>
        <Painel titulo="Receitas x Despesas por mês">
          <GraficoMeses dados={v.meses} />
        </Painel>
        <Painel titulo="Receitas x Despesas por categoria">
          <GraficoCategorias dados={v.categorias} />
        </Painel>
        <div className="space-y-4">
          <Painel titulo="Conciliação — status por conta e mês">
            <Conciliacao contas={d.contas} meses={d.meses.map((m) => m.mes)} saldos={d.saldos} />
          </Painel>
          <Painel titulo={`Resumo por conta — ${v.ultimoMes}`}>
            <ResumoContas linhas={v.contasUltimoMes} />
          </Painel>
        </div>
      </div>
    </div>
  );
}
