import { api } from "./client";
import { atualizarMock, excluirMock, listarMock } from "../mock/lancamentos";

// ---------- Contrato com o back-end ----------
// GET    /api/lancamentos        -> Lancamento[]
// PATCH  /api/lancamentos/{id}   -> Lancamento   (corpo: LancamentoEdicao)
// DELETE /api/lancamentos/{id}   -> 204
// O back-end deve validar as MESMAS regras do front (veja validar() em lib/lancamentos.ts).
// Editar um lançamento NÃO muda a assinatura de importação dele: é ela que permite reimportar sem duplicar.

export type Tipo = "Receita" | "Despesa" | "Investimento";

export type Lancamento = {
  id: number;
  data: string; // AAAA-MM-DD
  banco: string; // "104 - Caixa"
  categoria: string;
  tipo: Tipo;
  descricao: string;
  observacao: string; // em "Aplicação Financeira": Investimento, Rendimento ou Resgate
  valor: number; // centavos, com sinal
};

export type LancamentoEdicao = Omit<Lancamento, "id">;

const USAR_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function listarLancamentos(simular = ""): Promise<Lancamento[]> {
  if (USAR_MOCK) return listarMock(simular);
  return (await api.get<Lancamento[]>("/api/lancamentos")).data;
}

export async function atualizarLancamento(id: number, dados: LancamentoEdicao): Promise<Lancamento> {
  if (USAR_MOCK) return atualizarMock(id, dados);
  return (await api.patch<Lancamento>(`/api/lancamentos/${id}`, dados)).data;
}

export async function excluirLancamento(id: number): Promise<void> {
  if (USAR_MOCK) return excluirMock(id);
  await api.delete(`/api/lancamentos/${id}`);
}
