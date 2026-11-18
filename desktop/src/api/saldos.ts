import { api } from "./client";
import { USAR_MOCK } from "../lib/mock";
import { listarSaldosMock } from "../mock/saldos";
import type { SaldoAplicadoMes, SaldoContaMes } from "./dashboard";

// ---------- Contrato com o back-end ----------
// GET /api/saldos -> DadosSaldos        (qualquer usuário logado e ativo)
//
// SOMENTE CONSULTA, por decisão: NÃO existe rota para gravar ou editar saldos.
// Os saldos vêm do extrato na importação (docs/regra-saldos.md) ou são calculados dos lançamentos.
// Se um dia for preciso editar saldos, siga antes docs/seguranca-saldos.md (histórico, justificativa e fechamento de mês).

export type AplicadoMes = SaldoAplicadoMes & {
  calculado: number; // saldo final calculado (aplicações menos resgates, acumulado)
};

export type DadosSaldos = {
  contas: string[];
  meses: string[];
  saldos: SaldoContaMes[]; // status NÃO CONFERIDO = sem saldo do extrato
  aplicado: AplicadoMes[];
};

export async function listarSaldos(): Promise<DadosSaldos> {
  if (USAR_MOCK) return listarSaldosMock();
  return (await api.get<DadosSaldos>("/api/saldos")).data;
}
