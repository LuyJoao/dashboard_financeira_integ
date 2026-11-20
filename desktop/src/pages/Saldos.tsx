import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listarSaldos } from "../api/saldos";
import { Cartao } from "../components/Cartao";
import { Carregando, ErroMsg } from "../components/estados";
import { BarraFiltros, FiltroSelect } from "../components/Filtros";
import { BotoesExportacao } from "../components/BotoesExportacao";
import { useFiltros } from "../hooks/useFiltros";
import { formatBRL } from "../lib/format";
import { visaoPorMes } from "../lib/saldosVisao";

function Selo({ status }: { status: string }) {
  if (status === "OK") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">OK</span>;
  if (status === "DIVERGÊNCIA") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Divergência</span>;
  return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">Não conferido</span>;
}

const brl = (v: number | null) => (v === null ? "—" : formatBRL(v));

// SOMENTE CONSULTA: os saldos vêm do extrato (importação) ou são calculados dos lançamentos. Não há edição nesta tela.
export default function Saldos() {
  const f = useFiltros();
  const consulta = useQuery({ queryKey: ["saldos"], queryFn: listarSaldos });
  const d = consulta.data;
  const mes = f.get("mes") || (d ? d.meses[d.meses.length - 1] : "");

  const visao = useMemo(() => (d ? visaoPorMes(d) : []), [d]);
  const linhas = useMemo(() => (d ? d.saldos.filter((s) => s.mes === mes).sort((a, b) => a.conta.localeCompare(b.conta)) : []), [d, mes]);
  const aplicado = d?.aplicado.find((a) => a.mes === mes);

  if (consulta.isLoading) return <Carregando texto="Carregando os saldos..." />;
  if (consulta.error || !d) return <ErroMsg erro={consulta.error} onRetry={() => consulta.refetch()} />;

  const doMes = visao.find((v) => v.mes === mes);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Saldos mensais</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tela de consulta. O saldo do extrato vem da importação (lido do próprio extrato) e o saldo calculado vem dos lançamentos. Se os dois não batem, aparece
          divergência: confira os lançamentos.
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <BarraFiltros mostrarLimpar={f.temFiltro} onLimpar={f.limpar}>
          <FiltroSelect
            label="Mês"
            valor={f.get("mes")}
            onChange={(v) => f.set("mes", v)}
            opcoes={d.meses}
            todas="Último mês"
          />
        </BarraFiltros>

        <BotoesExportacao />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Cartao titulo={`Saldo nas contas (fim de ${mes})`} valor={brl(doMes?.contas ?? null)} />
        <Cartao titulo="Saldo aplicado" valor={brl(aplicado ? aplicado.saldo_final : null)} />
        <Cartao titulo="Total (contas + aplicado)" valor={brl(doMes?.total ?? null)} />
        <Cartao
          titulo="Variação do total no mês"
          valor={brl(doMes?.variacao ?? null)}
          destaque={doMes?.variacao == null ? undefined : doMes.variacao >= 0 ? "ok" : "erro"}
        />
      </div>

      {doMes && doMes.divergencias > 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          {doMes.divergencias} conta(s) com divergência: o saldo calculado dos lançamentos é diferente do saldo do extrato. Confira se falta algum lançamento ou se há
          algum valor errado.
        </p>
      )}
      {doMes && doMes.naoConferidos > 0 && (
        <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
          {doMes.naoConferidos} conta(s) sem saldo do extrato neste mês (saldo calculado a partir dos lançamentos).
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Contas em {mes}</h2>
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left font-medium">Conta</th>
                <th className="p-2 text-right font-medium">Saldo inicial</th>
                <th className="p-2 text-right font-medium">Entradas</th>
                <th className="p-2 text-right font-medium">Saídas</th>
                <th className="p-2 text-right font-medium">Saldo calculado</th>
                <th className="p-2 text-right font-medium">Saldo do extrato</th>
                <th className="p-2 text-right font-medium">Diferença</th>
                <th className="p-2 text-center font-medium">Conciliação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((s) => (
                <tr key={s.conta} className="border-b tabular-nums last:border-0">
                  <td className="p-2">{s.conta}</td>
                  <td className="p-2 text-right">{formatBRL(s.saldo_inicial)}</td>
                  <td className="p-2 text-right text-green-700">{formatBRL(s.entradas)}</td>
                  <td className="p-2 text-right text-red-700">{formatBRL(s.saidas)}</td>
                  <td className="p-2 text-right">{formatBRL(s.saldo_final)}</td>
                  <td className="p-2 text-right">{s.status === "NÃO CONFERIDO" ? "—" : formatBRL(s.saldo_informado)}</td>
                  <td className="p-2 text-right">{s.status === "NÃO CONFERIDO" ? "—" : formatBRL(s.diferenca)}</td>
                  <td className="p-2 text-center">
                    <Selo status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {aplicado && (
        <section className="space-y-1 rounded-xl border bg-white p-4 text-sm">
          <h2 className="font-medium">Saldo aplicado ({aplicado.mes})</h2>
          <p className="text-slate-600">
            No início do mês: <strong>{formatBRL(aplicado.saldo_inicial)}</strong> · Calculado (aplicações menos resgates): <strong>{formatBRL(aplicado.calculado)}</strong>{" "}
            · Em uso: <strong>{formatBRL(aplicado.saldo_final)}</strong>
          </p>
          <p className="text-xs text-slate-500">O extrato das contas só mostra a saída ao aplicar e a entrada ao resgatar; por isso o saldo aplicado é calculado.</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Evolução mês a mês</h2>
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left font-medium">Mês</th>
                <th className="p-2 text-right font-medium">Saldo nas contas</th>
                <th className="p-2 text-right font-medium">Saldo aplicado</th>
                <th className="p-2 text-right font-medium">Total</th>
                <th className="p-2 text-right font-medium">Variação no mês</th>
                <th className="p-2 text-center font-medium">Conciliação</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {visao.map((v) => (
                <tr key={v.mes} className={`border-b tabular-nums last:border-0 ${v.mes === mes ? "bg-slate-50 font-medium" : ""}`}>
                  <td className="p-2">{v.mes}</td>
                  <td className="p-2 text-right">{formatBRL(v.contas)}</td>
                  <td className="p-2 text-right">{brl(v.aplicado)}</td>
                  <td className="p-2 text-right">{brl(v.total)}</td>
                  <td className={`p-2 text-right ${v.variacao === null ? "" : v.variacao >= 0 ? "text-green-700" : "text-red-700"}`}>{brl(v.variacao)}</td>
                  <td className="p-2 text-center">
                    {v.divergencias > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{v.divergencias} divergência(s)</span>
                    ) : v.naoConferidos > 0 ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{v.naoConferidos} não conferido(s)</span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">OK</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {v.mes !== mes && (
                      <button className="text-sm text-slate-600 hover:text-slate-900" onClick={() => f.set("mes", v.mes)}>
                        Ver
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
