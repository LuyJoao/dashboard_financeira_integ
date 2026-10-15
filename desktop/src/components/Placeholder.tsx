export function Placeholder({ titulo }: { titulo: string }) {
  // Mantém a rota navegável enquanto sua tela definitiva ainda não existe.
  return (
    <div>
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <p className="mt-2 text-sm text-slate-500">Tela ainda não implementada.</p>
    </div>
  );
}
