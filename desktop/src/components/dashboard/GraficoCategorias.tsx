import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, formatBRLCompacto } from "../../lib/format";

type Item = { categoria: string; receitas: number; despesas: number };

export function GraficoCategorias({ dados }: { dados: Item[] }) {
  return (
    <div style={{ height: Math.max(280, dados.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => formatBRLCompacto(Number(v))} />
          <YAxis type="category" dataKey="categoria" width={170} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: unknown) => formatBRL(Number(v))} />
          <Legend />
          <Bar dataKey="receitas" name="Receitas" fill="#16a34a" />
          <Bar dataKey="despesas" name="Despesas" fill="#dc2626" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
