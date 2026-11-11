import type { LancamentoEdicao } from "../api/lancamentos";

export const OBS_APLICACAO = ["Investimento", "Rendimento", "Resgate"];

function dataValida(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  return dt.getUTCFullYear() === ano && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === dia;
}

// Regras de um lançamento. O mesmo conjunto vai servir para corrigir erros na prévia da importação.
export function validar(l: LancamentoEdicao): string[] {
  const erros: string[] = [];
  if (!dataValida(l.data)) erros.push("Data inválida.");
  if (!l.banco) erros.push("Escolha a conta.");
  if (!l.categoria) erros.push("Escolha a categoria.");
  if (l.valor === 0) erros.push("O valor não pode ser zero.");
  if (l.tipo === "Receita" && l.valor < 0) erros.push("Receita com valor negativo.");
  if ((l.tipo === "Despesa" || l.tipo === "Investimento") && l.valor > 0) erros.push(`${l.tipo} com valor positivo.`);
  if (l.categoria === "Aplicação Financeira") {
    if (!OBS_APLICACAO.includes(l.observacao)) {
      erros.push('Em "Aplicação Financeira", a Observação deve ser Investimento, Rendimento ou Resgate.');
    } else if (l.observacao === "Investimento" && l.valor > 0) {
      erros.push("Investimento deve ter valor negativo.");
    } else if (l.observacao !== "Investimento" && l.valor < 0) {
      erros.push(`${l.observacao} deve ter valor positivo.`);
    }
  }
  return erros;
}

// Converte o que o usuário digitou ("1.234,56", "1234,56" ou "1234.56") em centavos. O sinal vem do tipo, não do texto.
export function parseValorBRL(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, "").replace("R$", "");
  if (!t) return null;
  const n = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d{1,2})?$/.test(n)) return null;
  const centavos = Math.round(parseFloat(n) * 100);
  return centavos > 0 ? centavos : null;
}

export function valorParaCampo(centavos: number): string {
  return (Math.abs(centavos) / 100).toFixed(2).replace(".", ",");
}
