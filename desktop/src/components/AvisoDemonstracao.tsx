import { USAR_MOCK } from "../lib/mock";

// Faixa no topo enquanto os dados forem de exemplo (só em desenvolvimento). Evita confundir demonstração com dados reais.
export function AvisoDemonstracao() {
  if (!USAR_MOCK) return null;
  return (
    <div className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900 print:hidden">
      Modo demonstração: os dados das telas são de exemplo, não do sistema.
    </div>
  );
}
