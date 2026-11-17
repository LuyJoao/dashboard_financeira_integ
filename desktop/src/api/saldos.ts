import { api } from "./client";
import { listarSaldosMock, salvarAplicadoMock, salvarSaldoMock } from "../mock/saldos";
import type { SaldoAplicadoMes, SaldoContaMes } from "./dashboard";

// ---------- Contrato com o back-end ----------
// GET /api/saldos            -> DadosSaldos
// PUT /api/saldos            -> SaldoContaMes   corpo: { mes, conta, saldo_inicial, saldo_extrato }
// PUT /api/saldos/aplicado   -> AplicadoMes     corpo: { mes, saldo_final }   (null = voltar ao saldo aplicado calculado)
// ATENÇÃO: o mês tem uma barra ("Mai/26"), então ele vai no CORPO, nunca no caminho da URL.
// Regras: docs/regra-saldos.md. saldo_extrato null = "NÃO CONFERIDO" (o saldo vira o calculado dos lançamentos).
// Usuário comum e admin podem informar saldos. Depois de salvar, o dashboard e os meses seguintes se recalculam.

export type AplicadoMes = SaldoAplicadoMes & {
  calculado: number; // saldo final calculado (aplicações menos resgates, acumulado)
  sobrescrito: boolean; // true = saldo_final foi informado pelo usuário
};

export type DadosSaldos = {
  contas: string[];
  meses: string[];
  saldos: SaldoContaMes[]; // status NÃO CONFERIDO = sem saldo do extrato
  aplicado: AplicadoMes[];
};

export type SaldoEdicao = { saldo_inicial: number; saldo_extrato: number | null };

const USAR_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function listarSaldos(): Promise<DadosSaldos> {
  if (USAR_MOCK) return listarSaldosMock();
  return (await api.get<DadosSaldos>("/api/saldos")).data;
}

export async function salvarSaldo(mes: string, conta: string, dados: SaldoEdicao): Promise<SaldoContaMes> {
  if (USAR_MOCK) return salvarSaldoMock(mes, conta, dados);
  return (await api.put<SaldoContaMes>("/api/saldos", { mes, conta, ...dados })).data;
}

export async function salvarAplicado(mes: string, saldo_final: number | null): Promise<AplicadoMes> {
  if (USAR_MOCK) return salvarAplicadoMock(mes, saldo_final);
  return (await api.put<AplicadoMes>("/api/saldos/aplicado", { mes, saldo_final })).data;
}
