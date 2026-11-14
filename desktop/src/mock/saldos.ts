import type { AplicadoMes, DadosSaldos, SaldoEdicao } from "../api/saldos";
import type { SaldoContaMes } from "../api/dashboard";
import { montarDadosDashboardMock } from "../api/dashboardMock";
import { definirOverrideAplicado, definirOverrideSaldo } from "./saldosOverrides";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function aplicadoDoMes(mes: string): AplicadoMes {
  const { dados, aplicadoExtra } = montarDadosDashboardMock();
  const a = dados.aplicado.find((x) => x.mes === mes);
  if (!a) throw new Error("Mês não encontrado.");
  return { ...a, ...aplicadoExtra[mes] };
}

export async function listarSaldosMock(): Promise<DadosSaldos> {
  await esperar(400);
  const { dados, aplicadoExtra } = montarDadosDashboardMock();
  return {
    contas: dados.contas,
    meses: dados.meses,
    saldos: dados.saldos,
    aplicado: dados.aplicado.map((a) => ({ ...a, ...aplicadoExtra[a.mes] })),
  };
}

export async function salvarSaldoMock(mes: string, conta: string, dados: SaldoEdicao): Promise<SaldoContaMes> {
  await esperar(400);
  if (!Number.isInteger(dados.saldo_inicial) || (dados.saldo_extrato !== null && !Number.isInteger(dados.saldo_extrato))) {
    throw new Error("Valor inválido.");
  }
  definirOverrideSaldo(mes, conta, dados);
  const linha = montarDadosDashboardMock().dados.saldos.find((s) => s.mes === mes && s.conta === conta);
  if (!linha) throw new Error("Mês ou conta não encontrado.");
  return linha;
}

export async function salvarAplicadoMock(mes: string, saldoFinal: number | null): Promise<AplicadoMes> {
  await esperar(400);
  if (saldoFinal !== null && !Number.isInteger(saldoFinal)) throw new Error("Valor inválido.");
  definirOverrideAplicado(mes, saldoFinal);
  return aplicadoDoMes(mes);
}
