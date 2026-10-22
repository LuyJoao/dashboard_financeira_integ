import { api } from "./client";
import { buscarDashboardMock } from "./dashboardMock";

// ---------- Contrato com o back-end ----------
// GET /api/dashboard  ->  DadosDashboard
// Todos os valores em CENTAVOS, com o sinal original (despesas negativas).
// "receitas" e "despesas" NÃO incluem o principal de aplicações e resgates (vêm em "aplicacoes" e "resgates").
// Rendimentos de aplicação entram em "receitas" (categoria "Rendimentos de Aplicações").

export type ResumoMes = {
  mes: string; // "Jan/26"
  receitas: number;
  despesas: number; // negativo
  aplicacoes: number; // negativo: dinheiro que saiu da conta para investir
  resgates: number; // positivo: dinheiro que voltou do investimento
};

export type ResumoCategoria = { categoria: string; receitas: number; despesas: number }; // despesas negativo

export type SaldoContaMes = {
  mes: string;
  conta: string; // "104 - Caixa"
  saldo_inicial: number;
  entradas: number;
  saidas: number; // negativo
  saldo_final: number; // calculado pelos lançamentos
  saldo_informado: number; // do extrato
  diferenca: number;
  status: "OK" | "DIVERGÊNCIA";
};

export type DadosDashboard = {
  instituicao: string;
  atualizado_em: string; // data e hora da última importação
  contas: string[];
  meses: ResumoMes[];
  categorias: ResumoCategoria[];
  saldos: SaldoContaMes[];
};

// Enquanto o back-end não existe, usa dados de exemplo. Para usar a API de verdade: VITE_USE_MOCK=false no desktop/.env
const USAR_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function buscarDashboard(): Promise<DadosDashboard> {
  if (USAR_MOCK) return buscarDashboardMock();
  return (await api.get<DadosDashboard>("/api/dashboard")).data;
}
