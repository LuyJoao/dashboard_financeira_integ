import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { mensagemErro } from "../api/client";
import type { SaldoContaMes } from "../api/dashboard";
import { AplicadoMes, listarSaldos, salvarAplicado, salvarSaldo, SaldoEdicao } from "../api/saldos";
import { Cartao } from "../components/Cartao";
import { Carregando, ErroMsg } from "../components/estados";
import { BarraFiltros, FiltroSelect } from "../components/Filtros";
import { btnCls } from "../components/ui";
import { useFiltros } from "../hooks/useFiltros";
import { formatBRL } from "../lib/format";
import { parseSaldoBRL } from "../lib/saldos";

const textoErro = (e: unknown) => mensagemErro(e, e instanceof Error ? e.message : undefined);
const paraTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const campo = "w-32 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-slate-900";

function Selo({ status }: { status: string | null }) {
  if (status === "OK") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">OK</span>;
  if (status === "DIVERGÊNCIA") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Divergência</span>;
  if (status === "NÃO CONFERIDO") return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">Não conferido</span>;
  return <span>—</span>;
}

// Uma conta no mês: saldo inicial e saldo do extrato editáveis; o resto é calculado e mostra o resultado ao vivo.
function LinhaSaldo({ s, enviando, onSalvar }: { s: SaldoContaMes; enviando: boolean; onSalvar: (d: SaldoEdicao) => void }) {
  const origIni = paraTexto(s.saldo_inicial);
  const origExt = s.status === "NÃO CONFERIDO" ? "" : paraTexto(s.saldo_informado);
  const [ini, setIni] = useState(origIni);
  const [ext, setExt] = useState(origExt);

  const iniN = parseSaldoBRL(ini);
  const extVazio = ext.trim() === "";
  const extN = extVazio ? null : parseSaldoBRL(ext);
  const invalido = iniN === null || (!extVazio && extN === null);
  const alterado = ini !== origIni || ext !== origExt;
  const calculado = iniN === null ? null : iniN + s.entradas + s.saidas;
  const dif = calculado === null || extN === null ? null : calculado - extN;
  const status = invalido ? null : extVazio ? "NÃO CONFERIDO" : dif === 0 ? "OK" : "DIVERGÊNCIA";

  return (
    <tr className="border-b tabular-nums last:border-0">
      <td className="p-2">{s.conta}</td>
      <td className="p-2 text-right">
        <input className={campo} inputMode="decimal" value={ini} onChange={(e) => setIni(e.target.value)} />
      </td>
      <td className="p-2 text-right text-green-700">{formatBRL(s.entradas)}</td>
      <td className="p-2 text-right text-red-700">{formatBRL(s.saidas)}</td>
      <td className="p-2 text-right">{calculado === null ? "—" : formatBRL(calculado)}</td>
      <td className="p-2 text-right">
        <input className={campo} inputMode="decimal" placeholder="não conferido" value={ext} onChange={(e) => setExt(e.target.value)} />
      </td>
      <td className="p-2 text-right">{dif === null ? "—" : formatBRL(dif)}</td>
      <td className="p-2 text-center">
        <Selo status={status} />
      </td>
      <td className="p-2 text-right">
        <button
          className={`${btnCls} px-3 py-1`}
          disabled={!alterado || invalido || enviando}
          onClick={() => iniN !== null && onSalvar({ saldo_inicial: iniN, saldo_extrato: extN })}
        >
          Salvar
        </button>
      </td>
    </tr>
  );
}

function BlocoAplicado({ a, enviando, onSalvar }: { a: AplicadoMes; enviando: boolean; onSalvar: (v: number | null) => void }) {
  const orig = a.sobrescrito ? paraTexto(a.saldo_final) : "";
  const [txt, setTxt] = useState(orig);
  const vazio = txt.trim() === "";
  const valor = vazio ? null : parseSaldoBRL(txt);
  const invalido = !vazio && valor === null;

  return (
    <div className="space-y-3 rounded-xl border bg-white p-4 text-sm">
      <h2 className="font-medium">Saldo aplicado ({a.mes})</h2>
      <p className="text-slate-600">
        No início do mês: <strong>{formatBRL(a.saldo_inicial)}</strong> · Calculado (aplicações menos resgates): <strong>{formatBRL(a.calculado)}</strong> · Em
        uso: <strong>{formatBRL(a.saldo_final)}</strong> ({a.sobrescrito ? "informado por você" : "calculado"})
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-slate-500">Saldo real do investimento (opcional, do extrato da aplicação)</span>
          <input className={campo} inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value)} />
        </label>
        <button className={`${btnCls} px-3 py-1`} disabled={vazio || invalido || txt === orig || enviando} onClick={() => onSalvar(valor)}>
          Salvar saldo real
        </button>
        {a.sobrescrito && (
          <button className="rounded-md border px-3 py-1 hover:bg-slate-50" disabled={enviando} onClick={() => onSalvar(null)}>
            Voltar ao calculado
          </button>
        )}
      </div>
      {invalido && <p className="text-red-600">Valor inválido. Use números e vírgula, por exemplo 1234,56.</p>}
    </div>
  );
}

