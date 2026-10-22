import type { SaldoContaMes } from "../../api/dashboard";
import { formatBRL } from "../../lib/format";

export function ResumoContas({ linhas }: { linhas: SaldoContaMes[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="p-2 text-left font-medium">Conta</th>
            <th className="p-2 text-right font-medium">Saldo inicial</th>
            <th className="p-2 text-right font-medium">Entradas</th>
            <th className="p-2 text-right font-medium">Saídas</th>
            <th className="p-2 text-right font-medium">Saldo final</th>
            <th className="p-2 text-center font-medium">Conciliação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((s) => (
            <tr key={s.conta} className="border-t tabular-nums">
              <td className="p-2">{s.conta}</td>
              <td className="p-2 text-right">{formatBRL(s.saldo_inicial)}</td>
              <td className="p-2 text-right text-green-700">{formatBRL(s.entradas)}</td>
              <td className="p-2 text-right text-red-700">{formatBRL(s.saidas)}</td>
              <td className="p-2 text-right font-medium">{formatBRL(s.saldo_informado)}</td>
              <td className="p-2 text-center">{s.status === "OK" ? "OK" : "Divergência"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
