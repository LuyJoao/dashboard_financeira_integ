// A API guarda valores em CENTAVOS (inteiros). Converta só na hora de exibir.
export function formatBRL(centavos: number | null | undefined): string {
  if (centavos == null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Versão curta para eixos de gráfico: "R$ 150 mil".
export function formatBRLCompacto(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

// Datas chegam como "AAAA-MM-DD". Não use new Date("2026-05-14"): ele interpreta como UTC
// e, no Brasil, mostraria 13/05. Aqui o texto é só reordenado, sem fuso horário.
export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// Data e hora de um instante real (com fuso). Aqui a conversão para o horário local é desejada.
export function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
