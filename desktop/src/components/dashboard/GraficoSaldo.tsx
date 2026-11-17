import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, formatBRLCompacto } from "../../lib/format";

type Ponto = { mes: string; contas: number; aplicado: number | null; total: number | null };

export function GraficoSaldo({ dados, mostrarAplicado }: { dados: Ponto[]; mostrarAplicado: boolean }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mes" />
          <YAxis tickFormatter={(v) => formatBRLCompacto(Number(v))} width={80} />
          <Tooltip formatter={(v: unknown) => formatBRL(Number(v))} />
          <Legend />
          <Line type="monotone" dataKey="contas" name="Saldo nas contas" stroke="#2563eb" strokeWidth={2} dot />
          {mostrarAplicado && <Line type="monotone" dataKey="aplicado" name="Saldo aplicado" stroke="#7c3aed" strokeWidth={2} dot />}
          {mostrarAplicado && <Line type="monotone" dataKey="total" name="Total (contas + aplicado)" stroke="#0f172a" strokeWidth={2} dot />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
