import { api } from "./client";
import { atualizarTituloMock, criarTituloMock, excluirTituloMock, listarTitulosMock } from "../mock/titulos";

// ---------- Contrato com o back-end ----------
// GET    /api/titulos        -> Titulo[]
// POST   /api/titulos        -> Titulo  (corpo: TituloEdicao)
// PATCH  /api/titulos/{id}   -> Titulo  (corpo: TituloEdicao; marcar como pago = enviar pago_em; desfazer = pago_em null)
// DELETE /api/titulos/{id}   -> 204
// Usuário comum e admin podem lançar títulos. O back-end valida as mesmas regras de validarTitulo() em lib/titulos.ts.
// O status (a vencer, vence hoje, vencido, pago) e o atraso são CALCULADOS: não existem como coluna.

export type TipoTitulo = "pagar" | "receber";
export type FormaTitulo = "NF" | "Boleto";

export type Titulo = {
  id: number;
  tipo: TipoTitulo;
  empresa_id: number;
  empresa_nome: string; // vem junto para a lista
  forma: FormaTitulo;
  numero: string; // número da NF ou do boleto
  descricao: string;
  valor: number; // centavos, sempre positivo (o tipo diz se é a pagar ou a receber)
  vencimento: string; // AAAA-MM-DD
  pago_em: string | null; // AAAA-MM-DD, marcado à mão
};

export type TituloEdicao = Omit<Titulo, "id" | "empresa_nome">;

const USAR_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function listarTitulos(simular = ""): Promise<Titulo[]> {
  if (USAR_MOCK) return listarTitulosMock(simular);
  return (await api.get<Titulo[]>("/api/titulos")).data;
}

export async function criarTitulo(dados: TituloEdicao): Promise<Titulo> {
  if (USAR_MOCK) return criarTituloMock(dados);
  return (await api.post<Titulo>("/api/titulos", dados)).data;
}

export async function atualizarTitulo(id: number, dados: TituloEdicao): Promise<Titulo> {
  if (USAR_MOCK) return atualizarTituloMock(id, dados);
  return (await api.patch<Titulo>(`/api/titulos/${id}`, dados)).data;
}

export async function excluirTitulo(id: number): Promise<void> {
  if (USAR_MOCK) return excluirTituloMock(id);
  await api.delete(`/api/titulos/${id}`);
}
