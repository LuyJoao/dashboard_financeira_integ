import type { AplicadoInformado, Previa, SaldoInformado, SaldoSugerido } from "../api/importacoes";
import type { LancamentoEdicao } from "../api/lancamentos";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// "2026-05-14" -> "Mai/26"
export function rotuloMes(dataISO: string): string {
  const [ano, mes] = dataISO.split("-");
  return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`;
}

// Aceita zero e negativo (o saldo de uma conta pode ficar negativo): "1.234,56" ou "-1234,56".
export function parseSaldoBRL(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, "").replace("R$", "");
  if (!t) return null;
  const negativo = t.startsWith("-");
  const corpo = negativo ? t.slice(1) : t;
  const n = corpo.includes(",") ? corpo.replace(/\./g, "").replace(",", ".") : corpo;
  if (!/^\d+(\.\d{1,2})?$/.test(n)) return null;
  const centavos = Math.round(parseFloat(n) * 100);
  return negativo && centavos !== 0 ? -centavos : centavos;
}

export const chave = (mes: string, conta: string) => `${mes}|${conta}`;

export type CampoSaldo = { inicial: string; final: string };
export type EstadoSaldos = {
  contas: Record<string, CampoSaldo>; // por mês e conta (textos digitados)
  aplicadoInicial: string; // saldo aplicado no início do primeiro mês
  aplicadoFinal: Record<string, string>; // saldo aplicado no fim de cada mês
};

const paraTexto = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

// Preenche o formulário com o que o sistema já sabe; o resto o usuário digita.
export function iniciarSaldos(p: Previa): EstadoSaldos {
  const contas: Record<string, CampoSaldo> = {};
  for (const s of p.saldos) {
    contas[chave(s.mes, s.conta)] = { inicial: paraTexto(s.saldo_inicial), final: paraTexto(s.saldo_final_informado) };
  }
  const aplicadoFinal: Record<string, string> = {};
  for (const a of p.aplicado) aplicadoFinal[a.mes] = paraTexto(a.saldo_final);
  return { contas, aplicadoInicial: paraTexto(p.aplicado[0]?.saldo_inicial ?? null), aplicadoFinal };
}

type Ajuste = { entradas: number; saidas: number };

// Linhas corrigidas na tela ainda não estão nas somas do servidor: soma-as por mês e conta.
export function ajustesDasCorrecoes(correcoes: Record<number, LancamentoEdicao>): Record<string, Ajuste> {
  const ajustes: Record<string, Ajuste> = {};
  for (const d of Object.values(correcoes)) {
    const k = chave(rotuloMes(d.data), d.banco);
    if (!ajustes[k]) ajustes[k] = { entradas: 0, saidas: 0 };
    if (d.valor > 0) ajustes[k].entradas += d.valor;
    else ajustes[k].saidas += d.valor;
  }
  return ajustes;
}

export type Conciliacao = {
  entradas: number;
  saidas: number;
  calculado: number | null;
  diferenca: number | null;
  status: "OK" | "DIVERGÊNCIA" | null;
};

// Mesma regra da planilha: calculado = inicial + entradas + saídas; diferença = calculado − informado; OK se for zero.
export function conciliar(s: SaldoSugerido, campo: CampoSaldo, ajuste?: Ajuste): Conciliacao {
  const entradas = s.entradas + (ajuste?.entradas ?? 0);
  const saidas = s.saidas + (ajuste?.saidas ?? 0);
  const inicial = parseSaldoBRL(campo.inicial);
  const informado = parseSaldoBRL(campo.final);
  const calculado = inicial === null ? null : inicial + entradas + saidas;
  const diferenca = calculado === null || informado === null ? null : calculado - informado;
  return { entradas, saidas, calculado, diferenca, status: diferenca === null ? null : diferenca === 0 ? "OK" : "DIVERGÊNCIA" };
}

// Monta o que vai para a API. Devolve null se algum saldo estiver vazio ou inválido.
export function montarSaldos(p: Previa, e: EstadoSaldos): { saldos: SaldoInformado[]; aplicado: AplicadoInformado[] } | null {
  const saldos: SaldoInformado[] = [];
  for (const s of p.saldos) {
    const campo = e.contas[chave(s.mes, s.conta)];
    const inicial = parseSaldoBRL(campo?.inicial ?? "");
    const final = parseSaldoBRL(campo?.final ?? "");
    if (inicial === null || final === null) return null;
    saldos.push({ mes: s.mes, conta: s.conta, saldo_inicial: inicial, saldo_final_informado: final });
  }
  const aplicado: AplicadoInformado[] = [];
  let anterior = parseSaldoBRL(e.aplicadoInicial);
  for (const a of p.aplicado) {
    const final = parseSaldoBRL(e.aplicadoFinal[a.mes] ?? "");
    if (anterior === null || final === null) return null;
    aplicado.push({ mes: a.mes, saldo_inicial: anterior, saldo_final: final });
    anterior = final; // o início do mês seguinte é o fim do anterior
  }
  return { saldos, aplicado };
}
