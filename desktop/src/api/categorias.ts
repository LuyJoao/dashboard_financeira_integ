import { api } from "./client";
import { atualizarCategoriaMock, criarCategoriaMock, excluirCategoriaMock, listarCategoriasMock } from "../mock/categorias";

// ---------- Contrato com o back-end ----------
// GET    /api/categorias        -> Categoria[]   (qualquer usuário logado: alimenta os formulários e filtros)
// POST   /api/categorias        -> Categoria     (ADMIN; corpo: { nome })
// PATCH  /api/categorias/{id}   -> Categoria     (ADMIN; corpo: { nome }). A categoria de sistema não pode ser renomeada (409).
// DELETE /api/categorias/{id}   -> 204           (ADMIN). 409 se for de sistema ou estiver em uso por lançamentos.
// O nome é único, ignorando maiúsculas e minúsculas. Renomear muda o nome em todos os lançamentos (relação por id).
// A categoria "Aplicação Financeira" é do sistema: o dashboard a usa para separar aplicações, resgates e rendimentos.

export type Categoria = {
  id: number;
  nome: string;
  sistema: boolean; // não pode ser renomeada nem excluída
  em_uso: number; // quantidade de lançamentos que usam a categoria
};

const USAR_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function listarCategorias(): Promise<Categoria[]> {
  if (USAR_MOCK) return listarCategoriasMock();
  return (await api.get<Categoria[]>("/api/categorias")).data;
}

export async function criarCategoria(nome: string): Promise<Categoria> {
  if (USAR_MOCK) return criarCategoriaMock(nome);
  return (await api.post<Categoria>("/api/categorias", { nome })).data;
}

export async function atualizarCategoria(id: number, nome: string): Promise<Categoria> {
  if (USAR_MOCK) return atualizarCategoriaMock(id, nome);
  return (await api.patch<Categoria>(`/api/categorias/${id}`, { nome })).data;
}

export async function excluirCategoria(id: number): Promise<void> {
  if (USAR_MOCK) return excluirCategoriaMock(id);
  await api.delete(`/api/categorias/${id}`);
}
