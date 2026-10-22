import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, formatBRLCompacto } from "../../lib/format";

export function GraficoMeses({ dados }: { dados: { mes: string; receitas: number; despesas: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mes" />
          <YAxis tickFormatter={(v) => formatBRLCompacto(Number(v))} width={80} />
          <Tooltip formatter={(v: unknown) => formatBRL(Number(v))} />
          <Legend />
          <Bar dataKey="receitas" name="Receitas" fill="#16a34a" />
          <Bar dataKey="despesas" name="Despesas" fill="#dc2626" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
