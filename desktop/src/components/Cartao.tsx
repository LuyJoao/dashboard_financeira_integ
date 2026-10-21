export function Cartao({
  titulo,
  valor,
  destaque,
}: {
  titulo: string;
  valor: string | number;
  destaque?: "ok" | "erro";
}) {
  const cor = destaque === "erro" ? "text-red-700" : destaque === "ok" ? "text-green-700" : "text-slate-900";
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold ${cor}`}>{valor}</p>
    </div>
  );
}
