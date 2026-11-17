import type { Titulo, TituloEdicao } from "../api/titulos";
import { hojeISO } from "./lancamentos";

export type StatusTitulo = "pago" | "vencido" | "vence_hoje" | "a_vencer";
export const ROTULO_STATUS: Record<StatusTitulo, string> = {
  pago: "Pago",
  vencido: "Vencido",
  vence_hoje: "Vence hoje",
  a_vencer: "A vencer",
};

const dia = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d) / 86400000;
};

// Dias de a até b (positivo se b é depois de a). Datas AAAA-MM-DD, sem fuso horário.
export const diasEntre = (a: string, b: string) => Math.round(dia(b) - dia(a));

export function somaDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

export function dataValidaISO(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [ano, mes, dia2] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(ano, mes - 1, dia2));
  return dt.getUTCFullYear() === ano && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === dia2;
}

// O atraso NÃO é guardado: é calculado. Vencido = não pago e vencimento antes de hoje.
export function statusDoTitulo(t: Pick<Titulo, "vencimento" | "pago_em">, hoje = hojeISO()): StatusTitulo {
  if (t.pago_em) return "pago";
  const d = diasEntre(hoje, t.vencimento);
  return d < 0 ? "vencido" : d === 0 ? "vence_hoje" : "a_vencer";
}

export const diasDeAtraso = (t: Pick<Titulo, "vencimento">, hoje = hojeISO()) => Math.max(0, diasEntre(t.vencimento, hoje));

export function validarTitulo(t: TituloEdicao, hoje = hojeISO()): string[] {
  const erros: string[] = [];
  if (!t.empresa_id) erros.push("Escolha a empresa.");
  if (!t.numero.trim()) erros.push("Informe o número do documento.");
  if (!(t.valor > 0)) erros.push("O valor deve ser maior que zero.");
  if (!dataValidaISO(t.vencimento)) erros.push("Vencimento inválido.");
  if (t.pago_em !== null) {
    if (!dataValidaISO(t.pago_em)) erros.push("Data do pagamento inválida.");
    else if (t.pago_em > hoje) erros.push("A data do pagamento não pode ser futura.");
  }
  return erros;
}

const soma = (xs: Titulo[]) => xs.reduce((t, x) => t + x.valor, 0);

export function resumoTitulos(titulos: Titulo[], hoje = hojeISO()) {
  const abertos = titulos.filter((t) => !t.pago_em);
  const vencidos = abertos.filter((t) => statusDoTitulo(t, hoje) === "vencido");
  const prox7 = abertos.filter((t) => {
    const d = diasEntre(hoje, t.vencimento);
    return d >= 0 && d <= 7;
  });
  const grupo = (xs: Titulo[]) => ({ qtd: xs.length, valor: soma(xs) });
  return {
    aPagar: soma(abertos.filter((t) => t.tipo === "pagar")),
    aReceber: soma(abertos.filter((t) => t.tipo === "receber")),
    vencidosPagar: grupo(vencidos.filter((t) => t.tipo === "pagar")),
    vencidosReceber: grupo(vencidos.filter((t) => t.tipo === "receber")),
    vencemEm7Dias: grupo(prox7),
  };
}
