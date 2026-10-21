// A API guarda valores em CENTAVOS (inteiros). Converta só na hora de exibir.
export function formatBRL(centavos: number | null | undefined): string {
  if (centavos == null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Datas chegam como "AAAA-MM-DD". Não use new Date("2026-05-14"): ele interpreta como UTC
// e, no Brasil, mostraria 13/05. Aqui o texto é só reordenado, sem fuso horário.
export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}
