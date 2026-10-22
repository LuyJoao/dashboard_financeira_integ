import type { SaldoContaMes } from "../../api/dashboard";
import { formatBRL } from "../../lib/format";

// Quadro conta x mês: "OK" quando o saldo calculado pelos lançamentos bate com o extrato.
export function Conciliacao({ contas, meses, saldos }: { contas: string[]; meses: string[]; saldos: SaldoContaMes[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-sm">
        <thead>
          <tr className="text-slate-500">
            <th className="p-2 text-left font-medium">Conta</th>
            {meses.map((m) => (
              <th key={m} className="p-2 font-medium">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contas.map((conta) => (
            <tr key={conta} className="border-t">
              <td className="p-2 text-left">{conta}</td>
              {meses.map((mes) => {
                const s = saldos.find((x) => x.conta === conta && x.mes === mes);
                const cor = !s ? "bg-slate-100 text-slate-500" : s.status === "OK" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
                return (
                  <td key={mes} className="p-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${cor}`} title={s ? `Diferença: ${formatBRL(s.diferenca)}` : ""}>
                      {!s ? "—" : s.status === "OK" ? "OK" : formatBRL(s.diferenca)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
