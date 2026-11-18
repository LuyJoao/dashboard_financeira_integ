import type { DadosSaldos } from "../api/saldos";
import { montarDadosDashboardMock } from "../api/dashboardMock";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
