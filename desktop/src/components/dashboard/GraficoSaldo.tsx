import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, formatBRLCompacto } from "../../lib/format";

export function GraficoSaldo({ dados }: { dados: { mes: string; saldo: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mes" />
          <YAxis tickFormatter={(v) => formatBRLCompacto(Number(v))} width={80} />
          <Tooltip formatter={(v: unknown) => formatBRL(Number(v))} />
          <Line type="monotone" dataKey="saldo" name="Saldo consolidado" stroke="#2563eb" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
