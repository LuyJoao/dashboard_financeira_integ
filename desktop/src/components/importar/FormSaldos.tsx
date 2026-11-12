import type { Previa } from "../../api/importacoes";
import type { LancamentoEdicao } from "../../api/lancamentos";
import { formatBRL } from "../../lib/format";
import { ajustesDasCorrecoes, chave, conciliar, EstadoSaldos } from "../../lib/saldos";

type Props = {
  previa: Previa;
  estado: EstadoSaldos;
  correcoes: Record<number, LancamentoEdicao>;
  onChange: (estado: EstadoSaldos) => void;
};

const campo = "w-32 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-slate-900";

export function FormSaldos({ previa, estado, correcoes, onChange }: Props) {
  const ajustes = ajustesDasCorrecoes(correcoes);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Os saldos foram lidos do extrato (coluna Saldo Após Lançamento). Confira e corrija se precisar. O sistema compara o saldo calculado (inicial +
        entradas + saídas) com o saldo do extrato.
      </p>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-slate-600">
            <tr>
              <th className="p-2 text-left font-medium">Mês</th>
              <th className="p-2 text-left font-medium">Conta</th>
              <th className="p-2 text-right font-medium">Saldo inicial</th>
              <th className="p-2 text-right font-medium">Entradas</th>
              <th className="p-2 text-right font-medium">Saídas</th>
              <th className="p-2 text-right font-medium">Saldo calculado</th>
              <th className="p-2 text-right font-medium">Saldo final informado</th>
              <th className="p-2 text-right font-medium">Diferença</th>
              <th className="p-2 text-center font-medium">Conciliação</th>
            </tr>
          </thead>
          <tbody>
            {previa.saldos.map((s) => {
              const k = chave(s.mes, s.conta);
              const c = estado.contas[k];
              const r = conciliar(s, c, ajustes[k]);
              return (
                <tr key={k} className="border-b tabular-nums last:border-0">
                  <td className="p-2">{s.mes}</td>
                  <td className="p-2">{s.conta}</td>
                  <td className="p-2 text-right">
                    <input
                      className={campo}
                      inputMode="decimal"
                      value={c.inicial}
                      onChange={(e) => onChange({ ...estado, contas: { ...estado.contas, [k]: { ...c, inicial: e.target.value } } })}
                    />
                  </td>
                  <td className="p-2 text-right text-green-700">{formatBRL(r.entradas)}</td>
                  <td className="p-2 text-right text-red-700">{formatBRL(r.saidas)}</td>
                  <td className="p-2 text-right">{r.calculado === null ? "—" : formatBRL(r.calculado)}</td>
                  <td className="p-2 text-right">
                    {s.lido_do_extrato && <span className="mb-0.5 block text-xs text-slate-400">do extrato</span>}
                    <input
                      className={campo}
                      inputMode="decimal"
                      value={c.final}
                      onChange={(e) => onChange({ ...estado, contas: { ...estado.contas, [k]: { ...c, final: e.target.value } } })}
                    />
                  </td>
                  <td className="p-2 text-right">{r.diferenca === null ? "—" : formatBRL(r.diferenca)}</td>
                  <td className="p-2 text-center">
                    {r.status === "OK" && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">OK</span>}
                    {r.status === "DIVERGÊNCIA" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Divergência</span>}
                    {r.status === null && "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {previa.aplicado.length > 0 && (
        <div className="rounded-xl border bg-white p-4 text-sm">
          <h3 className="mb-3 font-medium">Saldo aplicado</h3>
          <div className="flex flex-wrap items-end gap-4">
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">No início de {previa.aplicado[0].mes}</span>
              <input
                className={campo}
                inputMode="decimal"
                value={estado.aplicadoInicial}
                onChange={(e) => onChange({ ...estado, aplicadoInicial: e.target.value })}
              />
            </label>
            {previa.aplicado.map((a) => (
              <label key={a.mes} className="space-y-1">
                <span className="block text-xs text-slate-500">No fim de {a.mes}</span>
                <input
                  className={campo}
                  inputMode="decimal"
                  value={estado.aplicadoFinal[a.mes] ?? ""}
                  onChange={(e) => onChange({ ...estado, aplicadoFinal: { ...estado.aplicadoFinal, [a.mes]: e.target.value } })}
                />
              </label>
            ))}
          </div>
          {previa.aplicado[0].calculado && (
            <p className="mt-3 text-xs text-slate-500">
              Calculado como aplicações menos resgates. Se quiser o valor real do investimento, digite o saldo do extrato da aplicação.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