export default function Saldos() {
  const f = useFiltros();
  const qc = useQueryClient();
  const consulta = useQuery({ queryKey: ["saldos"], queryFn: listarSaldos });
  const d = consulta.data;
  const mes = f.get("mes") || (d ? d.meses[d.meses.length - 1] : "");

  const linhas = useMemo(() => (d ? d.saldos.filter((s) => s.mes === mes).sort((a, b) => a.conta.localeCompare(b.conta)) : []), [d, mes]);
  const aplicado = d?.aplicado.find((a) => a.mes === mes);

  // Depois de salvar, a lista, o dashboard e os meses seguintes se recalculam
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["saldos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const salvarConta = useMutation({
    mutationFn: ({ conta, dados }: { conta: string; dados: SaldoEdicao }) => salvarSaldo(mes, conta, dados),
    onSuccess: atualizar,
  });
  const salvarApl = useMutation({ mutationFn: (v: number | null) => salvarAplicado(mes, v), onSuccess: atualizar });

  if (consulta.isLoading) return <Carregando texto="Carregando os saldos..." />;
  if (consulta.error || !d) return <ErroMsg erro={consulta.error} onRetry={() => consulta.refetch()} />;

  const saldoContas = linhas.reduce((t, s) => t + s.saldo_informado, 0);
  const divergencias = linhas.filter((s) => s.status === "DIVERGÊNCIA").length;
  const naoConferidos = linhas.filter((s) => s.status === "NÃO CONFERIDO").length;

  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-xl font-semibold">Saldos mensais</h1>
      <p className="text-sm text-slate-500">
        O saldo do extrato é o que o banco mostra no fim do mês. Na importação ele já vem lido do extrato; aqui você confere, corrige ou informa o de um mês
        lançado à mão. Deixe em branco se ainda não conferiu: o sistema usa o saldo calculado dos lançamentos.
      </p>

      <BarraFiltros mostrarLimpar={f.temFiltro} onLimpar={f.limpar}>
        <FiltroSelect label="Mês" valor={f.get("mes")} onChange={(v) => f.set("mes", v)} opcoes={d.meses} todas="Último mês" />
      </BarraFiltros>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Cartao titulo={`Saldo nas contas (fim de ${mes})`} valor={formatBRL(saldoContas)} />
        <Cartao titulo="Saldo aplicado" valor={aplicado ? formatBRL(aplicado.saldo_final) : "—"} />
        <Cartao titulo="Total (contas + aplicado)" valor={aplicado ? formatBRL(saldoContas + aplicado.saldo_final) : "—"} />
      </div>

      {divergencias > 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          {divergencias} conta(s) com divergência: o saldo calculado dos lançamentos é diferente do saldo do extrato. Confira se falta algum lançamento ou se há algum valor
          errado.
        </p>
      )}
      {naoConferidos > 0 && (
        <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
          {naoConferidos} conta(s) sem saldo do extrato neste mês (saldo calculado a partir dos lançamentos).
        </p>
      )}

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
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((s) => (
              <LinhaSaldo
                key={`${s.mes}|${s.conta}|${s.saldo_inicial}|${s.saldo_informado}|${s.status}`}
                s={s}
                enviando={salvarConta.isPending}
                onSalvar={(dados) => salvarConta.mutate({ conta: s.conta, dados })}
              />
            ))}
          </tbody>
        </table>
      </div>
      {salvarConta.isError && <p className="text-sm text-red-600">{textoErro(salvarConta.error)}</p>}

      {aplicado && (
        <BlocoAplicado key={`${aplicado.mes}|${aplicado.saldo_final}|${aplicado.sobrescrito}`} a={aplicado} enviando={salvarApl.isPending} onSalvar={(v) => salvarApl.mutate(v)} />
      )}
      {salvarApl.isError && <p className="text-sm text-red-600">{textoErro(salvarApl.error)}</p>}
    </div>
  );
}
