import { api } from "./client";
import { buscarDashboardMock } from "./dashboardMock";

// ---------- Contrato com o back-end ----------
// GET /api/dashboard  ->  DadosDashboard
// A API devolve linhas JÁ AGREGADAS por (mês, conta, categoria, movimento); o front filtra por mês, conta e categoria.
// Valores em CENTAVOS, com o sinal original (despesas negativas).
// "movimento" só é preenchido na categoria "Aplicação Financeira":
//   "aplicacao" = dinheiro que saiu da conta para investir, "resgate" = voltou do investimento, "rendimento" = rendimento.
// Nas demais categorias é null.

export type Movimento = "aplicacao" | "resgate" | "rendimento";

export type LinhaResumo = {
  mes: string; // "Jan/26"
  conta: string; // "104 - Caixa"
  categoria: string;
  movimento: Movimento | null;
  receitas: number; // soma dos valores positivos
  despesas: number; // soma dos valores negativos (negativo)
};

export type SaldoContaMes = {
  mes: string;
  conta: string;
  saldo_inicial: number; // informado
  entradas: number;
  saidas: number; // negativo
  saldo_final: number; // calculado: inicial + entradas + saídas
  saldo_informado: number; // do extrato; em mês sem extrato (só lançamentos manuais) é o saldo calculado
  diferenca: number; // ARRED(calculado − informado; 2)
  status: "OK" | "DIVERGÊNCIA" | "NÃO CONFERIDO"; // NÃO CONFERIDO = não há saldo do extrato (saldo calculado dos lançamentos)
};

export type SaldoAplicadoMes = { mes: string; saldo_inicial: number; saldo_final: number }; // informado no sistema

export type DadosDashboard = {
  instituicao: string;
  atualizado_em: string; // data e hora da última importação
  contas: string[];
  categorias: string[];
  meses: string[]; // em ordem cronológica
  resumo: LinhaResumo[];
  saldos: SaldoContaMes[];
  aplicado: SaldoAplicadoMes[];
};

// Enquanto o back-end não existe, usa dados de exemplo. Para usar a API de verdade: VITE_USE_MOCK=false no desktop/.env
const USAR_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function buscarDashboard(): Promise<DadosDashboard> {
  if (USAR_MOCK) return buscarDashboardMock();
  return (await api.get<DadosDashboard>("/api/dashboard")).data;
}
